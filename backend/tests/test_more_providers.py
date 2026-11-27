from types import SimpleNamespace

from fastapi.testclient import TestClient
import httpx
import pytest

from app.config import Settings
from app.ingestion.google_news.client import GoogleNewsIngestionSource
from app.ingestion.newsapi.client import NewsAPIIngestionSource
from app.ingestion.newsdata.client import NewsDataIngestionSource
from app.ingestion.service import IngestionService
from app.ingestion import remote
from app.main import app, get_articles_cache, get_ingestion_service


GOOGLE_XML = '''<rss xmlns:media="http://search.yahoo.com/mrss/"><channel><item>
<title><![CDATA[Technology &amp; science]]></title>
<link>https://news.google.com/rss/articles/story-1?oc=5</link>
<source url="https://publisher.example">Publisher &amp; Co</source>
<pubDate>Fri, 27 Nov 2026 10:00:00 GMT</pubDate>
<description><![CDATA[<a href="https://news.google.com/rss/articles/story-1">Article title</a>]]></description>
<media:thumbnail url="https://images.example/cover.jpg"/>
</item><item><title>Missing URL</title></item></channel></rss>'''

NEWSAPI_ARTICLE = {
    'title': 'API headline', 'url': 'https://publisher.example/api?utm_source=feed',
    'urlToImage': 'https://images.example/api.jpg',
    'publishedAt': '2026-11-27T12:00:00+02:00', 'source': {'name': 'API Publisher'},
}
NEWSDATA_ARTICLE = {
    'id': 'provider-id', 'title': 'Data headline', 'url': 'https://publisher.example/data',
    'published_at': '2026-11-27T10:00:00Z', 'media': {'image_url': 'https://images.example/data.jpg'},
    'source': {'name': 'Data Publisher', 'priority': 4},
    'ai': {'sentiment': {'label': 'positive', 'score': 95}},
}


def settings(**kwargs):
    return Settings(_env_file=None, NEWSAPI_API_KEY=kwargs.pop('NEWSAPI_API_KEY', ''),
                    NEWSDATA_API_KEY=kwargs.pop('NEWSDATA_API_KEY', ''), **kwargs)


@pytest.mark.asyncio
async def test_google_rss_preserves_feed_publisher_story_link_and_cover():
    requests = []

    def handler(request):
        requests.append(request)
        return httpx.Response(200, text=GOOGLE_XML)

    async with httpx.AsyncClient(transport=httpx.MockTransport(handler)) as client:
        source = GoogleNewsIngestionSource(client=client, settings=settings())
        articles = await source.fetch_articles(limit=5)
        again = await source.fetch_articles(limit=5)
    assert len(articles) == 1
    article = articles[0]
    assert article.id == again[0].id
    assert article.source == 'Google News'
    assert article.publisher == 'Publisher & Co'
    assert article.title == 'Technology & science'
    assert article.url == 'https://news.google.com/rss/articles/story-1?oc=5'
    assert article.image_url == 'https://images.example/cover.jpg'
    assert article.published_at.isoformat() == '2026-11-27T10:00:00+00:00'
    assert requests[0].url.params['q'] == 'technology'
    assert requests[0].url.params['ceid'] == 'US:en'
    assert 'apikey' not in requests[0].url.params


@pytest.mark.asyncio
async def test_newsapi_maps_pulse_fields_but_keeps_feed_separate_from_publisher():
    requests = []

    def handler(request):
        requests.append(request)
        return httpx.Response(200, json={'status': 'ok', 'articles': [
            NEWSAPI_ARTICLE, None, {'title': '[Removed]', 'url': 'https://example.com/removed'},
            {'title': 'Bad scheme', 'url': 'javascript:alert(1)'},
            {**NEWSAPI_ARTICLE, 'url': 'https://publisher.example/api?utm_source=other'},
        ]})

    async with httpx.AsyncClient(transport=httpx.MockTransport(handler)) as client:
        source = NewsAPIIngestionSource(client=client, settings=settings(NEWSAPI_API_KEY='dummy-newsapi'))
        articles = await source.fetch_articles(limit=50)
    assert len(articles) == 1
    article = articles[0]
    assert article.source == 'NewsAPI'
    assert article.publisher == 'API Publisher'
    assert article.url == 'https://publisher.example/api'
    assert article.image_url == NEWSAPI_ARTICLE['urlToImage']
    assert article.published_at.isoformat() == '2026-11-27T10:00:00+00:00'
    assert requests[0].headers['X-Api-Key'] == 'dummy-newsapi'
    assert 'apiKey' not in requests[0].url.params
    assert requests[0].url.params['pageSize'] == '20'
    assert 'from' not in requests[0].url.params
    assert article.hn_score == 0


