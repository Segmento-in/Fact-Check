from abc import ABC, abstractmethod
from datetime import datetime, timezone
import logging
import re
from typing import List, Optional
import httpx

from app.config import Settings, settings as default_settings
from app.models import Article

logger = logging.getLogger(__name__)


class BaseIngestionSource(ABC):
    """Abstract base class for all news and claim ingestion sources."""

    def __init__(
        self,
        client: Optional[httpx.AsyncClient] = None,
        settings: Optional[Settings] = None,
    ) -> None:
        self._client = client
        self.settings = settings or default_settings

    @property
    @abstractmethod
    def source_name(self) -> str:
        """Name of the ingestion source (e.g. 'Hacker News', 'Medium')."""
        pass

    @abstractmethod
    async def fetch_articles(self, limit: Optional[int] = None) -> List[Article]:
        """
        Fetch articles from the provider source.

        Args:
            limit: Maximum number of articles to return.

        Returns:
            List[Article]: Validated Article models.
        """
        pass

    @staticmethod
    def clean_html(raw_html: str) -> str:
        """Strip HTML tags, decode entities, and normalize whitespace."""
        if not raw_html:
            return ""

        # Remove CDATA wrappers
        text = re.sub(r'<!\[CDATA\[([\s\S]*?)\]\]>', r'\1', raw_html)

        # Remove tags
        text = re.sub(r'<[^>]+>', '', text)

        # Basic entity decoding
        entities = {
            '&nbsp;': ' ',
            '&amp;': '&',
            '&lt;': '<',
            '&gt;': '>',
            '&quot;': '"',
            '&#39;': "'",
            '&apos;': "'",
            '&hellip;': '...',
            '&mdash;': '—',
            '&ndash;': '–',
        }
        for ent, char in entities.items():
            text = text.replace(ent, char)

        # Remove numeric entities
        text = re.sub(r'&#\d+;', '', text)

        # Normalize whitespace
        return re.sub(r'\s+', ' ', text).strip()

    @staticmethod
    def extract_image_url(html_content: str) -> str:
        """Extract first image src attribute from an HTML block."""
        if not html_content:
            return ""
        match = re.search(r'<img[^>]+src=["\']([^"\']+)["\']', html_content, re.IGNORECASE)
        if match:
            return match.group(1).strip()
        return ""

