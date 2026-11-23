import asyncio
from collections import Counter

import httpx
import pytest
from fastapi.testclient import TestClient

from app.config import Settings
from app.ingestion.hackernews.client import HackerNewsIngestionSource
from app.ingestion.medium.client import MediumIngestionSource
from app.ingestion.service import IngestionService
from app.main import app, get_article_extractor, get_articles_cache, get_ingestion_service
from app.models import ExtractionResult


def medium_xml(tag, count=10):
    items = "".join(
        f'<item><title>{tag} {i}</title>'
        f'<link>https://medium.com/@writer/{tag}-{i}</link>'
        '<pubDate>Mon, 23 Nov 2026 10:00:00 GMT</pubDate>'
        '<description><![CDATA[<img src="https://miro.medium.com/cover.jpg"/>]]></description>'
        '</item>'
        for i in range(count)
    )
    return f'<rss><channel>{items}</channel></rss>'


def feed_handler(request):
    if request.url.path.endswith('topstories.json'):
        return httpx.Response(200, json=list(range(1, 101)))
    if '/v0/item/' in request.url.path:
        story_id = int(request.url.path.rsplit('/', 1)[1].split('.')[0])
        return httpx.Response(200, json={
            'id': story_id, 'type': 'story', 'title': f'HN {story_id}',
            'url': f'https://publisher.example/{story_id}', 'score': story_id,
        })
    if '/feed/tag/' in request.url.path:
        return httpx.Response(200, text=medium_xml(request.url.path.rsplit('/', 1)[1]))
    return httpx.Response(404)


@pytest.mark.asyncio
async def test_mixed_feed_returns_sixty_unique_articles_with_both_providers():
    async with httpx.AsyncClient(transport=httpx.MockTransport(feed_handler)) as client:
        service = IngestionService(client=client, settings=Settings(_env_file=None))
        articles = await service.fetch_articles()

    assert len(articles) == len({article.url for article in articles}) == 60
    assert Counter(article.source for article in articles) == {'Hacker News': 30, 'Medium': 30}
    assert len({article.category for article in articles if article.source == 'Medium'}) == 7


@pytest.mark.asyncio
async def test_hackernews_backfills_deleted_self_posts_and_duplicate_urls_in_rank_order():
    def handler(request):
        if request.url.path.endswith('topstories.json'):
            return httpx.Response(200, json=[1, 2, 3, 4, 5, 6])
        story_id = int(request.url.path.rsplit('/', 1)[1].split('.')[0])
        item = {'id': story_id, 'type': 'story', 'title': str(story_id),
                'url': f'https://publisher.example/{story_id}'}
        if story_id == 1:
            item['deleted'] = True
        if story_id == 2:
            item.pop('url')
        if story_id == 4:
            item['url'] = 'https://publisher.example/3'
        return httpx.Response(200, json=item)

    async with httpx.AsyncClient(transport=httpx.MockTransport(handler)) as client:
        source = HackerNewsIngestionSource(client=client, settings=Settings(_env_file=None))
        articles = await source.fetch_articles(limit=3)
    assert [article.hn_id for article in articles] == [3, 5, 6]


@pytest.mark.asyncio
async def test_medium_topics_interleave_and_deduplicate_tracking_urls():
    def handler(request):
        tag = request.url.path.rsplit('/', 1)[1]
        xml = medium_xml(tag, 3)
        # One Article appears under two tags with different RSS tracking values.
        xml = xml.replace(f'{tag}-0', 'shared?source=' + tag)
        return httpx.Response(200, text=xml)

    async with httpx.AsyncClient(transport=httpx.MockTransport(handler)) as client:
        source = MediumIngestionSource(client=client, tags=['technology', 'programming'])
        articles = await source.fetch_articles(limit=4)
    assert len({article.url for article in articles}) == 4
    assert [article.title for article in articles] == [
        'technology 0', 'technology 1', 'programming 1', 'technology 2',
    ]


