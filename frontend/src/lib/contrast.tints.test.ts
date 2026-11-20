import { describe, it, expect } from 'vitest';
import { getContrastBetweenTokens } from './contrast';

describe('Verdict Chip Tint Contrast Ratios from globals.css tokens', () => {
  describe('ink on each of the 4 tints: at least 4.5:1 (text contrast)', () => {
    const tints = [
      'verified-tint',
      'ruby-tint',
      'lemon-tint',
      'ink-mute-tint',
    ] as const;

    tints.forEach((tint) => {
      it(`ink on ${tint} must be at least 4.5:1`, () => {
        const ratio = getContrastBetweenTokens('ink', tint);
        console.info(`[Contrast MUST >= 4.5] ink on ${tint}: ${ratio.toFixed(2)}:1`);
        expect(ratio).toBeGreaterThanOrEqual(4.5);
      });
    });
  });

  describe('Verdict colour as ICON on its own tint: at least 3.0:1 (graphical elements)', () => {
    const iconPairs = [
      ['verified', 'verified-tint'],
      ['ruby', 'ruby-tint'],
      ['lemon', 'lemon-tint'],
      ['ink-mute', 'ink-mute-tint'],
    ] as const;

    iconPairs.forEach(([fg, bg]) => {
      it(`${fg} on ${bg} must be at least 3.0:1 for icons`, () => {
        const ratio = getContrastBetweenTokens(fg, bg);
        console.info(`[Contrast MUST >= 3.0] ${fg} on ${bg} (icon): ${ratio.toFixed(2)}:1`);
        expect(ratio).toBeGreaterThanOrEqual(3.0);
      });
    });
  });
});

