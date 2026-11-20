import { describe, it, expect } from "vitest";
import { parseArticlesResponse } from "./contract";

describe("API Contract Parser", () => {
  // Test 1: Parses real models.py shape
  it("parses a fixture shaped from the real models.py to typed object", () => {
    // Bug caught: a backend field rename silently breaks the UI
    const rawFixture = {
      articles: [
        {
          article: {
            id: "hn_12345",
            hn_id: 12345,
            title: "Breakthrough in Distributed Systems",
            url: "https://example.com/breakthrough",
            published_at: "2026-11-09T10:00:00Z",
            hn_score: 182,
            source: "Hacker News",
            image_url: null,
            category: "technology",
          },
          extraction: {
            status: "ok",
            word_count: 520,
            text_preview: "Researchers have announced a novel consensus model...",
            final_url: "https://example.com/breakthrough",
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

    const parsed = parseArticlesResponse(rawFixture);
    expect(parsed.total).toBe(1);
    expect(parsed.cached).toBe(false);
    expect(parsed.articles).toHaveLength(1);

    const report = parsed.articles[0];
    expect(report.article.hnId).toBe(12345);
    expect(report.article.title).toBe("Breakthrough in Distributed Systems");
    expect(report.article.url).toBe("https://example.com/breakthrough");
    expect(report.article.hnScore).toBe(182);
    expect(report.article.source).toBe("Hacker News");
    expect(report.extraction.status).toBe("ok");
    expect(report.extraction.wordCount).toBe(520);
    expect(report.extraction.textPreview).toBe(
      "Researchers have announced a novel consensus model..."
    );
    expect(report.checked).toBe(false);
    expect(report.overallVerdictKey).toBeNull();
  });

  // Test 2: Throws on missing articles, missing title, or missing url
  it("throws clear error when response is missing articles array", () => {
    // Bug caught: UI renders garbage on a wrong server answer
    expect(() => parseArticlesResponse({})).toThrow("missing 'articles' array");
    expect(() => parseArticlesResponse(null)).toThrow("expected JSON object");
    expect(() => parseArticlesResponse("not json")).toThrow("expected JSON object");
  });

  it("throws clear error when an article is lacking title or url", () => {
    // Bug caught: UI renders garbage on a wrong server answer
    const missingTitle = {
      articles: [
        {
          article: {
            url: "https://example.com/page",
          },
        },
      ],
    };
    expect(() => parseArticlesResponse(missingTitle)).toThrow(
      "missing or empty 'title'"
    );

    const missingUrl = {
      articles: [
        {
          article: {
            title: "Valid Title",
          },
        },
      ],
    };
    expect(() => parseArticlesResponse(missingUrl)).toThrow(
      "missing or empty 'url'"
    );
  });
});

