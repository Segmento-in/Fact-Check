import type {
  CheckSubmission,
  VerificationReport,
  Article,
} from '../contract';

export interface DataSource {
  submitCheck(input: CheckSubmission): Promise<{ reportId: string }>;
  getReport(id: string): Promise<VerificationReport | null>;
  listFeedArticles(): Promise<Article[]>;
}

