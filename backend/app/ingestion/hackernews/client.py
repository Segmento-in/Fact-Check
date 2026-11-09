import asyncio
from datetime import datetime, timezone
import logging
from typing import List, Optional
import httpx

from app.config import Settings, settings as default_settings
from app.ingestion.base import BaseIngestionSource
from app.models import Article

logger = logging.getLogger(__name__)

HN_TOP_STORIES_URL = "https://hacker-news.firebaseio.com/v0/topstories.json"
HN_ITEM_URL = "https://hacker-news.firebaseio.com/v0/item/{item_id}.json"


class HackerNewsIngestionSource(BaseIngestionSource):
    """Ingestion source that pulls stories from the Hacker News API into Articles."""

    @property
    def source_name(self) -> str:
        return "Hacker News"

    async def fetch_articles(self, limit: Optional[int] = None) -> List[Article]:
        """Fetch top stories from Hacker News bounded by settings limits."""
        effective_limit = limit if limit is not None else self.settings.HN_TOP_STORIES_LIMIT
        if effective_limit > self.settings.HN_MAX_LIMIT:
            effective_limit = self.settings.HN_MAX_LIMIT
        if effective_limit <= 0:
            return []

        try:
            if self._client is not None:
                return await self._fetch_articles_internal(self._client, effective_limit)
            else:
                async with httpx.AsyncClient(timeout=self.settings.HTTP_TIMEOUT_SECONDS) as client:
                    return await self._fetch_articles_internal(client, effective_limit)
        except Exception as e:
            logger.warning("Unexpected error during Hacker News feed fetch: %s", e)
            return []

    async def _fetch_articles_internal(
        self, client: httpx.AsyncClient, limit: int
    ) -> List[Article]:
        try:
            response = await client.get(
                HN_TOP_STORIES_URL, timeout=self.settings.HTTP_TIMEOUT_SECONDS
            )
            if response.status_code != 200:
                logger.warning(
                    "Hacker News top stories endpoint returned HTTP %d", response.status_code
                )
                return []
            ids = response.json()
            if not isinstance(ids, list):
                logger.warning("Hacker News top stories returned non-list JSON.")
                return []
        except Exception as e:
            logger.warning("Failed to fetch top stories ID list: %s", e)
            return []

        target_ids = ids[:limit]
        if not target_ids:
            return []

        sem = asyncio.Semaphore(self.settings.MAX_CONCURRENT_REQUESTS)

        async def fetch_single_item(item_id: int) -> Optional[dict]:
            url = HN_ITEM_URL.format(item_id=item_id)
            try:
                async with sem:
                    res = await client.get(url, timeout=self.settings.HTTP_TIMEOUT_SECONDS)
                if res.status_code != 200:
                    logger.warning("Hacker News item %d returned HTTP %d", item_id, res.status_code)
                    return None
                data = res.json()
                if not isinstance(data, dict):
                    return None
                return data
            except Exception as item_err:
                logger.warning("Failed to fetch Hacker News item %d: %s", item_id, item_err)
                return None

        tasks = [fetch_single_item(item_id) for item_id in target_ids]
        raw_items = await asyncio.gather(*tasks, return_exceptions=True)

        articles: List[Article] = []
        for item in raw_items:
            if item is None or isinstance(item, Exception):
                continue

            if item.get("deleted") is True or item.get("dead") is True:
                continue

            if item.get("type") != "story":
                continue

            raw_url = item.get("url")
            if not isinstance(raw_url, str):
                continue
            url = raw_url.strip()
            if not url or not url.startswith("http"):
                continue

            raw_title = item.get("title")
            if not isinstance(raw_title, str):
                continue
            title = raw_title.strip()
            if not title:
                continue

            hn_id = item.get("id")
            if not isinstance(hn_id, int):
                continue

            unix_time = item.get("time")
            published_at = None
            if isinstance(unix_time, (int, float)):
                try:
                    published_at = datetime.fromtimestamp(unix_time, tz=timezone.utc)
                except Exception:
                    published_at = None

            raw_score = item.get("score")
            hn_score = int(raw_score) if isinstance(raw_score, (int, float)) else 0

            articles.append(
                Article(
                    id=f"hn_{hn_id}",
                    hn_id=hn_id,
                    title=title,
                    url=url,
                    published_at=published_at,
                    hn_score=hn_score,
                    source="Hacker News",
                    category="tech",
                )
            )

        return articles

