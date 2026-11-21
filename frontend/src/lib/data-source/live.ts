import type { DataSource } from './types';
import type { VerificationReport, Article } from '../contract';
import { parseArticlesResponse } from './live-parse';

export const LIVE_REQUEST_TIMEOUT_MS = 8000;

export function createLiveDataSource(): DataSource {
  const rawBaseUrl = process.env.NEXT_PUBLIC_API_BASE_URL || 'http://localhost:8000';
  const baseUrl = rawBaseUrl.replace(/\/+$/, '');

  return {
    async submitCheck(): Promise<{ reportId: string }> {
      // ponytail: submitCheck not available in live mode yet; trigger: when the backend pipeline exists
      throw new Error('Submit is not available in live mode yet.');
    },

    async getReport(): Promise<VerificationReport | null> {
      // ponytail: getReport not available in live mode yet; trigger: when the backend pipeline exists
      throw new Error('Report is not available in live mode yet.');
    },

    async listFeedArticles(): Promise<Article[]> {
      const controller = new AbortController();
      const timer = setTimeout(() => controller.abort(), LIVE_REQUEST_TIMEOUT_MS);

      try {
        const url = `${baseUrl}/api/articles?limit=20`;
        const response = await fetch(url, {
          method: 'GET',
          headers: { Accept: 'application/json' },
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
    },
  };
}
