"""Shared HTTP and Article mapping for the Pulse-derived Feed adapters."""
from abc import abstractmethod
from datetime import datetime, timezone
from email.utils import parsedate_to_datetime
import hashlib
import html
import logging
import re
import time
from typing import Optional
from urllib.parse import parse_qsl, urlencode, urlsplit, urlunsplit

import httpx

from app.ingestion.base import BaseIngestionSource
from app.models import Article

logger = logging.getLogger(__name__)


def clean_text(value: object) -> str:
    if not isinstance(value, str):
        return ""
    return " ".join(html.unescape(re.sub(r"<[^>]*>", "", value)).split())


def article_url(value: object) -> Optional[str]:
    if not isinstance(value, str):
        return None
    try:
        parts = urlsplit(value.strip())
        if parts.scheme.lower() not in {"http", "https"} or not parts.hostname:
            return None
        if parts.username or parts.password or any(char.isspace() for char in parts.netloc):
            return None
        # Preserve semantic query parameters, removing only known tracking fields.
        query = [(key, val) for key, val in parse_qsl(parts.query, keep_blank_values=True)
                 if not key.lower().startswith("utm_") and key.lower() not in {"fbclid", "gclid"}]
        return urlunsplit((parts.scheme.lower(), parts.netloc, parts.path, urlencode(query), ""))
    except ValueError:
        return None


def published_date(value: object) -> Optional[datetime]:
    if not isinstance(value, str) or not value.strip():
        return None
    try:
        result = datetime.fromisoformat(value.strip().replace("Z", "+00:00"))
    except ValueError:
        try:
            result = parsedate_to_datetime(value.strip())
        except (TypeError, ValueError, OverflowError):
            return None
    if result.tzinfo is None:
        result = result.replace(tzinfo=timezone.utc)
    return result.astimezone(timezone.utc)


def make_article(*, prefix: str, feed: str, title: object, url: object,
                 date: object = None, image: object = None, publisher: object = None) -> Optional[Article]:
    headline, link = clean_text(title), article_url(url)
    if not headline or headline.lower() == "[removed]" or not link:
        return None
    cover = article_url(image)
    if cover and urlsplit(cover).scheme != "https":
        cover = None
    return Article(
        id=f"{prefix}_{hashlib.sha256(link.encode()).hexdigest()[:16]}",
        title=headline, url=link, published_at=published_date(date), hn_score=0,
        source=feed, publisher=clean_text(publisher) or None,
        image_url=cover, category="tech",
    )


def unique_articles(articles: list[Article], limit: int) -> list[Article]:
    seen: set[str] = set()
    result: list[Article] = []
    for article in articles:
        if article.url not in seen:
            seen.add(article.url)
            result.append(article)
        if len(result) >= limit:
            break
    return result


class HttpIngestionSource(BaseIngestionSource):
    """Pulse-style timeouts, partial failures and rate-limit backoff, without DB coupling."""
    key_setting: Optional[str] = None

    def __init__(self, *args, **kwargs):
        super().__init__(*args, **kwargs)
        self._retry_until = 0.0
        self._backoff_count = 0

    def _api_key(self) -> str:
        if not self.key_setting:
            return ""
        secret = getattr(self.settings, self.key_setting)
        return secret.get_secret_value().strip() if secret is not None else ""

    async def fetch_articles(self, limit: Optional[int] = None) -> list[Article]:
        effective = min(limit if limit is not None else self.settings.FEED_DEFAULT_LIMIT,
                        self.settings.FEED_MAX_LIMIT)
        if effective <= 0 or time.monotonic() < self._retry_until:
            return []
        if self.key_setting and not self._api_key():
            return []
        try:
            if self._client is not None:
                articles = await self._fetch(self._client, effective)
            else:
                async with httpx.AsyncClient(timeout=self.settings.HTTP_TIMEOUT_SECONDS) as client:
                    articles = await self._fetch(client, effective)
            return unique_articles(articles, effective)
        except Exception as exc:
            # Exceptions and response bodies can contain credentials; log neither.
            logger.warning("%s Feed request failed (%s)", self.source_name, type(exc).__name__)
            return []

    async def _get(self, client: httpx.AsyncClient, url: str, **kwargs) -> Optional[httpx.Response]:
        response = await client.get(url, timeout=self.settings.HTTP_TIMEOUT_SECONDS, **kwargs)
        if response.status_code == 429:
            self._backoff_count += 1
            delay = min(30 * 2 ** min(self._backoff_count - 1, 7), 3600)
            try:
                delay = max(delay, min(float(response.headers.get("retry-after", "0")), 3600))
            except ValueError:
                pass
            self._retry_until = time.monotonic() + delay
            logger.warning("%s Feed rate limited; cooling down", self.source_name)
            return None
        if response.status_code != 200:
            logger.warning("%s Feed returned HTTP %d", self.source_name, response.status_code)
            return None
        self._backoff_count = 0
        return response

    @abstractmethod
    async def _fetch(self, client: httpx.AsyncClient, limit: int) -> list[Article]:
        raise NotImplementedError
