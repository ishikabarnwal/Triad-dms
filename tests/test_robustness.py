"""Failure paths: storage errors, races, odd files, OCR limits and config parsing."""

import io

import fitz
import pytesseract
import pytest
from PIL import Image
from pymongo.collection import Collection
from pymongo.errors import PyMongoError

from app import config
from app.db import ensure_indexes
from tests.samples import FAKE_PDF, scanned_image, text_pdf


def fail_writes_to(monkeypatch, collection_name):
    """Make insert_one fail for one collection only."""
    original = Collection.insert_one

    def insert_one(self, document, *args, **kwargs):
        if self.name == collection_name:
            raise PyMongoError("simulated write failure")
        return original(self, document, *args, **kwargs)

    monkeypatch.setattr(Collection, "insert_one", insert_one)


# ---- error handling ----

def test_unexpected_errors_return_generic_json_500(app):
    app.add_url_rule("/api/boom", "boom", lambda: 1 / 0)

    response = app.test_client().get("/api/boom")

    assert response.status_code == 500
    assert response.get_json() == {"error": "internal_error", "message": "Something went wrong on the server."}
    assert "ZeroDivision" not in response.get_data(as_text=True)


def test_failed_audit_write_does_not_fail_the_request(client, register, monkeypatch):
    register()
    fail_writes_to(monkeypatch, "audit_logs")

    response = client.post("/api/auth/login", json={"email": "asha@example.com", "password": "secret123"})

    assert response.status_code == 200


def test_health_reports_database_down_as_503(client, monkeypatch):
    class BrokenDb:
        def command(self, name):
            raise PyMongoError("no route to host")

    monkeypatch.setattr("app.routes.health.get_db", lambda: BrokenDb())

    response = client.get("/api/health")

    assert response.status_code == 503
    assert response.get_json()["database"] == "unreachable"


def test_health_reports_missing_tesseract(client, monkeypatch):
    def missing():
        raise pytesseract.TesseractNotFoundError()

    monkeypatch.setattr(pytesseract, "get_tesseract_version", missing)

    assert client.get("/api/health").get_json()["ocr"] == {"status": "unavailable", "version": None}


# ---- storage ----

def test_changed_index_definition_is_replaced(db):
    db.users.drop_index("users_email_unique")
    db.users.create_index("email", unique=True, name="users_email_unique")

    ensure_indexes(db)

    assert "partialFilterExpression" in db.users.index_information()["users_email_unique"]


def test_missing_gridfs_file_is_404(app, client, upload, tokens, db):
    doc_id = upload(text_pdf("x"), headers=tokens["a"]).get_json()["id"]
    app.extensions["gridfs"].delete(db.documents.find_one()["gridfs_id"])

    response = client.get(f"/api/documents/{doc_id}/download", headers=tokens["a"])

    assert response.status_code == 404
    assert response.get_json()["error"] == "file_not_found"


def test_failed_document_insert_removes_the_stored_file(upload, tokens, db, monkeypatch):
    fail_writes_to(monkeypatch, "documents")

    response = upload(text_pdf("x"), headers=tokens["a"])

    assert response.status_code == 500
    assert db.fs.files.count_documents({}) == 0


# ---- races the unique indexes protect against ----

def test_simultaneous_access_requests_end_in_one_pending(client, upload, tokens, db, monkeypatch):
    doc_id = upload(text_pdf("x"), headers=tokens["a"]).get_json()["id"]
    first = client.post("/api/access/request", json={"doc_id": doc_id}, headers=tokens["b"]).get_json()
    # Pretend the second request's check ran before the first insert landed.
    monkeypatch.setattr("app.routes.access.document_access", lambda user, document: ("none", None))

    second = client.post("/api/access/request", json={"doc_id": doc_id}, headers=tokens["b"])

    assert second.status_code == 409
    assert second.get_json()["request_id"] == first["id"]
    assert db.access_requests.count_documents({}) == 1


def test_simultaneous_signups_with_the_same_email(register, monkeypatch, db):
    register()
    monkeypatch.setattr("app.routes.auth.ensure_identity_free", lambda email, username: None)

    response = register(username="different_name")

    assert response.status_code == 409
    assert response.get_json()["error"] == "email_taken"
    assert db.users.count_documents({"email": "asha@example.com"}) == 1


# ---- files and OCR ----

