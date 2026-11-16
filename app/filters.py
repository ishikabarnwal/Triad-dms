"""Query filters shared by the document list, search and the audit log."""

from datetime import datetime, time, timedelta, timezone

from app.metadata import metadata_filters
from app.utils import ApiError, division_names, find_division


def date_range(column, date_from=None, date_to=None):
    """Condition for `column` between two dates, both inclusive. None when no dates are given."""
    bounds = {}
    if date_from:
        bounds["$gte"] = datetime.combine(date_from, time.min, tzinfo=timezone.utc)
    if date_to:
        # Inclusive end date: everything before the start of the next day.
        bounds["$lt"] = datetime.combine(date_to + timedelta(days=1), time.min, tzinfo=timezone.utc)
    return {column: bounds} if bounds else None


def division_condition(name_or_code, column="division"):
    """Condition for one division, matched by name or code. 400 for an unknown division."""
    division = find_division(name_or_code)
    if not division:
        raise ApiError(400, "unknown_division", f"Unknown division '{name_or_code}'.", divisions=division_names())
    return {column: division["name"]}


def document_filters(query, fields, args):
    """Conditions from the common filter params plus every metadata filter in the query string."""
    conditions = []
    if query.division:
        conditions.append(division_condition(query.division))
    created = date_range("created_at", query.date_from, query.date_to)
    if created:
        conditions.append(created)
    if query.ocr_status:
        conditions.append({"ocr_status": query.ocr_status})
    return conditions + metadata_filters(args, fields)
