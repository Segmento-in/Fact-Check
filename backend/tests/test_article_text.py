from pathlib import Path
import httpx
import pytest

from app.config import Settings
from app.extraction.article_text import ArticleTextExtractor

FIXTURES_DIR = Path(__file__).parent / "fixtures"
SAMPLE_ARTICLE_PATH = FIXTURES_DIR / "sample_article.html"
SAMPLE_HTML = SAMPLE_ARTICLE_PATH.read_text(encoding="utf-8")


@pytest.mark.asyncio
async def test_fixture_page_returns_ok_and_contains_known_sentence():
    """Test 1: The fixture page returns 'ok', and a known sentence from the body is in text."""
    known_sentence = (
        "The distributed verification protocol achieves consensus across "
        "heterogeneous validator nodes without requiring synchronous block propagation."
    )

    def handler(request: httpx.Request) -> httpx.Response:
        return httpx.Response(
            200,
            headers={"Content-Type": "text/html; charset=utf-8"},
            text=SAMPLE_HTML,
        )

    async with httpx.AsyncClient(transport=httpx.MockTransport(handler)) as client:
        extractor = ArticleTextExtractor(
            client=client, settings=Settings(_env_file=None)
        )
        result = await extractor.extract("https://example.com/protocol")

    assert result.status == "ok"
    assert known_sentence in result.text


@pytest.mark.asyncio
async def test_nav_menu_and_cookie_banner_are_not_in_extracted_text():
    """Test 2: Nav menu words and the cookie-banner sentence are not in text."""
    cookie_sentence = (
        "We use essential analytics cookies to ensure optimal performance"
    )
    nav_word = "Documentation Portal"

    def handler(request: httpx.Request) -> httpx.Response:
        return httpx.Response(
            200,
            headers={"Content-Type": "text/html; charset=utf-8"},
            text=SAMPLE_HTML,
        )

    async with httpx.AsyncClient(transport=httpx.MockTransport(handler)) as client:
        extractor = ArticleTextExtractor(
            client=client, settings=Settings(_env_file=None)
        )
        result = await extractor.extract("https://example.com/protocol")

    assert result.status == "ok"
    assert cookie_sentence not in result.text
    assert nav_word not in result.text


@pytest.mark.asyncio
async def test_word_count_matches_text_split_length():
    """Test 3: word_count equals len(text.split())."""
    def handler(request: httpx.Request) -> httpx.Response:
        return httpx.Response(
            200,
            headers={"Content-Type": "text/html; charset=utf-8"},
            text=SAMPLE_HTML,
        )

    async with httpx.AsyncClient(transport=httpx.MockTransport(handler)) as client:
        extractor = ArticleTextExtractor(
            client=client, settings=Settings(_env_file=None)
        )
        result = await extractor.extract("https://example.com/protocol")

    assert result.status == "ok"
    assert result.word_count == len(result.text.split())
    assert result.word_count > 0


@pytest.mark.asyncio
async def test_page_with_fewer_than_min_words_returns_too_short():
    """Test 4: A page with fewer than ARTICLE_MIN_WORDS words returns 'too_short'."""
    short_html = (
        "<!DOCTYPE html><html><body><article><h1>Brief Notice</h1>"
        "<p>This brief statement contains only a tiny handful of words.</p>"
        "</article></body></html>"
    )

    def handler(request: httpx.Request) -> httpx.Response:
        return httpx.Response(
            200,
            headers={"Content-Type": "text/html"},
            text=short_html,
        )

    async with httpx.AsyncClient(transport=httpx.MockTransport(handler)) as client:
        extractor = ArticleTextExtractor(
            client=client, settings=Settings(_env_file=None, ARTICLE_MIN_WORDS=100)
        )
        result = await extractor.extract("https://example.com/short")

    assert result.status == "too_short"
    assert result.word_count < 100
    assert result.word_count > 0


@pytest.mark.asyncio
async def test_page_with_only_scripts_and_nav_returns_no_text():
    """Test 5: A page with only scripts and nav returns 'no_text'."""
    boilerplate_only_html = (
        "<!DOCTYPE html><html><head><script>console.log('tracker');</script></head>"
        "<body><nav><ul><li><a href='/'>Home</a></li></ul></nav></body></html>"
    )

    def handler(request: httpx.Request) -> httpx.Response:
        return httpx.Response(
            200,
            headers={"Content-Type": "text/html"},
            text=boilerplate_only_html,
        )

    async with httpx.AsyncClient(transport=httpx.MockTransport(handler)) as client:
        extractor = ArticleTextExtractor(
            client=client, settings=Settings(_env_file=None)
        )
        result = await extractor.extract("https://example.com/empty")

    assert result.status == "no_text"
    assert result.text == ""
    assert result.word_count == 0


