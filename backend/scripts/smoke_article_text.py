import asyncio
import sys
from pathlib import Path

# Ensure backend root is on sys.path regardless of execution directory
BACKEND_ROOT = Path(__file__).resolve().parent.parent
if str(BACKEND_ROOT) not in sys.path:
    sys.path.insert(0, str(BACKEND_ROOT))

from app.feeds.hackernews import HackerNewsFeed
from app.extraction.article_text import ArticleTextExtractor


async def main():
    feed = HackerNewsFeed()
    articles = await feed.fetch_articles(limit=8)
    extractor = ArticleTextExtractor()

    print(f"Fetched {len(articles)} Hacker News articles. Extracting readable text...\n")
    for article in articles:
        result = await extractor.extract(article.url)
        preview = result.text[:120].replace("\n", " ") if result.text else "(no text)"
        print(f"[{result.status.upper()}] words={result.word_count} url={article.url}")
        print(f"   preview: {preview}\n")


if __name__ == "__main__":
    asyncio.run(main())
