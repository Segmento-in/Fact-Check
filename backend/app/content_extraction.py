"""Stage 1 API: a submitted Article link becomes cleaned Article Text."""
import asyncio
import logging
from functools import lru_cache
import re
from typing import Literal
import unicodedata

from fastapi import APIRouter, Depends, Response
from pydantic import BaseModel, ConfigDict, Field, field_validator

from app.config import Settings, settings as default_settings
from app.extraction.article_text import ArticleTextExtractor
from app.extraction.safe_fetcher import FetchFailure, SafeFetcher, validate_article_url

logger = logging.getLogger(__name__)
router = APIRouter(prefix="/api/content", tags=["Content"])
ContentExtractionStatus = Literal[
    "ok", "too_short", "no_text", "not_html", "fetch_failed", "blocked_url",
    "too_large", "too_long", "timeout", "busy", "unsupported_encoding",
]
MESSAGES = {
    "ok": "Article Text extracted. It has not been fact-checked.",
    "too_short": "We could not find enough Article Text. Try another link.",
    "no_text": "We could not find readable Article Text on this page.",
    "not_html": "This link does not return an HTML article page.",
    "fetch_failed": "We could not open this article. Try again or use another link.",
    "blocked_url": "This link cannot be opened. Use a public Article link.",
    "too_large": "This page is too large to download safely.",
    "too_long": "This article is longer than the current text limit.",
    "timeout": "This article took too long to load. Try again.",
    "busy": "We are processing other articles. Please try again shortly.",
    "unsupported_encoding": "This page returned an unsupported download encoding.",
}
HTTP_STATUSES = {
    "ok": 200, "too_short": 422, "no_text": 422, "not_html": 415,
    "fetch_failed": 502, "blocked_url": 400, "too_large": 413, "too_long": 413,
    "timeout": 504, "busy": 503, "unsupported_encoding": 415,
}


class ContentExtractionRequest(BaseModel):
    model_config = ConfigDict(extra="forbid")
    url: str = Field(min_length=1, max_length=2048)

    @field_validator("url")
    @classmethod
    def validate_link(cls, value: str) -> str:
        # Validate raw input before a URL parser can discard unsafe controls.
        if any(ord(char) < 32 or ord(char) == 127 for char in value):
            raise ValueError("The Article link contains unsupported characters.")
        return str(validate_article_url(value.strip()))


class ContentExtractionResponse(BaseModel):
    status: ContentExtractionStatus
    text: str = ""
    word_count: int = 0
    final_url: str | None = None
    message: str


def clean_article_text(value: str) -> str:
    """Normalize whitespace, preserving wording, numbers, punctuation and Unicode."""
    value = unicodedata.normalize("NFC", value)
    value = value.replace("\r\n", "\n").replace("\r", "\n").lstrip("\ufeff")
    value = "".join(
        char if char in "\n\t" or unicodedata.category(char) != "Cc" else " "
        for char in value
    )
    value = "\n".join(re.sub(r"[^\S\n]+", " ", line).strip() for line in value.split("\n"))
    return re.sub(r"\n{3,}", "\n\n", value).strip()


def result(status: ContentExtractionStatus, **fields) -> ContentExtractionResponse:
    return ContentExtractionResponse(status=status, message=MESSAGES[status], **fields)


class ContentExtractionService:
    def __init__(self, settings: Settings, fetcher: SafeFetcher | None = None):
        self.settings = settings
        self.fetcher = fetcher if fetcher is not None else SafeFetcher(settings)
        self.extractor = ArticleTextExtractor(settings=settings)
        # ponytail: worker capacity is per process; add a shared quota when using multiple API replicas or when one client can starve others.
        self._slots = asyncio.Semaphore(max(1, settings.ARTICLES_MAX_CONCURRENT_EXTRACTIONS))
        self._workers: set[asyncio.Task] = set()

    async def extract(self, url: str) -> ContentExtractionResponse:
        if self._slots.locked():
            return result("busy")
        await self._slots.acquire()
        deadline = asyncio.get_running_loop().time() + self.settings.ARTICLE_FETCH_TIMEOUT_SECONDS
        worker = asyncio.create_task(self._extract(url, deadline))
        self._workers.add(worker)
        worker.add_done_callback(self._worker_finished)
        try:
            # Return on time without abandoning thread-backed DNS or parsing work.
            async with asyncio.timeout_at(deadline):
                return await asyncio.shield(worker)
        except TimeoutError:
            return result("timeout")

    def _worker_finished(self, worker: asyncio.Task) -> None:
        self._workers.discard(worker)
        if not worker.cancelled():
            worker.exception()
        self._slots.release()

    async def _extract(self, url: str, deadline: float) -> ContentExtractionResponse:
        try:
            page = await self.fetcher.fetch_html(url, deadline=deadline)
            if asyncio.get_running_loop().time() >= deadline:
                return result("timeout")
            extracted = await self.extractor.extract_html(
                page.content, page.final_url, limit_text=False, include_tables=True,
            )
            if asyncio.get_running_loop().time() >= deadline:
                return result("timeout")
            if extracted.status not in {"ok", "too_short"}:
                return result(extracted.status, final_url=page.final_url)
            text = clean_article_text(extracted.text)
            if not text:
                return result("no_text", final_url=page.final_url)
            # Never silently send a cut-off article to future checking stages.
            if len(text) > self.settings.ARTICLE_MAX_CHARS:
                return result("too_long", final_url=page.final_url)
            word_count = len(text.split())
            status = "ok" if word_count >= self.settings.ARTICLE_MIN_WORDS else "too_short"
            return result(status, text=text, word_count=word_count, final_url=page.final_url)
        except FetchFailure as error:
            return result(error.status)
        except TimeoutError:
            return result("timeout")
        except Exception as error:
            # Log only the exception class; messages can contain private URLs.
            logger.warning("Content extraction failed (%s)", type(error).__name__)
            return result("fetch_failed")


@lru_cache(maxsize=1)
def get_content_extraction_service() -> ContentExtractionService:
    return ContentExtractionService(default_settings)


@router.post(
    "/extract",
    response_model=ContentExtractionResponse,
    summary="Fetch and clean a submitted Article link",
)
async def extract_content(
    body: ContentExtractionRequest,
    response: Response,
    service: ContentExtractionService = Depends(get_content_extraction_service),
) -> ContentExtractionResponse:
    extraction = await service.extract(body.url)
    response.status_code = HTTP_STATUSES[extraction.status]
    response.headers["Cache-Control"] = "no-store"
    return extraction
