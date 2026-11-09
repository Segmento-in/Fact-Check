import asyncio
from datetime import datetime, timezone
import httpx
import pytest

from app.config import Settings
from app.feeds.hackernews import HackerNewsFeed


@pytest.mark.asyncio
async def test_story_with_url_becomes_article_with_correct_fields():
    """Test 1: Story with a URL becomes an Article with the right fields."""
    def handler(request: httpx.Request) -> httpx.Response:
        if request.url.path == "/v0/topstories.json":
            return httpx.Response(200, json=[1001])
        if request.url.path == "/v0/item/1001.json":
            return httpx.Response(
                200,
                json={
                    "id": 1001,
                    "type": "story",
                    "title": "Show HN: My New App",
                    "url": "https://example.com/app",
                    "time": 1700000000,
                    "score": 150,
                },
            )
        return httpx.Response(404)

    async with httpx.AsyncClient(transport=httpx.MockTransport(handler)) as client:
        feed = HackerNewsFeed(client=client, settings=Settings(_env_file=None))
        articles = await feed.fetch_articles()

    assert len(articles) == 1
    article = articles[0]
    assert article.hn_id == 1001
    assert article.title == "Show HN: My New App"
    assert article.url == "https://example.com/app"
    assert article.hn_score == 150
    assert article.published_at == datetime.fromtimestamp(1700000000, tz=timezone.utc)


@pytest.mark.asyncio
async def test_time_converts_to_timezone_aware_utc_and_missing_time_is_none():
    """Test 2: time converts to a timezone-aware UTC datetime. A missing time gives None."""
    def handler(request: httpx.Request) -> httpx.Response:
        if request.url.path == "/v0/topstories.json":
            return httpx.Response(200, json=[1001, 1002])
        if request.url.path == "/v0/item/1001.json":
            return httpx.Response(
                200,
                json={
                    "id": 1001,
                    "type": "story",
                    "title": "Story with timestamp",
                    "url": "https://example.com/1",
                    "time": 1710000000,
                    "score": 10,
                },
            )
        if request.url.path == "/v0/item/1002.json":
            return httpx.Response(
                200,
                json={
                    "id": 1002,
                    "type": "story",
                    "title": "Story without timestamp",
                    "url": "https://example.com/2",
                    "score": 20,
                },
            )
        return httpx.Response(404)

    async with httpx.AsyncClient(transport=httpx.MockTransport(handler)) as client:
        feed = HackerNewsFeed(client=client, settings=Settings(_env_file=None))
        articles = await feed.fetch_articles()

    assert len(articles) == 2
    assert articles[0].published_at == datetime.fromtimestamp(1710000000, tz=timezone.utc)
    assert articles[0].published_at.tzinfo == timezone.utc
    assert articles[1].published_at is None


@pytest.mark.asyncio
async def test_ask_hn_without_url_is_skipped():
    """Test 3: An 'Ask HN' item with no url is skipped."""
    def handler(request: httpx.Request) -> httpx.Response:
        if request.url.path == "/v0/topstories.json":
            return httpx.Response(200, json=[1001])
        if request.url.path == "/v0/item/1001.json":
            return httpx.Response(
                200,
                json={
                    "id": 1001,
                    "type": "story",
                    "title": "Ask HN: What is your favorite editor?",
                    "text": "Tell me what you think.",
                    "score": 45,
                },
            )
        return httpx.Response(404)

    async with httpx.AsyncClient(transport=httpx.MockTransport(handler)) as client:
        feed = HackerNewsFeed(client=client, settings=Settings(_env_file=None))
        articles = await feed.fetch_articles()

    assert len(articles) == 0


