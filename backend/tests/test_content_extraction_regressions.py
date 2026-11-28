"""Regression checks for log privacy and cancellation-safe worker capacity."""
import asyncio
import logging
import threading

import httpx
import pytest

from test_content_extraction import HTML, fetcher, post_link, settings
from app.content_extraction import ContentExtractionService


@pytest.mark.asyncio
async def test_article_query_values_are_absent_from_logs(caplog):
    caplog.set_level(logging.INFO)
    def handler(request):
        return httpx.Response(200, headers={"content-type": "text/html"}, content=HTML)

    config = settings(ARTICLE_MIN_WORDS=10000)
    service = ContentExtractionService(config, fetcher(handler, config))
    response = await post_link(service, {"url": "https://example.com/a?access_token=review-demo-secret"})
    assert response.status_code == 422
    assert "review-demo-secret" not in caplog.text


@pytest.mark.asyncio
async def test_timed_out_dns_work_still_counts_toward_worker_limit():
    finish = threading.Event()
    started = threading.Event()

    def blocking_dns():
        started.set()
        finish.wait(timeout=2)
        return ["93.184.216.34"]

    async def resolver(host, port):
        return await asyncio.to_thread(blocking_dns)

    requests = []
    def handler(request):
        requests.append(request.url.path)
        return httpx.Response(200, headers={"content-type": "text/html"}, content=HTML)

    config = settings(ARTICLE_FETCH_TIMEOUT_SECONDS=0.15, ARTICLES_MAX_CONCURRENT_EXTRACTIONS=1)
    service = ContentExtractionService(config, fetcher(handler, config, resolver))
    try:
        response = await post_link(service, {"url": "https://example.com/first"})
        assert started.is_set()
        assert response.status_code == 504
        # The first DNS thread is still running. A one-worker service should be busy.
        response = await post_link(service, {"url": "https://example.com/second"})
        assert response.status_code == 503
    finally:
        finish.set()

    for _ in range(50):
        recovered = await post_link(service, {"url": "https://example.com/recovered"})
        if recovered.status_code != 503:
            break
        await asyncio.sleep(0.01)
    assert recovered.status_code == 200
    assert requests == ["/recovered"]

