import pytest
import httpx
from datetime import datetime, timezone

from app.ingestion.base import BaseIngestionSource
from app.ingestion.hackernews.client import HackerNewsIngestionSource
from app.ingestion.medium.client import MediumIngestionSource
from app.ingestion.service import IngestionService
from app.config import Settings

SAMPLE_MEDIUM_XML = """<?xml version="1.0" encoding="UTF-8"?>
<rss xmlns:dc="http://purl.org/dc/elements/1.1/" xmlns:content="http://purl.org/rss/1.0/modules/content/" xmlns:atom="http://www.w3.org/2005/Atom" version="2.0">
  <channel>
    <title>Stories on Medium</title>
    <item>
      <title><![CDATA[Understanding DeepSeek V3 Architecture]]></title>
      <link>https://medium.com/@author/deepseek-v3-arch-12345?source=rss----all</link>
      <guid isPermaLink="false">https://medium.com/p/12345</guid>
      <dc:creator><![CDATA[Jane Doe]]></dc:creator>
      <pubDate>Fri, 07 Mar 2026 10:00:00 GMT</pubDate>
      <content:encoded><![CDATA[
        <p>Introduction to the new open weights architecture.</p>
        <figure><img src="https://miro.medium.com/v2/resize:fit:1200/test_image.png" /></figure>
        <p>More detailed text explanation here.</p>
      ]]></content:encoded>
    </item>
    <item>
      <title><![CDATA[Post-Quantum Cryptography Basics]]></title>
      <link>https://medium.com/@author/post-quantum-crypto-67890</link>
      <guid isPermaLink="false">https://medium.com/p/67890</guid>
      <dc:creator><![CDATA[John Smith]]></dc:creator>
      <pubDate>Thu, 06 Mar 2026 15:30:00 GMT</pubDate>
      <description><![CDATA[<p>Summary without content encoded tag.</p><img src="https://miro.medium.com/v2/resize:fit:800/crypto.jpg" />]]></description>
    </item>
  </channel>
</rss>
"""


@pytest.mark.asyncio
async def test_medium_ingestion_parses_articles_and_images():
    """Test that MediumIngestionSource parses XML, extracts images, and cleans URLs."""
    def handler(request: httpx.Request) -> httpx.Response:
        return httpx.Response(200, text=SAMPLE_MEDIUM_XML)

    async with httpx.AsyncClient(transport=httpx.MockTransport(handler)) as client:
        source = MediumIngestionSource(client=client, tags=["artificial-intelligence"])
        articles = await source.fetch_articles(limit=10)

    assert len(articles) == 2

    # First article checks
    a1 = articles[0]
    assert a1.title == "Understanding DeepSeek V3 Architecture"
    assert a1.source == "Medium"
    assert a1.url == "https://medium.com/@author/deepseek-v3-arch-12345"
    assert a1.image_url == "https://miro.medium.com/v2/resize:fit:1200/test_image.png"
    assert a1.published_at == datetime(2026, 3, 7, 10, 0, tzinfo=timezone.utc)
    assert a1.category == "artificial-intelligence"

    # Second article checks
    a2 = articles[1]
    assert a2.title == "Post-Quantum Cryptography Basics"
    assert a2.image_url == "https://miro.medium.com/v2/resize:fit:800/crypto.jpg"


@pytest.mark.asyncio
async def test_medium_ingestion_handles_rate_limit():
    """Test that HTTP 429 returns empty list without raising exception."""
    def handler(request: httpx.Request) -> httpx.Response:
        return httpx.Response(429, text="Too Many Requests")

    async with httpx.AsyncClient(transport=httpx.MockTransport(handler)) as client:
        source = MediumIngestionSource(client=client, tags=["technology"])
        articles = await source.fetch_articles(limit=10)

    assert articles == []


@pytest.mark.asyncio
async def test_ingestion_service_orchestration():
    """Test that IngestionService coordinates multiple sources and interleaves them."""
    def handler(request: httpx.Request) -> httpx.Response:
        url_str = str(request.url)
        if "topstories.json" in url_str:
            return httpx.Response(200, json=[101])
        elif "item/101.json" in url_str:
            return httpx.Response(200, json={
                "id": 101,
                "type": "story",
                "title": "HN Breaking Tech Story",
                "url": "https://news.ycombinator.com/story/101",
                "score": 150,
                "time": 1772877600
            })
        elif "medium.com/feed/tag" in url_str:
            return httpx.Response(200, text=SAMPLE_MEDIUM_XML)
        return httpx.Response(404)

    async with httpx.AsyncClient(transport=httpx.MockTransport(handler)) as client:
        service = IngestionService(client=client)
        articles = await service.fetch_articles(limit=10)

    assert len(articles) >= 2
    sources = {a.source for a in articles}
    assert "Hacker News" in sources
    assert "Medium" in sources