@pytest.mark.asyncio
async def test_newsdata_uses_current_v2_shape_and_one_page_with_no_truth_metrics():
    requests = []

    def handler(request):
        requests.append(request)
        return httpx.Response(200, json={'status': 'success', 'results': [
            NEWSDATA_ARTICLE, 'bad record', {'title': 'Missing URL'},
        ], 'next_page': 'another-page'})

    async with httpx.AsyncClient(transport=httpx.MockTransport(handler)) as client:
        source = NewsDataIngestionSource(client=client, settings=settings(NEWSDATA_API_KEY='dummy-newsdata'))
        articles = await source.fetch_articles(limit=60)
    assert len(requests) == 1
    assert requests[0].url.path == '/api/2/news'
    assert requests[0].url.params['apikey'] == 'dummy-newsdata'
    assert requests[0].url.params['size'] == '10'
    assert 'timeframe' not in requests[0].url.params
    assert len(articles) == 1
    article = articles[0]
    assert article.source == 'NewsData.io'
    assert article.publisher == 'Data Publisher'
    assert article.image_url == NEWSDATA_ARTICLE['media']['image_url']
    assert article.hn_score == 0
    assert 'confidence' not in article.model_dump()
    assert 'sentiment' not in article.model_dump()


@pytest.mark.asyncio
@pytest.mark.parametrize('provider', [NewsAPIIngestionSource, NewsDataIngestionSource])
@pytest.mark.parametrize('key', ['', '   ', None])
async def test_missing_keys_make_no_http_request(provider, key):
    def handler(request):
        pytest.fail('A provider without a key must not make an HTTP request')

    name = provider.key_setting
    async with httpx.AsyncClient(transport=httpx.MockTransport(handler)) as client:
        source = provider(client=client, settings=settings(**{name: key}))
        assert await source.fetch_articles() == []


@pytest.mark.asyncio
@pytest.mark.parametrize('provider', [GoogleNewsIngestionSource, NewsAPIIngestionSource, NewsDataIngestionSource])
@pytest.mark.parametrize('status', [401, 403, 426, 429, 500])
async def test_provider_errors_are_isolated_and_credentials_are_not_logged(provider, status, caplog):
    sentinel = 'dummy-key-not-for-logs'
    def handler(request):
        return httpx.Response(status, text='API key: ' + sentinel)

    config = settings(NEWSAPI_API_KEY=sentinel, NEWSDATA_API_KEY=sentinel)
    async with httpx.AsyncClient(transport=httpx.MockTransport(handler)) as client:
        assert await provider(client=client, settings=config).fetch_articles() == []
    assert sentinel not in caplog.text
    assert sentinel not in repr(config)


@pytest.mark.asyncio
@pytest.mark.parametrize('provider', [NewsAPIIngestionSource, NewsDataIngestionSource])
@pytest.mark.parametrize('payload', [None, [], {'status': 'error', 'message': 'dummy-credential'},
                                    {'status': 'ok', 'articles': None}, {'status': 'success', 'results': None}])
async def test_malformed_and_api_error_payloads_do_not_break_feed(provider, payload, caplog):
    async with httpx.AsyncClient(transport=httpx.MockTransport(lambda _: httpx.Response(200, json=payload))) as client:
        source = provider(client=client, settings=settings(NEWSAPI_API_KEY='dummy', NEWSDATA_API_KEY='dummy'))
        assert await source.fetch_articles() == []
    assert 'dummy-credential' not in caplog.text


@pytest.mark.asyncio
@pytest.mark.parametrize('provider', [GoogleNewsIngestionSource, NewsAPIIngestionSource, NewsDataIngestionSource])
async def test_timeout_and_invalid_payloads_return_empty_without_logging_key(provider, caplog):
    def handler(request):
        raise httpx.ReadTimeout('request contains dummy-sensitive-key')

    config = settings(NEWSAPI_API_KEY='dummy-sensitive-key', NEWSDATA_API_KEY='dummy-sensitive-key')
    async with httpx.AsyncClient(transport=httpx.MockTransport(handler)) as client:
        assert await provider(client=client, settings=config).fetch_articles() == []
    assert 'dummy-sensitive-key' not in caplog.text


