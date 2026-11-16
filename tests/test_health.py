"""Health check and error format tests."""


def test_health_reports_database_ok(client):
    response = client.get("/api/health")

    assert response.status_code == 200
    body = response.get_json()
    assert body["status"] == "ok"
    assert body["database"] == "ok"
    assert body["ocr"]["status"] in {"available", "unavailable"}


def test_unknown_route_returns_json_error(client):
    response = client.get("/api/does-not-exist")

    assert response.status_code == 404
    assert response.get_json()["error"] == "not_found"
    assert response.get_json()["message"]


def test_wrong_method_returns_json_error(client):
    response = client.post("/api/health")

    assert response.status_code == 405
    assert response.get_json()["error"] == "method_not_allowed"
