"""Search tests: ranking, partial words, match locations, snippets, filters and confidentiality."""

from datetime import date, timedelta

import pytest

from tests.samples import FAKE_PDF, text_pdf

ALPHA_SECRET = "convoy route through the northern pass at dawn"
BRAVO_SECRET = "financial allocation for radar upgrades"


@pytest.fixture
def corpus(upload, tokens):
    """Documents in both divisions. Returns their ids by name."""

    def add(headers, title, text, **metadata):
        response = upload(text_pdf(text), title=title, metadata=metadata, headers=headers)
        assert response.status_code == 201, response.get_json()
        return response.get_json()["id"]

    return {
        "alpha_plan": add(tokens["a"], "Alpha Movement Plan", ALPHA_SECRET, **{"Report Type": "Operational"}),
        "alpha_log": add(tokens["a"], "Convoy Logbook", "daily vehicle checks", **{"Report Type": "Technical"}),
        "bravo_budget": add(tokens["b"], "Bravo Budget", BRAVO_SECRET, **{"Report Type": "Financial"}),
    }


def search(client, headers, query):
    """GET /api/search and return the JSON body (asserting 200)."""
    response = client.get(f"/api/search{query}", headers=headers)
    assert response.status_code == 200, response.get_json()
    return response.get_json()


def by_title(body):
    """Results keyed by title."""
    return {result["title"]: result for result in body["results"]}


# ---- basics ----

def test_search_requires_login(client):
    assert client.get("/api/search?q=alpha").status_code == 401


@pytest.mark.parametrize("query", ["", "?q=", "?q=%20%20", "?q=--%22%22"])
def test_empty_query_without_filters_is_400(client, tokens, query):
    response = client.get(f"/api/search{query}", headers=tokens["a"])

    assert response.status_code == 400
    assert response.get_json()["error"] == "query_required"


def test_title_match(client, tokens, corpus):
    result = by_title(search(client, tokens["a"], "?q=movement"))["Alpha Movement Plan"]

    assert result["matched_in"] == ["title"]
    assert result["id"] == result["doc_id"] == corpus["alpha_plan"]


def test_metadata_match_names_the_key(client, tokens, corpus):
    result = by_title(search(client, tokens["a"], "?q=operational"))["Alpha Movement Plan"]

    assert result["matched_in"] == ["metadata"]
    assert result["matched_keys"] == ["Report Type"]


def test_content_match_has_marked_snippet(client, tokens, corpus):
    result = by_title(search(client, tokens["a"], "?q=northern"))["Alpha Movement Plan"]

    assert result["matched_in"] == ["content"]
    assert "<mark>northern</mark>" in result["snippet"]
    assert "ocr_text" not in result


def test_match_in_several_places(client, tokens, corpus):
    result = by_title(search(client, tokens["a"], "?q=convoy"))["Alpha Movement Plan"]

    assert result["matched_in"] == ["content"]
    assert by_title(search(client, tokens["a"], "?q=convoy"))["Convoy Logbook"]["matched_in"] == ["title"]


@pytest.mark.parametrize(
    ("query", "title"),
    [("conv", "Convoy Logbook"), ("north", "Alpha Movement Plan"), ("FINANC", "Bravo Budget")],
)
def test_partial_words_match_case_insensitively(client, tokens, corpus, query, title):
    headers = tokens["b"] if title == "Bravo Budget" else tokens["a"]

    assert title in by_title(search(client, headers, f"?q={query}"))


def test_partial_match_marks_the_fragment(client, tokens, corpus):
    result = by_title(search(client, tokens["a"], "?q=north"))["Alpha Movement Plan"]

    assert "<mark>north</mark>ern" in result["snippet"]


def test_stemmed_match_from_text_index(client, tokens, corpus):
    result = by_title(search(client, tokens["a"], "?q=routes"))["Alpha Movement Plan"]

    assert "content" in result["matched_in"]
    assert "<mark>route</mark>" in result["snippet"]


def test_all_words_must_appear_for_partial_matches(client, tokens, corpus):
    titles = by_title(search(client, tokens["a"], "?q=northern%20dawn"))

    assert list(titles) == ["Alpha Movement Plan"]


