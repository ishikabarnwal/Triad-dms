"""Search endpoint."""

import math

from flask import Blueprint, g, jsonify, request

from app.db import get_db
from app.filters import document_filters
from app.metadata import active_fields
from app.models import serialize_document
from app.schemas import SearchQuery, reserved_args
from app.search import candidates, match_locations, match_pattern, search_terms, unsearchable_keys, snippet
from app.utils import REQUESTABLE_STATUSES, ApiError, access_status, can_download, latest_requests, login_required

search_bp = Blueprint("search", __name__)


def search_result(document, status, matched_in=(), matched_keys=(), text_snippet=None):
    """One search hit. Restricted documents carry title and metadata only."""
    allowed = can_download(status)
    return {
        **serialize_document(document, (status, allowed)),
        "can_request_access": status in REQUESTABLE_STATUSES,
        "matched_in": list(matched_in),
        "matched_keys": list(matched_keys),
        "snippet": text_snippet if allowed else None,
        "score": round(document.get("score", 0.0), 3),
    }


def ranked_hits(user, terms, conditions, fields):
    """All search hits the user may see, best first, with where each one matched."""
    documents = candidates(terms, conditions)
    pattern = match_pattern(terms)
    hidden_keys = unsearchable_keys(fields)
    requests_by_document = latest_requests(user, [d["_id"] for d in documents])

    hits = []
    for document in documents:
        status = access_status(user, document, requests_by_document.get(document["_id"]))
        allowed = can_download(status)
        matched_in, keys = match_locations(document, pattern, hidden_keys, include_content=allowed)
        # Matched only inside text the user may not read: drop it rather than hint at the content.
        if not matched_in:
            continue
        text_snippet = snippet(document.get("ocr_text") or "", pattern) if "content" in matched_in else None
        hits.append(search_result(document, status, matched_in, keys, text_snippet))
    return hits


def filtered_page(user, conditions, query):
    """No search words: just the filtered documents, newest first."""
    collection = get_db().documents
    mongo_query = {"$and": conditions}
    total = collection.count_documents(mongo_query)
    documents = list(
        collection.find(mongo_query, {"ocr_text": 0, "search_blob": 0})
        .sort([("created_at", -1), ("_id", -1)])
        .skip((query.page - 1) * query.limit)
        .limit(query.limit)
    )
    requests_by_document = latest_requests(user, [d["_id"] for d in documents])
    results = [
        search_result(document, access_status(user, document, requests_by_document.get(document["_id"])))
        for document in documents
    ]
    return results, total


@search_bp.get("/search")
@login_required
def search():
    """Search titles, metadata values and OCR text, ranked by relevance.

    Combine with any document filter (metadata keys, division, date_from, date_to,
    ocr_status). With no search words, returns the filtered documents. Snippets and
    content matches only appear for documents the user can open.
    """
    user = g.current_user
    query = SearchQuery.model_validate(reserved_args(request.args))
    fields = active_fields()
    conditions = document_filters(query, fields, request.args)
    terms = search_terms(query.q)

    if not terms and not conditions:
        raise ApiError(400, "query_required", "Enter something to search for, or pick at least one filter.")

    if terms:
        hits = ranked_hits(user, terms, conditions, fields)
        total = len(hits)
        start = (query.page - 1) * query.limit
        results = hits[start : start + query.limit]
    else:
        results, total = filtered_page(user, conditions, query)

    return jsonify({
        "query": query.q,
        "terms": terms,
        "results": results,
        "total": total,
        "page": query.page,
        "limit": query.limit,
        "pages": math.ceil(total / query.limit) if total else 0,
    })
