"""Adapted from Pulse's NewsAPIProvider request and field mapping."""
import httpx

from app.ingestion.remote import HttpIngestionSource, make_article
from app.models import Article

NEWSAPI_URL = "https://newsapi.org/v2/everything"


class NewsAPIIngestionSource(HttpIngestionSource):
    source_name = "NewsAPI"
    key_setting = "NEWSAPI_API_KEY"

    async def _fetch(self, client: httpx.AsyncClient, limit: int) -> list[Article]:
        response = await self._get(client, NEWSAPI_URL, params={
            "q": self.settings.NEWS_FEED_QUERY,
            "language": self.settings.NEWS_FEED_LANGUAGE,
            "sortBy": "publishedAt",
            "pageSize": min(limit, self.settings.NEWSAPI_PAGE_SIZE),
        }, headers={"X-Api-Key": self._api_key()})
        if response is None:
            return []
        data = response.json()
        if not isinstance(data, dict) or data.get("status") != "ok":
            return []
        items = data.get("articles")
        if not isinstance(items, list):
            return []
        articles = []
        for item in items:
            if not isinstance(item, dict):
                continue
            source = item.get("source")
            publisher = source.get("name") if isinstance(source, dict) else None
            article = make_article(
                prefix="newsapi", feed=self.source_name, title=item.get("title"),
                url=item.get("url"), date=item.get("publishedAt"),
                image=item.get("urlToImage"), publisher=publisher,
            )
            if article:
                articles.append(article)
        return articles