def test_title_matches_rank_above_content_matches(client, upload, tokens):
    upload(text_pdf("nothing relevant here"), title="Satellite Imagery Review", headers=tokens["a"])
    upload(text_pdf("the satellite uplink was restored"), title="Weekly Notes", headers=tokens["a"])

    titles = [r["title"] for r in search(client, tokens["a"], "?q=satellite")["results"]]

    assert titles == ["Satellite Imagery Review", "Weekly Notes"]


def test_scores_are_returned(client, tokens, corpus):
    results = search(client, tokens["a"], "?q=convoy")["results"]

    assert all(isinstance(r["score"], float) for r in results)


# ---- confidentiality ----

def test_other_divisions_ocr_text_never_matches(client, tokens, corpus):
    response = client.get("/api/search?q=northern", headers=tokens["b"])

    assert response.get_json()["total"] == 0
    assert response.get_json()["results"] == []
    assert "dawn" not in response.get_data(as_text=True)


def test_other_division_partial_ocr_match_is_hidden_too(client, tokens, corpus):
    assert search(client, tokens["a"], "?q=rada")["total"] == 0


def test_other_division_title_match_returns_only_title_and_metadata(client, tokens, corpus):
    response = client.get("/api/search?q=alpha", headers=tokens["b"])
    result = by_title(response.get_json())["Alpha Movement Plan"]

    assert result["matched_in"] == ["title"]
    assert result["can_download"] is False
    assert result["access_status"] == "none"
    assert result["can_request_access"] is True
    assert result["snippet"] is None
    assert "ocr_text" not in result
    assert result["metadata"]["Report Type"] == "Operational"
    assert ALPHA_SECRET not in response.get_data(as_text=True)
    assert "dawn" not in response.get_data(as_text=True)


def test_mixed_match_drops_content_location_for_restricted_document(client, upload, tokens, corpus):
    upload(text_pdf("radar maintenance schedule"), title="Radar Report", headers=tokens["a"])

    result = by_title(search(client, tokens["b"], "?q=radar"))

    assert result["Radar Report"]["matched_in"] == ["title"]
    assert result["Radar Report"]["snippet"] is None
    assert "content" in result["Bravo Budget"]["matched_in"]


def test_approved_access_unlocks_content_search(client, tokens, corpus):
    body = {"doc_id": corpus["alpha_plan"]}
    request_id = client.post("/api/access/request", json=body, headers=tokens["b"]).get_json()["id"]
    client.post("/api/access/approve", json={"request_id": request_id}, headers=tokens["a"])

    result = by_title(search(client, tokens["b"], "?q=northern"))["Alpha Movement Plan"]

    assert result["access_status"] == "approved"
    assert "<mark>northern</mark>" in result["snippet"]


def test_revoked_access_hides_content_again(client, tokens, corpus):
    body = {"doc_id": corpus["alpha_plan"]}
    request_id = client.post("/api/access/request", json=body, headers=tokens["b"]).get_json()["id"]
    client.post("/api/access/approve", json={"request_id": request_id}, headers=tokens["a"])
    client.post("/api/access/revoke", json={"request_id": request_id}, headers=tokens["a"])

    assert search(client, tokens["b"], "?q=northern")["total"] == 0


@pytest.mark.parametrize(("word", "title"), [("northern", "Alpha Movement Plan"), ("radar", "Bravo Budget")])
def test_super_admin_searches_content_in_every_division(client, tokens, corpus, word, title):
    result = by_title(search(client, tokens["admin"], f"?q={word}"))[title]

    assert result["access_status"] == "admin"
    assert f"<mark>{word}</mark>" in result["snippet"]


# ---- snippets ----

def test_snippet_escapes_html(client, upload, tokens):
    upload(text_pdf('<script>alert("x")</script> convoy & <b>tanks</b>'), title="Odd", headers=tokens["a"])

    result = by_title(search(client, tokens["a"], "?q=tanks"))["Odd"]

    assert "<script>" not in result["snippet"] and "<b>" not in result["snippet"]
    assert "&lt;script&gt;" in result["snippet"]
    assert "&amp;" in result["snippet"]
    assert "<mark>tanks</mark>" in result["snippet"]


