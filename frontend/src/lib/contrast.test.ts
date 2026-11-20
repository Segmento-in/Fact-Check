import { describe, it, expect } from 'vitest';
import { getContrastBetweenTokens } from './contrast';

describe('WCAG Contrast Ratios from globals.css tokens', () => {
  describe('MUST be at least 4.5:1 (normal text contrast)', () => {
    const textPairs = [
      ['ink', 'canvas'],
      ['ink', 'canvas-soft'],
      ['ink-secondary', 'canvas-soft'],
      ['on-primary', 'primary'],
      ['primary', 'canvas'],
      ['ink-mute', 'canvas'],
      ['verified', 'canvas'],
      ['lemon', 'canvas'],
    ] as const;

    textPairs.forEach(([fg, bg]) => {
      it(`${fg} on ${bg} must be at least 4.5:1`, () => {
        const ratio = getContrastBetweenTokens(fg, bg);
        console.info(`[Contrast MUST >= 4.5] ${fg} on ${bg}: ${ratio.toFixed(2)}:1`);
        expect(ratio).toBeGreaterThanOrEqual(4.5);
      });
    });
  });

  describe('MUST be at least 3.0:1 (icons and graphical elements)', () => {
    const iconPairs = [
      ['ruby', 'canvas'],
      ['verified', 'canvas-soft'],
      ['lemon', 'canvas-soft'],
      ['ink-mute', 'canvas-soft'],
    ] as const;

    iconPairs.forEach(([fg, bg]) => {
      it(`${fg} on ${bg} must be at least 3.0:1 for icons`, () => {
        const ratio = getContrastBetweenTokens(fg, bg);
        console.info(`[Contrast MUST >= 3.0] ${fg} on ${bg} (icon): ${ratio.toFixed(2)}:1`);
        expect(ratio).toBeGreaterThanOrEqual(3.0);
      });
    });
  });

  describe('BANNED PAIRS (do not use as text)', () => {
    it('ink-mute on canvas-soft is below 4.5:1 (do not use as text)', () => {
      const ratio = getContrastBetweenTokens('ink-mute', 'canvas-soft');
      console.info(`[BANNED PAIR - text] ink-mute on canvas-soft: ${ratio.toFixed(2)}:1 (< 4.5)`);
      expect(ratio).toBeGreaterThanOrEqual(1);
      expect(ratio).toBeLessThan(4.5);
    });

    it('ruby on canvas is below 4.5:1 (do not use as text)', () => {
      const ratio = getContrastBetweenTokens('ruby', 'canvas');
      console.info(`[BANNED PAIR - text] ruby on canvas: ${ratio.toFixed(2)}:1 (< 4.5)`);
      expect(ratio).toBeGreaterThanOrEqual(1);
      expect(ratio).toBeLessThan(4.5);
    });
  });
});

