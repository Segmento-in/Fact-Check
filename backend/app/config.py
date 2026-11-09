from typing import List
from pydantic_settings import BaseSettings, SettingsConfigDict


class Settings(BaseSettings):
    """Application settings loaded from environment or .env with safe defaults."""

    # Hacker News Feed Settings
    HN_TOP_STORIES_LIMIT: int = 10
    HN_MAX_LIMIT: int = 30
    HTTP_TIMEOUT_SECONDS: float = 10.0
    MAX_CONCURRENT_REQUESTS: int = 10

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
