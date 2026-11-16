import json
import sys
import uuid

import requests

BASE_URL = "http://localhost:5000/api"
REPORT_FILE = "test_report_extended.txt"

results = {"total": 0, "passed": 0, "failed": 0, "errors": []}

# Unique per run, so the script can be run again and again against the same database.
RUN_ID = uuid.uuid4().hex[:8]
SECRET_WORD = f"codeword{RUN_ID}"
SECRET_SENTENCE = f"The {SECRET_WORD} convoy leaves the northern depot at dawn"

state = {}


def log_result(test_name, success, error_msg=""):
    results["total"] += 1
    if success:
        results["passed"] += 1
    else:
        results["failed"] += 1
        results["errors"].append(f"[{test_name}] FAILED: {error_msg}")


def check(test_name, response, expected_status, extra_check=None, extra_msg=""):
    """Log one endpoint check: the status code, plus an optional check on the JSON body."""
    if response.status_code != expected_status:
        log_result(test_name, False, f"Expected {expected_status}, got {response.status_code}. Response: {response.text[:300]}")
        return False
    if extra_check is not None:
        try:
            ok = extra_check(response.json())
        except (ValueError, KeyError, TypeError, IndexError) as e:
            ok, extra_msg = False, f"{extra_msg} ({e})"
        if not ok:
            log_result(test_name, False, f"{extra_msg}. Response: {response.text[:300]}")
            return False
    log_result(test_name, True)
    return True


def auth(user_key):
    return {"Authorization": f"Bearer {state[user_key]['token']}"}


def build_pdf(text):
    """A minimal one-page PDF with a real text layer, built by hand so only `requests` is needed."""
    safe = text.replace("\\", "\\\\").replace("(", "\\(").replace(")", "\\)")
    content = f"BT /F1 14 Tf 72 720 Td ({safe}) Tj ET"
    objects = [
        "<< /Type /Catalog /Pages 2 0 R >>",
        "<< /Type /Pages /Kids [3 0 R] /Count 1 >>",
        "<< /Type /Page /Parent 2 0 R /MediaBox [0 0 612 792] "
        "/Resources << /Font << /F1 4 0 R >> >> /Contents 5 0 R >>",
        "<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica >>",
        f"<< /Length {len(content)} >>\nstream\n{content}\nendstream",
    ]
    pdf = b"%PDF-1.4\n"
    offsets = []
    for number, body in enumerate(objects, start=1):
        offsets.append(len(pdf))
        pdf += f"{number} 0 obj\n{body}\nendobj\n".encode()
    xref_at = len(pdf)
    pdf += f"xref\n0 {len(objects) + 1}\n0000000000 65535 f \n".encode()
    for offset in offsets:
        pdf += f"{offset:010d} 00000 n \n".encode()
    pdf += f"trailer\n<< /Size {len(objects) + 1} /Root 1 0 R >>\nstartxref\n{xref_at}\n%%EOF\n".encode()
    return pdf


def upload(user_key, title, text, metadata):
    files = {"file": (f"{title}.pdf", build_pdf(text), "application/pdf")}
    data = {"title": title, "metadata": json.dumps(metadata)}
    return requests.post(f"{BASE_URL}/documents/upload", files=files, data=data, headers=auth(user_key))


