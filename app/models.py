"""Shapes of the documents we return from the API.

Raw Mongo documents never leave the backend: every response goes through one of
these serializers so ids become strings and private fields are dropped.
"""

from bson import ObjectId
from bson.errors import InvalidId


def isoformat(value):
    """Return a datetime as an ISO 8601 string, or None."""
    return value.isoformat() if value else None


def parse_object_id(value):
    """Convert a string to an ObjectId, returning None if it isn't a valid id."""
    try:
        return ObjectId(str(value))
    except (InvalidId, TypeError):
        return None


def serialize_user(user):
    """Public view of a user. Never includes the password hash."""
    user_id = str(user["_id"])
    return {
        "id": user_id,
        "user_id": user_id,
        "name": user.get("name"),
        "email": user.get("email"),
        "username": user.get("username"),
        "division": user.get("division"),
        "role": user.get("role", "member"),
        "created_at": isoformat(user.get("created_at")),
        "last_login_at": isoformat(user.get("last_login_at")),
    }


def serialize_document(document, access=None, include_ocr_text=False):
    """Public view of a document.

    `access` is an (access_status, can_download) pair for the viewer. OCR text is
    only included when the caller has checked the viewer may read it.
    """
    document_id = str(document["_id"])
    body = {
        "id": document_id,
        "doc_id": document_id,
        "title": document.get("title"),
        "filename": document.get("filename"),
        "content_type": document.get("content_type"),
        "size": document.get("size"),
        "division": document.get("division"),
        "metadata": document.get("metadata", {}),
        "ocr_status": document.get("ocr_status"),
        "ocr_error": document.get("ocr_error"),
        "ocr_chars": document.get("ocr_chars", 0),
        "page_count": document.get("page_count"),
        "uploaded_by": str(document["uploaded_by"]) if document.get("uploaded_by") else None,
        "uploaded_by_name": document.get("uploaded_by_name"),
        "upload_source": document.get("upload_source"),
        "created_at": isoformat(document.get("created_at")),
    }
    if access is not None:
        body["access_status"], body["can_download"] = access
    if include_ocr_text:
        body["ocr_text"] = document.get("ocr_text", "")
    return body


def serialize_access_request(access_request, status):
    """Public view of an access request. `status` is the live status (approvals past expiry show "expired")."""
    request_id = str(access_request["_id"])
    document_id = str(access_request["document_id"])

    def user_id(key):
        return str(access_request[key]) if access_request.get(key) else None

    return {
        "id": request_id,
        "request_id": request_id,
        "doc_id": document_id,
        "document_id": document_id,
        "document_title": access_request.get("document_title"),
        "owner_division": access_request.get("owner_division"),
        "requester_id": user_id("requester_id"),
        "requester_name": access_request.get("requester_name"),
        "requester_division": access_request.get("requester_division"),
        "reason": access_request.get("reason"),
        "status": status,
        "decided_by": user_id("decided_by"),
        "decided_by_name": access_request.get("decided_by_name"),
        "decision_note": access_request.get("decision_note"),
        "decided_at": isoformat(access_request.get("decided_at")),
        "expires_at": isoformat(access_request.get("expires_at")),
        "revoked_by": user_id("revoked_by"),
        "revoked_by_name": access_request.get("revoked_by_name"),
        "revoke_note": access_request.get("revoke_note"),
        "revoked_at": isoformat(access_request.get("revoked_at")),
        "created_at": isoformat(access_request.get("created_at")),
    }


def serialize_field(field, options, usage_count=None):
    """Public view of a metadata field. `options` is the resolved list (division names for the division field)."""
    body = {
        "id": str(field["_id"]),
        "key": field["key"],
        "label": field.get("label") or field["key"],
        "type": field.get("type", "text"),
        "options": options,
        "required": field.get("required", False),
        "filterable": field.get("filterable", True),
        "searchable": field.get("searchable", True),
        "order": field.get("order", 0),
        "source": field.get("source"),
        "locked": field.get("locked", False),
        "active": field.get("active", True),
    }
    if usage_count is not None:
        body["usage_count"] = usage_count
        body["created_at"] = isoformat(field.get("created_at"))
        body["updated_at"] = isoformat(field.get("updated_at"))
    return body


def serialize_division(division, counts=None):
    """Public view of a division. `counts` adds user and document totals for the admin page."""
    body = {
        "id": str(division["_id"]),
        "name": division["name"],
        "code": division.get("code"),
        "description": division.get("description"),
    }
    if counts is not None:
        body.update(counts)
        body["created_at"] = isoformat(division.get("created_at"))
    return body


def serialize_audit(entry):
    """Public view of an audit log entry."""
    return {
        "id": str(entry["_id"]),
        "actor_id": entry.get("actor_id"),
        "actor_name": entry.get("actor_name"),
        "action": entry.get("action"),
        "target_type": entry.get("target_type"),
        "target_id": entry.get("target_id"),
        "division": entry.get("division"),
        "details": entry.get("details") or {},
        "ip": entry.get("ip"),
        "created_at": isoformat(entry.get("created_at")),
    }
