import asyncio
from datetime import datetime, timezone
from typing import List, Optional
import httpx
import pytest
from fastapi.testclient import TestClient

from app.config import settings
from app.ingestion.service import IngestionService
from app.main import (
    app,
    get_articles_cache,
    get_clock,
    get_article_extractor,
    get_ingestion_service,
)
from app.models import (
    Article,
    ArticleReport,
    ExtractionResult,
    ExtractionSummary,
)
from app.trusted_sources import TRUSTED_SOURCES, is_trusted_domain
from app.verdicts import VERDICT_COLORS, VERDICT_LABELS


class FakeIngestionService:
    def __init__(self, articles: Optional[List[Article]] = None) -> None:
        self.articles = articles if articles is not None else []
        self.captured_limits: List[int] = []
        self.captured_sources: List[Optional[str]] = []

    async def fetch_articles(
        self,
        limit: int = 20,
        source: Optional[str] = None,
    ) -> List[Article]:
        self.captured_limits.append(limit)
        self.captured_sources.append(source)
        return self.articles[:limit]



# ---------------------------------------------------------------------------
# Test 1: Default ArticleReport shape and values
# ---------------------------------------------------------------------------
def test_default_article_report_has_checked_false_no_verdict_no_claims_no_evidence():
    article = Article(
        hn_id=101,
        title="Sample News",
        url="https://example.com/article",
        published_at=datetime.now(timezone.utc),
        hn_score=42,
    )
    extraction = ExtractionSummary(
        status="ok",
        word_count=250,
        text_preview="Sample preview text...",
        final_url="https://example.com/article",
    )
    report = ArticleReport(article=article, extraction=extraction)

    assert report.checked is False
    assert report.overall_verdict_key is None
    assert report.overall_confidence is None
    assert report.claims == []
    assert report.skipped_statements == []


# ---------------------------------------------------------------------------
# Test 2: VERDICT_LABELS and VERDICT_COLORS dictionary contracts
# ---------------------------------------------------------------------------
def test_verdict_labels_and_colors_match_contract_and_contain_no_fake():
    expected_labels = {
        "supported": "Verified with evidence",
        "refuted": "Evidence says this is false",
        "mixed": "Evidence shows only part of this is true",
        "not_enough_evidence": "Not enough evidence yet",
    }
    assert VERDICT_LABELS == expected_labels
    for key, label in VERDICT_LABELS.items():
        assert "fake" not in label.lower()

    expected_colors = {
        "supported": "green",
        "refuted": "red",
        "mixed": "yellow",
        "not_enough_evidence": "grey",
    }
    assert VERDICT_COLORS == expected_colors
    assert set(VERDICT_LABELS.keys()) == set(VERDICT_COLORS.keys())


# ---------------------------------------------------------------------------
# Test 3: TRUSTED_SOURCES list length and unique domains
# ---------------------------------------------------------------------------
def test_trusted_sources_has_exactly_eight_unique_domains():
    assert len(TRUSTED_SOURCES) == 8
    domains = [s.domain for s in TRUSTED_SOURCES]
    assert len(set(domains)) == 8


# ---------------------------------------------------------------------------
# Test 4: is_trusted_domain validation and security look-alike rejection
# ---------------------------------------------------------------------------
def test_is_trusted_domain_accepts_valid_and_rejects_lookalikes():
    # Accepts all 8 official domains
    for source in TRUSTED_SOURCES:
        assert is_trusted_domain(source.domain) is True

    # Accepts valid subdomains
    assert is_trusted_domain("www.reuters.com") is True
    assert is_trusted_domain("blogs.nist.gov") is True

    # Rejects look-alikes and security threats
    assert is_trusted_domain("evilreuters.com") is False
    assert is_trusted_domain("reuters.com.evil.io") is False
    assert is_trusted_domain("notnist.gov") is False
    assert is_trusted_domain("") is False
    assert is_trusted_domain("reuters.com:443/path") is False