@pytest.mark.asyncio
async def test_rate_limit_cooldown_survives_refresh_and_expires(monkeypatch):
    now = [1000.0]
    monkeypatch.setattr(remote, 'time', SimpleNamespace(monotonic=lambda: now[0]))
    calls = []

    def handler(request):
        calls.append(request)
        return httpx.Response(429, headers={'Retry-After': '90'})

    async with httpx.AsyncClient(transport=httpx.MockTransport(handler)) as client:
        source = NewsAPIIngestionSource(client=client, settings=settings(NEWSAPI_API_KEY='dummy'))
        assert await source.fetch_articles() == []
        assert await source.fetch_articles() == []
        assert len(calls) == 1
        now[0] += 91
        assert await source.fetch_articles() == []
        assert len(calls) == 2


def test_ingestion_dependency_keeps_one_service_for_provider_cooldowns():
    get_ingestion_service.cache_clear()
    assert get_ingestion_service() is get_ingestion_service()
    get_ingestion_service.cache_clear()


@pytest.mark.asyncio
async def test_disabled_provider_is_not_called_even_with_key():
    async with httpx.AsyncClient(transport=httpx.MockTransport(lambda _: pytest.fail('Disabled Feed called'))) as client:
        service = IngestionService(client=client, settings=settings(
            ENABLED_FEEDS=[], NEWSAPI_API_KEY='dummy', NEWSDATA_API_KEY='dummy'))
        assert await service.fetch_articles(source='all') == []
        assert await service.fetch_articles(source='newsapi') == []


def provider_handler(request):
    if request.url.host == 'news.google.com':
        return httpx.Response(200, text=GOOGLE_XML)
    if request.url.host == 'newsapi.org':
        return httpx.Response(200, json={'status': 'ok', 'articles': [NEWSAPI_ARTICLE]})
    if request.url.host == 'newsdata.io':
        return httpx.Response(200, json={'status': 'success', 'results': [NEWSDATA_ARTICLE]})
    if request.url.path.endswith('topstories.json'):
        return httpx.Response(200, json=[100])
    if '/item/' in request.url.path:
        return httpx.Response(200, json={'id': 100, 'type': 'story', 'title': 'HN headline',
                                       'url': 'https://publisher.example/hn'})
    if request.url.host == 'medium.com':
        return httpx.Response(200, text='<rss><channel><item><title>Medium headline</title>'
                              '<link>https://medium.com/@writer/story</link></item></channel></rss>')
    return httpx.Response(404)


@pytest.mark.asyncio
async def test_all_five_providers_share_the_existing_round_robin_contract():
    async with httpx.AsyncClient(transport=httpx.MockTransport(provider_handler)) as client:
        service = IngestionService(client=client, settings=settings(
            NEWSAPI_API_KEY='dummy-api', NEWSDATA_API_KEY='dummy-data'))
        articles = await service.fetch_articles(limit=5)
    assert [article.source for article in articles] == ['Hacker News', 'Medium', 'Google News', 'NewsData.io', 'NewsAPI']
    assert len({article.url for article in articles}) == 5


@pytest.mark.parametrize('feed,expected', [('google_news', 'Google News'), ('newsdata', 'NewsData.io'), ('newsapi', 'NewsAPI'), ('all', None)])
def test_api_accepts_new_feed_filters_and_returns_unchecked_article_reports(feed, expected):
    class Ingestion:
        async def fetch_articles(self, limit, source):
            async with httpx.AsyncClient(transport=httpx.MockTransport(provider_handler)) as client:
                return await IngestionService(client=client, settings=settings(
                    NEWSAPI_API_KEY='dummy-api', NEWSDATA_API_KEY='dummy-data')).fetch_articles(limit, source)

    app.dependency_overrides[get_ingestion_service] = lambda: Ingestion()
    app.dependency_overrides[get_articles_cache] = lambda: {}
    try:
        with TestClient(app) as client:
            response = client.get('/api/articles', params={'source': feed, 'limit': 5, 'extract_text': 'false'})
        assert response.status_code == 200
        rows = response.json()['articles']
        assert len(rows) == (5 if feed == 'all' else 1)
        for row in rows:
            assert row['checked'] is False
            assert row['claims'] == []
            assert row['overall_verdict_key'] is None
            assert row['extraction']['status'] == 'not_requested'
            if expected:
                assert row['article']['source'] == expected
                assert row['article']['publisher']
    finally:
        app.dependency_overrides.clear()


def test_mapping_missing_dates_and_images_keeps_honest_empty_values():
    article = remote.make_article(prefix='sample', feed='NewsAPI', title='A title',
                                  url='https://publisher.example/story', date='bad-date',
                                  image='http://images.example/insecure.jpg')
    assert article.published_at is None
    assert article.image_url is None
    assert article.publisher is None
