import type { LucideIcon } from 'lucide-react';
import { CircleCheck, CircleX, TriangleAlert, CircleHelp } from 'lucide-react';
import type { Verdict, Confidence, ClaimTally } from './contract';

export type { Verdict, Confidence };

export const VERDICTS: readonly [
  'supported',
  'refuted',
  'mixed',
  'not_enough_evidence',
] = [
  'supported',
  'refuted',
  'mixed',
  'not_enough_evidence',
] as const;

export const VERDICT_LABEL: Record<Verdict, string> = {
  supported: 'Verified with evidence',
  refuted: 'Evidence says this is false',
  mixed: 'Evidence shows only part of this is true',
  not_enough_evidence: 'Not enough evidence yet',
};

export const VERDICT_ICON: Record<Verdict, LucideIcon> = {
  supported: CircleCheck,
  refuted: CircleX,
  mixed: TriangleAlert,
  not_enough_evidence: CircleHelp,
};

export const VERDICT_STYLE: Record<
  Verdict,
  { tint: string; icon: string }
> = {
  supported: {
    tint: 'bg-verified-tint',
    icon: 'text-verified',
  },
  refuted: {
    tint: 'bg-ruby-tint',
    icon: 'text-ruby',
  },
  mixed: {
    tint: 'bg-lemon-tint',
    icon: 'text-lemon',
  },
  not_enough_evidence: {
    tint: 'bg-ink-mute-tint',
    icon: 'text-ink-mute',
  },
};

export const CONFIDENCE_LABEL: Record<Confidence, string> = {
  very_sure: 'Very sure',
  fairly_sure: 'Fairly sure',
  not_very_sure: 'Not very sure',
};

export const ICON_SIZE = 16;
export const ICON_SIZE_SM = 14;
export const ICON_STROKE = 2;

export function tallyVerdicts(claims: Array<{ verdict: Verdict }>): ClaimTally {
  const tally: ClaimTally = {
    supported: 0,
    refuted: 0,
    mixed: 0,
    not_enough_evidence: 0,
  };

  for (const item of claims) {
    if (item.verdict in tally) {
      tally[item.verdict]++;
    }
  }

  return tally;
}

