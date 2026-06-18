"""
CraftMen PDF Extraction Microservice
FastAPI + Claude — extracts positions from Leistungsverzeichnisse (GAEB/PDF)
"""

import os
import re
import json
import httpx
import asyncio
import pdfplumber
from io import BytesIO
import base64
import logging
from fastapi import FastAPI, HTTPException, BackgroundTasks, Header
from pydantic import BaseModel, ValidationError
from supabase import create_client, Client
from typing import Optional
from dotenv import load_dotenv
from pdf2image import convert_from_bytes
import pytesseract

load_dotenv()

logger = logging.getLogger("pdf-service")
logging.basicConfig(level=os.environ.get("LOG_LEVEL", "INFO"))

app = FastAPI(title="CraftMen PDF Service", version="1.0.0", root_path=os.environ.get("FASTAPI_ROOT_PATH", ""))

SUPABASE_URL = os.environ["SUPABASE_URL"]
SUPABASE_SERVICE_KEY = os.environ["SUPABASE_SERVICE_ROLE_KEY"]
PDF_SERVICE_SECRET = os.environ["PDF_SERVICE_SECRET"]
ANTHROPIC_API_KEY = os.environ.get("ANTHROPIC_API_KEY")
ANTHROPIC_MODEL = os.environ.get("ANTHROPIC_MODEL", "claude-sonnet-4-6")
BUCKET_NAME = "leistungsverzeichnisse"
MIN_EXTRACTED_TEXT_LENGTH = 50

supabase: Client = create_client(SUPABASE_URL, SUPABASE_SERVICE_KEY)


class ExtractionRequest(BaseModel):
    lvId: str
    storagePath: str
    callbackUrl: str


class Base64ExtractionRequest(BaseModel):
    inquiryId: str
    fileName: str
    contentBase64: str
    callbackUrl: str


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


# ─── POSITION PARSER ─────────────────────────────────────────────────────────

POSITION_PATTERN = re.compile(
    r"""
    ^(?P<pos_num>\d{1,2}[.\-]\d{1,3}(?:[.\-]\d{1,3})?)
    \s+
    (?P<short_text>.+?)
    (?:\s{2,}(?P<unit>[a-zA-Z²³/]+(?:\s[a-zA-Z²³/]+)?))?
    (?:\s+(?P<qty>[\d,.]+))?
    $
    """,
    re.VERBOSE,
)

UNIT_KEYWORDS = {"m²", "m2", "m³", "m3", "m", "lm", "psch", "stk", "stück", "t", "kg", "l"}


def parse_quantity(raw: str) -> Optional[float]:
    if not raw:
        return None
    cleaned = raw.replace(".", "").replace(",", ".")
    try:
        return float(cleaned)
    except ValueError:
        return None


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


def _anthropic_headers() -> dict[str, str]:
    if not ANTHROPIC_API_KEY:
        raise ExtractionPipelineError("ANTHROPIC_API_KEY is not configured")
    return {
        "x-api-key": ANTHROPIC_API_KEY,
        "anthropic-version": "2023-06-01",
        "content-type": "application/json",
    }


def _parse_claude_positions(raw_text: str, stage: int) -> ExtractionResult:
    try:
        data = json.loads(raw_text)
        result = ExtractionResult(positions=data.get("positions", []), extraction_stage=stage)
    except (json.JSONDecodeError, ValidationError, AttributeError) as exc:
        raise ExtractionPipelineError(
            f"Claude returned invalid extraction JSON at stage {stage}: {exc}",
            retryable_json=True,
        ) from exc
    return result


async def _call_claude(messages: list[dict]) -> str:
    payload = {"model": ANTHROPIC_MODEL, "max_tokens": 8192, "temperature": 0, "messages": messages}
    async with httpx.AsyncClient(timeout=120) as client:
        response = await client.post("https://api.anthropic.com/v1/messages", headers=_anthropic_headers(), json=payload)
        response.raise_for_status()
        data = response.json()
    text_parts = [block.get("text", "") for block in data.get("content", []) if block.get("type") == "text"]
    text = "".join(text_parts).strip()
    if not text:
        raise ExtractionPipelineError("Claude returned an empty response")
    return text


async def call_claude_for_positions(messages: list[dict], stage: int) -> ExtractionResult:
    raw = await _call_claude(messages)
    try:
        return _parse_claude_positions(raw, stage)
    except ExtractionPipelineError as exc:
        if not exc.retryable_json:
            raise
        logger.warning("Claude returned invalid JSON at stage %s; retrying once", stage)

    retry_raw = await _call_claude(messages)
    return _parse_claude_positions(retry_raw, stage)


async def structure_text_with_claude(text: str, stage: int) -> ExtractionResult:
    return await call_claude_for_positions([
        {"role": "user", "content": f"{_position_schema_prompt()}\n\nPDF text:\n{text}"},
    ], stage)


def extract_text_with_pdfplumber(pdf_bytes: bytes) -> str:
    with pdfplumber.open(BytesIO(pdf_bytes)) as pdf:
        return "\n".join(page.extract_text() or "" for page in pdf.pages).strip()


def extract_text_with_ocr(pdf_bytes: bytes) -> str:
    pages = convert_from_bytes(pdf_bytes)
    return "\n".join(pytesseract.image_to_string(page) for page in pages).strip()


def pdf_pages_as_png_data(pdf_bytes: bytes) -> list[str]:
    images = []
    for page in convert_from_bytes(pdf_bytes):
        buf = BytesIO()
        page.save(buf, format="PNG")
        images.append(base64.b64encode(buf.getvalue()).decode("ascii"))
    return images


