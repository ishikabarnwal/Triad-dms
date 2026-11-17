"""Cross-division access requests: request, approve, reject, revoke and the lists around them.

Every status change is a single conditional update ("only if still pending",
"only if still approved"), so two people deciding the same request at once can't
both succeed.
"""

import math
from datetime import timedelta

from flask import Blueprint, g, jsonify, request
from pymongo import ReturnDocument
from pymongo.errors import DuplicateKeyError

from app.db import get_db
from app.models import parse_object_id, serialize_access_request
from app.schemas import AccessApproval, AccessDecision, AccessListQuery, AccessRequestCreate
from app.utils import (
    ApiError,
    GRANTING_STATUSES,
    active_approval_condition,
    can_decide,
    document_access,
    get_document_or_404,
    is_admin,
    login_required,
    read_body,
    request_state,
    utcnow,
    write_audit,
)

access_bp = Blueprint("access", __name__)


def serialize(access_request):
    """Serialize a request with its live status."""
    return serialize_access_request(access_request, request_state(access_request))


def get_request_or_404(request_id):
    """Load an access request by id or raise 404."""
    object_id = parse_object_id(request_id)
    access_request = get_db().access_requests.find_one({"_id": object_id}) if object_id else None
    if not access_request:
        raise ApiError(404, "request_not_found", "Access request not found.")
    return access_request


def pending_conflict(existing):
    """409 carrying the request that is already waiting, so the client can show it."""
    body = serialize(existing)
    return ApiError(
        409,
        "request_pending",
        "You already have a pending request for this document.",
        id=body["id"],
        request_id=body["request_id"],
        request=body,
    )


def ensure_can_decide(user, access_request):
    """Only the owning division or the super admin may decide, and never on their own request."""
    if access_request["requester_id"] == user["_id"]:
        raise ApiError(403, "own_request", "You can't decide on your own access request.")
    if not can_decide(user, access_request):
        raise ApiError(
            403,
            "not_allowed",
            f"Only {access_request['owner_division']} or the system administrator can decide on this request.",
        )


def already_decided(access_request):
    """409 for a request that is no longer pending."""
    status = request_state(access_request)
    return ApiError(409, "already_decided", f"This request has already been {status}.", status=status)


def status_condition(status):
    """Mongo condition for one live status filter."""
    if status == "all":
        return {}
    if status == "approved":
        return active_approval_condition()
    if status == "expired":
        return {"status": "approved", "expires_at": {"$lte": utcnow()}}
    return {"status": status}


def inbox_scope(user):
    """Requests a user is responsible for: their division's documents, or all for the super admin."""
    return {} if is_admin(user) else {"owner_division": user["division"]}


def paged_requests(base_query, query):
    """Run a request list query with status and document filters and pagination, newest first."""
    mongo_query = {**base_query, **status_condition(query.status)}
    if query.doc_id:
        mongo_query["document_id"] = parse_object_id(query.doc_id)
    collection = get_db().access_requests
    total = collection.count_documents(mongo_query)
    cursor = (
        collection.find(mongo_query)
        .sort([("created_at", -1), ("_id", -1)])
        .skip((query.page - 1) * query.limit)
        .limit(query.limit)
    )
    return jsonify({
        "requests": [serialize(access_request) for access_request in cursor],
        "total": total,
        "page": query.page,
        "limit": query.limit,
        "pages": math.ceil(total / query.limit) if total else 0,
        "status": query.status,
    })


def audit_decision(action, user, access_request, **details):
    """Audit log entry for approve/reject/revoke."""
    write_audit(
        action,
        actor=user,
        target_type="access_request",
        target_id=access_request["_id"],
        division=access_request["owner_division"],
        details={
            "document_id": str(access_request["document_id"]),
            "document_title": access_request.get("document_title"),
            "requester_name": access_request.get("requester_name"),
            "requester_division": access_request.get("requester_division"),
            **details,
        },
    )


