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
        limit: int = 20,
        source: Optional[str] = None,
    ) -> List[Article]:
        """
        Fetch articles from one or all registered ingestion sources.

        Args:
            limit: Total maximum number of articles to return.
            source: Optional specific source name ('hackernews', 'medium', or None for all).
        """
        if source and source.lower() in self.sources:
            return await self.sources[source.lower()].fetch_articles(limit=limit)

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