# ---------------------------------------------------------------------------
# Test 5: /api/trusted-sources endpoint returns 8 sources
# ---------------------------------------------------------------------------
def test_api_trusted_sources_returns_eight_sources():
    client = TestClient(app)
    response = client.get("/api/trusted-sources")
    assert response.status_code == 200
    data = response.json()
    assert "sources" in data
    assert len(data["sources"]) == 8
    names = [s["name"] for s in data["sources"]]
    assert "Associated Press" in names
    assert "Reuters" in names


# ---------------------------------------------------------------------------
# Test 6: /api/articles returns reports in order with checked=false
# ---------------------------------------------------------------------------
def test_api_articles_returns_reports_in_order_with_checked_false():
    articles_data = [
        Article(hn_id=1, title="Story 1", url="https://example.com/1", hn_score=10),
        Article(hn_id=2, title="Story 2", url="https://example.com/2", hn_score=20),
        Article(hn_id=3, title="Story 3", url="https://example.com/3", hn_score=30),
    ]

    class FakeIngestionService:
        async def fetch_articles(
            self,
            limit: int = 20,
            source: Optional[str] = None,
        ) -> List[Article]:
            return articles_data[:limit]

    class FakeExtractor:
        async def extract(self, url: str) -> ExtractionResult:
            return ExtractionResult(
                status="ok",
                text=f"Body text for {url}",
                word_count=4,
                final_url=url,
            )

    test_cache = {}
    app.dependency_overrides[get_ingestion_service] = lambda: FakeIngestionService()
    app.dependency_overrides[get_article_extractor] = lambda: FakeExtractor()
    app.dependency_overrides[get_articles_cache] = lambda: test_cache

    try:
        client = TestClient(app)
        response = client.get("/api/articles?limit=3")
        assert response.status_code == 200
        data = response.json()

        assert data["total"] == 3
        assert len(data["articles"]) == 3
        assert data["cached"] is False

        for idx, report in enumerate(data["articles"]):
            assert report["article"]["hn_id"] == idx + 1
            assert report["checked"] is False
            assert report["overall_verdict_key"] is None
            assert report["claims"] == []
            assert report["extraction"]["status"] == "ok"
            assert report["extraction"]["word_count"] == 4
            assert report["extraction"]["text_preview"] == f"Body text for https://example.com/{idx+1}"
    finally:
        app.dependency_overrides.clear()




# ---------------------------------------------------------------------------
# Test 7: text_preview is <= 600 chars and empty on failed extraction
# ---------------------------------------------------------------------------
def test_text_preview_is_at_most_600_chars_and_empty_on_failed_extraction():
    long_text = "A" * 1200
    articles_data = [
        Article(hn_id=1, title="Long Article", url="https://example.com/long"),
        Article(hn_id=2, title="Failed Article", url="https://example.com/fail"),
    ]

    class FakeIngestionService:
        async def fetch_articles(
            self,
            limit: int = 20,
            source: Optional[str] = None,
        ) -> List[Article]:
            return articles_data[:limit]

    class FakeExtractor:
        async def extract(self, url: str) -> ExtractionResult:
            if "long" in url:
                return ExtractionResult(status="ok", text=long_text, word_count=1200)
            return ExtractionResult(status="fetch_failed", text="", word_count=0)

    test_cache = {}
    app.dependency_overrides[get_ingestion_service] = lambda: FakeIngestionService()
    app.dependency_overrides[get_article_extractor] = lambda: FakeExtractor()
    app.dependency_overrides[get_articles_cache] = lambda: test_cache

    try:
        client = TestClient(app)
        response = client.get("/api/articles?limit=2")
        assert response.status_code == 200
        data = response.json()

        long_rep = data["articles"][0]
        assert len(long_rep["extraction"]["text_preview"]) == 600
        assert long_rep["extraction"]["text_preview"] == "A" * 600

        fail_rep = data["articles"][1]
        assert fail_rep["extraction"]["status"] == "fetch_failed"
        assert fail_rep["extraction"]["text_preview"] == ""
    finally:
        app.dependency_overrides.clear()