def ocr_text(client, headers, response):
    """OCR text of an uploaded document, through the details endpoint."""
    return client.get(f"/api/documents/{response.get_json()['id']}", headers=headers).get_json()["ocr_text"]


@pytest.mark.parametrize(
    ("image_format", "extension", "mime"),
    [("BMP", "bmp", "image/bmp"), ("WEBP", "webp", "image/webp"), ("TIFF", "tif", "image/tiff")],
)
def test_other_image_formats_are_accepted_and_ocrd(client, upload, tokens, image_format, extension, mime):
    response = upload(scanned_image("RADIO LOG", image_format), filename=f"scan.{extension}", headers=tokens["a"])

    assert response.status_code == 201
    assert response.get_json()["content_type"] == mime
    assert "RADIO" in ocr_text(client, tokens["a"], response).upper()


def test_multi_page_tiff_is_ocrd_page_by_page(client, upload, tokens):
    pages = [Image.open(io.BytesIO(scanned_image(word))) for word in ("FIRST PAGE", "SECOND PAGE")]
    buffer = io.BytesIO()
    pages[0].save(buffer, format="TIFF", save_all=True, append_images=pages[1:])

    response = upload(buffer.getvalue(), filename="pages.tiff", headers=tokens["a"])

    text = ocr_text(client, tokens["a"], response).upper()
    assert response.get_json()["page_count"] == 2
    assert "FIRST" in text and "SECOND" in text


def test_password_protected_pdf_is_stored_with_failed_ocr(upload, tokens):
    pdf = fitz.open()
    pdf.new_page().insert_text((72, 72), "locked")
    data = pdf.tobytes(encryption=fitz.PDF_ENCRYPT_AES_256, user_pw="user", owner_pw="owner")

    response = upload(data, filename="locked.pdf", headers=tokens["a"])

    assert response.status_code == 201
    assert response.get_json()["ocr_status"] == "failed"
    assert "password" in response.get_json()["ocr_error"]


def test_ocr_page_cap_limits_tesseract_work(make_app):
    client = make_app(OCR_MAX_PAGES=1).test_client()
    signup = {"email": "cap@example.com", "password": "secret123", "division": "Division A"}
    headers = {"Authorization": f"Bearer {client.post('/api/auth/register', json=signup).get_json()['token']}"}
    pdf = fitz.open()
    for word in ("ALPHA", "BRAVO"):
        page = pdf.new_page(width=1600, height=220)
        page.insert_image(page.rect, stream=scanned_image(word))

    response = client.post(
        "/api/documents/upload",
        data={"file": (io.BytesIO(pdf.tobytes()), "two.pdf")},
        headers=headers,
        content_type="multipart/form-data",
    )

    details = client.get(f"/api/documents/{response.get_json()['id']}", headers=headers).get_json()
    assert details["page_count"] == 2
    assert "ALPHA" in details["ocr_text"].upper()
    assert "BRAVO" not in details["ocr_text"].upper()


def test_long_filenames_are_shortened_but_keep_the_extension(upload, tokens):
    response = upload(FAKE_PDF, filename=("x" * 300) + ".pdf", headers=tokens["a"])

    filename = response.get_json()["filename"]
    assert len(filename) == 200
    assert filename.endswith(".pdf")


# ---- config parsing ----

def test_env_helpers(monkeypatch):
    monkeypatch.setenv("T_BOOL", " Yes ")
    monkeypatch.setenv("T_INT", "42")
    monkeypatch.setenv("T_LIST", "a, b,,c ")
    monkeypatch.setenv("T_BLANK", "   ")

    assert config.env_bool("T_BOOL", False) is True
    assert config.env_bool("T_BLANK", True) is True
    assert config.env_int("T_INT", 0) == 42
    assert config.env_int("T_BLANK", 7) == 7
    assert config.env_list("T_LIST", []) == ["a", "b", "c"]
    assert config.env_list("T_BLANK", ["x"]) == ["x"]


def test_env_int_rejects_garbage(monkeypatch):
    monkeypatch.setenv("T_INT", "forty")

    with pytest.raises(RuntimeError, match="T_INT must be an integer"):
        config.env_int("T_INT", 0)


def test_app_refuses_to_start_without_jwt_secret(make_app):
    with pytest.raises(RuntimeError, match="JWT_SECRET"):
        make_app(JWT_SECRET="")
