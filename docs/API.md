# API reference

All routes are under `/api` on port 5000. Send `Authorization: Bearer <token>`. IDs are returned as strings in `id`, plus `doc_id` or `request_id` where the brief names them. **Required** marks the endpoints the assignment specifies.

| Method | Path | Auth | Description |
|---|---|---|---|
| GET | `/api/health` | None | Database and Tesseract status |
| POST | `/api/auth/register` | None | **Required.** Create a member account: `name`, `email` or `username`, `password`, `division`. Returns 201 with a token |
| POST | `/api/auth/login` | None | **Required.** Email or username plus password. Returns `token`, `access_token` and `user` |
| GET | `/api/auth/me` | Token | The signed-in user |
| GET | `/api/divisions` | None | Division names and codes (the sign up page needs them) |
| GET | `/api/config/public` | None | Upload size limit, OCR page limit and accepted file types |
| GET | `/api/metadata-fields` | Token | Active metadata fields in display order |
| POST | `/api/documents/upload` | Token or anonymous | **Required.** Multipart `file`, `metadata` (JSON string), optional `title`. Returns 201 |
| GET | `/api/documents` | Token | **Required.** List with `scope`, `page`, `limit`, `sort`, `order`, `q`, `division`, `date_from`, `date_to`, `ocr_status` and any metadata key as a filter |
| GET | `/api/documents/<doc_id>` | Token | Details with `access_status`, `can_download` and the viewer's latest request. OCR text only with access |
| GET | `/api/documents/<doc_id>/download` | Token | **Required.** Streams the file from GridFS, 403 without access |
| GET | `/api/documents/<doc_id>/preview` | Token | Same as download, served inline |
| GET | `/api/search` | Token | **Required.** `q` plus the same filters as the list. Ranked results with `matched_in` and `snippet` |
| POST | `/api/access/request` | Token | **Required.** `{ "doc_id": ..., "reason": optional }`. 409 if one is already pending |
| POST | `/api/access/approve` | Token | **Required.** `{ "request_id": ..., "expires_in_days": optional, "note": optional }` |
| POST | `/api/access/reject` | Token | `{ "request_id": ..., "note": optional }` |
| POST | `/api/access/revoke` | Token | `{ "request_id": ..., "note": optional }` for an active approval |
| GET | `/api/access/inbox` | Token | Requests for my division's documents (all divisions for the admin). `status`, `doc_id`, `division` (admin), `page`, `limit` |
| GET | `/api/access/mine` | Token | Requests I sent, with live status |
| GET | `/api/access/pending-count` | Token | Pending requests waiting on me |
| GET | `/api/stats` | Token | Dashboard totals, a breakdown by a select field, and recent activity |
| GET | `/api/admin/metadata-fields` | Admin | All fields, including hidden ones, with usage counts |
| POST | `/api/admin/metadata-fields` | Admin | Create a field |
| PUT | `/api/admin/metadata-fields/reorder` | Admin | `{ "ids": [...] }` in the new order |
| PUT | `/api/admin/metadata-fields/<field_id>` | Admin | Edit a field, or restore it with `active: true` |
| DELETE | `/api/admin/metadata-fields/<field_id>` | Admin | Hide a field (soft delete) |
| GET | `/api/admin/divisions` | Admin | Divisions with user and document counts |
| POST | `/api/admin/divisions` | Admin | Create a division |
| PUT | `/api/admin/divisions/<division_id>` | Admin | Edit or rename a division (the rename carries through) |
| DELETE | `/api/admin/divisions/<division_id>` | Admin | Delete an empty division, 409 while it has users or documents |
| GET | `/api/admin/users` | Admin | Users, with `q`, `division` and `role` filters |
| PUT | `/api/admin/users/<user_id>` | Admin | Change a user's `division` or `role`; admins can't demote themselves |
| GET | `/api/admin/audit-logs` | Admin | Audit log with `action` (comma-separated prefixes), `actor`, `division`, `date_from`, `date_to` |

Errors use `400` validation, `401` missing or invalid token, `403` forbidden, `404` not found, `409` conflict, `413` too large and `429` rate limited.

## Example: upload

```bash
curl -X POST http://localhost:5000/api/documents/upload \
  -H "Authorization: Bearer $TOKEN" \
  -F "file=@fuel_q2.pdf;type=application/pdf" \
  -F 'metadata={"Report Type": "Financial", "Classification": "CONFIDENTIAL"}' \
  -F "title=Fuel Consumption Statement Q2"
```

```json
{
  "message": "Document uploaded.",
  "id": "6afcb730f74ef600fe1fc8c0",
  "doc_id": "6afcb730f74ef600fe1fc8c0",
  "title": "Fuel Consumption Statement Q2",
  "filename": "fuel_q2.pdf",
  "content_type": "application/pdf",
  "size": 812,
  "division": "Division A",
  "metadata": { "Report Type": "Financial", "Classification": "CONFIDENTIAL", "Division": "Division A" },
  "ocr_status": "done",
  "ocr_error": null,
  "ocr_chars": 51,
  "page_count": 1,
  "uploaded_by": "6afcb730f74ef600fe1fc8bc",
  "uploaded_by_name": "Asha Verma",
  "upload_source": "user",
  "created_at": "2026-11-17T20:21:04.313906+00:00",
  "access_status": "owner",
  "can_download": true
}
```

The division defaults to the uploader's own, and `metadata.Division` is always set to match it.

## Example: search

```bash
curl "http://localhost:5000/api/search?q=convoy" -H "Authorization: Bearer $TOKEN"
```

```json
{
  "query": "convoy",
  "terms": ["convoy"],
  "results": [
    {
      "id": "6afcb730f74ef600fe1fc8c0",
      "title": "Fuel Consumption Statement Q2",
      "division": "Division A",
      "metadata": { "Report Type": "Financial", "Classification": "CONFIDENTIAL", "Division": "Division A" },
      "ocr_status": "done",
      "access_status": "owner",
      "can_download": true,
      "can_request_access": false,
      "matched_in": ["content"],
      "matched_keys": [],
      "snippet": "Fuel consumption rose on the northern <mark>convoy</mark> route.",
      "score": 0.583
    }
  ],
  "total": 1,
  "page": 1,
  "limit": 20,
  "pages": 1
}
```

Each result also carries the same document fields as the upload response; they are trimmed here for length.