def test_authentication():
    for key, division in (("a", "Division A"), ("b", "Division B")):
        body = {
            "name": f"Test User {key.upper()} {RUN_ID}",
            "username": f"user_{key}_{RUN_ID}",
            "email": f"user-{key}-{RUN_ID}@example.com",
            "password": "TestPass123!",
            "division": division,
        }
        response = requests.post(f"{BASE_URL}/auth/register", json=body)
        if check(f"POST /api/auth/register ({division})", response, 201,
                 lambda b, d=division: b["token"] and b["access_token"] and b["user"]["division"] == d,
                 "Expected token, access_token and the user's division"):
            state[key] = {"token": response.json()["token"], **body}

    if "a" not in state or "b" not in state:
        log_result("Authentication flow", False, "Registration failed, skipping the remaining auth tests")
        return

    duplicate = {"name": "Duplicate", "email": state["a"]["email"], "password": "TestPass123!", "division": "Division A"}
    response = requests.post(f"{BASE_URL}/auth/register", json=duplicate)
    check("POST /api/auth/register (duplicate email -> 409)", response, 409)

    response = requests.post(f"{BASE_URL}/auth/login", json={"email": state["a"]["email"], "password": "TestPass123!"})
    if check("POST /api/auth/login (by email)", response, 200,
             lambda b: b["token"] == b["access_token"], "Expected identical token and access_token"):
        state["a"]["token"] = response.json()["token"]

    response = requests.post(f"{BASE_URL}/auth/login", json={"username": state["b"]["username"], "password": "TestPass123!"})
    if check("POST /api/auth/login (by username)", response, 200, lambda b: b["user"]["division"] == "Division B",
             "Expected the Division B user"):
        state["b"]["token"] = response.json()["token"]

    response = requests.post(f"{BASE_URL}/auth/login", json={"email": state["a"]["email"], "password": "wrong-password"})
    check("POST /api/auth/login (wrong password -> 401)", response, 401)

    response = requests.get(f"{BASE_URL}/auth/me", headers=auth("a"))
    check("GET /api/auth/me", response, 200, lambda b: b["user"]["email"] == state["a"]["email"],
          "Expected the logged-in user's email")

    response = requests.get(f"{BASE_URL}/auth/me")
    check("GET /api/auth/me (no token -> 401)", response, 401)


def test_rbac_isolation():
    if "a" not in state or "b" not in state:
        log_result("RBAC isolation", False, "Needs the users from test_authentication")
        return

    response = upload("a", f"RBAC Test {RUN_ID}", "Division A only material",
                      {"Division": "Division A", "Report Type": "Financial"})
    if not check("POST /api/documents/upload (Division A user)", response, 201,
                 lambda b: b["doc_id"] and b["division"] == "Division A", "Expected doc_id in Division A"):
        return
    doc_id = response.json()["doc_id"]

    response = upload("b", "Wrong Division", "x", {"Division": "Division A"})
    check("POST /api/documents/upload (B into Division A -> 403)", response, 403)

    response = requests.get(f"{BASE_URL}/documents/{doc_id}/download", headers=auth("a"))
    check("GET /api/documents/<id>/download (owner -> 200)", response, 200)

    response = requests.get(f"{BASE_URL}/documents/{doc_id}/download", headers=auth("b"))
    check("GET /api/documents/<id>/download (other division -> 403)", response, 403)

    response = requests.get(f"{BASE_URL}/documents/{doc_id}", headers=auth("b"))
    check("GET /api/documents/<id> (other division sees no OCR text)", response, 200,
          lambda b: b["can_download"] is False and "ocr_text" not in b, "Expected can_download false and no ocr_text")

    response = requests.get(f"{BASE_URL}/documents", params={"scope": "division"}, headers=auth("b"))
    check("GET /api/documents (B's division list excludes A's doc)", response, 200,
          lambda b: doc_id not in [d["id"] for d in b["documents"]], "Division A document leaked into B's list")

    response = requests.post(f"{BASE_URL}/access/request", json={"doc_id": doc_id, "reason": "Joint review"}, headers=auth("b"))
    if not check("POST /api/access/request", response, 201, lambda b: b["request_id"] and b["status"] == "pending",
                 "Expected a pending request with request_id"):
        return
    request_id = response.json()["request_id"]

    response = requests.post(f"{BASE_URL}/access/request", json={"doc_id": doc_id}, headers=auth("b"))
    check("POST /api/access/request (duplicate -> 409)", response, 409)

    response = requests.post(f"{BASE_URL}/access/approve", json={"request_id": request_id}, headers=auth("b"))
    check("POST /api/access/approve (own request -> 403)", response, 403)

    response = requests.get(f"{BASE_URL}/access/inbox", headers=auth("a"))
    check("GET /api/access/inbox (Division A sees the request)", response, 200,
          lambda b: request_id in [r["id"] for r in b["requests"]], "Request missing from Division A's inbox")

    response = requests.post(f"{BASE_URL}/access/approve", json={"request_id": request_id, "expires_in_days": 7}, headers=auth("a"))
    check("POST /api/access/approve", response, 200, lambda b: b["status"] == "approved" and b["expires_at"],
          "Expected an approved request with an expiry")

    response = requests.get(f"{BASE_URL}/documents/{doc_id}/download", headers=auth("b"))
    check("GET /api/documents/<id>/download (after approval -> 200)", response, 200)

    response = requests.post(f"{BASE_URL}/access/revoke", json={"request_id": request_id}, headers=auth("a"))
    check("POST /api/access/revoke", response, 200)

    response = requests.get(f"{BASE_URL}/documents/{doc_id}/download", headers=auth("b"))
    check("GET /api/documents/<id>/download (after revoke -> 403)", response, 403)