@pytest.mark.asyncio
async def test_content_type_pdf_returns_not_html():
    """Test 6: Content-Type: application/pdf returns 'not_html'."""
    def handler(request: httpx.Request) -> httpx.Response:
        return httpx.Response(
            200,
            headers={"Content-Type": "application/pdf"},
            content=b"%PDF-1.4 mock binary content",
        )

    async with httpx.AsyncClient(transport=httpx.MockTransport(handler)) as client:
        extractor = ArticleTextExtractor(
            client=client, settings=Settings(_env_file=None)
        )
        result = await extractor.extract("https://example.com/document.pdf")

    assert result.status == "not_html"
    assert result.text == ""


@pytest.mark.asyncio
async def test_http_404_and_500_each_return_fetch_failed():
    """Test 7: HTTP 404 and HTTP 500 each return 'fetch_failed'."""
    def not_found_handler(request: httpx.Request) -> httpx.Response:
        return httpx.Response(404, text="Not Found")

    async with httpx.AsyncClient(transport=httpx.MockTransport(not_found_handler)) as client:
        extractor = ArticleTextExtractor(
            client=client, settings=Settings(_env_file=None)
        )
        res_404 = await extractor.extract("https://example.com/not-found")
        assert res_404.status == "fetch_failed"

    def server_error_handler(request: httpx.Request) -> httpx.Response:
        return httpx.Response(500, text="Internal Server Error")

    async with httpx.AsyncClient(transport=httpx.MockTransport(server_error_handler)) as client:
        extractor = ArticleTextExtractor(
            client=client, settings=Settings(_env_file=None)
        )
        res_500 = await extractor.extract("https://example.com/server-error")
        assert res_500.status == "fetch_failed"


@pytest.mark.asyncio
async def test_timeout_and_connect_error_return_fetch_failed():
    """Test 8: Timeout and connection error each return 'fetch_failed'."""
    def timeout_handler(request: httpx.Request) -> httpx.Response:
        raise httpx.ReadTimeout("Read timed out", request=request)

    async with httpx.AsyncClient(transport=httpx.MockTransport(timeout_handler)) as client:
        extractor = ArticleTextExtractor(
            client=client, settings=Settings(_env_file=None)
        )
        res_timeout = await extractor.extract("https://example.com/timeout")
        assert res_timeout.status == "fetch_failed"

    def connect_error_handler(request: httpx.Request) -> httpx.Response:
        raise httpx.ConnectError("Network unreachable", request=request)

    async with httpx.AsyncClient(transport=httpx.MockTransport(connect_error_handler)) as client:
        extractor = ArticleTextExtractor(
            client=client, settings=Settings(_env_file=None)
        )
        res_conn = await extractor.extract("https://example.com/conn-error")
        assert res_conn.status == "fetch_failed"


@pytest.mark.asyncio
async def test_301_redirect_returns_ok_and_sets_final_url():
    """Test 9: A 301 redirect to a 200 page returns 'ok' and sets final_url to the final address."""
    def redirect_handler(request: httpx.Request) -> httpx.Response:
        if request.url.path == "/initial-entry":
            return httpx.Response(
                301,
                headers={"Location": "https://example.com/final-destination"},
            )
        if request.url.path == "/final-destination":
            return httpx.Response(
                200,
                headers={"Content-Type": "text/html; charset=utf-8"},
                text=SAMPLE_HTML,
            )
        return httpx.Response(404)

    async with httpx.AsyncClient(transport=httpx.MockTransport(redirect_handler)) as client:
        extractor = ArticleTextExtractor(
            client=client, settings=Settings(_env_file=None)
        )
        result = await extractor.extract("https://example.com/initial-entry")

    assert result.status == "ok"
    assert result.final_url == "https://example.com/final-destination"