# ---------------------------------------------------------------------------
# Test 8: Failed extraction status passed through, Article kept in list
# ---------------------------------------------------------------------------
def test_failed_extraction_statuses_passed_through_and_article_preserved():
    articles_data = [
        Article(hn_id=1, title="Not HTML Doc", url="https://example.com/doc.pdf"),
        Article(hn_id=2, title="Timeout Doc", url="https://example.com/timeout"),
    ]

    class FakeIngestionService:
        async def fetch_articles(
            self,
            limit: int = 20,
            source: Optional[str] = None,
        ) -> List[Article]:
            return articles_data[:limit]

    class FakeExtractor:
        async def extract(self, url: str) -> ExtractionResult:
            if "doc.pdf" in url:
                return ExtractionResult(status="not_html", final_url=url)
            return ExtractionResult(status="fetch_failed", final_url=url)

    test_cache = {}
    app.dependency_overrides[get_ingestion_service] = lambda: FakeIngestionService()
    app.dependency_overrides[get_article_extractor] = lambda: FakeExtractor()
    app.dependency_overrides[get_articles_cache] = lambda: test_cache

    try:
        client = TestClient(app)
        response = client.get("/api/articles?limit=2")
        assert response.status_code == 200
        data = response.json()

        assert len(data["articles"]) == 2
        assert data["articles"][0]["article"]["title"] == "Not HTML Doc"
        assert data["articles"][0]["extraction"]["status"] == "not_html"
        assert data["articles"][1]["article"]["title"] == "Timeout Doc"
        assert data["articles"][1]["extraction"]["status"] == "fetch_failed"
    finally:
        app.dependency_overrides.clear()




# ---------------------------------------------------------------------------
# Test 9: Limit bounds validation (0 and 31 return 422, valid works)
# ---------------------------------------------------------------------------
def test_limit_query_parameter_validation():
    client = TestClient(app)

    # Below minimum (1)
    res_0 = client.get("/api/articles?limit=0")
    assert res_0.status_code == 422

    # Above maximum (30)
    res_31 = client.get("/api/articles?limit=31")
    assert res_31.status_code == 422

    # Valid limits work and reach service
    fake_service = FakeIngestionService([])
    test_cache = {}
    app.dependency_overrides[get_ingestion_service] = lambda: fake_service
    app.dependency_overrides[get_articles_cache] = lambda: test_cache
    try:
        res_valid = client.get("/api/articles?limit=7")
        assert res_valid.status_code == 200
        assert fake_service.captured_limits == [7]
    finally:
        app.dependency_overrides.clear()




# ---------------------------------------------------------------------------
# Test 10: In-memory cache hit and TTL expiration with injected clock
# ---------------------------------------------------------------------------
def test_in_memory_cache_hit_and_ttl_expiration_with_injected_clock():
    feed_calls = 0

    class CountingIngestionService:
        async def fetch_articles(
            self,
            limit: int = 20,
            source: Optional[str] = None,
        ) -> List[Article]:
            nonlocal feed_calls
            feed_calls += 1
            return [Article(hn_id=1, title="Cached Story", url="https://example.com/cached")][:limit]

    class DummyExtractor:
        async def extract(self, url: str) -> ExtractionResult:
            return ExtractionResult(status="ok", text="Text", word_count=1)

    current_time = [1000.0]
    test_cache = {}

    app.dependency_overrides[get_ingestion_service] = lambda: CountingIngestionService()
    app.dependency_overrides[get_article_extractor] = lambda: DummyExtractor()
    app.dependency_overrides[get_clock] = lambda: (lambda: current_time[0])
    app.dependency_overrides[get_articles_cache] = lambda: test_cache

    try:
        client = TestClient(app)

        # Call 1: Miss
        res1 = client.get("/api/articles?limit=5")
        assert res1.status_code == 200
        assert res1.json()["cached"] is False
        assert feed_calls == 1

        # Call 2: Hit within TTL
        current_time[0] += 100.0  # within 600s
        res2 = client.get("/api/articles?limit=5")
        assert res2.status_code == 200
        assert res2.json()["cached"] is True
        assert feed_calls == 1

        # Call 3: Expired after TTL
        current_time[0] += 501.0  # total 601s passed since cached
        res3 = client.get("/api/articles?limit=5")
        assert res3.status_code == 200
        assert res3.json()["cached"] is False
        assert feed_calls == 2
    finally:
        app.dependency_overrides.clear()




