"""
Hacker News feed ingestion module.
Maintained for backward compatibility. Re-exports HackerNewsIngestionSource from app.ingestion.
"""
from app.ingestion.hackernews.client import (
    HackerNewsIngestionSource as HackerNewsFeed,
    HN_TOP_STORIES_URL,
    HN_ITEM_URL,
)

__all__ = ["HackerNewsFeed", "HN_TOP_STORIES_URL", "HN_ITEM_URL"]
