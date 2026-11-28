"""Offline tests for submitted Article links; no real DNS or HTTP calls."""
from pathlib import Path
import asyncio

import httpx
import pytest

from app.config import Settings
from app.content_extraction import (
    ContentExtractionService,
    clean_article_text,
    get_content_extraction_service,
)
from app.extraction.safe_fetcher import SafeFetcher
from app.main import app

HTML = (Path(__file__).parent / "fixtures" / "sample_article.html").read_bytes()
PUBLIC_IP = "93.184.216.34"


def settings(**changes):
    return Settings(_env_file=None, **changes)


async def public_dns(host, port):
    return [PUBLIC_IP]


def fetcher(handler, config=None, resolver=public_dns):
    transport = httpx.MockTransport(handler)

    def client_factory(**kwargs):
        return httpx.AsyncClient(transport=transport, **kwargs)

    return SafeFetcher(config or settings(), resolver=resolver, client_factory=client_factory)


async def post_link(service, body):
    app.dependency_overrides[get_content_extraction_service] = lambda: service
    try:
        async with httpx.AsyncClient(
            transport=httpx.ASGITransport(app=app), base_url="http://testserver"
        ) as client:
            return await client.post("/api/content/extract", json=body)
    finally:
        app.dependency_overrides.pop(get_content_extraction_service, None)


@pytest.mark.asyncio
async def test_link_endpoint_returns_clean_text_without_claims_or_verdicts():
    def handler(request):
        assert request.url.host == PUBLIC_IP
        assert request.headers["host"] == "example.com"
        assert request.extensions["sni_hostname"] == "example.com"
        assert request.headers["accept-encoding"] == "identity"
        assert "cookie" not in request.headers
        assert "authorization" not in request.headers
        return httpx.Response(200, headers={"content-type": "text/html"}, content=HTML)

    config = settings()
    service = ContentExtractionService(config, fetcher(handler, config))
    response = await post_link(service, {"url": "https://example.com/article"})
    assert response.status_code == 200
    result = response.json()
    assert result["status"] == "ok"
    assert result["final_url"] == "https://example.com/article"
    assert result["word_count"] == len(result["text"].split())
    assert "without requiring synchronous block propagation" in result["text"]
    assert "Documentation Portal" not in result["text"]
    assert "essential analytics cookies" not in result["text"]
    assert "Sponsored Sponsor Advert" not in result["text"]
    assert not {"claims", "verdict", "confidence", "reportId", "evidence"} & result.keys()


@pytest.mark.parametrize("url", [
    "http://127.0.0.1/a", "http://169.254.169.254/latest/meta-data/",
    "http://10.0.0.1/", "http://192.168.1.1/", "http://[::1]/",
    "http://[::ffff:127.0.0.1]/", "http://100.64.0.1/", "http://224.0.0.1/",
])
@pytest.mark.asyncio
async def test_private_special_and_metadata_addresses_never_reach_http(url):
    def no_request(request):
        pytest.fail("An unsafe destination reached the HTTP transport")

    async def no_dns(host, port):
        pytest.fail("An IP literal should not require DNS")

    service = ContentExtractionService(settings(), fetcher(no_request, resolver=no_dns))
    response = await post_link(service, {"url": url})
    assert response.status_code == 400
    assert response.json()["status"] == "blocked_url"
    assert response.json()["text"] == ""


@pytest.mark.parametrize("url", [
    "ftp://example.com/a", "file:///etc/passwd", "javascript:alert(1)",
    "https://user:password@example.com/", "https://example.com:8443/",
    "https://example.com/\nattack", "https://example.com/\\attack", "not a URL",
])
@pytest.mark.asyncio
async def test_invalid_url_is_rejected_before_fetching(url):
    class NoExtraction:
        async def extract(self, url):
            pytest.fail("Invalid input reached extraction")

    response = await post_link(NoExtraction(), {"url": url})
    assert response.status_code == 422


