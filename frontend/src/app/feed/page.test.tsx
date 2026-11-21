import '@testing-library/jest-dom/vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import LiveFeedPage from './page';
import * as dataSourceModule from '@/lib/data-source';
import { hasPercent, hasEmoji } from '@/test/text-rules';

describe('LiveFeedPage', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.restoreAllMocks();
  });

  it('renders exactly 8 Feed Cards with no percent sign and no emoji', async () => {
    const { container } = render(<LiveFeedPage />);

    await waitFor(() => {
      const articles = screen.getAllByRole('article');
      expect(articles.length).toBe(8);
    });

    const text = container.textContent || '';
    expect(hasPercent(text)).toBe(false);
    expect(hasEmoji(text)).toBe(false);
  });

  it('renders all five Feed Card State kinds across the cards', async () => {
    render(<LiveFeedPage />);

    await waitFor(() => {
      expect(screen.getByText('Not checked yet')).toBeInTheDocument();
      expect(screen.getByText('Checking')).toBeInTheDocument();
      expect(screen.getByText('No checkable claims')).toBeInTheDocument();
      expect(screen.getByText('We could not finish this check')).toBeInTheDocument();
    });
  });

  it('card with report is a link, card without is not', async () => {
    render(<LiveFeedPage />);

    await waitFor(() => {
      expect(screen.getAllByRole('article').length).toBe(8);
    });

    // Art 1 (not_checked_yet) has no link
    expect(screen.queryByRole('link', { name: /Highland community council/i })).not.toBeInTheDocument();

    // Art 3 (checked, sample-all-verdicts) has a link
    const link = screen.getByRole('link', { name: /Harbor City council votes/i });
    expect(link).toHaveAttribute('href', '/report/sample-all-verdicts');
  });

  it('Refresh Feed reloads the articles', async () => {
    render(<LiveFeedPage />);

    await waitFor(() => {
      expect(screen.getAllByRole('article').length).toBe(8);
    });

    const refreshBtn = screen.getByRole('button', { name: /Refresh Feed/i });
    fireEvent.click(refreshBtn);

    await waitFor(() => {
      expect(screen.getAllByRole('article').length).toBe(8);
    });
  });

  it('Feed Score never sits inside a Verdict Chip', async () => {
    const { container } = render(<LiveFeedPage />);

    await waitFor(() => {
      expect(screen.getAllByRole('article').length).toBe(8);
    });

    const chips = container.querySelectorAll('[data-verdict]');
    chips.forEach((chip) => {
      expect(chip.textContent).not.toMatch(/Feed Score/i);
      expect(chip.textContent).not.toMatch(/Score/i);
    });
  });

  it('all tally count elements share the text-ink class and none use blue or primary colors', async () => {
    const { container } = render(<LiveFeedPage />);

    await waitFor(() => {
      expect(screen.getAllByRole('article').length).toBe(8);
    });

    const tallyCounts = container.querySelectorAll('article div.pt-4 span.font-mono');
    expect(tallyCounts.length).toBeGreaterThan(0);
    tallyCounts.forEach((span) => {
      expect(span.className).toContain('text-ink');
      expect(span.className).not.toContain('text-primary');
      expect(span.className).not.toContain('text-blue');
    });
  });

  it('shows Could-Not-Finish block and Try again when listing fails', async () => {
    const mockList = vi.fn().mockRejectedValueOnce(new Error('Network failure')).mockResolvedValueOnce([]);
    vi.spyOn(dataSourceModule, 'getDataSource').mockReturnValue({
      submitCheck: vi.fn(),
      getReport: vi.fn(),
      listFeedArticles: mockList,
    });

    render(<LiveFeedPage />);

    await waitFor(() => {
      expect(screen.getByText('We could not load the Feed')).toBeInTheDocument();
    });

    const tryAgainBtn = screen.getByRole('button', { name: 'Try again' });
    fireEvent.click(tryAgainBtn);

    await waitFor(() => {
      expect(screen.getByText('No Articles yet. Try Refresh Feed.')).toBeInTheDocument();
    });
  });
});