@pytest.mark.asyncio
async def test_job_and_comment_items_are_skipped():
    """Test 4: A job item and a comment item are skipped."""
    def handler(request: httpx.Request) -> httpx.Response:
        if request.url.path == "/v0/topstories.json":
            return httpx.Response(200, json=[1001, 1002, 1003])
        if request.url.path == "/v0/item/1001.json":
            return httpx.Response(
                200,
                json={
                    "id": 1001,
                    "type": "job",
                    "title": "Acme is hiring Engineers",
                    "url": "https://acme.com/jobs",
                },
            )
        if request.url.path == "/v0/item/1002.json":
            return httpx.Response(
                200,
                json={
                    "id": 1002,
                    "type": "comment",
                    "title": "A comment title",
                    "url": "https://example.com/comment",
                },
            )
        if request.url.path == "/v0/item/1003.json":
            return httpx.Response(
                200,
                json={
                    "id": 1003,
                    "type": "story",
                    "title": "Valid Story",
                    "url": "https://example.com/story",
                },
            )
        return httpx.Response(404)

    async with httpx.AsyncClient(transport=httpx.MockTransport(handler)) as client:
        feed = HackerNewsFeed(client=client, settings=Settings(_env_file=None))
        articles = await feed.fetch_articles()

    assert len(articles) == 1
    assert articles[0].hn_id == 1003


@pytest.mark.asyncio
async def test_null_deleted_and_dead_items_are_skipped():
    """Test 5: A null item (raw JSON null), a deleted item, and a dead item are skipped."""
    def handler(request: httpx.Request) -> httpx.Response:
        if request.url.path == "/v0/topstories.json":
            return httpx.Response(200, json=[1001, 1002, 1003, 1004])
        if request.url.path == "/v0/item/1001.json":
            # Raw JSON null body as sent by real HN for removed items
            return httpx.Response(200, content=b"null")
        if request.url.path == "/v0/item/1002.json":
            return httpx.Response(
                200,
                json={
                    "id": 1002,
                    "type": "story",
                    "title": "Deleted Story",
                    "url": "https://example.com/deleted",
                    "deleted": True,
                },
            )
        if request.url.path == "/v0/item/1003.json":
            return httpx.Response(
                200,
                json={
                    "id": 1003,
                    "type": "story",
                    "title": "Dead Story",
                    "url": "https://example.com/dead",
                    "dead": True,
                },
            )
        if request.url.path == "/v0/item/1004.json":
            return httpx.Response(
                200,
                json={
                    "id": 1004,
                    "type": "story",
                    "title": "Active Story",
                    "url": "https://example.com/active",
                },
            )
        return httpx.Response(404)

    async with httpx.AsyncClient(transport=httpx.MockTransport(handler)) as client:
        feed = HackerNewsFeed(client=client, settings=Settings(_env_file=None))
        articles = await feed.fetch_articles()

    assert len(articles) == 1
    assert articles[0].hn_id == 1004


@pytest.mark.asyncio
async def test_url_not_starting_with_http_is_skipped():
    """Test 6: A URL not starting with http is skipped."""
    def handler(request: httpx.Request) -> httpx.Response:
        if request.url.path == "/v0/topstories.json":
            return httpx.Response(200, json=[1001, 1002, 1003])
        if request.url.path == "/v0/item/1001.json":
            return httpx.Response(
                200,
                json={
                    "id": 1001,
                    "type": "story",
                    "title": "FTP Story",
                    "url": "ftp://example.com/file",
                },
            )
        if request.url.path == "/v0/item/1002.json":
            return httpx.Response(
                200,
                json={
                    "id": 1002,
                    "type": "story",
                    "title": "Relative URL Story",
                    "url": "relative/path",
                },
            )
        if request.url.path == "/v0/item/1003.json":
            return httpx.Response(
                200,
                json={
                    "id": 1003,
                    "type": "story",
                    "title": "Valid HTTP Story",
                    "url": "http://example.com/valid",
                },
            )
        return httpx.Response(404)

    async with httpx.AsyncClient(transport=httpx.MockTransport(handler)) as client:
        feed = HackerNewsFeed(client=client, settings=Settings(_env_file=None))
        articles = await feed.fetch_articles()

    assert len(articles) == 1
    assert articles[0].hn_id == 1003


