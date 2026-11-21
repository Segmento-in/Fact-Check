import { describe, it, expect } from 'vitest';
import { parseArticlesResponse } from './live-parse';

describe('live-parse: parseArticlesResponse', () => {
  it('parses a valid backend ArticlesResponse fixture into Article records', () => {
    const rawFixture = {
      articles: [
        {
          article: {
            id: 'hn_12345',
            hn_id: 12345,
            title: 'Breakthrough in Distributed Systems',
            url: 'https://news.example.com/item/12345',
            published_at: '2026-11-09T10:00:00Z',
            hn_score: 182,
            source: 'Hacker News',
            site: 'example.com',
            image_url: null,
            category: 'tech',
          },
          extraction: {
            status: 'ok',
            word_count: 520,
            text_preview: 'Researchers have announced...',
            final_url: 'https://news.example.com/item/12345',
          },
          checked: false,
          overall_verdict_key: null,
          overall_confidence: null,
          claims: [],
          skipped_statements: [],
        },
      ],
      total: 1,
      cached: false,
    };

    const articles = parseArticlesResponse(rawFixture);
    expect(articles).toHaveLength(1);

    const art = articles[0];
    expect(art.id).toBe('hn_12345');
    expect(art.isSample).toBe(false);
    expect(art.headline).toBe('Breakthrough in Distributed Systems');
    expect(art.publisher).toBe('example.com');
    expect(art.feedScore).toBe(182);
    expect(art.publishedAt).toBe('2026-11-09T10:00:00Z');
    expect(art.url).toBe('https://news.example.com/item/12345');
    expect(art.state).toEqual({ kind: 'not_checked_yet' });
  });

  it('falls back to URL hostname when site and domain are missing', () => {
    const fixture = {
      articles: [
        {
          article: {
            id: 'hn_999',
            title: 'Kernel release notes',
            url: 'https://www.kernel.org/pub/linux',
            hn_score: 55,
          },
        },
      ],
    };

    const articles = parseArticlesResponse(fixture);
    expect(articles[0].publisher).toBe('kernel.org');
  });

  it('returns empty array when articles array is empty', () => {
    const articles = parseArticlesResponse({ articles: [], total: 0 });
    expect(articles).toEqual([]);
  });

  it('throws clear error when response is not an object or missing articles', () => {
    expect(() => parseArticlesResponse(null)).toThrow(/expected JSON object/i);
    expect(() => parseArticlesResponse('hello')).toThrow(/expected JSON object/i);
    expect(() => parseArticlesResponse({})).toThrow(/missing 'articles' array/i);
  });

  it('throws clear error when an article item is not an object or missing article', () => {
    expect(() => parseArticlesResponse({ articles: [null] })).toThrow(/expected object/i);
    expect(() => parseArticlesResponse({ articles: [{}] })).toThrow(/missing 'article' object/i);
  });

  it('throws clear error when title is missing or empty', () => {
    expect(() =>
      parseArticlesResponse({
        articles: [{ article: { url: 'https://example.com' } }],
      })
    ).toThrow(/missing or empty 'title'/i);

    expect(() =>
      parseArticlesResponse({
        articles: [{ article: { title: '   ', url: 'https://example.com' } }],
      })
    ).toThrow(/missing or empty 'title'/i);
  });

  it('throws clear error when url is missing or empty', () => {
    expect(() =>
      parseArticlesResponse({
        articles: [{ article: { title: 'Valid Headline' } }],
      })
    ).toThrow(/missing or empty 'url'/i);

    expect(() =>
      parseArticlesResponse({
        articles: [{ article: { title: 'Valid Headline', url: '   ' } }],
      })
    ).toThrow(/missing or empty 'url'/i);
  });

  it('ignores extra unknown fields safely without error', () => {
    const fixture = {
      articles: [
        {
          article: {
            title: 'Future Tech',
            url: 'https://future.test/tech',
            extra_nested: { foo: 123 },
            unrecognized_flag: true,
          },
          extra_outer: 'ignored',
        },
      ],
      extra_root: 'ignored',
    };

    const articles = parseArticlesResponse(fixture);
    expect(articles).toHaveLength(1);
    expect(articles[0].headline).toBe('Future Tech');
  });
});

