"""Reference data every client needs: metadata fields and divisions."""

from flask import Blueprint, jsonify

from app.db import get_db
from app.metadata import active_fields, field_options
from app.models import serialize_division, serialize_field
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