@pytest.mark.asyncio
async def test_dns_with_even_one_private_answer_is_blocked():
    async def mixed_dns(host, port):
        return [PUBLIC_IP, "10.0.0.1"]

    def no_request(request):
        pytest.fail("Mixed public/private DNS must not reach HTTP")

    service = ContentExtractionService(settings(), fetcher(no_request, resolver=mixed_dns))
    response = await post_link(service, {"url": "https://example.com/a"})
    assert response.status_code == 400
    assert response.json()["status"] == "blocked_url"


@pytest.mark.asyncio
async def test_redirect_rechecks_destination_and_blocks_private_target():
    calls = []
    def handler(request):
        calls.append(str(request.url))
        return httpx.Response(302, headers={"location": "http://127.0.0.1/admin"})

    service = ContentExtractionService(settings(), fetcher(handler))
    response = await post_link(service, {"url": "https://example.com/a"})
    assert response.status_code == 400
    assert response.json()["status"] == "blocked_url"
    assert len(calls) == 1


@pytest.mark.asyncio
async def test_redirect_checks_new_dns_and_keeps_real_public_final_url():
    dns_calls = []
    requests = []
    async def resolve(host, port):
        dns_calls.append(host)
        return [PUBLIC_IP]

    def handler(request):
        requests.append(request)
        if request.url.path == "/start":
            return httpx.Response(302, headers={
                "location": "https://publisher.example/story",
                "set-cookie": "session=must-not-follow",
            })
        assert request.headers["host"] == "publisher.example"
        assert request.extensions["sni_hostname"] == "publisher.example"
        assert "cookie" not in request.headers
        return httpx.Response(200, headers={"content-type": "text/html"}, content=HTML)

    service = ContentExtractionService(settings(), fetcher(handler, resolver=resolve))
    response = await post_link(service, {"url": "https://example.com/start"})
    assert response.status_code == 200
    assert response.json()["final_url"] == "https://publisher.example/story"
    assert dns_calls == ["example.com", "publisher.example"]
    assert len(requests) == 2


@pytest.mark.asyncio
async def test_dns_is_not_re_resolved_when_connecting_to_validated_ip():
    calls = 0
    async def changing_dns(host, port):
        nonlocal calls
        calls += 1
        return [PUBLIC_IP] if calls == 1 else ["127.0.0.1"]

    def handler(request):
        assert request.url.host == PUBLIC_IP
        return httpx.Response(200, headers={"content-type": "text/html"}, content=HTML)

    service = ContentExtractionService(settings(), fetcher(handler, resolver=changing_dns))
    response = await post_link(service, {"url": "https://example.com/article"})
    assert response.status_code == 200
    assert calls == 1


@pytest.mark.asyncio
async def test_redirect_loop_has_a_finite_request_limit():
    requests = []
    def handler(request):
        requests.append(request)
        return httpx.Response(302, headers={"location": "/loop"})

    service = ContentExtractionService(settings(), fetcher(handler))
    response = await post_link(service, {"url": "https://example.com/loop"})
    assert response.status_code == 502
    assert response.json()["status"] == "fetch_failed"
    assert len(requests) <= 6


@pytest.mark.parametrize("status,headers,body,expected,http_status", [
    (200, {"content-type": "application/pdf"}, b"%PDF", "not_html", 415),
    (403, {"content-type": "text/html"}, b"Forbidden", "fetch_failed", 502),
    (404, {}, b"", "fetch_failed", 502),
    (429, {}, b"", "fetch_failed", 502),
    (200, {"content-type": "text/html"}, b"<html><script>x()</script></html>", "no_text", 422),
])
@pytest.mark.asyncio
async def test_fetch_and_extraction_failures_are_clear(status, headers, body, expected, http_status):
    def handler(request):
        return httpx.Response(status, headers=headers, content=body)

    service = ContentExtractionService(settings(), fetcher(handler))
    response = await post_link(service, {"url": "https://example.com/a"})
    assert response.status_code == http_status
    assert response.json()["status"] == expected
    assert response.json()["text"] == ""
    assert response.json()["word_count"] == 0


