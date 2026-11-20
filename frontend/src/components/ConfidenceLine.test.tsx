import '@testing-library/jest-dom/vitest';
import { render, screen } from '@testing-library/react';
import { describe, it, expect } from 'vitest';
import { ConfidenceLine } from './ConfidenceLine';
import { CONFIDENCE_LABEL } from '../lib/vocabulary';
import { hasPercent, hasEmoji } from '../test/text-rules';
import type { Confidence } from '../lib/contract';

describe('ConfidenceLine component', () => {
  const confidences: Confidence[] = ['very_sure', 'fairly_sure', 'not_very_sure'];

  confidences.forEach((confidence) => {
    it(`renders only the exact label "${CONFIDENCE_LABEL[confidence]}" for ${confidence}`, () => {
      const { container } = render(<ConfidenceLine confidence={confidence} />);
      const text = container.textContent?.trim() || '';

      expect(text).toBe(CONFIDENCE_LABEL[confidence]);
      expect(screen.getByText(CONFIDENCE_LABEL[confidence])).toBeInTheDocument();
      expect(hasPercent(text)).toBe(false);
      expect(hasEmoji(text)).toBe(false);

      const el = screen.getByText(CONFIDENCE_LABEL[confidence]);
      expect(el).toHaveClass('text-sm');
      expect(el).toHaveClass('text-ink-secondary');
    });
  });
});

