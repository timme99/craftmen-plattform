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


def _pdf_pages_as_png_data(pdf_bytes: bytes) -> list[str]:
    images = []
    for page in convert_from_bytes(pdf_bytes):
        buf = BytesIO()
        page.save(buf, format="PNG")
        images.append(base64.b64encode(buf.getvalue()).decode("ascii"))
    return images


def _extract_with_claude_vision(pdf_bytes: bytes) -> ExtractionResult:
    content: list[dict] = [{"type": "text", "text": _position_schema_prompt()}]
    content.extend(
        {"type": "image", "source": {"type": "base64", "media_type": "image/png", "data": image}}
        for image in _pdf_pages_as_png_data(pdf_bytes)
    )
    return _call_claude_for_positions([{"role": "user", "content": content}], 3)


def extract_from_pdf_bytes(pdf_bytes: bytes) -> dict:
    stage_errors: list[str] = []
    try:
        text = _extract_text_with_pdfplumber(pdf_bytes)
        if len(text) >= MIN_EXTRACTED_TEXT_LENGTH:
            logger.info("PDF extraction succeeded with stage 1 (pdfplumber)")
            return _structure_text_with_claude(text, 1).model_dump()
        stage_errors.append(f"stage 1 produced only {len(text)} characters")
    except ExtractionPipelineError as exc:
        if exc.retryable_json:
            raise
        stage_errors.append(f"stage 1 failed: {exc}")
    except Exception as exc:
        stage_errors.append(f"stage 1 failed: {exc}")
    logger.info("PDF extraction stage 1 unavailable; falling back to stage 2")

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
        result = _extract_with_claude_vision(pdf_bytes).model_dump()
        logger.info("PDF extraction succeeded with stage 3 (Claude Vision)")
        return result
    except Exception as exc:
        stage_errors.append(f"stage 3 failed: {exc}")
        logger.exception("PDF extraction failed in stage 3 (Claude Vision)")
        raise ExtractionPipelineError("All PDF extraction stages failed", stage_errors) from exc