@pytest.mark.asyncio
async def test_download_limit_rejects_instead_of_extracting_partial_html():
    config = settings(ARTICLE_MAX_DOWNLOAD_BYTES=100)
    def handler(request):
        return httpx.Response(200, headers={"content-type": "text/html"}, content=HTML)

    service = ContentExtractionService(config, fetcher(handler, config))
    response = await post_link(service, {"url": "https://example.com/a"})
    assert response.status_code == 413
    assert response.json()["status"] == "too_large"
    assert response.json()["text"] == ""


@pytest.mark.asyncio
async def test_long_article_is_not_silently_truncated():
    config = settings(ARTICLE_MAX_CHARS=120)
    def handler(request):
        return httpx.Response(200, headers={"content-type": "text/html"}, content=HTML)

    service = ContentExtractionService(config, fetcher(handler, config))
    response = await post_link(service, {"url": "https://example.com/a"})
    assert response.status_code == 413
    assert response.json()["status"] == "too_long"
    assert response.json()["text"] == ""


@pytest.mark.asyncio
async def test_short_article_remains_short_instead_of_becoming_success():
    config = settings(ARTICLE_MIN_WORDS=10000)
    def handler(request):
        return httpx.Response(200, headers={"content-type": "text/html"}, content=HTML)

    service = ContentExtractionService(config, fetcher(handler, config))
    response = await post_link(service, {"url": "https://example.com/a"})
    assert response.status_code == 422
    assert response.json()["status"] == "too_short"
    assert response.json()["word_count"] == len(response.json()["text"].split())
    assert 0 < response.json()["word_count"] < 10000


@pytest.mark.asyncio
async def test_network_timeout_is_not_an_internal_server_error():
    def handler(request):
        raise httpx.ReadTimeout("upstream timeout", request=request)

    service = ContentExtractionService(settings(), fetcher(handler))
    response = await post_link(service, {"url": "https://example.com/a"})
    assert response.status_code == 504
    assert response.json()["status"] == "timeout"


@pytest.mark.asyncio
async def test_total_deadline_includes_dns_resolution():
    async def stuck_dns(host, port):
        await asyncio.Event().wait()

    def no_request(request):
        pytest.fail("DNS never completed")

    config = settings(ARTICLE_FETCH_TIMEOUT_SECONDS=0.01)
    service = ContentExtractionService(config, fetcher(no_request, config, stuck_dns))
    response = await post_link(service, {"url": "https://example.com/a"})
    assert response.status_code == 504
    assert response.json()["status"] == "timeout"


@pytest.mark.asyncio
async def test_saturated_worker_limit_returns_busy_without_fetching():
    entered, finish = asyncio.Event(), asyncio.Event()
    async def held_dns(host, port):
        entered.set()
        await finish.wait()
        return [PUBLIC_IP]

    def handler(request):
        return httpx.Response(200, headers={"content-type": "text/html"}, content=HTML)

    config = settings(ARTICLES_MAX_CONCURRENT_EXTRACTIONS=1, ARTICLE_FETCH_TIMEOUT_SECONDS=2)
    service = ContentExtractionService(config, fetcher(handler, config, held_dns))
    first = asyncio.create_task(post_link(service, {"url": "https://example.com/first"}))
    try:
        async with asyncio.timeout(1):
            await entered.wait()
        response = await post_link(service, {"url": "https://example.com/second"})
        assert response.status_code == 503
        assert response.json()["status"] == "busy"
    finally:
        finish.set()
        first_response = await first
    assert first_response.status_code == 200


def test_cleaning_preserves_negation_numbers_unicode_and_paragraphs():
    raw = "  Café\u00a0prices\t did NOT rise 20%.\r\n\r\n\r\nCost: ₹100; date 2026-11-28.\x00  "
    result = clean_article_text(raw)
    assert result == "Café prices did NOT rise 20%.\n\nCost: ₹100; date 2026-11-28."
    assert clean_article_text(result) == result