@pytest.mark.asyncio
async def test_medium_concurrency_is_bounded_and_one_failed_tag_keeps_other_topics():
    active = peak = 0

    async def handler(request):
        nonlocal active, peak
        active += 1
        peak = max(peak, active)
        await asyncio.sleep(0.001)
        active -= 1
        tag = request.url.path.rsplit('/', 1)[1]
        if tag == 'technology':
            return httpx.Response(429)
        return httpx.Response(200, text=medium_xml(tag))

    async with httpx.AsyncClient(transport=httpx.MockTransport(handler)) as client:
        source = MediumIngestionSource(
            client=client, settings=Settings(_env_file=None, MAX_CONCURRENT_REQUESTS=2),
        )
        articles = await source.fetch_articles(limit=60)
    assert len(articles) == 60
    assert 1 < peak <= 2


@pytest.mark.asyncio
@pytest.mark.parametrize('failed_provider', ['medium', 'hackernews'])
async def test_healthy_provider_fills_mixed_feed_when_other_provider_fails(failed_provider):
    def handler(request):
        is_medium = request.url.host == 'medium.com'
        if is_medium == (failed_provider == 'medium'):
            raise httpx.ConnectError('Provider unavailable')
        return feed_handler(request)

    async with httpx.AsyncClient(transport=httpx.MockTransport(handler)) as client:
        service = IngestionService(client=client, settings=Settings(_env_file=None))
        articles = await service.fetch_articles(limit=60)
    assert len(articles) == 60
    assert len({article.source for article in articles}) == 1


@pytest.mark.asyncio
async def test_nonpositive_limit_does_not_fetch_and_all_overrides_single_feed_default():
    async with httpx.AsyncClient(transport=httpx.MockTransport(feed_handler)) as client:
        service = IngestionService(client=client, settings=Settings(_env_file=None, DEFAULT_FEED='hackernews'))
        assert await service.fetch_articles(limit=0) == []
        assert await service.fetch_articles(limit=-1) == []
        articles = await service.fetch_articles(limit=60, source='all')
        assert {article.source for article in articles} == {'Hacker News', 'Medium'}
        with pytest.raises(ValueError, match='Unknown Feed'):
            await service.fetch_articles(source='bogus')


def test_feed_card_request_returns_sixty_reports_without_article_page_downloads():
    # Exercise the actual orchestrator and both parsers through the HTTP endpoint.
    transport = httpx.MockTransport(feed_handler)

    class Ingestion:
        async def fetch_articles(self, limit, source):
            async with httpx.AsyncClient(transport=transport) as client:
                return await IngestionService(client=client).fetch_articles(limit, source)

    class Extractor:
        calls = 0

        async def extract(self, url):
            self.calls += 1
            return ExtractionResult(status='ok', text='Article text', word_count=2)

    extractor = Extractor()
    cache = {}
    app.dependency_overrides[get_ingestion_service] = lambda: Ingestion()
    app.dependency_overrides[get_article_extractor] = lambda: extractor
    app.dependency_overrides[get_articles_cache] = lambda: cache
    try:
        with TestClient(app) as client:
            url = '/api/articles?limit=60&source=all&extract_text=false'
            response = client.get(url)
            assert response.status_code == 200
            data = response.json()
            assert data['total'] == 60
            assert Counter(row['article']['source'] for row in data['articles']) == {
                'Hacker News': 30, 'Medium': 30,
            }
            assert extractor.calls == 0
            for row in data['articles']:
                assert row['checked'] is False
                assert row['overall_verdict_key'] is None
                assert row['claims'] == []
                assert row['extraction']['status'] == 'not_requested'
            assert client.get(url).json()['cached'] is True
            # Text requests must not reuse metadata-only cached reports.
            text_data = client.get('/api/articles?limit=60&source=all').json()
            assert text_data['cached'] is False
            assert extractor.calls == 60
            assert text_data['articles'][0]['extraction']['status'] == 'ok'
    finally:
        app.dependency_overrides.clear()