@pytest.mark.asyncio
async def test_hn_order_is_preserved():
    """Test 7: HN rank order is preserved even when earlier items respond slower."""
    ids = [2001, 2002, 2003, 2004]

    async def handler(request: httpx.Request) -> httpx.Response:
        if request.url.path == "/v0/topstories.json":
            return httpx.Response(200, json=ids)
        for i, story_id in enumerate(ids):
            if request.url.path == f"/v0/item/{story_id}.json":
                # Earlier IDs sleep longer so later IDs resolve first (reverse arrival)
                delay = (len(ids) - i) * 0.02
                await asyncio.sleep(delay)
                return httpx.Response(
                    200,
                    json={
                        "id": story_id,
                        "type": "story",
                        "title": f"Story {story_id}",
                        "url": f"https://example.com/{story_id}",
                        "score": story_id,
                    },
                )
        return httpx.Response(404)

    async with httpx.AsyncClient(transport=httpx.MockTransport(handler)) as client:
        feed = HackerNewsFeed(client=client, settings=Settings(_env_file=None))
        articles = await feed.fetch_articles()

    assert [a.hn_id for a in articles] == [2001, 2002, 2003, 2004]


@pytest.mark.asyncio
async def test_concurrency_cap_is_enforced():
    """Test: in-flight concurrent requests never exceed MAX_CONCURRENT_REQUESTS but run in parallel."""
    ids = list(range(1001, 1011))  # 10 stories
    active_requests = 0
    max_active_requests = 0

    async def handler(request: httpx.Request) -> httpx.Response:
        nonlocal active_requests, max_active_requests
        if request.url.path == "/v0/topstories.json":
            return httpx.Response(200, json=ids)
        if request.url.path.startswith("/v0/item/"):
            active_requests += 1
            if active_requests > max_active_requests:
                max_active_requests = active_requests
            await asyncio.sleep(0.02)
            active_requests -= 1
            item_id = int(request.url.path.split("/")[3].replace(".json", ""))
            return httpx.Response(
                200,
                json={
                    "id": item_id,
                    "type": "story",
                    "title": f"Story {item_id}",
                    "url": f"https://example.com/{item_id}",
                },
            )
        return httpx.Response(404)

    test_settings = Settings(
        _env_file=None,
        MAX_CONCURRENT_REQUESTS=3,
        HN_TOP_STORIES_LIMIT=10,
    )
    async with httpx.AsyncClient(transport=httpx.MockTransport(handler)) as client:
        feed = HackerNewsFeed(client=client, settings=test_settings)
        articles = await feed.fetch_articles()

    assert len(articles) == 10
    assert max_active_requests <= 3
    assert max_active_requests > 1


@pytest.mark.asyncio
async def test_empty_whitespace_or_missing_title_is_skipped():
    """Test: items with empty, whitespace-only, or missing title are skipped."""
    def handler(request: httpx.Request) -> httpx.Response:
        if request.url.path == "/v0/topstories.json":
            return httpx.Response(200, json=[1001, 1002, 1003, 1004])
        if request.url.path == "/v0/item/1001.json":
            return httpx.Response(
                200,
                json={"id": 1001, "type": "story", "title": "", "url": "https://example.com/1"},
            )
        if request.url.path == "/v0/item/1002.json":
            return httpx.Response(
                200,
                json={"id": 1002, "type": "story", "title": "   ", "url": "https://example.com/2"},
            )
        if request.url.path == "/v0/item/1003.json":
            return httpx.Response(
                200,
                json={"id": 1003, "type": "story", "url": "https://example.com/3"},
            )
        if request.url.path == "/v0/item/1004.json":
            return httpx.Response(
                200,
                json={"id": 1004, "type": "story", "title": "Valid Headline", "url": "https://example.com/4"},
            )
        return httpx.Response(404)

    async with httpx.AsyncClient(transport=httpx.MockTransport(handler)) as client:
        feed = HackerNewsFeed(client=client, settings=Settings(_env_file=None))
        articles = await feed.fetch_articles()

    assert len(articles) == 1
    assert articles[0].hn_id == 1004


