import { describe, it, expect } from 'vitest';
import { splitProofGroups } from './proof-groups';
import type { EvidenceRecord } from './contract';

describe('splitProofGroups', () => {
  it('splits supports, challenges and counts said-nothing, while dropping rejected evidence', () => {
    const evidence: EvidenceRecord[] = [
      {
        tag: 'E1',
        passage: 'Passage one.',
        link: 'https://reuters.com/sample/1',
        copyGroupId: 'cg-1',
        pageDate: '2026-10-01',
        fetchedOn: '2026-10-02',
        stance: 'supports',
        quote: 'Passage one.',
        fenceResult: 'accepted',
      },
      {
        tag: 'E2',
        passage: 'Passage two.',
        link: 'https://reuters.com/sample/2',
        copyGroupId: 'cg-2',
        pageDate: '2026-10-01',
        fetchedOn: '2026-10-02',
        stance: 'supports_only_part',
        quote: 'Passage two.',
        fenceResult: 'accepted',
      },
      {
        tag: 'E3',
        passage: 'Passage three.',
        link: 'https://apnews.com/sample/3',
        copyGroupId: 'cg-3',
        pageDate: '2026-10-01',
        fetchedOn: '2026-10-02',
        stance: 'opposes',
        quote: 'Passage three.',
        fenceResult: 'accepted',
      },
      {
        tag: 'E4',
        passage: 'Passage four.',
        link: 'https://factcheck.org/sample/4',
        copyGroupId: 'cg-4',
        pageDate: '2026-10-01',
        fetchedOn: '2026-10-02',
        stance: 'says_nothing',
        quote: '',
        fenceResult: 'accepted',
      },
      {
        tag: 'E5',
        passage: 'Passage five.',
        link: 'https://apnews.com/sample/5',
        copyGroupId: 'cg-5',
        pageDate: '2026-10-01',
        fetchedOn: '2026-10-02',
        stance: 'supports',
        quote: 'Passage five.',
        fenceResult: 'rejected', // Rejected: must be dropped
      },
    ];

    const result = splitProofGroups(evidence);

    expect(result.supports.map((e) => e.tag)).toEqual(['E1', 'E2']);
    expect(result.challenges.map((e) => e.tag)).toEqual(['E3']);
    expect(result.saidNothing).toBe(1);
    expect(result.supports.some((e) => e.tag === 'E5')).toBe(false);
  });

  it('handles empty evidence list', () => {
    const result = splitProofGroups([]);
    expect(result.supports).toEqual([]);
    expect(result.challenges).toEqual([]);
    expect(result.saidNothing).toBe(0);
  });
});

