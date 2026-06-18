import os
import json
import urllib.request
from http.server import BaseHTTPRequestHandler
from supabase import create_client
from dotenv import load_dotenv
from _pdf_utils import extract_from_pdf_bytes

load_dotenv()

SUPABASE_URL = os.environ["SUPABASE_URL"]
SUPABASE_SERVICE_KEY = os.environ["SUPABASE_SERVICE_ROLE_KEY"]
PDF_SERVICE_SECRET = os.environ["PDF_SERVICE_SECRET"]
BUCKET_NAME = "leistungsverzeichnisse"

supabase = create_client(SUPABASE_URL, SUPABASE_SERVICE_KEY)


def _post_json(url: str, payload: dict) -> None:
    data = json.dumps(payload).encode()
    req = urllib.request.Request(url, data=data, headers={"Content-Type": "application/json"}, method="POST")
    urllib.request.urlopen(req, timeout=30)


class handler(BaseHTTPRequestHandler):
    def do_POST(self):
        length = int(self.headers.get("Content-Length", 0))
        body = json.loads(self.rfile.read(length))

        try:
            pdf_bytes = supabase.storage.from_(BUCKET_NAME).download(body["storagePath"])
            result = extract_from_pdf_bytes(pdf_bytes)
            payload = {
                "lvId": body["lvId"],
                "secret": PDF_SERVICE_SECRET,
                "success": True,
                "positions": result["positions"],
                "extraction_stage": result["extraction_stage"],
            }
        except Exception as exc:
            payload = {
                "lvId": body["lvId"],
                "secret": PDF_SERVICE_SECRET,
                "success": False,
                "status": 422,
                "error": getattr(exc, "message", str(exc)),
                "details": getattr(exc, "stage_errors", []),
            }

        try:
            _post_json(body["callbackUrl"], payload)
        except Exception:
            pass

        self._respond(200 if payload.get("success") else 422, {"ok": payload.get("success", False), "error": payload.get("error")})

    def _respond(self, status: int, data: dict) -> None:
        body = json.dumps(data).encode()
        self.send_response(status)
        self.send_header("Content-Type", "application/json")
        self.send_header("Content-Length", str(len(body)))
        self.end_headers()
        self.wfile.write(body)

    def log_message(self, format, *args):
        pass