# ---------------------------------------------------------------------------
# Test 11: Concurrency cap ARTICLES_MAX_CONCURRENT_EXTRACTIONS is enforced
# ---------------------------------------------------------------------------
def test_extraction_concurrency_cap_is_enforced():
    articles_data = [
        Article(hn_id=i, title=f"Story {i}", url=f"https://example.com/{i}")
        for i in range(10)
    ]

    in_flight = 0
    max_in_flight = 0

    class TrackingExtractor:
        async def extract(self, url: str) -> ExtractionResult:
            nonlocal in_flight, max_in_flight
            in_flight += 1
            max_in_flight = max(max_in_flight, in_flight)
            await asyncio.sleep(0.02)
            in_flight -= 1
            return ExtractionResult(status="ok", text="Extracted text", word_count=2)

    test_cache = {}
    app.dependency_overrides[get_ingestion_service] = lambda: FakeIngestionService(articles_data)
    app.dependency_overrides[get_article_extractor] = lambda: TrackingExtractor()
    app.dependency_overrides[get_articles_cache] = lambda: test_cache

    try:
        client = TestClient(app)
        response = client.get("/api/articles?limit=10")
        assert response.status_code == 200
        assert max_in_flight <= settings.ARTICLES_MAX_CONCURRENT_EXTRACTIONS
        assert max_in_flight > 1
    finally:
        app.dependency_overrides.clear()




# ---------------------------------------------------------------------------
# Test 12: Empty feed returns 200 with empty articles list
# ---------------------------------------------------------------------------
def test_empty_feed_returns_200_with_empty_articles_and_zero_total():
    class EmptyIngestionService:
        async def fetch_articles(
            self,
            limit: int = 20,
            source: Optional[str] = None,
        ) -> List[Article]:
            return []

    test_cache = {}
    app.dependency_overrides[get_ingestion_service] = lambda: EmptyIngestionService()
    app.dependency_overrides[get_articles_cache] = lambda: test_cache

    try:
        client = TestClient(app)
        response = client.get("/api/articles?limit=5")
        assert response.status_code == 200
        data = response.json()
        assert data["articles"] == []
        assert data["total"] == 0
        assert data["cached"] is False
    finally:
        app.dependency_overrides.clear()



# ---------------------------------------------------------------------------
# Test 13: app.main imports clean without error
# ---------------------------------------------------------------------------
def test_app_imports_clean():
    import importlib
    import app.main
    reloaded = importlib.reload(app.main)
    assert getattr(reloaded, "app", None) is not None


# ---------------------------------------------------------------------------
# Test 14: No source param passes source=None to ingestion and leaves behavior unchanged
# ---------------------------------------------------------------------------
def test_articles_no_source_param_behavior_unchanged():
    captured_source = []

    class MockIngestion:
        async def fetch_articles(self, limit: int = 20, source: Optional[str] = None):
            captured_source.append(source)
            return [
                Article(hn_id=1, title="Story 1", url="https://example.com/1", hn_score=10),
            ]

    class MockExtractor:
        async def extract(self, url: str) -> ExtractionResult:
            return ExtractionResult(status="ok", text="Text", word_count=1, final_url=url)

    app.dependency_overrides[get_ingestion_service] = lambda: MockIngestion()
    app.dependency_overrides[get_article_extractor] = lambda: MockExtractor()
    app.dependency_overrides[get_articles_cache] = lambda: {}
    try:
        client = TestClient(app)
        response = client.get("/api/articles?limit=1")
        assert response.status_code == 200
        assert captured_source == [None]
        data = response.json()
        assert len(data["articles"]) == 1
        assert data["articles"][0]["checked"] is False
    finally:
        app.dependency_overrides.clear()



