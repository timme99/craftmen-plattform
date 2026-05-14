"""
CraftMen PDF Extraction — Vercel Serverless Version
Synchronous: extraction + callback happen within the single request lifecycle.
"""

import os
import re
import base64
import httpx
import pdfplumber
from io import BytesIO
from fastapi import FastAPI, HTTPException, Header
from pydantic import BaseModel
from supabase import create_client, Client
from typing import Optional
from dotenv import load_dotenv

load_dotenv()

app = FastAPI(
    title="CraftMen PDF Service",
    version="1.0.0",
    root_path=os.environ.get("FASTAPI_ROOT_PATH", "/_/pdf-service"),
)

SUPABASE_URL = os.environ["SUPABASE_URL"]
SUPABASE_SERVICE_KEY = os.environ["SUPABASE_SERVICE_ROLE_KEY"]
PDF_SERVICE_SECRET = os.environ["PDF_SERVICE_SECRET"]
BUCKET_NAME = "leistungsverzeichnisse"

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


# ─── POSITION PARSER ─────────────────────────────────────────────────────────

POSITION_PATTERN = re.compile(
    r"""
    ^(?P<pos_num>\d{1,2}[.\-]\d{1,3}(?:[.\-]\d{1,3})?)   # e.g. 1.1 / 01.010 / 1-010
    \s+
    (?P<short_text>.+?)                                     # short description
    (?:\s{2,}(?P<unit>[a-zA-Z²³/]+(?:\s[a-zA-Z²³/]+)?))?  # optional unit
    (?:\s+(?P<qty>[\d,.]+))?                                # optional quantity
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


def extract_positions_from_text(text: str) -> list[ExtractedPosition]:
    positions = []
    lines = text.splitlines()
    current_pos: Optional[dict] = None
    long_text_lines: list[str] = []
    sort_order = 0

    for line in lines:
        stripped = line.strip()
        if not stripped:
            if current_pos and long_text_lines:
                current_pos["longText"] = " ".join(long_text_lines).strip()
                long_text_lines = []
            continue

        match = POSITION_PATTERN.match(stripped)
        if match:
            if current_pos:
                if long_text_lines:
                    current_pos["longText"] = " ".join(long_text_lines).strip()
                positions.append(ExtractedPosition(**current_pos))
                long_text_lines = []

            current_pos = {
                "positionNumber": match.group("pos_num"),
                "shortText": match.group("short_text").strip(),
                "unit": match.group("unit"),
                "quantity": parse_quantity(match.group("qty") or ""),
                "sortOrder": sort_order,
            }
            sort_order += 1
        elif current_pos:
            parts = stripped.split()
            if len(parts) <= 3 and parts[0].lower() in UNIT_KEYWORDS:
                current_pos["unit"] = parts[0]
                if len(parts) > 1:
                    current_pos["quantity"] = parse_quantity(parts[1])
            else:
                long_text_lines.append(stripped)

    if current_pos:
        if long_text_lines:
            current_pos["longText"] = " ".join(long_text_lines).strip()
        positions.append(ExtractedPosition(**current_pos))

    return positions


def extract_from_pdf_bytes(pdf_bytes: bytes) -> list[ExtractedPosition]:
    positions = []
    with pdfplumber.open(BytesIO(pdf_bytes)) as pdf:
        full_text = ""
        for page in pdf.pages:
            tables = page.extract_tables()
            for table in tables:
                for row in table:
                    if not row or not row[0]:
                        continue
                    pos_num = str(row[0]).strip()
                    if re.match(r"^\d+[.\-]\d+", pos_num):
                        positions.append(
                            ExtractedPosition(
                                positionNumber=pos_num,
                                shortText=str(row[1] or "").strip()[:200],
                                unit=str(row[2] or "").strip() if len(row) > 2 else None,
                                quantity=parse_quantity(str(row[3] or "")),
                                sortOrder=len(positions),
                            )
                        )
            full_text += (page.extract_text() or "") + "\n"

        if not positions and full_text.strip():
            positions = extract_positions_from_text(full_text)

    return positions


# ─── ROUTES ──────────────────────────────────────────────────────────────────

@app.get("/health")
def health():
    return {"status": "ok", "service": "pdf-extractor"}


@app.post("/extract")
async def extract(request: ExtractionRequest):
    try:
        pdf_bytes = supabase.storage.from_(BUCKET_NAME).download(request.storagePath)
        positions = extract_from_pdf_bytes(pdf_bytes)
        payload = {
            "lvId": request.lvId,
            "secret": PDF_SERVICE_SECRET,
            "success": True,
            "positions": [p.model_dump() for p in positions],
        }
    except Exception as exc:
        payload = {
            "lvId": request.lvId,
            "secret": PDF_SERVICE_SECRET,
            "success": False,
            "error": str(exc),
        }

    async with httpx.AsyncClient(timeout=30) as client:
        await client.post(request.callbackUrl, json=payload)

    return {"ok": True}


@app.post("/extract-from-base64")
async def extract_from_base64(
    request: Base64ExtractionRequest,
    x_service_secret: Optional[str] = Header(None),
):
    if x_service_secret != PDF_SERVICE_SECRET:
        raise HTTPException(status_code=403, detail="Forbidden")

    try:
        pdf_bytes = base64.b64decode(request.contentBase64)
        positions = extract_from_pdf_bytes(pdf_bytes)
        payload = {
            "inquiryId": request.inquiryId,
            "secret": PDF_SERVICE_SECRET,
            "success": True,
            "positions": [p.model_dump() for p in positions],
        }
    except Exception as exc:
        payload = {
            "inquiryId": request.inquiryId,
            "secret": PDF_SERVICE_SECRET,
            "success": False,
            "error": str(exc),
        }

    async with httpx.AsyncClient(timeout=30) as client:
        await client.post(request.callbackUrl, json=payload)

    return {"ok": True}
