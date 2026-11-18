# Development

Running the project locally, testing it, and finding your way around the code.

## Getting started

Prerequisites: [Docker Desktop](https://www.docker.com/products/docker-desktop/) (or Docker Engine with the Compose plugin) and Git. Ports 3000, 5000 and 27017 must be free.

```bash
git clone https://github.com/ishikabarnwal/Triad-dms.git
cd Triad-dms
cp .env.example .env            # PowerShell: Copy-Item .env.example .env
docker compose up -d --build
docker compose exec backend python -m app.demo_seed --reset
```

Then open:

| | URL |
|---|---|
| App | http://localhost:3000 |
| API | http://localhost:5000/api |
| Health check | http://localhost:5000/api/health |

**Before deploying anywhere real**, edit `.env`: set a long random `JWT_SECRET` (e.g. `python -c "import secrets; print(secrets.token_hex(32))"`), a strong `ADMIN_PASSWORD` and `ALLOW_ANONYMOUS_UPLOAD=false`. The admin account is created from `.env` the first time the backend starts.

**What the demo seed does.** Every step goes through the real API in-process, so uploads are stored in GridFS, read by OCR and audited exactly like a real upload. Each step is then dated over the past three weeks. `--reset` first removes documents, stored files, access requests, audit logs and non-admin users; divisions, metadata fields and admins are kept. Without `--reset` the seed refuses to run on a database that already has documents.

### Run without Docker

Needs Python 3.12 or 3.13, MongoDB 7 on `localhost:27017`, Tesseract on your `PATH` (or set `TESSERACT_CMD` in `.env`, e.g. `C:/Program Files/Tesseract-OCR/tesseract.exe`) and Node.js 22.

```bash
python -m venv .venv
source .venv/bin/activate        # Windows: .venv\Scripts\activate
pip install -r requirements.txt
cp .env.example .env
python run.py                     # seeds, then serves the API on http://localhost:5000

# in a second terminal
cd frontend
npm ci
npm run dev                       # http://localhost:5173, proxies /api to port 5000
```

Load the demo data with `python -m app.demo_seed --reset`.

## Testing

| Suite | Command | Result |
|---|---|---|
| Backend (pytest, real MongoDB) | `docker compose run --rm tests` | 393 passed |
| Frontend unit tests | `cd frontend && npm ci && npm test` | 6 passed |
| Evaluators' script | `python test_api.py` | 1 of 1 passed |
| Extended evaluator-style script | `python test_api_extended.py` | 28 of 28 passed |

- **Backend suite.** The pytest suite runs in its own image against the Compose MongoDB, using a throwaway `triad_dms_test` database. It covers auth, upload and OCR, filters, RBAC, every access request transition, search confidentiality, admin endpoints, the audit log, robustness against malformed input, and the demo seed.
- **API scripts.** Both scripts call the running API on port 5000 and need `requests` (`pip install requests`). `test_api.py` is the evaluators' file, unchanged; it writes its result to `test_report.txt`.
- **CI.** [GitHub Actions](../.github/workflows/tests.yml) runs on every push and pull request. One job runs the pytest suite, starts gunicorn, and runs both API scripts against it. A second job runs the frontend tests and production build.

## Notes for evaluators, in full

**`ALLOW_ANONYMOUS_UPLOAD`.** The provided `test_api.py` uploads without an `Authorization` header and expects 200 or 201. With `ALLOW_ANONYMOUS_UPLOAD=true` (the default, so the script passes out of the box):
- An upload without a token is accepted. Its division comes from `metadata["Division"]`, which must name an existing division.
- It is stored with `uploaded_by: null` and `upload_source: "anonymous"`.
- As soon as a token is present, the normal rules apply in full: the division must be the uploader's own, or the request gets 403.

The flag exists only for that script. Set it to `false` in production, and anonymous uploads then get 401.

**`test_sample.pdf`.** The script's sample is `%PDF-1.4` followed by 1 KB of filler and `%%EOF`; it has no pages. It passes the content check (it does start with `%PDF`), so it is stored in GridFS like any other file. Text extraction fails, and the document is saved with `ocr_status: "failed"`, `ocr_error: "Failed to open stream"`, `ocr_text: ""` and `page_count: 0`. The API still returns 201, because an OCR failure never fails an upload. The document page says the PDF has no pages to show and offers the original as a download.

**Seed data.** The seed always provides divisions named exactly "Division A" and "Division B" and a metadata field with key exactly "Report Type" that includes the option "Financial", as the script's upload expects.

## Project structure

```
Triad-dms/
├── app/
│   ├── __init__.py          # create_app(): config, blueprints, CORS, limiter, error handlers
│   ├── config.py            # settings from environment variables
│   ├── db.py                # Mongo client, GridFS bucket, indexes and metadata index sync
│   ├── models.py            # serializers: ObjectIds become string ids
│   ├── schemas.py           # Pydantic models for every request body and query string
│   ├── metadata.py          # field definitions, value validation and metadata filters
│   ├── filters.py           # shared list, search and audit filters
│   ├── files.py             # allowed types, content sniffing, safe filenames
│   ├── ocr.py               # PyMuPDF text layer, Tesseract fallback
│   ├── search.py            # text index plus partial-word search, match locations, snippets
│   ├── utils.py             # auth decorators, RBAC rules, audit logging
│   ├── seed.py              # idempotent seed: divisions, fields, super admin
│   ├── demo_seed.py         # demo users, documents and access requests
│   └── routes/              # auth, documents, access, search, catalog, stats, admin, health
├── frontend/
│   ├── src/
│   │   ├── api/             # axios client with the JWT interceptor, one module per area
│   │   ├── components/      # app shell, tables, dialogs, document, search, access, settings
│   │   ├── pages/           # landing, auth, dashboard, document, search, access, settings
│   │   ├── hooks/           # cached metadata fields, divisions, pending count
│   │   └── lib/             # small helpers, including the tested snippet renderer
│   ├── nginx.conf           # serves the build and proxies /api to the backend (Docker)
│   ├── vercel.json          # the same proxying on Vercel
│   └── Dockerfile
├── tests/                   # pytest suite (393 tests)
├── docs/                    # these guides, plus screenshots/
├── test_api.py              # evaluators' script, unchanged
├── test_api_extended.py     # extended evaluator-style checks
├── docker-compose.yml       # mongo, backend, frontend, and the tests service
├── Dockerfile               # backend runtime and test images
├── render.yaml              # Render Blueprint for the API
├── run.py                   # local entry point without Docker
└── .env.example
```