@pytest.mark.asyncio
async def test_limit_is_respected_and_capped_at_max_limit():
    """Test 8: limit is respected, and a limit above HN_MAX_LIMIT is capped."""
    top_ids = list(range(1, 51))

    def handler(request: httpx.Request) -> httpx.Response:
        if request.url.path == "/v0/topstories.json":
            return httpx.Response(200, json=top_ids)
        if request.url.path.startswith("/v0/item/"):
            item_id = int(request.url.path.split("/")[3].replace(".json", ""))
            return httpx.Response(
                200,
                json={
                    "id": item_id,
                    "type": "story",
                    "title": f"Story {item_id}",
                    "url": f"https://example.com/{item_id}",
                },
            )
        return httpx.Response(404)

    custom_settings = Settings(
        _env_file=None,
        HN_TOP_STORIES_LIMIT=5,
        HN_MAX_LIMIT=15,
    )
    async with httpx.AsyncClient(transport=httpx.MockTransport(handler)) as client:
        feed = HackerNewsFeed(client=client, settings=custom_settings)

        # Default limit
        res_default = await feed.fetch_articles()
        assert len(res_default) == 5

        # Caller requested limit within bounds
        res_custom = await feed.fetch_articles(limit=8)
        assert len(res_custom) == 8

        # Caller requested limit exceeding HN_MAX_LIMIT (15)
        res_capped = await feed.fetch_articles(limit=40)
        assert len(res_capped) == 15


@pytest.mark.asyncio
async def test_http_429_on_id_list_returns_empty_list_without_exception():
    """Test 9: HTTP 429 on the ID list returns [], no exception."""
    def handler(request: httpx.Request) -> httpx.Response:
        if request.url.path == "/v0/topstories.json":
            return httpx.Response(429, text="Too Many Requests")
        return httpx.Response(404)

    async with httpx.AsyncClient(transport=httpx.MockTransport(handler)) as client:
        feed = HackerNewsFeed(client=client, settings=Settings(_env_file=None))
        articles = await feed.fetch_articles()

    assert articles == []


@pytest.mark.asyncio
async def test_http_500_on_one_item_still_returns_other_items():
    """Test 10: HTTP 500 on one item still returns the other items."""
    def handler(request: httpx.Request) -> httpx.Response:
        if request.url.path == "/v0/topstories.json":
            return httpx.Response(200, json=[1001, 1002, 1003])
        if request.url.path == "/v0/item/1001.json":
            return httpx.Response(
                200,
                json={
                    "id": 1001,
                    "type": "story",
                    "title": "First Story",
                    "url": "https://example.com/1",
                },
            )
        if request.url.path == "/v0/item/1002.json":
            return httpx.Response(500, text="Internal Server Error")
        if request.url.path == "/v0/item/1003.json":
            return httpx.Response(
                200,
                json={
                    "id": 1003,
                    "type": "story",
                    "title": "Third Story",
                    "url": "https://example.com/3",
                },
            )
        return httpx.Response(404)

    async with httpx.AsyncClient(transport=httpx.MockTransport(handler)) as client:
        feed = HackerNewsFeed(client=client, settings=Settings(_env_file=None))
        articles = await feed.fetch_articles()

    assert len(articles) == 2
    assert [a.hn_id for a in articles] == [1001, 1003]


@pytest.mark.asyncio
async def test_bad_json_on_id_list_returns_empty_list():
    """Test 11: Bad JSON on the ID list returns []."""
    def handler(request: httpx.Request) -> httpx.Response:
        if request.url.path == "/v0/topstories.json":
            return httpx.Response(200, text="<!DOCTYPE html><html>Broken Gateway</html>")
        return httpx.Response(404)

    async with httpx.AsyncClient(transport=httpx.MockTransport(handler)) as client:
        feed = HackerNewsFeed(client=client, settings=Settings(_env_file=None))
        articles = await feed.fetch_articles()

    assert articles == []
