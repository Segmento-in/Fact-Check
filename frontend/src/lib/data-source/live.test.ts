import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { createLiveDataSource, LIVE_REQUEST_TIMEOUT_MS } from './live';

describe('createLiveDataSource', () => {
  const originalFetch = globalThis.fetch;

  beforeEach(() => {
    vi.unstubAllEnvs();
  });

  afterEach(() => {
    globalThis.fetch = originalFetch;
    vi.restoreAllMocks();
  });

  it('listFeedArticles calls fetch at default http://localhost:8000/api/articles?limit=20 and maps articles', async () => {
    const mockFixture = {
      articles: [
        {
          article: {
            id: 'hn_101',
            hn_id: 101,
            title: 'Live News Headline',
            url: 'https://example.org/news/101',
            published_at: '2026-11-20T12:00:00Z',
            hn_score: 95,
            site: 'example.org',
          },
        },
      ],
      total: 1,
    };

    const fetchMock = vi.fn().mockResolvedValue({
      ok: true,
      status: 200,
      statusText: 'OK',
      json: async () => mockFixture,
    });
    globalThis.fetch = fetchMock;

    const ds = createLiveDataSource();
    const articles = await ds.listFeedArticles();

    expect(fetchMock).toHaveBeenCalledTimes(1);
    const calledUrl = fetchMock.mock.calls[0][0];
    expect(calledUrl).toBe('http://localhost:8000/api/articles?limit=20');

    expect(articles).toHaveLength(1);
    expect(articles[0].headline).toBe('Live News Headline');
    expect(articles[0].isSample).toBe(false);
    expect(articles[0].state).toEqual({ kind: 'not_checked_yet' });
  });

  it('uses NEXT_PUBLIC_API_BASE_URL when configured', async () => {
    vi.stubEnv('NEXT_PUBLIC_API_BASE_URL', 'https://api.factchecker.internal/');

    const fetchMock = vi.fn().mockResolvedValue({
      ok: true,
      status: 200,
      json: async () => ({ articles: [] }),
    });
    globalThis.fetch = fetchMock;

    const ds = createLiveDataSource();
    await ds.listFeedArticles();

    expect(fetchMock.mock.calls[0][0]).toBe('https://api.factchecker.internal/api/articles?limit=20');
  });

  it('rejects on HTTP 500 status', async () => {
    const fetchMock = vi.fn().mockResolvedValue({
      ok: false,
      status: 500,
      statusText: 'Internal Server Error',
    });
    globalThis.fetch = fetchMock;

    const ds = createLiveDataSource();
    await expect(ds.listFeedArticles()).rejects.toThrow(/Backend error \(500 Internal Server Error\)/);
  });

  it('rejects on malformed JSON response', async () => {
    const fetchMock = vi.fn().mockResolvedValue({
      ok: true,
      status: 200,
      json: async () => {
        throw new Error('Unexpected token in JSON');
      },
    });
    globalThis.fetch = fetchMock;

    const ds = createLiveDataSource();
    await expect(ds.listFeedArticles()).rejects.toThrow(/Unexpected token in JSON/);
  });

  it('rejects on abort / timeout', async () => {
    const fetchMock = vi.fn().mockRejectedValue(new DOMException('The operation was aborted', 'AbortError'));
    globalThis.fetch = fetchMock;

    const ds = createLiveDataSource();
    await expect(ds.listFeedArticles()).rejects.toThrow(/aborted/);
  });

  it('submitCheck rejects with "Submit is not available in live mode yet."', async () => {
    const ds = createLiveDataSource();
    await expect(ds.submitCheck({ text: 'Some text exceeding twenty characters', iWroteThis: false, contentKind: 'claim_or_text' })).rejects.toThrow(
      /Submit is not available in live mode yet/i
    );
  });

  it('getReport rejects with "Report is not available in live mode yet."', async () => {
    const ds = createLiveDataSource();
    await expect(ds.getReport('any-id')).rejects.toThrow(
      /Report is not available in live mode yet/i
    );
  });

  it('defines timeout constant as 8000 ms', () => {
    expect(LIVE_REQUEST_TIMEOUT_MS).toBe(8000);
  });
});

