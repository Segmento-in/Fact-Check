import type { Article } from '../contract';

/**
 * Pure parser for the backend GET /api/articles response.
 * Validates the response shape strictly and transforms backend models into frontend Article records.
 * Never invents claims, tallies, or reports.
 */
export function parseArticlesResponse(raw: unknown): Article[] {
  if (!raw || typeof raw !== 'object') {
    throw new Error('Invalid API response: expected JSON object');
  }

  const obj = raw as Record<string, unknown>;

  if (!Array.isArray(obj.articles)) {
    throw new Error("Invalid API response: missing 'articles' array");
  }

  return obj.articles.map((item, index) => {
    if (!item || typeof item !== 'object') {
      throw new Error(`Invalid article report at index ${index}: expected object`);
    }

    const repObj = item as Record<string, unknown>;
    const artRaw = repObj.article as Record<string, unknown> | undefined;

    if (!artRaw || typeof artRaw !== 'object') {
      throw new Error(`Invalid article report at index ${index}: missing 'article' object`);
    }

    if (typeof artRaw.title !== 'string' || !artRaw.title.trim()) {
      throw new Error(`Invalid article at index ${index}: missing or empty 'title'`);
    }

    if (typeof artRaw.url !== 'string' || !artRaw.url.trim()) {
      throw new Error(`Invalid article at index ${index}: missing or empty 'url'`);
    }

    const url = artRaw.url.trim();

    let publisher = '';
    if (typeof artRaw.site === 'string' && artRaw.site.trim()) {
      publisher = artRaw.site.trim();
    } else if (typeof artRaw.domain === 'string' && artRaw.domain.trim()) {
      publisher = artRaw.domain.trim();
    } else {
      try {
        publisher = new URL(url).hostname.replace(/^www\./, '');
      } catch {
        publisher = typeof artRaw.source === 'string' && artRaw.source.trim()
          ? artRaw.source.trim()
          : 'Hacker News';
      }
    }

    const id =
      typeof artRaw.id === 'string' && artRaw.id.trim()
        ? artRaw.id.trim()
        : typeof artRaw.hn_id === 'number'
          ? `hn_${artRaw.hn_id}`
          : `art_${index}`;

    const feedScore = typeof artRaw.hn_score === 'number' ? artRaw.hn_score : 0;
    const publishedAt = typeof artRaw.published_at === 'string' ? artRaw.published_at : '';

    return {
      id,
      isSample: false,
      headline: artRaw.title.trim(),
      publisher,
      feedScore,
      publishedAt,
      url,
      state: { kind: 'not_checked_yet' },
    };
  });
}