def test_snippet_is_short_and_centred(client, upload, tokens):
    filler = "\n".join(f"line {n} routine maintenance entry" for n in range(60))
    lines = filler.splitlines()
    lines[30] = "line 30 the hangar door seal failed inspection"
    upload(text_pdf("\n".join(lines)), title="Long Log", headers=tokens["a"])

    snippet_text = by_title(search(client, tokens["a"], "?q=hangar"))["Long Log"]["snippet"]

    plain = snippet_text.replace("<mark>", "").replace("</mark>", "")
    assert plain.startswith("… ") and plain.endswith(" …")
    assert len(plain) <= 210
    assert "<mark>hangar</mark>" in snippet_text


def test_title_only_match_has_no_snippet(client, tokens, corpus):
    assert by_title(search(client, tokens["a"], "?q=logbook"))["Convoy Logbook"]["snippet"] is None


# ---- filters ----

def test_query_combined_with_metadata_filter(client, tokens, corpus):
    titles = by_title(search(client, tokens["a"], "?q=convoy&Report Type=Technical"))

    assert list(titles) == ["Convoy Logbook"]


def test_division_filter_by_name_or_code(client, tokens, corpus):
    assert list(by_title(search(client, tokens["admin"], "?q=budget&division=div-b"))) == ["Bravo Budget"]
    assert search(client, tokens["admin"], "?q=budget&division=Division A")["total"] == 0


def test_unknown_division_filter_is_400(client, tokens, corpus):
    response = client.get("/api/search?q=x&division=Nowhere", headers=tokens["a"])

    assert response.status_code == 400
    assert response.get_json()["error"] == "unknown_division"


def test_ocr_status_filter(client, upload, tokens, corpus):
    upload(FAKE_PDF, title="Broken Scan", headers=tokens["a"])

    failed = search(client, tokens["a"], "?ocr_status=failed")

    assert [r["title"] for r in failed["results"]] == ["Broken Scan"]
    assert failed["results"][0]["matched_in"] == []


def test_date_filters(client, tokens, corpus):
    today = date.today()
    tomorrow = today + timedelta(days=1)

    assert search(client, tokens["a"], f"?q=convoy&date_from={today}&date_to={today}")["total"] == 2
    assert search(client, tokens["a"], f"?q=convoy&date_from={tomorrow}")["total"] == 0


@pytest.mark.parametrize(
    "query",
    [
        "?q=x&date_from=2026-02-01&date_to=2026-01-01",
        "?q=x&date_from=yesterday",
        "?q=x&ocr_status=maybe",
        "?q=x&limit=0",
    ],
)
def test_invalid_filters_are_400(client, tokens, query):
    assert client.get(f"/api/search{query}", headers=tokens["a"]).status_code == 400


def test_filters_without_query_return_a_filtered_list(client, tokens, corpus):
    body = search(client, tokens["b"], "?Report Type=Operational")

    result = by_title(body)["Alpha Movement Plan"]
    assert body["total"] == 1
    assert result["matched_in"] == [] and result["snippet"] is None
    assert result["can_download"] is False


def test_pagination(client, tokens, corpus):
    first = search(client, tokens["a"], "?q=convoy&limit=1&page=1")
    second = search(client, tokens["a"], "?q=convoy&limit=1&page=2")

    assert (first["total"], first["pages"]) == (2, 2)
    assert first["results"][0]["id"] != second["results"][0]["id"]


def test_non_searchable_fields_are_not_matched(client, upload, tokens):
    upload(text_pdf("nothing"), title="Dated", metadata={"Document Date": "2031-05-05"}, headers=tokens["a"])

    assert search(client, tokens["a"], "?q=2031")["total"] == 0


def test_document_list_supports_the_same_common_filters(client, upload, tokens, corpus):
    upload(FAKE_PDF, title="Broken Scan", headers=tokens["a"])

    response = client.get("/api/documents?ocr_status=failed", headers=tokens["a"]).get_json()
    by_division = client.get("/api/documents?scope=all&division=DIV-B", headers=tokens["a"]).get_json()

    assert [d["title"] for d in response["documents"]] == ["Broken Scan"]
    assert [d["title"] for d in by_division["documents"]] == ["Bravo Budget"]
