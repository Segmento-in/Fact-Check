from typing import List, Literal
from pydantic import Field, SecretStr
from pydantic_settings import BaseSettings, SettingsConfigDict


FeedName = Literal["hackernews", "medium", "google_news", "newsdata", "newsapi"]
FeedSelection = Literal["all", "hackernews", "medium", "google_news", "newsdata", "newsapi"]


class Settings(BaseSettings):
    """Application settings loaded from environment or .env with safe defaults."""

    # Hacker News Feed Settings
    HN_TOP_STORIES_LIMIT: int = 30
    HN_MAX_LIMIT: int = 100
    HTTP_TIMEOUT_SECONDS: float = 10.0
    MAX_CONCURRENT_REQUESTS: int = 10

    # Ingestion Feed Settings
    DEFAULT_FEED: FeedSelection = "all"
    FEED_DEFAULT_LIMIT: int = 60
    FEED_MAX_LIMIT: int = 100
    ENABLED_FEEDS: List[FeedName] = ["hackernews", "medium", "google_news", "newsdata", "newsapi"]
    NEWSAPI_API_KEY: SecretStr | None = Field(default=None, repr=False)
    NEWSDATA_API_KEY: SecretStr | None = Field(default=None, repr=False)
    NEWS_FEED_QUERY: str = "technology"
    NEWS_FEED_LANGUAGE: str = "en"
    NEWSDATA_COUNTRY: str = "us"
    NEWSDATA_PAGE_SIZE: int = Field(default=10, ge=1, le=50)
    NEWSAPI_PAGE_SIZE: int = Field(default=20, ge=1, le=100)
    GOOGLE_NEWS_LANGUAGE: str = "en-US"
    GOOGLE_NEWS_COUNTRY: str = "US"
    GOOGLE_NEWS_EDITION: str = "US:en"
    MEDIUM_TAGS: List[str] = [
        "artificial-intelligence",
        "technology",
        "data-science",
        "cybersecurity",
        "programming",
        "cloud-computing",
        "law",
    ]

    # CORS Settings
    CORS_ORIGINS: List[str] = ["http://localhost:3000"]

    # Article Text Extraction Settings
    ARTICLE_FETCH_TIMEOUT_SECONDS: float = 10.0
    ARTICLE_MAX_DOWNLOAD_BYTES: int = 2_000_000
    ARTICLE_MIN_WORDS: int = 100
    ARTICLE_MAX_CHARS: int = 20_000
    ARTICLE_USER_AGENT: str = "FactCheckerBot/0.1 (proof of concept)"
    ARTICLES_MAX_CONCURRENT_EXTRACTIONS: int = 5

    # Article Report Cache Settings
    ARTICLES_CACHE_TTL_SECONDS: int = 600

    model_config = SettingsConfigDict(
        env_file=".env",
        env_file_encoding="utf-8",
        case_sensitive=True,
        extra="ignore",
    )


settings = Settings()