@pytest.mark.asyncio
async def test_request_carries_article_user_agent_header():
    """Test 10: The request carries the ARTICLE_USER_AGENT header."""
    captured_user_agent = None

    def handler(request: httpx.Request) -> httpx.Response:
        nonlocal captured_user_agent
        captured_user_agent = request.headers.get("user-agent")
        return httpx.Response(
            200,
            headers={"Content-Type": "text/html; charset=utf-8"},
            text=SAMPLE_HTML,
        )

    custom_ua = "FactCheckerBot/0.1 (proof of concept)"
    settings = Settings(_env_file=None, ARTICLE_USER_AGENT=custom_ua)

    async with httpx.AsyncClient(transport=httpx.MockTransport(handler)) as client:
        extractor = ArticleTextExtractor(client=client, settings=settings)
        result = await extractor.extract("https://example.com/test-ua")

    assert result.status == "ok"
    assert captured_user_agent == custom_ua


@pytest.mark.asyncio
async def test_text_longer_than_article_max_chars_is_truncated():
    """Test 11: Text longer than ARTICLE_MAX_CHARS is cut to exactly that many characters."""
    max_chars_limit = 120
    settings = Settings(
        _env_file=None,
        ARTICLE_MAX_CHARS=max_chars_limit,
        ARTICLE_MIN_WORDS=5,
    )

    def handler(request: httpx.Request) -> httpx.Response:
        return httpx.Response(
            200,
            headers={"Content-Type": "text/html; charset=utf-8"},
            text=SAMPLE_HTML,
        )

    async with httpx.AsyncClient(transport=httpx.MockTransport(handler)) as client:
        extractor = ArticleTextExtractor(client=client, settings=settings)
        result = await extractor.extract("https://example.com/truncate")

    assert result.status == "ok"
    assert len(result.text) == max_chars_limit


@pytest.mark.asyncio
async def test_body_larger_than_max_download_bytes_does_not_crash():
    """Test 12: A body larger than ARTICLE_MAX_DOWNLOAD_BYTES does not crash and returns valid status."""
    paragraph = (
        "<p>Decentralized claim attestation guarantees continuous integrity across distributed nodes.</p>\n"
    )
    oversized_html = (
        "<!DOCTYPE html><html><body><article><h1>Massive Payload</h1>"
        + (paragraph * 500)
        + "</article></body></html>"
    )

    settings = Settings(
        _env_file=None,
        ARTICLE_MAX_DOWNLOAD_BYTES=1500,
        ARTICLE_MIN_WORDS=10,
    )

    def handler(request: httpx.Request) -> httpx.Response:
        return httpx.Response(
            200,
            headers={"Content-Type": "text/html; charset=utf-8"},
            text=oversized_html,
        )

    async with httpx.AsyncClient(transport=httpx.MockTransport(handler)) as client:
        extractor = ArticleTextExtractor(client=client, settings=settings)
        result = await extractor.extract("https://example.com/oversized")

    assert result.status in ["ok", "too_short"]
    assert result.word_count > 0


@pytest.mark.asyncio
async def test_non_utf8_encoding_returns_valid_status_without_exception():
    """Test 13: A page in a non-UTF-8 encoding returns a valid status and no exception."""
    # Use distinct non-repeating paragraphs so trafilatura deduplication does not strip them
    paragraphs = "".join(
        f"<p>Section {i}: Le protocole numéro {i} de vérification distribuée assure l'intégrité "
        f"et la traçabilité des données scientifiques sans latence excessive.</p>"
        for i in range(12)
    )
    french_body = (
        "<!DOCTYPE html><html><head><meta charset='iso-8859-1'></head>"
        "<body><article><h1>Vérification Algorithmique</h1>"
        + paragraphs
        + "</article></body></html>"
    ).encode("iso-8859-1")

    def handler(request: httpx.Request) -> httpx.Response:
        return httpx.Response(
            200,
            headers={"Content-Type": "text/html; charset=iso-8859-1"},
            content=french_body,
        )

    async with httpx.AsyncClient(transport=httpx.MockTransport(handler)) as client:
        extractor = ArticleTextExtractor(
            client=client, settings=Settings(_env_file=None, ARTICLE_MIN_WORDS=20)
        )
        result = await extractor.extract("https://example.com/iso-8859-1")

    assert result.status in ["ok", "too_short"]
    assert result.status == "ok"
    assert "vérification" in result.text.lower() or "protocole" in result.text.lower()
