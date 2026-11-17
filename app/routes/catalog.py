"""Reference data every client needs: metadata fields, divisions and public limits."""

from flask import Blueprint, current_app, jsonify

from app.db import get_db
from app.files import EXTENSION_KINDS
from app.metadata import active_fields, field_options
from app.models import serialize_division, serialize_field
from app.schemas import ACCESS_EXPIRY_MAX_DAYS, ACCESS_EXPIRY_MIN_DAYS
from app.utils import login_required

catalog_bp = Blueprint("catalog", __name__)


@catalog_bp.get("/metadata-fields")
@login_required
def metadata_fields():
    """Active metadata fields in display order, with resolved options, for upload forms and filters."""
    fields = active_fields()
    options = field_options(fields)
    return jsonify({"fields": [serialize_field(field, options[field["key"]]) for field in fields]})


@catalog_bp.get("/divisions")
def divisions():
    """All divisions. Public, because the signup page needs it before anyone is logged in."""
    items = get_db().divisions.find().sort("name", 1)
    return jsonify({"divisions": [serialize_division(division) for division in items]})


def accepted_file_types():
    """Distinct file kinds in the order they're declared, e.g. jpg and jpeg both count as "jpeg"."""
    return list(dict.fromkeys(EXTENSION_KINDS.values()))


@catalog_bp.get("/config/public")
def public_config():
    """The limits the API enforces, so the landing page can quote real numbers. Public: nothing here is secret."""
    config = current_app.config
    return jsonify(
        {
            "file_types": accepted_file_types(),
            "extensions": list(EXTENSION_KINDS),
            "max_upload_mb": config["MAX_UPLOAD_MB"],
            "ocr": {
                "enabled": config["OCR_ENABLED"],
                "max_pages": config["OCR_MAX_PAGES"],
                "page_timeout_seconds": config["OCR_PAGE_TIMEOUT"],
            },
            "session_minutes": config["JWT_EXPIRES_MINUTES"],
            "password": {"hashing": "bcrypt", "cost": config["BCRYPT_ROUNDS"], "min_length": config["PASSWORD_MIN_LENGTH"]},
            "login_rate_limit": config["LOGIN_RATE_LIMIT"],
            "access_expiry_days": {"min": ACCESS_EXPIRY_MIN_DAYS, "max": ACCESS_EXPIRY_MAX_DAYS},
        }
    )
