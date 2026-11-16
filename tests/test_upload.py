"""Upload tests: the evaluators' two traps, division rules, metadata validation, file checks and OCR."""

import io

import pytest

from tests.samples import FAKE_PDF, scanned_image, scanned_pdf, text_pdf

EVALUATOR_METADATA = {"Division": "Division A", "Report Type": "Financial"}


def stored_file(app, document):
    """Read a document's bytes back out of GridFS."""
    return app.extensions["gridfs"].open_download_stream(document["gridfs_id"]).read()


# ---- the evaluators' script ----

def test_evaluator_upload_without_token_and_fake_pdf_returns_201(app, db, upload):
    response = upload(FAKE_PDF, filename="test_sample.pdf", metadata=EVALUATOR_METADATA)

    assert response.status_code == 201
    body = response.get_json()
    assert body["id"] == body["doc_id"]
    assert body["division"] == "Division A"
    assert body["metadata"] == EVALUATOR_METADATA
    assert body["upload_source"] == "anonymous"
    assert body["uploaded_by"] is None
    assert body["ocr_status"] == "failed"
    assert body["ocr_error"]

    document = db.documents.find_one()
    assert document["ocr_text"] == ""
    assert document["uploaded_by"] is None
    assert stored_file(app, document) == FAKE_PDF


def test_anonymous_upload_can_be_disabled(make_app):
    client = make_app(ALLOW_ANONYMOUS_UPLOAD=False).test_client()

    response = client.post(
        "/api/documents/upload",
        data={"file": (io.BytesIO(FAKE_PDF), "test.pdf"), "metadata": '{"Division": "Division A"}'},
        content_type="multipart/form-data",
    )

    assert response.status_code == 401
    assert response.get_json()["error"] == "auth_required"


def test_anonymous_upload_needs_a_division(upload):
    response = upload(FAKE_PDF, metadata={"Report Type": "Financial"})

    assert response.status_code == 400
    assert response.get_json()["error"] == "division_required"


def test_anonymous_upload_rejects_unknown_division(upload):
    response = upload(FAKE_PDF, metadata={"Division": "Division Z"})

    assert response.status_code == 400
    assert response.get_json()["error"] == "unknown_division"


def test_invalid_token_is_rejected_not_treated_as_anonymous(upload):
    response = upload(FAKE_PDF, metadata=EVALUATOR_METADATA, headers={"Authorization": "Bearer garbage"})

    assert response.status_code == 401


# ---- division rules with a token ----

def test_user_upload_defaults_to_own_division(upload, tokens, db):
    response = upload(text_pdf("Annual audit"), metadata={"Report Type": "Financial"}, headers=tokens["b"])

    assert response.status_code == 201
    body = response.get_json()
    assert body["division"] == "Division B"
    assert body["metadata"]["Division"] == "Division B"
    assert body["upload_source"] == "user"
    assert body["uploaded_by_name"] == "Bravo User"
    assert body["access_status"] == "owner" and body["can_download"] is True
    assert db.documents.find_one()["uploaded_by"] is not None


def test_user_cannot_upload_to_another_division(upload, tokens, db):
    response = upload(FAKE_PDF, metadata=EVALUATOR_METADATA, headers=tokens["b"])

    assert response.status_code == 403
    assert response.get_json()["error"] == "division_forbidden"
    assert db.documents.count_documents({}) == 0
    assert db.fs.files.count_documents({}) == 0


def test_division_value_is_normalised_to_canonical_name(upload, tokens):
    response = upload(FAKE_PDF, metadata={"Division": "div-a"}, headers=tokens["a"])

    assert response.status_code == 201
    assert response.get_json()["metadata"]["Division"] == "Division A"


def test_super_admin_can_upload_to_any_division(upload, tokens):
    response = upload(FAKE_PDF, metadata={"Division": "Division B"}, headers=tokens["admin"])

    assert response.status_code == 201
    assert response.get_json()["division"] == "Division B"
    assert response.get_json()["access_status"] == "admin"


# ---- metadata validation ----

def test_select_option_is_matched_ignoring_case(upload, tokens):
    response = upload(FAKE_PDF, metadata={"Report Type": "financial"}, headers=tokens["a"])

    assert response.get_json()["metadata"]["Report Type"] == "Financial"