@pytest.mark.asyncio
async def test_request_does_not_trust_user_supplied_article_html():
    response = await post_link(object(), {
        "url": "https://example.com/a", "html": "<p>invented text</p>"
    })
    assert response.status_code == 422

@pytest.mark.asyncio
async def test_stream_without_content_length_still_enforces_download_limit():
    class Chunks(httpx.AsyncByteStream):
        async def __aiter__(self):
            yield b"<html>" + b"x" * 60
            yield b"x" * 60 + b"</html>"

    config = settings(ARTICLE_MAX_DOWNLOAD_BYTES=100)
    def handler(request):
        return httpx.Response(200, headers={"content-type": "text/html"}, stream=Chunks())

    service = ContentExtractionService(config, fetcher(handler, config))
    response = await post_link(service, {"url": "https://example.com/a"})
    assert response.status_code == 413
    assert response.json()["text"] == ""


@pytest.mark.asyncio
async def test_unsolicited_compressed_body_is_rejected_before_decoding():
    def handler(request):
        return httpx.Response(200, headers={
            "content-type": "text/html", "content-encoding": "gzip",
        }, content=b"")

    service = ContentExtractionService(settings(), fetcher(handler))
    response = await post_link(service, {"url": "https://example.com/a"})
    assert response.status_code == 415
    assert response.json()["status"] == "unsupported_encoding"


@pytest.mark.asyncio
async def test_safe_relative_redirect_is_followed():
    def handler(request):
        if request.url.path == "/old":
            return httpx.Response(301, headers={"location": "/new#section"})
        return httpx.Response(200, headers={"content-type": "text/html"}, content=HTML)

    service = ContentExtractionService(settings(), fetcher(handler))
    response = await post_link(service, {"url": "https://example.com/old"})
    assert response.status_code == 200
    assert response.json()["final_url"] == "https://example.com/new"


@pytest.mark.asyncio
async def test_timed_out_parser_holds_worker_slot_until_it_finishes(monkeypatch):
    import threading
    import trafilatura

    started, finish = threading.Event(), threading.Event()
    actual_extract = trafilatura.extract
    def held_parser(*args, **kwargs):
        started.set()
        finish.wait(timeout=2)
        return actual_extract(*args, **kwargs)

    monkeypatch.setattr(trafilatura, "extract", held_parser)
    config = settings(ARTICLE_FETCH_TIMEOUT_SECONDS=0.15, ARTICLES_MAX_CONCURRENT_EXTRACTIONS=1)
    def handler(request):
        return httpx.Response(200, headers={"content-type": "text/html"}, content=HTML)

    service = ContentExtractionService(config, fetcher(handler, config))
    try:
        response = await post_link(service, {"url": "https://example.com/first"})
        assert started.is_set()
        assert response.status_code == 504
        busy = await post_link(service, {"url": "https://example.com/second"})
        assert busy.status_code == 503
        assert busy.json()["status"] == "busy"
    finally:
        finish.set()

    for _ in range(50):
        recovered = await post_link(service, {"url": "https://example.com/recovered"})
        if recovered.status_code != 503:
            break
        await asyncio.sleep(0.01)
    assert recovered.status_code == 200
    assert recovered.json()["status"] == "ok"


@pytest.mark.asyncio
async def test_numeric_article_table_is_retained():
    table = (
        b"<table><tr><th>Region</th><th>Budget in rupees</th></tr>"
        b"<tr><td>Visakhapatnam</td><td>827391</td></tr>"
        b"<tr><td>Guntur</td><td>614582</td></tr></table>"
    )
    def handler(request):
        return httpx.Response(200, headers={"content-type": "text/html"},
                              content=HTML.replace(b"</article>", table + b"</article>"))

    service = ContentExtractionService(settings(), fetcher(handler))
    response = await post_link(service, {"url": "https://example.com/budget"})
    assert response.status_code == 200
    assert "827391" in response.json()["text"]
    assert "614582" in response.json()["text"]
