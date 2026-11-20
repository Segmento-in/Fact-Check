import type { EvidenceRecord } from './contract';

export interface ProofGroups {
  supports: EvidenceRecord[];
  challenges: EvidenceRecord[];
  saidNothing: number;
}

/**
 * Splits accepted Evidence into Supports and Challenges groups.
 * - Supports = stances 'supports' and 'supports_only_part'
 * - Challenges = stance 'opposes'
 * - saidNothing = count of 'says_nothing' passages
 * - Drops any Evidence where fenceResult !== 'accepted'
 */
export function splitProofGroups(evidence: EvidenceRecord[]): ProofGroups {
  const supports: EvidenceRecord[] = [];
  const challenges: EvidenceRecord[] = [];
  let saidNothing = 0;

  for (const item of evidence) {
    if (item.fenceResult !== 'accepted') {
      continue;
    }

    if (item.stance === 'supports' || item.stance === 'supports_only_part') {
      supports.push(item);
    } else if (item.stance === 'opposes') {
      challenges.push(item);
    } else if (item.stance === 'says_nothing') {
      saidNothing++;
    }
  }

  return { supports, challenges, saidNothing };
}