def test_invalid_select_option_is_400_with_details(upload, tokens):
    response = upload(FAKE_PDF, metadata={"Report Type": "Gossip"}, headers=tokens["a"])

    assert response.status_code == 400
    body = response.get_json()
    assert body["error"] == "invalid_metadata"
    assert body["details"][0]["field"] == "Report Type"
    assert "Financial" in body["details"][0]["message"]


@pytest.mark.parametrize("value", ["2026-11-16", "16/11/2026", "16-11-2026", "2026-11-16T09:30:00Z"])
def test_dates_are_normalised(upload, tokens, value):
    response = upload(FAKE_PDF, metadata={"Document Date": value}, headers=tokens["a"])

    assert response.get_json()["metadata"]["Document Date"] == "2026-11-16"


def test_invalid_date_is_400(upload, tokens):
    response = upload(FAKE_PDF, metadata={"Document Date": "next tuesday"}, headers=tokens["a"])

    assert response.status_code == 400
    assert response.get_json()["details"][0]["field"] == "Document Date"


def test_number_fields_are_stored_as_numbers(upload, tokens, db):
    db.metadata_fields.insert_one({"key": "Budget", "label": "Budget", "type": "number", "active": True, "order": 9})

    ok = upload(FAKE_PDF, metadata={"Budget": "1250000"}, headers=tokens["a"])
    bad = upload(FAKE_PDF, metadata={"Budget": "a lot"}, headers=tokens["a"])

    assert ok.get_json()["metadata"]["Budget"] == 1250000
    assert bad.status_code == 400


def test_unknown_keys_are_kept(upload, tokens):
    response = upload(FAKE_PDF, metadata={"Project Code": "  X-17 ", "Priority": 2}, headers=tokens["a"])

    assert response.status_code == 201
    metadata = response.get_json()["metadata"]
    assert metadata["Project Code"] == "X-17"
    assert metadata["Priority"] == 2


def test_inactive_fields_are_not_enforced(upload, tokens, db):
    db.metadata_fields.update_one({"key": "Report Type"}, {"$set": {"active": False}})

    response = upload(FAKE_PDF, metadata={"Report Type": "Anything at all"}, headers=tokens["a"])

    assert response.status_code == 201


def test_required_fields_are_enforced(upload, tokens, db):
    db.metadata_fields.update_one({"key": "Classification"}, {"$set": {"required": True}})

    response = upload(FAKE_PDF, metadata={}, headers=tokens["a"])

    assert response.status_code == 400
    assert response.get_json()["details"][0]["field"] == "Classification"


@pytest.mark.parametrize("key", ["bad.key", "$where", "page", "scope"])
def test_unsafe_or_reserved_keys_are_rejected(upload, tokens, key):
    response = upload(FAKE_PDF, metadata={key: "x"}, headers=tokens["a"])

    assert response.status_code == 400
    assert response.get_json()["details"][0]["field"] == key


@pytest.mark.parametrize("metadata", ["{not json", "[1, 2]", '"just a string"'])
def test_metadata_must_be_a_json_object(upload, tokens, metadata):
    response = upload(FAKE_PDF, metadata=metadata, headers=tokens["a"])

    assert response.status_code == 400
    assert response.get_json()["error"] == "validation_error"


def test_nested_values_are_rejected(upload, tokens):
    response = upload(FAKE_PDF, metadata={"Notes": {"nested": True}}, headers=tokens["a"])

    assert response.status_code == 400


# ---- file checks ----

def test_missing_file_is_400(client, tokens):
    response = client.post("/api/documents/upload", data={"metadata": "{}"}, headers=tokens["a"])

    assert response.status_code == 400
    assert response.get_json()["error"] == "file_required"


def test_empty_file_is_400(upload, tokens):
    response = upload(b"", headers=tokens["a"])

    assert response.status_code == 400
    assert response.get_json()["error"] == "empty_file"


@pytest.mark.parametrize("filename", ["notes.txt", "setup.exe", "noextension"])
def test_disallowed_extensions_are_400(upload, tokens, filename):
    response = upload(FAKE_PDF, filename=filename, headers=tokens["a"])

    assert response.status_code == 400
    assert response.get_json()["error"] == "unsupported_file_type"


def test_content_must_match_a_supported_type(upload, tokens):
    response = upload(b"MZ this is really an executable", filename="report.pdf", headers=tokens["a"])

    assert response.status_code == 400
    assert response.get_json()["error"] == "invalid_file"