# ---------------------------------------------------------------------------
# Test 15: source=medium passes param and returns articles with checked=false
# ---------------------------------------------------------------------------
def test_articles_source_medium_returns_articles_checked_false():
    captured_source = []
    med_article = Article(
        id="med_abc123",
        hn_id=0,
        title="Medium Story",
        url="https://medium.com/@dev/post",
        source="Medium",
        category="technology",
    )

    class MockIngestion:
        async def fetch_articles(self, limit: int = 20, source: Optional[str] = None):
            captured_source.append(source)
            if source == "medium":
                return [med_article]
            return []

    class MockExtractor:
        async def extract(self, url: str) -> ExtractionResult:
            return ExtractionResult(status="ok", text="Medium article text", word_count=3, final_url=url)

    app.dependency_overrides[get_ingestion_service] = lambda: MockIngestion()
    app.dependency_overrides[get_article_extractor] = lambda: MockExtractor()
    app.dependency_overrides[get_articles_cache] = lambda: {}
    try:
        client = TestClient(app)
        response = client.get("/api/articles?limit=1&source=medium")
        assert response.status_code == 200
        assert captured_source == ["medium"]
        data = response.json()
        assert len(data["articles"]) == 1
        report = data["articles"][0]
        assert report["article"]["source"] == "Medium"
        assert report["checked"] is False
        assert report["overall_verdict_key"] is None
    finally:
        app.dependency_overrides.clear()



# ---------------------------------------------------------------------------
# Test 16: source=bogus returns clean 4xx (currently 200 due to unvalidated source)
# ---------------------------------------------------------------------------
@pytest.mark.xfail(
    strict=True,
    reason="source=bogus currently returns 200 instead of clean 4xx (unvalidated source query param)",
)
def test_articles_source_bogus_clean_4xx():
    class MockIngestion:
        async def fetch_articles(self, limit: int = 20, source: Optional[str] = None):
            return []

    app.dependency_overrides[get_ingestion_service] = lambda: MockIngestion()
    app.dependency_overrides[get_articles_cache] = lambda: {}
    try:
        client = TestClient(app)
        response = client.get("/api/articles?source=bogus")
        assert 400 <= response.status_code < 500
    finally:
        app.dependency_overrides.clear()



# ---------------------------------------------------------------------------
# Test 17: Medium client failure does not crash endpoint (returns 200)
# ---------------------------------------------------------------------------
def test_articles_medium_client_failure_does_not_crash_endpoint():
    def failing_medium_handler(request: httpx.Request) -> httpx.Response:
        if "medium.com" in str(request.url):
            raise httpx.ConnectError("Simulated connection error")
        return httpx.Response(200, json=[])

    mock_client = httpx.AsyncClient(transport=httpx.MockTransport(failing_medium_handler))
    service = IngestionService(client=mock_client)

    class MockExtractor:
        async def extract(self, url: str) -> ExtractionResult:
            return ExtractionResult(status="ok", text="Text", word_count=1, final_url=url)

    app.dependency_overrides[get_ingestion_service] = lambda: service
    app.dependency_overrides[get_article_extractor] = lambda: MockExtractor()
    app.dependency_overrides[get_articles_cache] = lambda: {}
    try:
        client = TestClient(app)
        response = client.get("/api/articles?source=medium")
        assert response.status_code == 200
        data = response.json()
        assert data["articles"] == []
        assert data["total"] == 0
    finally:
        app.dependency_overrides.clear()


# ---------------------------------------------------------------------------
# Test 18: Network guard blocks real DNS lookups in tests
# ---------------------------------------------------------------------------
def test_network_guard_blocks_real_dns(network_leaks):
    import socket
    with pytest.raises(RuntimeError, match="real network blocked in tests"):
        socket.getaddrinfo("example.com", 80)
    assert "example.com" in network_leaks
    network_leaks.clear()