@access_bp.post("/request")
@login_required
def create_request():
    """Ask for access to another division's document. 201 with the new request.

    400 if the user can already open it, 409 (with the existing request) if one is pending.
    Users may ask again after a rejection, revocation or expiry.
    """
    user = g.current_user
    data = AccessRequestCreate.model_validate(read_body())
    document = get_document_or_404(data.doc_id, {"ocr_text": 0})

    status, latest = document_access(user, document)
    if status in GRANTING_STATUSES:
        raise ApiError(400, "already_has_access", "You already have access to this document.", access_status=status)
    if status == "pending":
        raise pending_conflict(latest)

    access_request = {
        "document_id": document["_id"],
        "document_title": document.get("title"),
        "owner_division": document["division"],
        "requester_id": user["_id"],
        "requester_name": user.get("name"),
        "requester_division": user.get("division"),
        "reason": data.reason,
        "status": "pending",
        "decided_by": None,
        "decided_by_name": None,
        "decision_note": None,
        "decided_at": None,
        "expires_at": None,
        "created_at": utcnow(),
    }
    try:
        access_request["_id"] = get_db().access_requests.insert_one(access_request).inserted_id
    except DuplicateKeyError as exc:
        # A second click landed between our check and the insert; the unique index caught it.
        existing = get_db().access_requests.find_one(
            {"requester_id": user["_id"], "document_id": document["_id"], "status": "pending"}
        )
        raise pending_conflict(existing) from exc

    write_audit(
        "access.request",
        actor=user,
        target_type="access_request",
        target_id=access_request["_id"],
        division=document["division"],
        details={"document_id": str(document["_id"]), "document_title": document.get("title"), "reason": data.reason},
    )
    return jsonify(serialize(access_request)), 201


@access_bp.post("/approve")
@login_required
def approve():
    """Approve a pending request, optionally for a limited number of days."""
    user = g.current_user
    data = AccessApproval.model_validate(read_body())
    access_request = get_request_or_404(data.request_id)
    ensure_can_decide(user, access_request)

    now = utcnow()
    expires_at = now + timedelta(days=data.expires_in_days) if data.expires_in_days else None
    updated = get_db().access_requests.find_one_and_update(
        {"_id": access_request["_id"], "status": "pending"},
        {"$set": {
            "status": "approved",
            "decided_by": user["_id"],
            "decided_by_name": user.get("name"),
            "decision_note": data.note,
            "decided_at": now,
            "expires_at": expires_at,
        }},
        return_document=ReturnDocument.AFTER,
    )
    if not updated:
        raise already_decided(get_request_or_404(data.request_id))

    audit_decision("access.approve", user, updated, expires_in_days=data.expires_in_days)
    return jsonify(serialize(updated))


@access_bp.post("/reject")
@login_required
def reject():
    """Reject a pending request with an optional note."""
    user = g.current_user
    data = AccessDecision.model_validate(read_body())
    access_request = get_request_or_404(data.request_id)
    ensure_can_decide(user, access_request)

    updated = get_db().access_requests.find_one_and_update(
        {"_id": access_request["_id"], "status": "pending"},
        {"$set": {
            "status": "rejected",
            "decided_by": user["_id"],
            "decided_by_name": user.get("name"),
            "decision_note": data.note,
            "decided_at": utcnow(),
        }},
        return_document=ReturnDocument.AFTER,
    )
    if not updated:
        raise already_decided(get_request_or_404(data.request_id))

    audit_decision("access.reject", user, updated, note=data.note)
    return jsonify(serialize(updated))


@access_bp.post("/revoke")
@login_required
def revoke():
    """Withdraw an approved, unexpired request. The requester loses access immediately."""
    user = g.current_user
    data = AccessDecision.model_validate(read_body())
    access_request = get_request_or_404(data.request_id)
    ensure_can_decide(user, access_request)

    updated = get_db().access_requests.find_one_and_update(
        {"_id": access_request["_id"], **active_approval_condition()},
        {"$set": {
            "status": "revoked",
            "revoked_by": user["_id"],
            "revoked_by_name": user.get("name"),
            "revoke_note": data.note,
            "revoked_at": utcnow(),
        }},
        return_document=ReturnDocument.AFTER,
    )
    if not updated:
        status = request_state(get_request_or_404(data.request_id))
        raise ApiError(
            409,
            "not_active",
            f"Only active approvals can be revoked; this request is {status}.",
            status=status,
        )

    audit_decision("access.revoke", user, updated, note=data.note)
    return jsonify(serialize(updated))


@access_bp.get("/inbox")
@login_required
def inbox():
    """Requests for my division's documents (all divisions for the super admin). Default ?status=pending.

    ?doc_id= narrows it to one document, which the details page uses for its access history.
    """
    query = AccessListQuery.model_validate(request.args.to_dict())
    return paged_requests(inbox_scope(g.current_user), query)


@access_bp.get("/mine")
@login_required
def mine():
    """Requests I have sent, with live status. Default ?status=all."""
    query = AccessListQuery.model_validate({"status": "all", **request.args.to_dict()})
    return paged_requests({"requester_id": g.current_user["_id"]}, query)


@access_bp.get("/pending-count")
@login_required
def pending_count():
    """Number of pending requests waiting on me, for the sidebar badge."""
    query = {**inbox_scope(g.current_user), "status": "pending"}
    return jsonify({"count": get_db().access_requests.count_documents(query)})
