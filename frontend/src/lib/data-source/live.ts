import type { DataSource } from './types';
import type { VerificationReport, Article } from '../contract';

export function createLiveDataSource(): DataSource {
  // ponytail: stub, replaced in Ticket 6.
  return {
    async submitCheck(): Promise<{ reportId: string }> {
      throw new Error('Live mode is built in Ticket 6');
    },

    async getReport(): Promise<VerificationReport | null> {
      throw new Error('Live mode is built in Ticket 6');
    },

    async listFeedArticles(): Promise<Article[]> {
      throw new Error('Live mode is built in Ticket 6');
    },
  };
}

