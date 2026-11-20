import type { DataSource } from './types';
import type { CheckSubmission, VerificationReport, Article } from '../contract';
import { SAMPLE_REPORTS, SAMPLE_ARTICLES } from './sample-data';

export function createSampleDataSource(): DataSource {
  return {
    async submitCheck(input: CheckSubmission): Promise<{ reportId: string }> {
      // ponytail: the sample submit ignores the text and picks by the switch only; revisit when the real API replaces it.
      if (input.iWroteThis) {
        return { reportId: 'sample-i-wrote-this' };
      }
      return { reportId: 'sample-all-verdicts' };
    },

    async getReport(id: string): Promise<VerificationReport | null> {
      const match = SAMPLE_REPORTS.find((r) => r.id === id);
      return match ?? null;
    },

    async listFeedArticles(): Promise<Article[]> {
      return [...SAMPLE_ARTICLES];
    },
  };
}