def test_content_type_comes_from_the_bytes_not_the_client(upload, tokens):
    response = upload(scanned_image("HELLO"), filename="scan.png", mimetype="application/x-evil", headers=tokens["a"])

    assert response.get_json()["content_type"] == "image/png"


def test_oversized_upload_is_413(make_app):
    app = make_app(MAX_CONTENT_LENGTH=2048)
    client = app.test_client()

    response = client.post(
        "/api/documents/upload",
        data={"file": (io.BytesIO(b"%PDF" + b"0" * 4096), "big.pdf"), "metadata": '{"Division": "Division A"}'},
        content_type="multipart/form-data",
    )

    assert response.status_code == 413
    assert response.get_json()["error"] == "file_too_large"


def test_title_defaults_to_filename_and_can_be_set(upload, tokens):
    default = upload(FAKE_PDF, filename="Monthly Ops Summary.pdf", headers=tokens["a"])
    custom = upload(FAKE_PDF, title="  Custom Title ", headers=tokens["a"])

    assert default.get_json()["title"] == "Monthly Ops Summary"
    assert custom.get_json()["title"] == "Custom Title"


def test_filename_paths_are_stripped(upload, tokens):
    response = upload(FAKE_PDF, filename="../../etc/passwd.pdf", headers=tokens["a"])

    assert response.get_json()["filename"] == "passwd.pdf"


def test_upload_is_audited(upload, tokens, db):
    upload(FAKE_PDF, metadata=EVALUATOR_METADATA)
    upload(FAKE_PDF, headers=tokens["a"])

    entries = list(db.audit_logs.find({"action": "document.upload"}).sort("created_at", 1))
    assert [e["actor_name"] for e in entries] == [None, "Alpha User"]
    assert entries[0]["details"]["upload_source"] == "anonymous"
    assert all(e["division"] == "Division A" for e in entries)


# ---- OCR ----

def ocr_text(client, headers, response):
    """Fetch the OCR text of an uploaded document through the details endpoint."""
    doc_id = response.get_json()["id"]
    return client.get(f"/api/documents/{doc_id}", headers=headers).get_json()["ocr_text"]


def test_pdf_text_layer_is_extracted(client, upload, tokens):
    response = upload(text_pdf("Quarterly budget allocation for Northern Command"), headers=tokens["a"])

    body = response.get_json()
    assert body["ocr_status"] == "done"
    assert body["page_count"] == 1
    assert "Quarterly budget allocation for Northern Command" in ocr_text(client, tokens["a"], response)


def test_scanned_image_is_ocrd(client, upload, tokens):
    response = upload(scanned_image("CONVOY ROUTE ALPHA"), filename="scan.png", headers=tokens["a"])

    assert response.get_json()["ocr_status"] == "done"
    text = ocr_text(client, tokens["a"], response).upper()
    assert "CONVOY" in text and "ROUTE" in text and "ALPHA" in text


def test_scanned_jpeg_is_ocrd(client, upload, tokens):
    response = upload(scanned_image("RADAR MAINTENANCE", "JPEG"), filename="scan.jpg", headers=tokens["a"])

    assert "RADAR" in ocr_text(client, tokens["a"], response).upper()


def test_pdf_without_text_layer_falls_back_to_ocr(client, upload, tokens):
    response = upload(scanned_pdf("SUPPLY DEPOT INVENTORY"), filename="scan.pdf", headers=tokens["a"])

    assert response.get_json()["ocr_status"] == "done"
    text = ocr_text(client, tokens["a"], response).upper()
    assert "SUPPLY" in text and "INVENTORY" in text


def test_ocr_can_be_switched_off(make_app):
    app = make_app(OCR_ENABLED=False)
    response = app.test_client().post(
        "/api/documents/upload",
        data={"file": (io.BytesIO(text_pdf("hello")), "a.pdf"), "metadata": '{"Division": "Division A"}'},
        content_type="multipart/form-data",
    )

    assert response.status_code == 201
    assert response.get_json()["ocr_status"] == "skipped"


def test_search_blob_includes_title_and_metadata(upload, tokens, db):
    upload(FAKE_PDF, title="Fuel Report", metadata={"Report Type": "Financial"}, headers=tokens["a"])

    blob = db.documents.find_one()["search_blob"]
    assert "Fuel Report" in blob and "Financial" in blob and "Division A" in blob
