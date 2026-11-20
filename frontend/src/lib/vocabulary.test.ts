import { describe, it, expect } from 'vitest';
import {
  VERDICTS,
  VERDICT_LABEL,
  VERDICT_ICON,
  VERDICT_STYLE,
  CONFIDENCE_LABEL,
  ICON_SIZE,
  ICON_STROKE,
  tallyVerdicts,
} from './vocabulary';
import { hasPercent, hasEmoji } from '../test/text-rules';
import type { Verdict } from './contract';

describe('vocabulary module', () => {
  it('defines exactly 4 Verdicts in the exact required order', () => {
    expect(VERDICTS).toEqual([
      'supported',
      'refuted',
      'mixed',
      'not_enough_evidence',
    ]);
  });

  it('provides exact human-readable labels for each Verdict', () => {
    expect(VERDICT_LABEL.supported).toBe('Verified with evidence');
    expect(VERDICT_LABEL.refuted).toBe('Evidence says this is false');
    expect(VERDICT_LABEL.mixed).toBe('Evidence shows only part of this is true');
    expect(VERDICT_LABEL.not_enough_evidence).toBe('Not enough evidence yet');
  });

  it('provides exact human-readable labels for the 3 Confidence values', () => {
    expect(CONFIDENCE_LABEL.very_sure).toBe('Very sure');
    expect(CONFIDENCE_LABEL.fairly_sure).toBe('Fairly sure');
    expect(CONFIDENCE_LABEL.not_very_sure).toBe('Not very sure');
  });

  it('every Verdict has a distinct lucide icon', () => {
    const icons = VERDICTS.map((v) => VERDICT_ICON[v]);
    icons.forEach((icon) => expect(icon).toBeDefined());
    const uniqueIcons = new Set(icons);
    expect(uniqueIcons.size).toBe(4);
  });

  it('no label has a percent sign or an emoji', () => {
    Object.values(VERDICT_LABEL).forEach((label) => {
      expect(hasPercent(label)).toBe(false);
      expect(hasEmoji(label)).toBe(false);
    });
    Object.values(CONFIDENCE_LABEL).forEach((label) => {
      expect(hasPercent(label)).toBe(false);
      expect(hasEmoji(label)).toBe(false);
    });
  });

  it('defines standard icon size (16) and stroke width (2)', () => {
    expect(ICON_SIZE).toBe(16);
    expect(ICON_STROKE).toBe(2);
  });

  it('VERDICT_STYLE provides full static tint and icon class names', () => {
    expect(VERDICT_STYLE.supported).toEqual({
      tint: 'bg-verified-tint',
      icon: 'text-verified',
    });
    expect(VERDICT_STYLE.refuted).toEqual({
      tint: 'bg-ruby-tint',
      icon: 'text-ruby',
    });
    expect(VERDICT_STYLE.mixed).toEqual({
      tint: 'bg-lemon-tint',
      icon: 'text-lemon',
    });
    expect(VERDICT_STYLE.not_enough_evidence).toEqual({
      tint: 'bg-ink-mute-tint',
      icon: 'text-ink-mute',
    });
  });

  describe('tallyVerdicts', () => {
    it('returns zero for all 4 Verdicts when given an empty list', () => {
      expect(tallyVerdicts([])).toEqual({
        supported: 0,
        refuted: 0,
        mixed: 0,
        not_enough_evidence: 0,
      });
    });

    it('accurately counts verdicts for a mixed list of claims', () => {
      const claims: Array<{ verdict: Verdict }> = [
        { verdict: 'supported' },
        { verdict: 'supported' },
        { verdict: 'refuted' },
        { verdict: 'mixed' },
        { verdict: 'not_enough_evidence' },
        { verdict: 'not_enough_evidence' },
      ];
      expect(tallyVerdicts(claims)).toEqual({
        supported: 2,
        refuted: 1,
        mixed: 1,
        not_enough_evidence: 2,
      });
    });
  });
});

