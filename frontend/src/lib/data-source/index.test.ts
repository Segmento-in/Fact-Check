import { describe, it, expect, vi, beforeEach } from 'vitest';
import { getDataSource } from './index';

describe('data-source selector (getDataSource)', () => {
  beforeEach(() => {
    vi.unstubAllEnvs();
  });

  it('returns Sample Data source when NEXT_PUBLIC_DATA_SOURCE is unset', async () => {
    vi.stubEnv('NEXT_PUBLIC_DATA_SOURCE', '');
    const ds = getDataSource();
    const articles = await ds.listFeedArticles();
    expect(articles.length).toBe(8);
  });

  it('returns Sample Data source when NEXT_PUBLIC_DATA_SOURCE is "sample"', async () => {
    vi.stubEnv('NEXT_PUBLIC_DATA_SOURCE', 'sample');
    const ds = getDataSource();
    const articles = await ds.listFeedArticles();
    expect(articles.length).toBe(8);
  });

  it('returns live source when NEXT_PUBLIC_DATA_SOURCE is "live", whose methods reject', async () => {
    vi.stubEnv('NEXT_PUBLIC_DATA_SOURCE', 'live');
    const ds = getDataSource();

    await expect(ds.submitCheck({ text: 'test', iWroteThis: false, contentKind: 'claim_or_text' })).rejects.toThrow(
      /Submit is not available in live mode yet/i
    );
    await expect(ds.getReport('sample-all-verdicts')).rejects.toThrow(
      /Report is not available in live mode yet/i
    );
  });

  it('throws an Error naming allowed values "sample" and "live" for invalid setting', () => {
    vi.stubEnv('NEXT_PUBLIC_DATA_SOURCE', 'banana');
    expect(() => getDataSource()).toThrow(/sample.*live/i);
  });
});

