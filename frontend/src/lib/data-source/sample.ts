import type { DataSource } from './types';
import type { CheckSubmission, VerificationReport, Article } from '../contract';
import { SAMPLE_REPORTS, SAMPLE_ARTICLES } from './sample-data';

function getSampleDelayMs(): number {
  const envVal = process.env.NEXT_PUBLIC_SAMPLE_DELAY_MS;
  if (envVal !== undefined && envVal !== '') {
    const parsed = Number(envVal);
    if (!Number.isNaN(parsed)) {
      return parsed;
    }
  }
  return 600;
}

const sleep = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));

export function createSampleDataSource(): DataSource {
  return {
    async submitCheck(input: CheckSubmission): Promise<{ reportId: string }> {
      const delay = getSampleDelayMs();
      if (delay > 0) await sleep(delay);
      // ponytail: the sample submit ignores the text and content kind and picks by the switch only; revisit when the real API replaces it.
      if (input.iWroteThis) {
        return { reportId: 'sample-i-wrote-this' };
      }
      return { reportId: 'sample-all-verdicts' };
    },

    async getReport(id: string): Promise<VerificationReport | null> {
      const delay = getSampleDelayMs();
      if (delay > 0) await sleep(delay);
      const match = SAMPLE_REPORTS.find((r) => r.id === id);
      return match ?? null;
    },

    async listFeedArticles(): Promise<Article[]> {
      const delay = getSampleDelayMs();
      if (delay > 0) await sleep(delay);
      return [...SAMPLE_ARTICLES];
    },
  };
}

