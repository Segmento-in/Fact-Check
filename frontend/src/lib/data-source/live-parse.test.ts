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
            source: 'Hacker News',
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
            source: 'Hacker News',
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



describe('Ticket 6: Feed Card article fields', () => {
  const fixture = {
    id: 'ticket-6-article',
    title: 'Feed Card parser fixture',
    url: 'https://publisher.example/story',
    source: 'Hacker News',
    hn_score: 478,
    published_at: '2026-11-20T10:00:00Z',
    image_url: null,
  };

  function parseOne(overrides: Record<string, unknown>) {
    const articles = parseArticlesResponse({
      articles: [{ article: { ...fixture, ...overrides } }],
    });
    expect(articles).toHaveLength(1);
    expect(articles[0].headline).toBe('Feed Card parser fixture');
    return articles[0];
  }

  it.each([
    ['Hacker News', 'Hacker News'],
    ['Medium', 'Medium'],
    ['  Medium  ', 'Medium'],
  ])('takes Feed name from source case', (source, expected) => {
    expect(parseOne({ source }).feed).toBe(expected);
  });

  it.each([undefined, '', '   ', null, 42])(
    'rejects missing, blank or non-string source: case',
    (source) => {
      const article: Record<string, unknown> = { ...fixture, source };
      if (source === undefined) delete article.source;

      expect(() =>
        parseArticlesResponse({ articles: [{ article }] })
      ).toThrow("Invalid article at index 0: missing or empty 'source'");
    }
  );

  it('reports the index of the article with missing source', () => {
    const invalidArticle: Record<string, unknown> = { ...fixture };
    delete invalidArticle.source;

    expect(() =>
      parseArticlesResponse({
        articles: [
          { article: fixture },
          { article: invalidArticle },
        ],
      })
    ).toThrow("Invalid article at index 1: missing or empty 'source'");
  });

  it('keeps an https Cover Image URL', () => {
    const imageUrl = 'https://cdn.example/cover.png';
    expect(parseOne({ image_url: imageUrl }).imageUrl).toBe(imageUrl);
  });

  it.each([
    'http://cdn.example/cover.png',
    'javascript:alert(1)',
    'data:image/png;base64,AAAA',
    '//cdn.example/cover.png',
    '/cover.png',
    '',
    null,
    42,
    undefined,
  ])('uses no Cover Image for invalid image_url: case', (imageUrl) => {
    expect(parseOne({ image_url: imageUrl }).imageUrl).toBeNull();
  });

  it.each([
    { feed: 'Hacker News', score: 0, expected: 0 },
    { feed: 'Hacker News', score: 478, expected: 478 },
    { feed: 'Hacker News', score: undefined, expected: null },
    { feed: 'Hacker News', score: null, expected: null },
    { feed: 'Hacker News', score: '478', expected: null },
    { feed: 'Medium', score: 0, expected: null },
    { feed: 'Medium', score: 478, expected: null },
    { feed: 'Google News', score: 478, expected: null },
  ])(
    'maps Feed Score for $feed with hn_score $score to $expected',
    ({ feed, score, expected }) => {
      const article = parseOne({ source: feed, hn_score: score });
      expect(article.feed).toBe(feed);
      expect(article.feedScore).toBe(expected);
    }
  );

  it('keeps a Medium Article id when hn_id is zero', () => {
    const article = parseOne({
      source: 'Medium',
      id: 'medium-article-7',
      hn_id: 0,
      hn_score: 0,
    });
    expect(article.id).toBe('medium-article-7');
    expect(article.feed).toBe('Medium');
    expect(article.feedScore).toBeNull();
    expect(article.state).toEqual({ kind: 'not_checked_yet' });
    expect(article.isSample).toBe(false);
  });
});
