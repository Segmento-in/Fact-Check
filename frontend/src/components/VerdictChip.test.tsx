import '@testing-library/jest-dom/vitest';
import { render, screen } from '@testing-library/react';
import { describe, it, expect } from 'vitest';
import { VerdictChip } from './VerdictChip';
import { VERDICTS, VERDICT_LABEL, VERDICT_STYLE } from '../lib/vocabulary';
import { hasPercent, hasEmoji } from '../test/text-rules';

describe('VerdictChip component', () => {
  VERDICTS.forEach((verdict) => {
    it(`renders correct label, icon, root data attribute and styles for ${verdict}`, () => {
      const { container } = render(<VerdictChip verdict={verdict} />);
      const root = container.firstElementChild as HTMLElement;

      expect(root).toHaveAttribute('data-verdict', verdict);
      expect(root).toHaveClass(VERDICT_STYLE[verdict].tint);

      // Label text
      const expectedLabel = VERDICT_LABEL[verdict];
      expect(screen.getByText(expectedLabel)).toBeInTheDocument();

      const labelElement = screen.getByText(expectedLabel);
      expect(labelElement).toHaveClass('text-ink');

      // Icon svg
      const svg = root.querySelector('svg');
      expect(svg).toBeInTheDocument();
      expect(svg).toHaveAttribute('aria-hidden', 'true');
      expect(svg).toHaveClass(VERDICT_STYLE[verdict].icon);

      // No percent and no emoji in text
      expect(hasPercent(root.textContent || '')).toBe(false);
      expect(hasEmoji(root.textContent || '')).toBe(false);
    });
  });

  it('supports size="sm" and size="md" (defaulting to md)', () => {
    const { container: mdContainer } = render(<VerdictChip verdict="supported" />);
    const mdRoot = mdContainer.firstElementChild as HTMLElement;
    expect(mdRoot).toHaveClass('h-[28px]');

    const { container: smContainer } = render(
      <VerdictChip verdict="supported" size="sm" />
    );
    const smRoot = smContainer.firstElementChild as HTMLElement;
    expect(smRoot).toHaveClass('h-[24px]');
  });
});

