import { describe, it, expect } from 'vitest';
import { getContrastRatio } from './contrast';

export function blendHex(fgHex: string, bgHex: string, opacity: number): string {
  const parse = (h: string) => {
    const clean = h.replace(/^#/, '');
    return {
      r: parseInt(clean.slice(0, 2), 16),
      g: parseInt(clean.slice(2, 4), 16),
      b: parseInt(clean.slice(4, 6), 16),
    };
  };

  const fg = parse(fgHex);
  const bg = parse(bgHex);

  const r = Math.round(fg.r * opacity + bg.r * (1 - opacity));
  const g = Math.round(fg.g * opacity + bg.g * (1 - opacity));
  const b = Math.round(fg.b * opacity + bg.b * (1 - opacity));

  const toHex = (n: number) => n.toString(16).padStart(2, '0');
  return `#${toHex(r)}${toHex(g)}${toHex(b)}`;
}

describe('Mesh gradient contrast test', () => {
  const canvasSoft = '#f6f9fc';
  const ink = '#0d253d';
  const inkSecondary = '#273951';

  const meshLayers = [
    { name: 'primary-subdued at 45%', fg: '#b9b9f9', opacity: 0.45 },
    { name: 'magenta at 25%', fg: '#f96bee', opacity: 0.25 },
    { name: 'canvas-cream at 90%', fg: '#f5e9d4', opacity: 0.90 },
  ];

  meshLayers.forEach(({ name, fg, opacity }) => {
    const blended = blendHex(fg, canvasSoft, opacity);

    it(`ink on ${name} blend (${blended}) is at least 4.5:1`, () => {
      const ratio = getContrastRatio(ink, blended);
      console.info(`[Mesh Contrast] ink on ${name} (${blended}): ${ratio.toFixed(2)}:1`);
      expect(ratio).toBeGreaterThanOrEqual(4.5);
    });

    it(`ink-secondary on ${name} blend (${blended}) is at least 4.5:1`, () => {
      const ratio = getContrastRatio(inkSecondary, blended);
      console.info(`[Mesh Contrast] ink-secondary on ${name} (${blended}): ${ratio.toFixed(2)}:1`);
      expect(ratio).toBeGreaterThanOrEqual(4.5);
    });
  });
});

