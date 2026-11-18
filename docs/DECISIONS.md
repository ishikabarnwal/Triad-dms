# Decisions, security and next steps

## Design decisions and trade-offs

1. **GridFS for files.** The brief asks for it, and it keeps files and records in one database: one backup, one connection string, no shared volume between workers. The access check runs before the file is streamed, chunk by chunk. At larger scale, object storage with signed URLs would take load off the API.
2. **Pydantic for every input.** Bodies and query strings are parsed by Pydantic v2 models, so validation lives in one file (`app/schemas.py`). Errors come back as `{field, message}` details, which the frontend shows next to the right input.
3. **Soft-deleted metadata fields.** Hiding a field sets `active: false`. Old documents keep their values and the key can't be reused for something else, and an admin can restore the field later. Key and type lock once documents use the field, because changing them would silently break existing values.
4. **Titles and metadata visible across divisions, content not.** People can only request access to files they know exist, so title and metadata are discoverable. The file, its preview, its OCR text and search snippets all stay with the owning division and approved readers.
5. **OCR inside the upload request.** This is simple and gives an immediate, honest answer ("text could not be read"). The text layer is used first, and there are per-upload page and per-page time limits, so typical uploads take a second or two. The cost is that a long scan holds a worker. An async queue is the first thing on the list below.
6. **MongoDB text search instead of a search engine.** One less service to run, and filters and access rules apply in the same query. This works well into the thousands of documents. Beyond that, the candidate cap (500 per pass) and the regex pass become limits, and I would move search to Atlas Search or OpenSearch.
7. **Division stored by name.** Documents, users and requests store the division's name, which keeps records readable and filters simple. The cost is a rename cascade, which lives in one function and runs when an admin renames a division. Audit history keeps the old name on purpose.
8. **Login limits counted in MongoDB, failures only.** The limiter's storage is MongoDB, so all gunicorn workers share one count. Only failed sign-ins count, so a busy office behind one IP isn't locked out by successful logins.

## Security notes

- **Passwords and sessions.** Passwords are hashed with bcrypt (cost 12 by default). Tokens are HS256 JWTs signed with `JWT_SECRET`, and the API refuses to start without one.
- **One permission check.** Every file, preview, OCR text and snippet goes through the same access check. Denied attempts are audited.
- **Uploads.** Types are decided from the file's bytes, not the client's claims. Filenames are sanitised and the size limit is enforced (`MAX_UPLOAD_MB`, default 25). Files are served with `Cache-Control: no-store` and `X-Content-Type-Options: nosniff`.
- **Headers.** nginx adds `X-Frame-Options: SAMEORIGIN` and a strict referrer policy. CORS is limited to the origins in `CORS_ORIGINS`.
- **Network.** MongoDB is bound to `127.0.0.1` in Compose, so it isn't exposed beyond the host.
- **Errors.** Unexpected errors are logged on the server and return a generic 500 without a stack trace.
- **Known gaps.** The JWT is kept in `localStorage`, which an XSS bug could read; the frontend never renders API data as HTML, but an httpOnly cookie with CSRF protection would be stronger. There is no Content Security Policy yet, no malware scanning of uploads, and no refresh-token rotation.

## What I would do next

- **Semantic search** over OCR text with vector embeddings, alongside the keyword search, keeping the same rule that restricted content never matches.
- **Async OCR.** A job queue (RQ or Celery) with progress on the document page, so long scans never hold an API worker.
- **SSO.** OIDC or SAML login against the organisation's identity provider, with divisions mapped from groups.
- **Virus scanning.** ClamAV on upload before a file becomes downloadable.
- **Retention.** Policies per classification, legal hold, and scheduled deletion with an audit trail.
- **Hardening.** httpOnly cookie sessions, a Content Security Policy, and classification-level clearances on top of division rules.
