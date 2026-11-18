# Features

What is implemented, grouped by the assignment's core requirements, then what goes beyond them.

## Dynamic metadata

- Fields live in the `metadata_fields` collection, not in code. Each has a key, label, type (`text`, `select`, `number`, `date`), options, display order and three flags: required, filterable, searchable.
- Uploads are validated against the active fields: required values, select options, numbers and ISO dates. Unknown keys are kept rather than rejected.
- Any query parameter on `GET /api/documents` that isn't a reserved word filters on metadata, e.g. `?Report Type=Financial`. Number and date filters are converted to the field's type first.
- Admins add, edit, reorder, hide and restore fields from the Settings page. A field's key and type lock once documents use it, and reserved words (`page`, `limit`, `q`, `scope` and the other list parameters) can't be used as keys.
- The upload form, filter bar, document page and search filters are all built from the field list at runtime.

## RBAC and division isolation

- Every user belongs to one division. Passwords are hashed with bcrypt and sessions use HS256 JWTs that expire after 8 hours.
- Members upload only to their own division (403 otherwise); the super admin can upload to any division.
- Files, previews and OCR text are served only to the owning division, to holders of an approved and unexpired access request, and to the super admin. Everyone else gets 403.
- The rules live in one place (`app/utils.py`) and every route reuses them: listing, details, download, preview, search and stats.

## Cross-division access requests

- Any user can see the title and metadata of other divisions' documents and ask for access with an optional reason.
- Only one pending request per user and document is allowed. MongoDB enforces this with a partial unique index, and a second request returns 409 with the existing one.
- Anyone in the owning division (or the super admin) can approve, with an optional expiry of 1 to 365 days (the UI offers none, 7, 30 or 90), or reject with a note. Nobody can decide their own request.
- Decisions are single conditional updates ("only if still pending"), so two reviewers can't both decide the same request.
- Requesters see each status with its details and can ask again after a rejection, revocation or expiry.

## OCR and search

- PDFs use their embedded text layer first. Pages with almost no text are rendered and read by Tesseract. Images (PNG, JPG, TIFF including multi-page, BMP, WebP) go straight to Tesseract.
- Extraction never fails an upload. Unreadable files are stored with `ocr_status: "failed"` and a short `ocr_error`.
- `GET /api/search` combines a weighted MongoDB text index (title, metadata values, OCR text) with a partial-word pass, so `fin` finds "Financial". Results are ranked, show where each one matched, and carry a highlighted snippet.
- Search combines with every document filter: division, upload date range, text status and any metadata field.

## Beyond the brief

- **Expiring and revocable access.** Approvals can expire, and the owning division can revoke them at any time. Expired or revoked access stops downloads immediately.
- **Audit log.** Uploads, downloads, previews, denied attempts, access requests and decisions, sign-ins, failed sign-ins and every admin change are recorded with actor, divisions, IP and details. Admins can filter the log by action group, person, division and date.
- **Rate-limited login.** Failed sign-ins are limited to 10 per minute per client. Counts are stored in MongoDB, so every gunicorn worker shares them.
- **Content-type verification.** The file type comes from the file's leading bytes, not the client's `Content-Type` or extension. A renamed executable is rejected with 400.
- **Confidentiality-safe search.** For documents you can't open, OCR text never counts as a match and is never returned, so search results can't reveal what a restricted file says.
- **Command palette.** Ctrl K finds documents and pages from anywhere; G D, G S, G A and G C jump to the dashboard, search, access requests and (for admins) settings.
- **Admin settings.** Metadata fields, divisions (a rename carries through users, documents and requests), users (division and role changes) and the audit log.
- **CI.** GitHub Actions runs the backend suite, both evaluator scripts against a live gunicorn server, and the frontend tests and build on every push.
- **Demo data.** One command loads four users, 14 documents (three of them scanned images) and access requests in every state, spread over three weeks.
