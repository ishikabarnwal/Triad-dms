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
