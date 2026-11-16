"""Document endpoints: upload, list, details, download and preview."""

import hashlib
import math
import re

from flask import Blueprint, current_app, g, jsonify, request, send_file
from gridfs.errors import NoFile
from pymongo import ASCENDING, DESCENDING

from app.db import get_db, get_fs
from app.files import MIME_TYPES, clean_filename, detect_kind
from app.filters import document_filters
from app.metadata import active_fields, division_field, is_blank, search_blob, validate_metadata
from app.models import isoformat, serialize_document
from app.ocr import extract_text
from app.schemas import ListQuery, UploadForm, reserved_args
from app.utils import (
    REQUESTABLE_STATUSES,
    ApiError,
    access_status,
    approved_document_ids,
    can_download,
    division_names,
    document_access,
    find_division,
    get_document_or_404,
    is_admin,
    latest_requests,
    login_required,
    optional_user,
    utcnow,
    write_audit,
)

documents_bp = Blueprint("documents", __name__)

SORTABLE_COLUMNS = {"created_at", "title", "filename", "size"}
# Big fields that list responses never need.
LIST_PROJECTION = {"ocr_text": 0, "search_blob": 0}


# ---- upload helpers ----

def read_upload():
    """Return (filename, bytes) of the uploaded `file` part, or raise 400."""
    upload = request.files.get("file")
    if upload is None or not upload.filename:
        raise ApiError(400, "file_required", "Attach the document as a multipart form field named 'file'.")
    data = upload.read()
    if not data:
        raise ApiError(400, "empty_file", "The uploaded file is empty.")
    return clean_filename(upload.filename), data


def resolve_division(raw_metadata, fields, uploader):
    """Work out which division the document belongs to, enforcing the upload rules.

    - Logged in: defaults to the user's division; any other division is 403 unless super admin.
    - Anonymous: the division must be given in metadata.
    Returns (division_name, metadata with the division value set to the canonical name).
    """
    field = division_field(fields)
    key = field["key"] if field else None
    requested = raw_metadata.get(key) if key else None

    if is_blank(requested):
        if uploader is None:
            raise ApiError(400, "division_required", f"Anonymous uploads must include '{key}' in metadata.")
        name = uploader["division"]
    else:
        division = find_division(requested)
        if not division:
            raise ApiError(400, "unknown_division", f"Unknown division '{requested}'.", divisions=division_names())
        name = division["name"]
        if uploader and not is_admin(uploader) and name != uploader["division"]:
            raise ApiError(
                403,
                "division_forbidden",
                f"You can only upload to your own division ({uploader['division']}).",
            )

    # document.division and the metadata value must never disagree.
    metadata = {**raw_metadata, key: name} if key else dict(raw_metadata)
    return name, metadata


def default_title(filename):
    """Use the filename without its extension when no title is given."""
    return filename.rsplit(".", 1)[0] if "." in filename else filename


def store_file(filename, data, kind, division):
    """Save the bytes to GridFS and return the new file id."""
    return get_fs().upload_from_stream(
        filename,
        data,
        metadata={"content_type": MIME_TYPES[kind], "division": division},
    )


# ---- read helpers ----

def sort_spec(query, fields):
    """Translate ?sort=&order= into a Mongo sort; metadata keys sort by their value."""
    if query.sort in SORTABLE_COLUMNS:
        column = query.sort
    elif query.sort in {field["key"] for field in fields}:
        column = f"metadata.{query.sort}"
    else:
        allowed = ", ".join(sorted(SORTABLE_COLUMNS)) + " or a metadata field key"
        raise ApiError(400, "invalid_sort", f"Can't sort by '{query.sort}'. Use {allowed}.")
    direction = ASCENDING if query.order == "asc" else DESCENDING
    # _id as a tie-breaker keeps pages stable when many rows share a value.
    return [(column, direction), ("_id", direction)]


def visibility_filter(user):
    """Documents the user can open: their division's plus ones they have approved access to."""
    return {"$or": [{"division": user["division"]}, {"_id": {"$in": approved_document_ids(user)}}]}


def list_conditions(query, fields, user):
    """All Mongo conditions for a list request."""
    conditions = document_filters(query, fields, request.args)
    if query.q:
        pattern = re.compile(re.escape(query.q), re.IGNORECASE)
        conditions.append({"$or": [{"title": pattern}, {"filename": pattern}]})
    if query.scope == "division":
        conditions.append(visibility_filter(user))
    return conditions


def access_payload(status, latest_request):
    """Extra access fields for the details view."""
    return {
        "can_request_access": status in REQUESTABLE_STATUSES,
        "access_request_id": str(latest_request["_id"]) if latest_request else None,
        "access_expires_at": isoformat(latest_request.get("expires_at")) if latest_request else None,
    }