def test_search():
    if "a" not in state or "b" not in state:
        log_result("Search", False, "Needs the users from test_authentication")
        return

    title = f"Search Test {RUN_ID}"
    response = upload("a", title, SECRET_SENTENCE, {"Division": "Division A", "Report Type": "Operational"})
    if not check("POST /api/documents/upload (real PDF with known text)", response, 201,
                 lambda b: b["ocr_status"] == "done", "Expected text extraction to succeed"):
        return
    doc_id = response.json()["doc_id"]

    def found_with_snippet(body):
        hit = next(r for r in body["results"] if r["id"] == doc_id)
        return "content" in hit["matched_in"] and f"<mark>{SECRET_WORD}</mark>" in hit["snippet"]

    response = requests.get(f"{BASE_URL}/search", params={"q": SECRET_WORD}, headers=auth("a"))
    check("GET /api/search (owner finds OCR text with snippet)", response, 200, found_with_snippet,
          "Expected the document with a <mark>ed snippet")

    response = requests.get(f"{BASE_URL}/search", params={"q": SECRET_WORD[:-3]}, headers=auth("a"))
    check("GET /api/search (partial word)", response, 200,
          lambda b: doc_id in [r["id"] for r in b["results"]], "Partial word didn't match")

    response = requests.get(f"{BASE_URL}/search", params={"q": SECRET_WORD, "Report Type": "Operational"}, headers=auth("a"))
    check("GET /api/search (query + metadata filter)", response, 200,
          lambda b: [r["id"] for r in b["results"]] == [doc_id], "Expected exactly the uploaded document")

    response = requests.get(f"{BASE_URL}/search", params={"q": SECRET_WORD}, headers=auth("b"))
    check("GET /api/search (other division gets no OCR match)", response, 200,
          lambda b: b["total"] == 0 and "northern depot" not in response.text, "Division A's OCR text leaked to Division B")

    def title_only(body):
        hit = next(r for r in body["results"] if r["id"] == doc_id)
        return (hit["snippet"] is None and "ocr_text" not in hit and hit["can_download"] is False
                and hit["can_request_access"] is True and "northern depot" not in response.text)

    response = requests.get(f"{BASE_URL}/search", params={"q": f"search test {RUN_ID}"}, headers=auth("b"))
    check("GET /api/search (other division: title match, no snippet)", response, 200, title_only,
          "Expected title and metadata only")


def generate_report():
    with open(REPORT_FILE, "w") as f:
        f.write("=== EXTENDED BACKEND API TEST REPORT ===\n")
        f.write(f"Run id: {RUN_ID}\n")
        f.write(f"Total Endpoints Tested: {results['total']}\n")
        f.write(f"Passed: {results['passed']}\n")
        f.write(f"Failed: {results['failed']}\n\n")

        if results["failed"] > 0:
            f.write("=== FAILURE DETAILS ===\n")
            for error in results["errors"]:
                f.write(f"{error}\n")


if __name__ == "__main__":
    print(f"Running extended API tests against {BASE_URL}...")

    for test in (test_authentication, test_rbac_isolation, test_search):
        try:
            test()
        except requests.exceptions.ConnectionError:
            log_result(test.__name__, False, "Connection Refused. Is the Flask server running on port 5000?")
        except Exception as e:
            log_result(test.__name__, False, str(e))

    generate_report()
    print(f"Testing complete. {results['passed']}/{results['total']} passed. Summary written to {REPORT_FILE}.")
    sys.exit(1 if results["failed"] else 0)
