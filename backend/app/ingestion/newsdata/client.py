"""Pulse's NewsDataProvider adapted to the current v2 News response contract."""
import httpx

from app.ingestion.remote import HttpIngestionSource, make_article
from app.models import Article

NEWSDATA_URL = "https://newsdata.io/api/2/news"


class NewsDataIngestionSource(HttpIngestionSource):
    source_name = "NewsData.io"
    key_setting = "NEWSDATA_API_KEY"

    async def _fetch(self, client: httpx.AsyncClient, limit: int) -> list[Article]:
        response = await self._get(client, NEWSDATA_URL, params={
            "q": self.settings.NEWS_FEED_QUERY,
            "language": self.settings.NEWS_FEED_LANGUAGE,
            "country": self.settings.NEWSDATA_COUNTRY,
            "size": min(limit, self.settings.NEWSDATA_PAGE_SIZE),
            "apikey": self._api_key(),
        })
        if response is None:
            return []
        data = response.json()
        if not isinstance(data, dict) or data.get("status") != "success":
            return []
        items = data.get("results")
        if not isinstance(items, list):
            return []
        articles = []
        for item in items:
            if not isinstance(item, dict):
                continue
            source, media = item.get("source"), item.get("media")
            article = make_article(
                prefix="newsdata", feed=self.source_name, title=item.get("title"),
                url=item.get("url"), date=item.get("published_at"),
                image=media.get("image_url") if isinstance(media, dict) else None,
                publisher=source.get("name") if isinstance(source, dict) else None,
            )
            if article:
                articles.append(article)
        # One page per request, like Pulse: do not silently spend quota following cursors.
        return articles
