"""Shared PDF extraction utilities for Vercel serverless functions."""

import base64
import json
import logging
import os
from io import BytesIO
from typing import Optional
import urllib.request

import pdfplumber
from pdf2image import convert_from_bytes
import pytesseract
from pydantic import BaseModel, ValidationError

logger = logging.getLogger(__name__)

ANTHROPIC_API_KEY = os.environ.get("ANTHROPIC_API_KEY")
ANTHROPIC_MODEL = os.environ.get("ANTHROPIC_MODEL", "claude-sonnet-4-6")
MIN_EXTRACTED_TEXT_LENGTH = 50


class ExtractedPosition(BaseModel):
    positionNumber: str
    shortText: str
    longText: Optional[str] = None
    unit: Optional[str] = None
    quantity: Optional[float] = None
    trade: Optional[str] = None
    sortOrder: int


class ExtractionResult(BaseModel):
    positions: list[ExtractedPosition]
    extraction_stage: int


class ExtractionPipelineError(Exception):
    def __init__(
        self,
        message: str,
        stage_errors: Optional[list[str]] = None,
        retryable_json: bool = False,
    ):
        super().__init__(message)
        self.message = message
        self.stage_errors = stage_errors or []
        self.retryable_json = retryable_json


# ─── Kostenloser lokaler Parser (Stufe 0, ohne KI) ─────────────────────────────
# Spiegelt die Einheiten aus src/lib/utils/units.ts. Erkennt Positionen
# tabellarischer Leistungsverzeichnisse direkt aus dem pdfplumber-Text – ohne
# einen Claude-Aufruf, spart also API-Kosten.
_LOCAL_UNIT_ALIASES = {
    "m2": "m²", "qm": "m²", "m²": "m²",
    "m3": "m³", "cbm": "m³", "m³": "m³",
    "m": "m", "lfm": "lfm", "lfdm": "lfm", "lm": "lfm", "laufmeter": "lfm",
    "km": "km", "stk": "Stk", "st": "Stk", "stck": "Stk", "stück": "Stk", "stueck": "Stk",
    "psch": "psch", "pausch": "psch", "pauschal": "psch",
    "t": "t", "to": "t", "tonne": "t", "kg": "kg", "g": "g",
    "l": "l", "ltr": "l", "liter": "l",
    "h": "h", "std": "h", "stunde": "h", "stunden": "h",
    "tag": "Tag", "tage": "Tag",
}
# Längere Einheiten zuerst, damit z.B. "m²" vor "m" greift.
_LOCAL_UNIT_RE = "|".join(re.escape(u) for u in sorted(_LOCAL_UNIT_ALIASES, key=len, reverse=True))
_LOCAL_POS_NUM_RE = re.compile(r"^\s*(\d{1,4}(?:[.\-]\d{1,4}){1,3})\s+(\S.*)$")
_LOCAL_QTY_UNIT_RE = re.compile(
    r"(?P<qty>\d{1,3}(?:\.\d{3})*(?:,\d+)?|\d+(?:[.,]\d+)?)\s*(?P<unit>" + _LOCAL_UNIT_RE + r")(?![A-Za-zÄÖÜäöü])",
    re.IGNORECASE,
)
MIN_LOCAL_POSITIONS = 3


def _parse_local_quantity(raw: str) -> Optional[float]:
    # Deutsches Zahlformat: 1.234,56 → 1234.56
    cleaned = raw.strip().replace(".", "").replace(",", ".")
    try:
        return float(cleaned)
    except ValueError:
        return None


def _canonical_local_unit(raw: str) -> Optional[str]:
    return _LOCAL_UNIT_ALIASES.get(raw.strip().rstrip(".").lower())


def _parse_positions_locally(text: str) -> list[ExtractedPosition]:
    """Regex-Parser über den pdfplumber-Text – kostenlos, ohne KI. Erfasst nur
    Zeilen mit Ordnungszahl + Menge + Einheit, um Fehltreffer (Überschriften,
    Datumsangaben) zu vermeiden. Reicht die Trefferzahl nicht, übernimmt Claude."""
    positions: list[ExtractedPosition] = []
    for line in text.splitlines():
        m = _LOCAL_POS_NUM_RE.match(line)
        if not m:
            continue
        pos_num, rest = m.group(1), m.group(2).strip()
        # Letzte Menge+Einheit nehmen – in tabellarischen LV stehen sie am
        # Zeilenende, während frühere Treffer aus dem Beschreibungstext stammen
        # (z.B. "H 3-4m").
        matches = list(_LOCAL_QTY_UNIT_RE.finditer(rest))
        if not matches:
            continue
        qm = matches[-1]
        qty = _parse_local_quantity(qm.group("qty"))
        if qty is None:
            continue
        short_text = rest[: qm.start()].strip(" .\t-–") or rest
        positions.append(
            ExtractedPosition(
                positionNumber=pos_num,
                shortText=short_text,
                longText=None,
                unit=_canonical_local_unit(qm.group("unit")),
                quantity=qty,
                trade=None,
                sortOrder=len(positions),
            )
        )
    return positions


def _position_schema_prompt() -> str:
    return """
Return only valid JSON with this exact shape:
{
  "positions": [
    {
      "positionNumber": "string",
      "shortText": "string",
      "longText": "string or null",
      "unit": "string or null",
      "quantity": 0.0,
      "trade": "string or null",
      "sortOrder": 0
    }
  ]
}
Extract every bill-of-quantities line item. Use null for unknown optional fields.
Do not include markdown, comments, explanations, or trailing commas.
""".strip()


