import asyncio
import time
from typing import Callable, List, Literal, Optional
from fastapi import Depends, FastAPI, Query
from fastapi.middleware.cors import CORSMiddleware

from app.config import Settings, settings as default_settings
from app.extraction.article_text import ArticleTextExtractor
from app.feeds.hackernews import HackerNewsFeed
from app.ingestion.service import IngestionService
from app.models import (
    Article,
    ArticleReport,
    ArticlesResponse,
    ExtractionResult,
    ExtractionSummary,
    TrustedSourcesResponse,
)
from app.trusted_sources import TRUSTED_SOURCES

app = FastAPI(
    title="Fact Checker API",
    description="Backend API for Fact Checker system",
    version="0.1.0",
)

# CORS middleware
app.add_middleware(
    CORSMiddleware,
    allow_origins=default_settings.CORS_ORIGINS,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# In-memory cache for GET /api/articles: (limit, source, extract_text) -> reports.
_articles_cache: dict[tuple, tuple[float, List[ArticleReport]]] = {}


def get_settings() -> Settings:
    return default_settings


def get_hn_feed() -> HackerNewsFeed:
    return HackerNewsFeed()


def get_ingestion_service() -> IngestionService:
    return IngestionService()


def get_article_extractor() -> ArticleTextExtractor:
    return ArticleTextExtractor()


def get_clock() -> Callable[[], float]:
    return time.time


def get_articles_cache() -> dict[tuple, tuple[float, List[ArticleReport]]]:
    return _articles_cache


@app.get("/health")
def health_check() -> dict:
    """Basic health check endpoint."""
    return {"status": "ok"}


@app.get("/api/trusted-sources", response_model=TrustedSourcesResponse)
def get_trusted_sources() -> TrustedSourcesResponse:
    """Return the list of trusted sources for fact-checking."""
    return TrustedSourcesResponse(sources=TRUSTED_SOURCES)


@app.get("/api/articles", response_model=ArticlesResponse)
async def get_articles(
    limit: int = Query(
        default=default_settings.FEED_DEFAULT_LIMIT,
        ge=1,
        le=default_settings.FEED_MAX_LIMIT,
        description="Number of articles to fetch",
    ),
    source: Optional[Literal["hackernews", "medium", "all"]] = Query(
        default=None,
        description="Feed: hackernews, medium, all, or the configured default when omitted",
    ),
    extract_text: bool = Query(
        default=True,
        description="False returns Feed Card metadata without downloading every Article page",
    ),
    ingestion: IngestionService = Depends(get_ingestion_service),
    extractor: ArticleTextExtractor = Depends(get_article_extractor),
    clock: Callable[[], float] = Depends(get_clock),
    cache: dict = Depends(get_articles_cache),
    settings: Settings = Depends(get_settings),
) -> ArticlesResponse:
    """
    Fetch news articles across ingestion sources (Hacker News, Medium) with extracted text status.

    Returns reports with checked=False (not fact-checked yet).
    Responses are cached per (limit, effective source, extract_text).
    Feed Card requests can skip text extraction; this never creates a Verdict.
    """
    now = clock()
    cache_key = (limit, source or settings.DEFAULT_FEED, extract_text)

    # Check cache for this key
    if cache_key in cache:
        cached_time, cached_reports = cache[cache_key]
        if (now - cached_time) < settings.ARTICLES_CACHE_TTL_SECONDS:
            return ArticlesResponse(
                articles=cached_reports,
                total=len(cached_reports),
                cached=True,
            )

    # Fetch articles from ingestion service
    raw_articles = await ingestion.fetch_articles(limit=limit, source=source)
    if not raw_articles:
        return ArticlesResponse(
            articles=[],
            total=0,
            cached=False,
        )

    # Concurrently extract text with bounded concurrency
    sem = asyncio.Semaphore(settings.ARTICLES_MAX_CONCURRENT_EXTRACTIONS)

    async def _extract_single(art: Article) -> ExtractionResult:
        async with sem:
            return await extractor.extract(art.url)

    if extract_text:
        tasks = [_extract_single(art) for art in raw_articles]
        extraction_results = await asyncio.gather(*tasks)
    else:
        extraction_results = [None] * len(raw_articles)

    reports: List[ArticleReport] = []
    for art, res in zip(raw_articles, extraction_results):
        text_preview = res.text[:600] if res and res.status == "ok" and res.text else ""
        summary = ExtractionSummary(
            status=res.status if res else "not_requested",
            word_count=res.word_count if res else 0,
            text_preview=text_preview,
            final_url=res.final_url if res else None,
        )
        report = ArticleReport(
            article=art,
            extraction=summary,
            checked=False,
            overall_verdict_key=None,
            overall_confidence=None,
            claims=[],
            skipped_statements=[],
        )
        reports.append(report)

    # Store in memory cache
    cache[cache_key] = (clock(), reports)

    return ArticlesResponse(
        articles=reports,
        total=len(reports),
        cached=False,
    )
