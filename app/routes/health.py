"""Health check endpoint."""

import pytesseract
from flask import Blueprint, jsonify
from pymongo.errors import PyMongoError

from app.db import get_db

health_bp = Blueprint("health", __name__)


def database_reachable():
    """Ping MongoDB and report whether it answered."""
    try:
        get_db().command("ping")
        return True
    except PyMongoError:
        return False


def ocr_engine_status():
    """Report whether the tesseract binary can be found, and its version."""
    try:
        return {"status": "available", "version": str(pytesseract.get_tesseract_version())}
    except (pytesseract.TesseractNotFoundError, OSError):
        return {"status": "unavailable", "version": None}


@health_bp.get("/health")
def health():
    """Return API, database and OCR engine status. 503 when the database is down."""
    db_ok = database_reachable()
    body = {
        "status": "ok" if db_ok else "degraded",
        "database": "ok" if db_ok else "unreachable",
        "ocr": ocr_engine_status(),
    }
    return jsonify(body), 200 if db_ok else 503
