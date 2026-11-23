import asyncio
import logging
from typing import Dict, List, Optional
import httpx

from app.config import Settings, settings as default_settings
from app.ingestion.base import BaseIngestionSource
from app.ingestion.hackernews.client import HackerNewsIngestionSource
from app.ingestion.medium.client import MediumIngestionSource
from app.models import Article

logger = logging.getLogger(__name__)


class IngestionService:
    """
    Global Ingestion Orchestrator.
    Manages and coordinates multiple claim/article ingestion sources (Hacker News, Medium, etc.).
    """

    def __init__(
        self,
        client: Optional[httpx.AsyncClient] = None,
        settings: Optional[Settings] = None,
    ) -> None:
        self.settings = settings or default_settings
        self._client = client

        # Registered ingestion providers
        self.sources: Dict[str, BaseIngestionSource] = {
            "hackernews": HackerNewsIngestionSource(client=client, settings=self.settings),
            "medium": MediumIngestionSource(client=client, settings=self.settings),
        }

    async def fetch_articles(
        self,
        limit: Optional[int] = None,
        source: Optional[str] = None,
    ) -> List[Article]:
        """
        Fetch articles from one or all registered ingestion sources.

        Args:
            limit: Total maximum number of articles to return.
            source: 'hackernews', 'medium', 'all', or None for the configured default.
        """
        limit = min(
            limit if limit is not None else self.settings.FEED_DEFAULT_LIMIT,
            self.settings.FEED_MAX_LIMIT,
        )
        if limit <= 0:
            return []
        target_source = (source if source is not None else self.settings.DEFAULT_FEED).lower()
        if target_source in self.sources:
            return await self.sources[target_source].fetch_articles(limit=limit)
        if target_source != "all":
            raise ValueError(f"Unknown Feed: {target_source}")

        # Multi-source parallel ingestion
        tasks = [src.fetch_articles(limit=limit) for src in self.sources.values()]
        results_lists = await asyncio.gather(*tasks, return_exceptions=True)

        combined: List[Article] = []
        seen_urls = set()

        # Interleave results from sources to ensure diversity
        valid_lists = [r for r in results_lists if isinstance(r, list)]
        max_len = max((len(lst) for lst in valid_lists), default=0)

        for i in range(max_len):
            for lst in valid_lists:
                if i < len(lst):
                    art = lst[i]
                    if art.url not in seen_urls:
                        seen_urls.add(art.url)
                        combined.append(art)
                    if len(combined) >= limit:
                        return combined

        return combined