async def extract_with_claude_vision(pdf_bytes: bytes) -> ExtractionResult:
    content: list[dict] = [{"type": "text", "text": _position_schema_prompt()}]
    content.extend(
        {"type": "image", "source": {"type": "base64", "media_type": "image/png", "data": image}}
        for image in pdf_pages_as_png_data(pdf_bytes)
    )
    return await call_claude_for_positions([{"role": "user", "content": content}], 3)


async def extract_from_pdf_bytes(pdf_bytes: bytes) -> ExtractionResult:
    stage_errors: list[str] = []

    try:
        text = extract_text_with_pdfplumber(pdf_bytes)
        if len(text) >= MIN_EXTRACTED_TEXT_LENGTH:
            logger.info("PDF extraction succeeded with stage 1 (pdfplumber)")
            return await structure_text_with_claude(text, 1)
        stage_errors.append(f"stage 1 produced only {len(text)} characters")
    except ExtractionPipelineError as exc:
        if exc.retryable_json:
            raise
        stage_errors.append(f"stage 1 failed: {exc}")
    except Exception as exc:
        stage_errors.append(f"stage 1 failed: {exc}")
    logger.info("PDF extraction stage 1 unavailable; falling back to stage 2")

    try:
        text = extract_text_with_ocr(pdf_bytes)
        if text.strip():
            logger.info("PDF extraction succeeded with stage 2 (pytesseract OCR)")
            return await structure_text_with_claude(text, 2)
        stage_errors.append("stage 2 produced empty OCR text")
    except ExtractionPipelineError as exc:
        if exc.retryable_json:
            raise
        stage_errors.append(f"stage 2 failed: {exc}")
    except Exception as exc:
        stage_errors.append(f"stage 2 failed: {exc}")
    logger.info("PDF extraction stage 2 unavailable; falling back to stage 3")

    try:
        result = await extract_with_claude_vision(pdf_bytes)
        logger.info("PDF extraction succeeded with stage 3 (Claude Vision)")
        return result
    except Exception as exc:
        stage_errors.append(f"stage 3 failed: {exc}")
        logger.exception("PDF extraction failed in stage 3 (Claude Vision)")
        raise ExtractionPipelineError("All PDF extraction stages failed", stage_errors) from exc


# ─── ROUTES ──────────────────────────────────────────────────────────────────

@app.get("/health")
def health():
    return {"status": "ok", "service": "pdf-extractor"}


@app.post("/extract")
async def extract(request: ExtractionRequest, background_tasks: BackgroundTasks):
    background_tasks.add_task(process_extraction, request)
    return {"accepted": True, "lvId": request.lvId}


async def process_extraction(request: ExtractionRequest):
    try:
        response = supabase.storage.from_(BUCKET_NAME).download(request.storagePath)
        pdf_bytes = response

        result = await extract_from_pdf_bytes(pdf_bytes)

        payload = {
            "lvId": request.lvId,
            "secret": PDF_SERVICE_SECRET,
            "success": True,
            "positions": [p.model_dump() for p in result.positions],
            "extraction_stage": result.extraction_stage,
        }
    except ExtractionPipelineError as exc:
        payload = {
            "lvId": request.lvId,
            "secret": PDF_SERVICE_SECRET,
            "success": False,
            "status": 422,
            "error": exc.message,
            "details": exc.stage_errors,
        }
    except Exception as exc:
        payload = {
            "lvId": request.lvId,
            "secret": PDF_SERVICE_SECRET,
            "success": False,
            "status": 422,
            "error": str(exc),
        }

    async with httpx.AsyncClient(timeout=30) as client:
        for attempt in range(3):
            try:
                await client.post(request.callbackUrl, json=payload)
                break
            except Exception:
                await asyncio.sleep(2**attempt)


@app.post("/extract-from-base64")
async def extract_from_base64(
    request: Base64ExtractionRequest,
    background_tasks: BackgroundTasks,
    x_service_secret: Optional[str] = Header(None),
):
    if x_service_secret != PDF_SERVICE_SECRET:
        raise HTTPException(status_code=403, detail="Forbidden")
    background_tasks.add_task(process_base64_extraction, request)
    return {"accepted": True, "inquiryId": request.inquiryId}


async def process_base64_extraction(request: Base64ExtractionRequest):
    try:
        pdf_bytes = base64.b64decode(request.contentBase64)
        result = await extract_from_pdf_bytes(pdf_bytes)

        payload = {
            "inquiryId": request.inquiryId,
            "secret": PDF_SERVICE_SECRET,
            "success": True,
            "positions": [p.model_dump() for p in result.positions],
            "extraction_stage": result.extraction_stage,
        }
    except ExtractionPipelineError as exc:
        payload = {
            "inquiryId": request.inquiryId,
            "secret": PDF_SERVICE_SECRET,
            "success": False,
            "status": 422,
            "error": exc.message,
            "details": exc.stage_errors,
        }
    except Exception as exc:
        payload = {
            "inquiryId": request.inquiryId,
            "secret": PDF_SERVICE_SECRET,
            "success": False,
            "status": 422,
            "error": str(exc),
        }

    async with httpx.AsyncClient(timeout=30) as client:
        for attempt in range(3):
            try:
                await client.post(request.callbackUrl, json=payload)
                break
            except Exception:
                await asyncio.sleep(2**attempt)
