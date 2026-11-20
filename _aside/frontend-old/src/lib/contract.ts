/**
 * Typed API contract and client for the Fact Checker backend.
 * Single source of truth for the API response shape and data parsing.
 */

export type ExtractionStatus =
  | "ok"
  | "too_short"
  | "no_text"
  | "not_html"
  | "fetch_failed";

export type VerdictKey =
  | "supported"
  | "refuted"
  | "mixed"
  | "not_enough_evidence";

export type ConfidenceLevel = "Low" | "Medium" | "High";

export interface Article {
  id: string | null;
  hnId: number;
  title: string;
  url: string;
  publishedAt: string | null;
  hnScore: number;
  source: string;
  imageUrl: string | null;
  category: string | null;
}

export interface ExtractionSummary {
  status: ExtractionStatus | string;
  wordCount: number;
  textPreview: string;
  finalUrl: string | null;
}

export interface ArticleReport {
  article: Article;
  extraction: ExtractionSummary;
  checked: boolean;
  overallVerdictKey: VerdictKey | null;
  overallConfidence: ConfidenceLevel | null;
  claims: unknown[];
  skippedStatements: string[];
}

export interface ArticlesResponse {
  articles: ArticleReport[];
  total: number;
  cached: boolean;
}

export const CLIENT_REQUEST_TIMEOUT_MS = 30000;

export const API_BASE_URL =
  process.env.NEXT_PUBLIC_API_BASE_URL || "http://127.0.0.1:8000";

/**
 * Validates and normalizes raw JSON returned by GET /api/articles into typed ArticlesResponse.
 * Throws a clear Error if required structures or fields are missing.
 */
export function parseArticlesResponse(raw: unknown): ArticlesResponse {
  if (!raw || typeof raw !== "object") {
    throw new Error("Invalid API response: expected JSON object");
  }

  const obj = raw as Record<string, unknown>;

  if (!Array.isArray(obj.articles)) {
    throw new Error("Invalid API response: missing 'articles' array");
  }

  const reports: ArticleReport[] = obj.articles.map((item, index) => {
    if (!item || typeof item !== "object") {
      throw new Error(`Invalid article report at index ${index}: expected object`);
    }

    const repObj = item as Record<string, unknown>;
    const artRaw = repObj.article as Record<string, unknown> | undefined;

    if (!artRaw || typeof artRaw !== "object") {
      throw new Error(`Invalid article report at index ${index}: missing 'article' object`);
    }

    if (typeof artRaw.title !== "string" || !artRaw.title.trim()) {
      throw new Error(`Invalid article at index ${index}: missing or empty 'title'`);
    }

    if (typeof artRaw.url !== "string" || !artRaw.url.trim()) {
      throw new Error(`Invalid article at index ${index}: missing or empty 'url'`);
    }

    const article: Article = {
      id: typeof artRaw.id === "string" ? artRaw.id : null,
      hnId: typeof artRaw.hn_id === "number" ? artRaw.hn_id : 0,
      title: artRaw.title,
      url: artRaw.url,
      publishedAt: typeof artRaw.published_at === "string" ? artRaw.published_at : null,
      hnScore: typeof artRaw.hn_score === "number" ? artRaw.hn_score : 0,
      source: typeof artRaw.source === "string" ? artRaw.source : "Hacker News",
      imageUrl: typeof artRaw.image_url === "string" ? artRaw.image_url : null,
      category: typeof artRaw.category === "string" ? artRaw.category : null,
    };

    const extRaw = (repObj.extraction as Record<string, unknown>) || {};
    const extraction: ExtractionSummary = {
      status: (extRaw.status as ExtractionStatus) || "fetch_failed",
      wordCount: typeof extRaw.word_count === "number" ? extRaw.word_count : 0,
      textPreview: typeof extRaw.text_preview === "string" ? extRaw.text_preview : "",
      finalUrl: typeof extRaw.final_url === "string" ? extRaw.final_url : null,
    };

    return {
      article,
      extraction,
      checked: Boolean(repObj.checked),
      overallVerdictKey: (repObj.overall_verdict_key as VerdictKey) || null,
      overallConfidence: (repObj.overall_confidence as ConfidenceLevel) || null,
      claims: Array.isArray(repObj.claims) ? repObj.claims : [],
      skippedStatements: Array.isArray(repObj.skipped_statements)
        ? (repObj.skipped_statements as string[])
        : [],
    };
  });

  return {
    articles: reports,
    total: typeof obj.total === "number" ? obj.total : reports.length,
    cached: Boolean(obj.cached),
  };
}

/**
 * Fetches latest articles from the backend API directly from the browser.
 */
export async function fetchArticles(limit: number = 20): Promise<ArticlesResponse> {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), CLIENT_REQUEST_TIMEOUT_MS);

  try {
    const url = `${API_BASE_URL}/api/articles?limit=${limit}`;
    const response = await fetch(url, {
      method: "GET",
      headers: { Accept: "application/json" },
      signal: controller.signal,
    });

    if (!response.ok) {
      throw new Error(`Backend error (${response.status} ${response.statusText})`);
    }

    const data = await response.json();
    return parseArticlesResponse(data);
  } finally {
    clearTimeout(timer);
  }
}

