"""Document search: MongoDB text search plus a partial-word fallback.

Text search ranks whole-word matches (with stemming), and a case-insensitive regex
pass catches partial words like "fin" for "Financial". Each candidate is then
checked in Python to see where it matched. For documents the viewer can't open,
OCR text never counts as a match and is never shown, so search results can't
reveal what a restricted document says.
"""

import html
import re

from app.db import get_db

# Upper bound on candidates per pass. Plenty for a prototype; beyond this we'd paginate in Mongo.
MAX_CANDIDATES = 500
MAX_TERMS = 10
SNIPPET_CHARS = 200
WORD = re.compile(r"\w+", re.UNICODE)
# Common English endings, so "reports" also highlights "report" (Mongo's text index already stems).
SUFFIXES = ("ing", "ed", "es", "s")
MIN_STEM_LENGTH = 3


def search_terms(text):
    """Unique lowercase words of a query, in order. Quotes and minus signs are dropped."""
    terms = []
    for word in WORD.findall(text.lower()):
        if word not in terms:
            terms.append(word)
    return terms[:MAX_TERMS]


def term_forms(term):
    """A term plus simple stems of it, for locating matches the text index found via stemming."""
    forms = {term}
    for suffix in SUFFIXES:
        if term.endswith(suffix) and len(term) - len(suffix) >= MIN_STEM_LENGTH:
            forms.add(term[: -len(suffix)])
    return forms


def match_pattern(terms):
    """One case-insensitive regex matching any form of any term, longest first."""
    forms = sorted({form for term in terms for form in term_forms(term)}, key=len, reverse=True)
    return re.compile("|".join(re.escape(form) for form in forms), re.IGNORECASE)


def with_conditions(query, conditions):
    """Add filter conditions to a Mongo query."""
    return {**query, "$and": conditions} if conditions else query


def text_matches(terms, conditions):
    """Whole-word matches from the text index, best score first."""
    query = with_conditions({"$text": {"$search": " ".join(terms)}}, conditions)
    cursor = (
        get_db().documents.find(query, {"score": {"$meta": "textScore"}, "search_blob": 0})
        .sort([("score", {"$meta": "textScore"})])
        .limit(MAX_CANDIDATES)
    )
    return list(cursor)


def partial_matches(terms, conditions):
    """Documents where every term appears somewhere, even inside a longer word."""
    per_term = []
    for term in terms:
        pattern = re.compile(re.escape(term), re.IGNORECASE)
        per_term.append({"$or": [{"title": pattern}, {"search_blob": pattern}, {"ocr_text": pattern}]})
    cursor = (
        get_db().documents.find({"$and": per_term + conditions}, {"search_blob": 0})
        .sort("created_at", -1)
        .limit(MAX_CANDIDATES)
    )
    return list(cursor)


def candidates(terms, conditions):
    """Union of both passes: text-index hits first by score, then partial-only hits, newest first."""
    merged = {}
    for document in text_matches(terms, conditions):
        merged[document["_id"]] = document
    for document in partial_matches(terms, conditions):
        merged.setdefault(document["_id"], {**document, "score": 0.0})
    return sorted(merged.values(), key=lambda d: (d.get("score", 0.0), d["created_at"]), reverse=True)


def unsearchable_keys(fields):
    """Metadata keys excluded from search because an admin turned `searchable` off."""
    return {field["key"] for field in fields if not field.get("searchable", True)}


def match_locations(document, pattern, hidden_keys, include_content):
    """Where a document matched: title, which metadata keys, and (if allowed) content."""
    in_title = bool(pattern.search(document.get("title") or ""))
    keys = [
        key
        for key, value in (document.get("metadata") or {}).items()
        if key not in hidden_keys and pattern.search(str(value))
    ]
    in_content = include_content and bool(pattern.search(document.get("ocr_text") or ""))

    matched_in = []
    if in_title:
        matched_in.append("title")
    if keys:
        matched_in.append("metadata")
    if in_content:
        matched_in.append("content")
    return matched_in, keys


def snippet(text, pattern, width=SNIPPET_CHARS):
    """~`width` characters of text around the first match, HTML-escaped, with matches in <mark>.

    Everything except our own <mark> tags is escaped, so the result is safe to render as HTML.
    """
    text = " ".join(text.split())
    first = pattern.search(text)
    if not first:
        return None

    padding = max(0, (width - (first.end() - first.start())) // 2)
    start = max(0, first.start() - padding)
    end = min(len(text), first.end() + padding)
    # Don't cut words in half at either edge.
    if start > 0:
        space = text.find(" ", start, first.start())
        start = space + 1 if space != -1 else start
    if end < len(text):
        space = text.rfind(" ", first.end(), end)
        end = space if space != -1 else end

    window = text[start:end]
    parts, last = [], 0
    for match in pattern.finditer(window):
        parts.append(html.escape(window[last:match.start()]))
        parts.append(f"<mark>{html.escape(match.group())}</mark>")
        last = match.end()
    parts.append(html.escape(window[last:]))

    prefix = "… " if start > 0 else ""
    suffix = " …" if end < len(text) else ""
    return f"{prefix}{''.join(parts)}{suffix}"