def _call_claude(messages: list[dict]) -> str:
    if not ANTHROPIC_API_KEY:
        raise ExtractionPipelineError("ANTHROPIC_API_KEY is not configured")
    payload = json.dumps({"model": ANTHROPIC_MODEL, "max_tokens": 8192, "temperature": 0, "messages": messages}).encode()
    req = urllib.request.Request(
        "https://api.anthropic.com/v1/messages",
        data=payload,
        headers={
            "x-api-key": ANTHROPIC_API_KEY,
            "anthropic-version": "2023-06-01",
            "content-type": "application/json",
        },
        method="POST",
    )
    with urllib.request.urlopen(req, timeout=120) as response:
        data = json.loads(response.read())
    text = "".join(block.get("text", "") for block in data.get("content", []) if block.get("type") == "text").strip()
    if not text:
        raise ExtractionPipelineError("Claude returned an empty response")
    return text


def _parse_claude_positions(raw_text: str, stage: int) -> ExtractionResult:
    try:
        data = json.loads(raw_text)
        return ExtractionResult(positions=data.get("positions", []), extraction_stage=stage)
    except (json.JSONDecodeError, ValidationError, AttributeError) as exc:
        raise ExtractionPipelineError(
            f"Claude returned invalid extraction JSON at stage {stage}: {exc}",
            retryable_json=True,
        ) from exc


def _call_claude_for_positions(messages: list[dict], stage: int) -> ExtractionResult:
    raw = _call_claude(messages)
    try:
        return _parse_claude_positions(raw, stage)
    except ExtractionPipelineError as exc:
        if not exc.retryable_json:
            raise
        logger.warning("Claude returned invalid JSON at stage %s; retrying once", stage)

    retry_raw = _call_claude(messages)
    return _parse_claude_positions(retry_raw, stage)


def _structure_text_with_claude(text: str, stage: int) -> ExtractionResult:
    return _call_claude_for_positions(
        [{"role": "user", "content": f"{_position_schema_prompt()}\n\nPDF text:\n{text}"}],
        stage,
    )


def _extract_text_with_pdfplumber(pdf_bytes: bytes) -> str:
    with pdfplumber.open(BytesIO(pdf_bytes)) as pdf:
        return "\n".join(page.extract_text() or "" for page in pdf.pages).strip()


def _extract_text_with_ocr(pdf_bytes: bytes) -> str:
    pages = convert_from_bytes(pdf_bytes)
    return "\n".join(pytesseract.image_to_string(page) for page in pages).strip()


def _extract_with_claude_pdf(pdf_bytes: bytes) -> ExtractionResult:
    # PDF nativ als Dokument an Claude schicken (kein poppler/pdf2image nötig –
    # funktioniert daher auch in Serverless-Umgebungen ohne poppler-Binary).
    pdf_b64 = base64.b64encode(pdf_bytes).decode("ascii")
    content: list[dict] = [
        {"type": "document", "source": {"type": "base64", "media_type": "application/pdf", "data": pdf_b64}},
        {"type": "text", "text": _position_schema_prompt()},
    ]
    return _call_claude_for_positions([{"role": "user", "content": content}], 3)


def extract_from_pdf_bytes(pdf_bytes: bytes) -> dict:
    stage_errors: list[str] = []

    # Gemeinsamer pdfplumber-Text für Stufe 0 (lokal) und Stufe 1 (Claude).
    text = ""
    try:
        text = _extract_text_with_pdfplumber(pdf_bytes)
    except Exception as exc:
        stage_errors.append(f"stage 1 text extraction failed: {exc}")

    if len(text) >= MIN_EXTRACTED_TEXT_LENGTH:
        # Stufe 0: kostenloser lokaler Parser (keine KI-Kosten).
        try:
            local = _parse_positions_locally(text)
            if len(local) >= MIN_LOCAL_POSITIONS:
                logger.info("PDF extraction succeeded with stage 0 (local parser, no AI)")
                return ExtractionResult(positions=local, extraction_stage=0).model_dump()
            stage_errors.append(f"stage 0 (local parser) found only {len(local)} positions")
        except Exception as exc:
            stage_errors.append(f"stage 0 (local parser) failed: {exc}")

        # Stufe 1: Claude strukturiert den extrahierten Text.
        try:
            logger.info("PDF extraction using stage 1 (pdfplumber + Claude)")
            return _structure_text_with_claude(text, 1).model_dump()
        except ExtractionPipelineError as exc:
            if exc.retryable_json:
                raise
            stage_errors.append(f"stage 1 failed: {exc}")
        except Exception as exc:
            stage_errors.append(f"stage 1 failed: {exc}")
    else:
        stage_errors.append(f"stage 1 produced only {len(text)} characters")
    logger.info("PDF extraction stages 0/1 unavailable; falling back to stage 2")

    try:
        text = _extract_text_with_ocr(pdf_bytes)
        if text.strip():
            logger.info("PDF extraction succeeded with stage 2 (pytesseract OCR)")
            return _structure_text_with_claude(text, 2).model_dump()
        stage_errors.append("stage 2 produced empty OCR text")
    except ExtractionPipelineError as exc:
        if exc.retryable_json:
            raise
        stage_errors.append(f"stage 2 failed: {exc}")
    except Exception as exc:
        stage_errors.append(f"stage 2 failed: {exc}")
    logger.info("PDF extraction stage 2 unavailable; falling back to stage 3")

    try:
        result = _extract_with_claude_pdf(pdf_bytes).model_dump()
        logger.info("PDF extraction succeeded with stage 3 (Claude native PDF)")
        return result
    except Exception as exc:
        stage_errors.append(f"stage 3 failed: {exc}")
        logger.exception("PDF extraction failed in stage 3 (Claude native PDF)")
        raise ExtractionPipelineError(
            "All PDF extraction stages failed: " + " | ".join(stage_errors),
            stage_errors,
        ) from exc
