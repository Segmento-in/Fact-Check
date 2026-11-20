import { describe, it, expect } from 'vitest';
import { hasEmoji, hasPercent, collectStrings } from './text-rules';

describe('text-rules helpers', () => {
  describe('hasEmoji', () => {
    it('is true for an emoji created from code point and false for plain text with a dash', () => {
      const emojiChar = String.fromCodePoint(0x1F642);
      expect(hasEmoji(emojiChar)).toBe(true);
      expect(hasEmoji(`Prefix ${emojiChar} suffix`)).toBe(true);
      expect(hasEmoji('plain words — with a dash')).toBe(false);
    });
  });

  describe('hasPercent', () => {
    it('is true for "5%" and false for "5 percent"', () => {
      expect(hasPercent('5%')).toBe(true);
      expect(hasPercent('5 percent')).toBe(false);
    });
  });

  describe('collectStrings', () => {
    it('finds a string nested 3 levels deep in an object with arrays', () => {
      const nested = {
        level1: [
          {
            level2: {
              level3: 'deep string',
            },
          },
        ],
      };

      const collected = collectStrings(nested);
      expect(collected).toContain('deep string');
    });
  });
});

