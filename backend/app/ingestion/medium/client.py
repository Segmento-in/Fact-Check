import asyncio
from datetime import datetime, timezone
import email.utils
import hashlib
import logging
import re
from typing import List, Optional
import xml.etree.ElementTree as ET
import httpx

from app.config import Settings, settings as default_settings
from app.ingestion.base import BaseIngestionSource
from app.models import Article

logger = logging.getLogger(__name__)

MEDIUM_FEED_BASE_URL = "https://medium.com/feed/tag"

# Default high-value technology and science tags on Medium
DEFAULT_MEDIUM_TAGS = [
    "artificial-intelligence",
    "technology",
    "data-science",
    "cybersecurity",
    "programming",
    "cloud-computing",
    "law",
]


class MediumIngestionSource(BaseIngestionSource):
    """
    Ingestion source that pulls articles from Medium RSS feeds by topic tags.
    Mirrors Segmento Pulse's Medium ingestion logic: parses XML, extracts 
    embedded CDATA images, cleans descriptions, and maps to Articles.
    """

    def __init__(
        self,
        client: Optional[httpx.AsyncClient] = None,
        settings: Optional[Settings] = None,
        tags: Optional[List[str]] = None,
    ) -> None:
        super().__init__(client=client, settings=settings)
        # Reuse Pulse's category-to-tag coverage, plus the existing security tag.
        self.tags = list(dict.fromkeys(tags if tags is not None else self.settings.MEDIUM_TAGS))

    @property
    def source_name(self) -> str:
        return "Medium"

    async def fetch_articles(self, limit: Optional[int] = None) -> List[Article]:
        """
        Fetch articles across configured Medium tags concurrently.

        Args:
            limit: Maximum total articles to return across all tags.
        """
        effective_limit = min(
            limit if limit is not None else self.settings.FEED_DEFAULT_LIMIT,
            self.settings.FEED_MAX_LIMIT,
        )
        if effective_limit <= 0:
            return []

        try:
            if self._client is not None:
                return await self._fetch_all_tags(self._client, effective_limit)
            else:
                async with httpx.AsyncClient(
                    timeout=self.settings.HTTP_TIMEOUT_SECONDS,
                    follow_redirects=True,
                ) as client:
                    return await self._fetch_all_tags(client, effective_limit)
        except Exception as e:
            logger.warning("Unexpected error during Medium feed fetch: %s", e)
            return []

    async def _fetch_all_tags(self, client: httpx.AsyncClient, limit: int) -> List[Article]:
        sem = asyncio.Semaphore(self.settings.MAX_CONCURRENT_REQUESTS)

        async def fetch_tag(tag: str) -> List[Article]:
            async with sem:
                return await self._fetch_single_tag(client, tag)

        tasks = [fetch_tag(tag) for tag in self.tags]
        results_per_tag = await asyncio.gather(*tasks, return_exceptions=True)

        combined: List[Article] = []
        seen_urls = set()

        # Give every topic a turn before taking another item from the first topic.
        batches = [res for res in results_per_tag if isinstance(res, list)]
        for index in range(max((len(batch) for batch in batches), default=0)):
            for batch in batches:
                if index < len(batch):
                    art = batch[index]
                    if art.url not in seen_urls:
                        seen_urls.add(art.url)
                        combined.append(art)
                    if len(combined) >= limit:
                        return combined

        return combined

    async def _fetch_single_tag(self, client: httpx.AsyncClient, tag: str) -> List[Article]:
        url = f"{MEDIUM_FEED_BASE_URL}/{tag}"
        try:
            response = await client.get(
                url, timeout=self.settings.HTTP_TIMEOUT_SECONDS, follow_redirects=True
            )
            if response.status_code == 429:
                logger.warning("[Medium Ingestion] Rate-limited (HTTP 429) on tag '%s'", tag)
                return []
            if response.status_code != 200:
                logger.warning(
                    "[Medium Ingestion] HTTP %d while fetching tag '%s'",
                    response.status_code,
                    tag,
                )
                return []

            return self._parse_feed_xml(response.text, tag)

        except httpx.TimeoutException:
            logger.warning("[Medium Ingestion] Timed out fetching tag '%s'", tag)
            return []
        except Exception as e:
            logger.warning("[Medium Ingestion] Error fetching tag '%s': %s", tag, e)
            return []

    def _parse_feed_xml(self, xml_text: str, tag: str) -> List[Article]:
        articles: List[Article] = []
        if not xml_text:
            return articles

        # XML namespace map commonly used by Medium RSS
        namespaces = {
            "content": "http://purl.org/rss/1.0/modules/content/",
            "dc": "http://purl.org/dc/elements/1.1/",
            "atom": "http://www.w3.org/2005/Atom",
        }

        try:
            root = ET.fromstring(xml_text)
            items = root.findall(".//item")
            for item in items:
                title = (item.findtext("title") or "Untitled").strip()
                link = (item.findtext("link") or "").strip()
                if not link or not link.startswith("http"):
                    continue

                # Strip medium tracking params from URL if present
                clean_url = link.split("?source=")[0].split("?responsesOpen=")[0]

                # Date parsing via standard library email.utils
                pub_date_str = item.findtext("pubDate")
                published_at = None
                if pub_date_str:
                    try:
                        published_at = email.utils.parsedate_to_datetime(pub_date_str)
                        if published_at.tzinfo is None:
                            published_at = published_at.replace(tzinfo=timezone.utc)
                    except Exception:
                        published_at = None

                # Extract content:encoded block
                content_elem = item.find("content:encoded", namespaces)
                content_html = content_elem.text if content_elem is not None and content_elem.text else ""
                if not content_html:
                    content_html = item.findtext("description") or ""

                # Extract featured image from content
                image_url = self.extract_image_url(content_html)

                # Deterministic stable ID from URL
                url_hash = hashlib.md5(clean_url.encode("utf-8")).hexdigest()[:12]

                article = Article(
                    id=f"med_{url_hash}",
                    hn_id=0,
                    title=self.clean_html(title),
                    url=clean_url,
                    published_at=published_at,
                    hn_score=0,
                    source="Medium",
                    image_url=image_url if image_url else None,
                    category=tag,
                )
                articles.append(article)

        except Exception as e:
            logger.warning("[Medium Ingestion] XML parse error for tag '%s': %s", tag, e)

        return articles

