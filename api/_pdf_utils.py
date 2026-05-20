"""Shared PDF extraction utilities for Vercel serverless functions."""

import re
import pdfplumber
from io import BytesIO
from typing import Optional

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


def _positions_from_text(text: str) -> list[dict]:
    positions = []
    lines = text.splitlines()
    current: Optional[dict] = None
    long_lines: list[str] = []
    order = 0

    for line in lines:
        s = line.strip()
        if not s:
            if current and long_lines:
                current["longText"] = " ".join(long_lines).strip()
                long_lines = []
            continue

        m = POSITION_PATTERN.match(s)
        if m:
            if current:
                if long_lines:
                    current["longText"] = " ".join(long_lines).strip()
                positions.append(current)
                long_lines = []
            current = {
                "positionNumber": m.group("pos_num"),
                "shortText": m.group("short_text").strip(),
                "unit": m.group("unit"),
                "quantity": parse_quantity(m.group("qty") or ""),
                "longText": None,
                "trade": None,
                "sortOrder": order,
            }
            order += 1
        elif current:
            parts = s.split()
            if len(parts) <= 3 and parts[0].lower() in UNIT_KEYWORDS:
                current["unit"] = parts[0]
                if len(parts) > 1:
                    current["quantity"] = parse_quantity(parts[1])
            else:
                long_lines.append(s)

    if current:
        if long_lines:
            current["longText"] = " ".join(long_lines).strip()
        positions.append(current)

    return positions


def extract_from_pdf_bytes(pdf_bytes: bytes) -> list[dict]:
    positions = []
    with pdfplumber.open(BytesIO(pdf_bytes)) as pdf:
        full_text = ""
        for page in pdf.pages:
            for table in page.extract_tables():
                for row in table:
                    if not row or not row[0]:
                        continue
                    pos_num = str(row[0]).strip()
                    if re.match(r"^\d+[.\-]\d+", pos_num):
                        positions.append({
                            "positionNumber": pos_num,
                            "shortText": str(row[1] or "").strip()[:200],
                            "unit": str(row[2] or "").strip() if len(row) > 2 else None,
                            "quantity": parse_quantity(str(row[3] or "")),
                            "longText": None,
                            "trade": None,
                            "sortOrder": len(positions),
                        })
            full_text += (page.extract_text() or "") + "\n"

        if not positions and full_text.strip():
            positions = _positions_from_text(full_text)

    return positions
