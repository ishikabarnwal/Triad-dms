"""Dynamic metadata: validation against the admin-defined fields, and list filters.

Nothing here knows any field by name. Behaviour comes from each field's `type`,
`options`, `required` and `source` as stored in the metadata_fields collection.
"""

import re
from datetime import date, datetime

from app.db import get_db
from app.schemas import RESERVED_QUERY_PARAMS
from app.utils import ApiError

DATE_INPUT_FORMATS = ("%Y-%m-%d", "%d-%m-%Y", "%d/%m/%Y", "%Y/%m/%d", "%d.%m.%Y")
MAX_KEY_LENGTH = 100
MAX_TEXT_LENGTH = 1000
INTEGER_PATTERN = re.compile(r"^[+-]?\d+$")


def active_fields():
    """All active metadata fields in display order."""
    return list(get_db().metadata_fields.find({"active": True}).sort("order", 1))


def division_field(fields):
    """The field whose options come from the divisions collection, if any."""
    return next((field for field in fields if field.get("source") == "divisions"), None)


def field_options(fields):
    """Map field key -> allowed options, reading division names live for the division field."""
    division_names = None
    options = {}
    for field in fields:
        if field.get("source") == "divisions":
            if division_names is None:
                division_names = [d["name"] for d in get_db().divisions.find({}, {"name": 1}).sort("name", 1)]
            options[field["key"]] = division_names
        else:
            options[field["key"]] = field.get("options") or []
    return options


def is_blank(value):
    """True for None and empty/whitespace strings."""
    return value is None or (isinstance(value, str) and not value.strip())


def check_key(key):
    """Reject keys that Mongo can't query safely or that collide with reserved params."""
    if not key.strip():
        return "Metadata keys can't be empty."
    if len(key) > MAX_KEY_LENGTH:
        return f"Metadata keys can be at most {MAX_KEY_LENGTH} characters."
    if "." in key or key.startswith("$"):
        return "Metadata keys can't contain '.' or start with '$'."
    if key in RESERVED_QUERY_PARAMS:
        return f"'{key}' is a reserved word and can't be used as a metadata key."
    return None


def parse_number(value):
    """Parse an int or float from a number or numeric string."""
    if isinstance(value, bool):
        raise ValueError("must be a number")
    if isinstance(value, (int, float)):
        return value
    text = str(value).strip()
    try:
        return int(text) if INTEGER_PATTERN.match(text) else float(text)
    except ValueError as exc:
        raise ValueError("must be a number") from exc


def parse_date(value):
    """Normalise a date to YYYY-MM-DD so stored values sort and compare correctly."""
    if isinstance(value, datetime):
        return value.date().isoformat()
    if isinstance(value, date):
        return value.isoformat()
    text = str(value).strip()
    try:
        return datetime.fromisoformat(text.replace("Z", "+00:00")).date().isoformat()
    except ValueError:
        pass
    for fmt in DATE_INPUT_FORMATS:
        try:
            return datetime.strptime(text, fmt).date().isoformat()
        except ValueError:
            continue
    raise ValueError("must be a date like 2026-11-16")


def match_option(value, options):
    """Return the option equal to `value` ignoring case, or None."""
    lowered = str(value).strip().lower()
    return next((option for option in options if option.lower() == lowered), None)


def coerce_value(field, value, options):
    """Convert a submitted value to the field's type. Raises ValueError with a reason."""
    field_type = field.get("type", "text")
    if field_type == "number":
        return parse_number(value)
    if field_type == "date":
        return parse_date(value)
    if field_type == "select" and options:
        option = match_option(value, options)
        if option is None:
            raise ValueError(f"must be one of: {', '.join(options)}")
        return option
    return coerce_text(value)


def coerce_text(value):
    """Store free text as a trimmed string with a length cap."""
    if isinstance(value, (dict, list)):
        raise ValueError("must be text, a number or true/false")
    text = str(value).strip()
    if len(text) > MAX_TEXT_LENGTH:
        raise ValueError(f"can be at most {MAX_TEXT_LENGTH} characters")
    return text


def keep_unknown_value(value):
    """Unknown keys are kept, but only as simple values."""
    if isinstance(value, (bool, int, float)):
        return value
    return coerce_text(value)


def validate_metadata(raw, fields):
    """Validate submitted metadata against the active fields and return the cleaned dict.

    Unknown keys are kept rather than rejected, so clients can send extra context.
    Raises ApiError(400, invalid_metadata) listing every problem at once.
    """
    by_key = {field["key"]: field for field in fields}
    options = field_options(fields)
    cleaned, errors = {}, []

    for key, value in raw.items():
        key_problem = check_key(key)
        if key_problem:
            errors.append({"field": key, "message": key_problem})
            continue
        if is_blank(value):
            continue
        field = by_key.get(key)
        try:
            cleaned[key] = coerce_value(field, value, options[key]) if field else keep_unknown_value(value)
        except ValueError as exc:
            errors.append({"field": key, "message": f"{key} {exc}."})

    for field in fields:
        if field.get("required") and field["key"] not in cleaned and not any(e["field"] == field["key"] for e in errors):
            errors.append({"field": field["key"], "message": f"{field['label'] or field['key']} is required."})

    if errors:
        raise ApiError(400, "invalid_metadata", errors[0]["message"], details=errors)
    return cleaned


def search_blob(title, filename, metadata):
    """One string of everything a user might search for besides OCR text."""
    values = [str(value) for value in metadata.values()]
    return " ".join([title, filename, *values])


def exact_text_match(value):
    """Case-insensitive whole-value match for text filters."""
    return re.compile(f"^{re.escape(str(value).strip())}$", re.IGNORECASE)


def filter_value(field, value, options):
    """Convert one ?key=value filter to the stored type so comparisons work."""
    if field is None:
        return exact_text_match(value)
    field_type = field.get("type", "text")
    try:
        if field_type == "number":
            return parse_number(value)
        if field_type == "date":
            return parse_date(value)
    except ValueError as exc:
        raise ApiError(400, "invalid_filter", f"Filter '{field['key']}' {exc}.") from exc
    if field_type == "select":
        option = match_option(value, options)
        return option if option is not None else exact_text_match(value)
    return exact_text_match(value)


def metadata_filters(args, fields):
    """Build Mongo conditions from every non-reserved query param.

    Repeating a param (?Report Type=Financial&Report Type=Technical) matches any of the values.
    """
    by_key = {field["key"]: field for field in fields}
    options = field_options(fields)
    conditions = []
    for key in args:
        if key in RESERVED_QUERY_PARAMS:
            continue
        if not key.strip() or "." in key or key.startswith("$"):
            raise ApiError(400, "invalid_filter", f"'{key}' is not a valid filter name.")
        values = [value for value in args.getlist(key) if value.strip()]
        if not values:
            continue
        field = by_key.get(key)
        converted = [filter_value(field, value, options.get(key, [])) for value in values]
        path = f"metadata.{key}"
        conditions.append({path: converted[0]} if len(converted) == 1 else {path: {"$in": converted}})
    return conditions