def send_document(doc_id, as_attachment):
    """Stream a document's file from GridFS if the current user may read it."""
    user = g.current_user
    document = get_document_or_404(doc_id)
    status, _ = document_access(user, document)
    action = "document.download" if as_attachment else "document.preview"

    if not can_download(status):
        write_audit(
            f"{action}_denied",
            actor=user,
            target_type="document",
            target_id=document["_id"],
            division=document["division"],
            details={"access_status": status},
        )
        raise ApiError(
            403,
            "access_denied",
            f"This document belongs to {document['division']}. Request access to open it.",
            access_status=status,
            can_request_access=status in REQUESTABLE_STATUSES,
        )

    try:
        stored = get_fs().open_download_stream(document["gridfs_id"])
    except NoFile as exc:
        current_app.logger.error("GridFS file missing for document %s", document["_id"])
        raise ApiError(404, "file_not_found", "The stored file for this document is missing.") from exc

    write_audit(
        action,
        actor=user,
        target_type="document",
        target_id=document["_id"],
        division=document["division"],
        details={"filename": document["filename"], "access_status": status},
    )

    response = send_file(
        stored,
        mimetype=document["content_type"],
        as_attachment=as_attachment,
        download_name=document["filename"],
        conditional=False,
        etag=False,
        max_age=0,
    )
    response.content_length = stored.length
    # Confidential files: never cache them, and never let the browser guess another type.
    response.headers["Cache-Control"] = "no-store"
    response.headers["X-Content-Type-Options"] = "nosniff"
    return response


# ---- routes ----

@documents_bp.post("/upload")
def upload():
    """Upload a file with metadata. Stores it in GridFS, extracts text and returns 201.

    Text extraction failures never fail the upload: the document is saved with ocr_status "failed".
    """
    uploader = optional_user()
    if uploader is None and not current_app.config["ALLOW_ANONYMOUS_UPLOAD"]:
        raise ApiError(401, "auth_required", "Log in to upload documents.")

    form = UploadForm.model_validate(request.form.to_dict())
    filename, data = read_upload()
    kind = detect_kind(filename, data)

    fields = active_fields()
    division, raw_metadata = resolve_division(form.metadata, fields, uploader)
    metadata = validate_metadata(raw_metadata, fields)
    title = form.title or default_title(filename)

    ocr = extract_text(data, kind)
    gridfs_id = store_file(filename, data, kind, division)
    document = {
        "title": title,
        "filename": filename,
        "content_type": MIME_TYPES[kind],
        "size": len(data),
        "sha256": hashlib.sha256(data).hexdigest(),
        "gridfs_id": gridfs_id,
        "division": division,
        "metadata": metadata,
        "search_blob": search_blob(title, filename, metadata),
        "ocr_text": ocr.text,
        "ocr_chars": len(ocr.text),
        "ocr_status": ocr.status,
        "ocr_error": ocr.error,
        "page_count": ocr.page_count,
        "uploaded_by": uploader["_id"] if uploader else None,
        "uploaded_by_name": uploader.get("name") if uploader else None,
        "upload_source": "user" if uploader else "anonymous",
        "created_at": utcnow(),
    }
    try:
        document["_id"] = get_db().documents.insert_one(document).inserted_id
    except Exception:
        # Don't leave an orphaned file in GridFS if the document row couldn't be saved.
        get_fs().delete(gridfs_id)
        raise

    write_audit(
        "document.upload",
        actor=uploader,
        target_type="document",
        target_id=document["_id"],
        division=division,
        details={
            "filename": filename,
            "size": len(data),
            "upload_source": document["upload_source"],
            "ocr_status": ocr.status,
        },
    )

    status = access_status(uploader, document) if uploader else None
    access = (status, can_download(status)) if uploader else None
    message = "Document uploaded." if ocr.status != "failed" else "Document uploaded, but text extraction failed."
    return jsonify({"message": message, **serialize_document(document, access)}), 201


@documents_bp.get("", strict_slashes=False)
@login_required
def list_documents():
    """List documents with metadata filters, pagination and sorting.

    scope=division (default): my division's documents plus ones I have approved access to.
    scope=all: every document's title and metadata, flagged with can_download and access_status.
    Also filters by division, date_from, date_to and ocr_status. Any other query param
    filters on metadata, e.g. ?Report Type=Financial.
    """
    user = g.current_user
    query = ListQuery.model_validate(reserved_args(request.args))
    fields = active_fields()
    sort = sort_spec(query, fields)

    conditions = list_conditions(query, fields, user)
    mongo_query = {"$and": conditions} if conditions else {}
    documents_collection = get_db().documents
    total = documents_collection.count_documents(mongo_query)
    documents = list(
        documents_collection.find(mongo_query, LIST_PROJECTION)
        .sort(sort)
        .skip((query.page - 1) * query.limit)
        .limit(query.limit)
    )

    requests_by_document = latest_requests(user, [d["_id"] for d in documents])
    items = []
    for document in documents:
        status = access_status(user, document, requests_by_document.get(document["_id"]))
        items.append(serialize_document(document, (status, can_download(status))))

    return jsonify({
        "documents": items,
        "total": total,
        "page": query.page,
        "limit": query.limit,
        "pages": math.ceil(total / query.limit) if total else 0,
        "scope": query.scope,
    })


@documents_bp.get("/<doc_id>")
@login_required
def document_details(doc_id):
    """Document details with can_download and access_status. OCR text only if the user has access."""
    document = get_document_or_404(doc_id)
    status, latest_request = document_access(g.current_user, document)
    allowed = can_download(status)
    body = serialize_document(document, (status, allowed), include_ocr_text=allowed)
    return jsonify({**body, **access_payload(status, latest_request)})


@documents_bp.get("/<doc_id>/download")
@login_required
def download(doc_id):
    """Download the original file. 403 unless same division, approved access or super admin."""
    return send_document(doc_id, as_attachment=True)


@documents_bp.get("/<doc_id>/preview")
@login_required
def preview(doc_id):
    """Show the file inline in the browser. Same access rules as download."""
    return send_document(doc_id, as_attachment=False)
