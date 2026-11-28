import asyncio
import logging
from typing import Optional
import httpx

from app.config import Settings, settings as default_settings
from app.models import ExtractionResult

logger = logging.getLogger(__name__)


class ArticleTextExtractor:
    """Extracts readable article text from web pages using trafilatura."""

    def __init__(
        self,
        client: Optional[httpx.AsyncClient] = None,
        settings: Optional[Settings] = None,
    ) -> None:
        self._client = client
        self.settings = settings or default_settings

    async def extract(self, url: str) -> ExtractionResult:
        """
        Fetch web page and extract its main article text.

        Never raises an exception; all errors map to an ExtractionResult status.
        """
        try:
            if self._client is not None:
                return await self._extract_with_client(self._client, url)
            else:
                async with httpx.AsyncClient(
                    timeout=self.settings.ARTICLE_FETCH_TIMEOUT_SECONDS,
                    follow_redirects=True,
                ) as client:
                    return await self._extract_with_client(client, url)
        except Exception as e:
            logger.warning("Article extraction failed for %s: %s", url, e)
            return ExtractionResult(status="fetch_failed", final_url=url)

    async def _extract_with_client(
        self, client: httpx.AsyncClient, url: str
    ) -> ExtractionResult:
        headers = {"User-Agent": self.settings.ARTICLE_USER_AGENT}
        final_url = url

        try:
            async with client.stream(
                "GET",
                url,
                headers=headers,
                follow_redirects=True,
                timeout=self.settings.ARTICLE_FETCH_TIMEOUT_SECONDS,
            ) as response:
                final_url = str(response.url)

                if response.status_code != 200:
                    logger.warning(
                        "Article fetch failed for %s: HTTP status %d",
                        final_url,
                        response.status_code,
                    )
                    return ExtractionResult(status="fetch_failed", final_url=final_url)

                content_type = response.headers.get("content-type", "").lower()
                if not (
                    "text/html" in content_type
                    or "application/xhtml+xml" in content_type
                ):
                    logger.warning(
                        "Article fetch for %s returned non-HTML Content-Type: %s",
                        final_url,
                        content_type,
                    )
                    return ExtractionResult(status="not_html", final_url=final_url)

                # Download up to ARTICLE_MAX_DOWNLOAD_BYTES
                content_bytes = bytearray()
                max_bytes = self.settings.ARTICLE_MAX_DOWNLOAD_BYTES
                async for chunk in response.aiter_bytes():
                    content_bytes.extend(chunk)
                    if len(content_bytes) >= max_bytes:
                        content_bytes = content_bytes[:max_bytes]
                        break

        except Exception as e:
            logger.warning("Article download failed for %s: %s", url, e)
            return ExtractionResult(status="fetch_failed", final_url=final_url)

        return await self.extract_html(bytes(content_bytes), final_url)

    async def extract_html(
        self, content_bytes: bytes, final_url: str, *, limit_text: bool = True,
        include_tables: bool = False,
    ) -> ExtractionResult:
        """Reuse main-text parsing after HTML has already been fetched safely."""
        # Run synchronous trafilatura extraction in a separate thread
        try:
            import trafilatura

            def _sync_extract(raw_data: bytes) -> Optional[str]:
                return trafilatura.extract(
                    raw_data,
                    include_comments=False,
                    include_tables=include_tables,
                    favor_precision=True,
                )

            extracted_text = await asyncio.to_thread(
                _sync_extract, bytes(content_bytes)
            )
        except Exception as e:
            logger.warning("Trafilatura extraction failed for %s: %s", final_url, e)
            return ExtractionResult(status="no_text", final_url=final_url)

        if not extracted_text or not extracted_text.strip():
            logger.warning("No main article text found for %s", final_url)
            return ExtractionResult(status="no_text", final_url=final_url)

        text = extracted_text.strip()
        if limit_text and len(text) > self.settings.ARTICLE_MAX_CHARS:
            text = text[: self.settings.ARTICLE_MAX_CHARS]

        word_count = len(text.split())

        if word_count < self.settings.ARTICLE_MIN_WORDS:
            logger.warning(
                "Extracted text too short (%d words < %d min) for %s",
                word_count,
                self.settings.ARTICLE_MIN_WORDS,
                final_url,
            )
            return ExtractionResult(
                status="too_short",
                text=text,
                word_count=word_count,
                final_url=final_url,
            )

        return ExtractionResult(
            status="ok",
            text=text,
            word_count=word_count,
            final_url=final_url,
        )

