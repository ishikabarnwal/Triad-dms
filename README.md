# Triad DMS

A document management system with dynamic metadata, division-based access control, cross-division access requests and OCR search. Built as the Triad AI full stack internship assignment.

[![tests](https://github.com/ishikabarnwal/Triad-dms/actions/workflows/tests.yml/badge.svg)](https://github.com/ishikabarnwal/Triad-dms/actions/workflows/tests.yml)
![Python 3.12](https://img.shields.io/badge/Python-3.12-3776AB?logo=python&logoColor=white)
![Flask 3.0](https://img.shields.io/badge/Flask-3.0-000000?logo=flask&logoColor=white)
![React 18](https://img.shields.io/badge/React-18-61DAFB?logo=react&logoColor=black)
![MongoDB 7](https://img.shields.io/badge/MongoDB-7-47A248?logo=mongodb&logoColor=white)
![Docker Compose](https://img.shields.io/badge/Docker-Compose-2496ED?logo=docker&logoColor=white)

![Landing page](docs/screenshots/landing.png)

## Live demo

Live demo: coming soon

| Account | Email | Division | Password |
|---|---|---|---|
| Super admin | `admin@example.com` (username `admin`) | Headquarters | the `ADMIN_PASSWORD` in your `.env` |
| Asha Verma | `asha.verma@example.com` | Division A | `Demo@12345` |
| Ravi Menon | `ravi.menon@example.com` | Division A | `Demo@12345` |
| Meera Rao | `meera.rao@example.com` | Division B | `Demo@12345` |
| Arjun Singh | `arjun.singh@example.com` | Division B | `Demo@12345` |

These are demo credentials only. Never reuse them on a real deployment.

## What it does

- **Dynamic metadata.** Fields are defined in the database and managed from the admin settings. Uploads, validation, filters and forms all follow them, and no field name is hardcoded.
- **Division-based access control.** Every user belongs to one division. Files, previews and OCR text stay inside the owning division unless access is granted, and one module enforces the rules for every route.
- **Cross-division access requests.** Anyone can see another division's document titles and details and ask for access. The owning division approves (optionally for a fixed number of days), rejects with a note, or revokes later.
- **OCR and search.** PDFs use their text layer, and scanned pages and images go through Tesseract. Search ranks matches in titles, metadata and file text, and never reveals the text of a file you can't open.

Also: expiring and revocable access, an audit log, rate-limited login, content-type verification, a command palette, admin settings, demo data and CI. Details in [docs/FEATURES.md](docs/FEATURES.md).

## Screenshots

| | |
|---|---|
| ![Dashboard](docs/screenshots/dashboard.png) **Dashboard**: totals, documents by type, recent activity, filterable table. | ![Search](docs/screenshots/search.png) **Search**: another division's file shows only its details; a shared file shows highlighted text. |
| ![Locked document](docs/screenshots/document-locked.png) **Locked document** seen from another division, with a request button. | ![Access requests](docs/screenshots/access-requests.png) **Access requests**: pending, approved, rejected and revoked, with notes. |

More in [docs/SCREENSHOTS.md](docs/SCREENSHOTS.md).

## Quick start

Needs Docker Desktop (or Docker Engine with Compose). Ports 3000, 5000 and 27017 must be free.

```bash
git clone https://github.com/ishikabarnwal/Triad-dms.git
cd Triad-dms
cp .env.example .env            # PowerShell: Copy-Item .env.example .env
docker compose up -d --build
docker compose exec backend python -m app.demo_seed --reset
```

Open http://localhost:3000. The API is at http://localhost:5000/api. Running without Docker, configuration and the code layout are in [docs/DEVELOPMENT.md](docs/DEVELOPMENT.md).

## Testing

| Suite | Command | Result |
|---|---|---|
| Backend (pytest, real MongoDB) | `docker compose run --rm tests` | 392 passed |
| Frontend unit tests | `cd frontend && npm ci && npm test` | 6 passed |
| Evaluators' script | `python test_api.py` | 1 of 1 passed |
| Extended evaluator-style script | `python test_api_extended.py` | 28 of 28 passed |

The two scripts call the running API on port 5000 and need `pip install requests`. GitHub Actions runs all four on every push.

## Notes for evaluators

- **Uploads without a token.** The provided `test_api.py` uploads without an `Authorization` header. With `ALLOW_ANONYMOUS_UPLOAD=true` (the default in `.env.example`) the upload is accepted, its division comes from `metadata["Division"]`, and it is stored with `uploaded_by: null`. With a token, the normal division rules always apply. Set the flag to `false` in production; the Render config does.
- **`test_sample.pdf` has no pages.** It is still stored in GridFS, with `ocr_status: "failed"` and the reason in `ocr_error`, and the API returns 201: an OCR failure never fails an upload.
- **Seed data** always includes "Division A", "Division B" and a "Report Type" field with the option "Financial".

The full explanation is in [docs/DEVELOPMENT.md](docs/DEVELOPMENT.md#notes-for-evaluators-in-full).

## Documentation

| Document | Contents |
|---|---|
| [docs/FEATURES.md](docs/FEATURES.md) | Everything that is implemented, by requirement |
| [docs/ARCHITECTURE.md](docs/ARCHITECTURE.md) | Layers, data model, access rules and request lifecycle, OCR and search |
| [docs/API.md](docs/API.md) | All endpoints, with upload and search examples |
| [docs/DECISIONS.md](docs/DECISIONS.md) | Design decisions and trade-offs, security notes, next steps |
| [docs/DEVELOPMENT.md](docs/DEVELOPMENT.md) | Setup with and without Docker, tests, project structure |
| [docs/DEPLOYMENT.md](docs/DEPLOYMENT.md) | Free deployment on MongoDB Atlas, Render and Vercel |
| [docs/SCREENSHOTS.md](docs/SCREENSHOTS.md) | All screenshots |

## Author

**Ishika Barnwal**

- GitHub: [github.com/ishikabarnwal](https://github.com/ishikabarnwal)
- LinkedIn: _add link_
