"""Adapted from Pulse's GoogleNewsRSSProvider and RSSParser image fallback order."""
import xml.etree.ElementTree as ET

import httpx

from app.ingestion.remote import HttpIngestionSource, make_article
from app.models import Article

GOOGLE_NEWS_RSS_URL = "https://news.google.com/rss/search"
MEDIA = "{http://search.yahoo.com/mrss/}"
CONTENT = "{http://purl.org/rss/1.0/modules/content/}"


class GoogleNewsIngestionSource(HttpIngestionSource):
    source_name = "Google News"

    async def _fetch(self, client: httpx.AsyncClient, limit: int) -> list[Article]:
        response = await self._get(client, GOOGLE_NEWS_RSS_URL, params={
            "q": self.settings.NEWS_FEED_QUERY,
            "hl": self.settings.GOOGLE_NEWS_LANGUAGE,
            "gl": self.settings.GOOGLE_NEWS_COUNTRY,
            "ceid": self.settings.GOOGLE_NEWS_EDITION,
        })
        if response is None:
            return []
        root = ET.fromstring(response.content)
        articles = []
        for item in root.findall(".//item"):
            source = item.find("source")
            # The RSS <source> is the Publisher; the Feed remains Google News.
            publisher = source.text if source is not None else None
            description = item.findtext("description") or item.findtext(CONTENT + "encoded") or ""
            image = None
            for tag in [MEDIA + "content", MEDIA + "thumbnail", "enclosure"]:
                element = item.find(tag)
                if element is not None:
                    if tag == "enclosure" and not element.get("type", "").startswith("image/"):
                        continue
                    image = element.get("url")
                    if image:
                        break
            image = image or self.extract_image_url(description)
            article = make_article(
                prefix="google", feed=self.source_name, title=item.findtext("title"),
                # Keep Google's actual story URL; never substitute the Publisher homepage.
                url=item.findtext("link"), date=item.findtext("pubDate"),
                image=image, publisher=publisher,
            )
            if article:
                articles.append(article)
        return articles
