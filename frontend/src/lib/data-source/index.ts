import type { DataSource } from './types';
import { createSampleDataSource } from './sample';
import { createLiveDataSource } from './live';

export function getDataSource(): DataSource {
  const mode = process.env.NEXT_PUBLIC_DATA_SOURCE;

  if (!mode || mode === 'sample') {
    return createSampleDataSource();
  }

  if (mode === 'live') {
    return createLiveDataSource();
  }

  throw new Error(
    `Invalid NEXT_PUBLIC_DATA_SOURCE: '${mode}'. Allowed values are 'sample' and 'live'.`
  );
}

export type { DataSource } from './types';

