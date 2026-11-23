import { within } from '@testing-library/react';
import type { Article, FeedCardState } from '@/lib/contract';
import { SAMPLE_ARTICLES } from '@/lib/data-source/sample-data';
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


describe('Ticket 6: magazine Feed Cards', () => {
  beforeEach(() => {
    vi.restoreAllMocks();
  });

  async function renderCard(overrides: Partial<Article> = {}) {
    const article: Article = {
      ...SAMPLE_ARTICLES[0],
      feed: 'Medium',
      imageUrl: null,
      feedScore: null,
      ...overrides,
    };
    const dataSource = dataSourceModule.getDataSource();
    vi.spyOn(dataSourceModule, 'getDataSource').mockReturnValue({
      ...dataSource,
      listFeedArticles: async () => [article],
    });
    const view = render(<LiveFeedPage />);
    await waitFor(() => expect(screen.getAllByRole('article')).toHaveLength(1));
    return { ...view, card: screen.getByRole('article'), article };
  }

  it('shows the Feed name in the Feed Pill, separately from Publisher', async () => {
    const { card } = await renderCard({ publisher: 'Independent Publisher' });
    const meta = card.querySelector<HTMLElement>('[data-part="meta"]');
    expect(meta).not.toBeNull();
    expect(within(meta!).getByText('Medium')).toBeInTheDocument();
    expect(meta).not.toHaveTextContent('Independent Publisher');
    expect(card.querySelector('[data-part="byline"]')).toHaveTextContent(
      'By Independent Publisher'
    );
  });

  it('shows a decorative Cover Image and replaces a broken image with a Cover Tile', async () => {
    const { card } = await renderCard({ imageUrl: '/sample-covers/cover-1.svg' });
    expect(card.querySelectorAll('img')).toHaveLength(1);
    const image = card.querySelector('img')!;
    expect(image).toHaveAttribute('src', '/sample-covers/cover-1.svg');
    expect(image).toHaveAttribute('alt', '');
    expect(image).toHaveAttribute('loading', 'lazy');
    expect(image).toHaveAttribute('referrerpolicy', 'no-referrer');
    expect(image).toHaveAttribute('decoding', 'async');
    expect(card.querySelector('[data-cover-tile]')).toBeNull();

    fireEvent.error(image);

    await waitFor(() => {
      expect(card.querySelector('img')).toBeNull();
      expect(card.querySelector('[data-cover-tile]')).not.toBeNull();
    });
  });

  it('shows a decorative icon-only Cover Tile when imageUrl is null', async () => {
    const { card } = await renderCard();
    const tile = card.querySelector('[data-cover-tile]');
    expect(tile).not.toBeNull();
    expect(tile).toHaveAttribute('aria-hidden', 'true');
    expect(tile?.querySelector('svg')).not.toBeNull();
    expect(tile?.textContent).toBe('');
    expect(card.querySelector('img')).toBeNull();
  });

  it.each([{ score: 0 }, { score: 478 }])(
    'shows numeric Feed Score $score in the byline',
    async ({ score }) => {
      const { card } = await renderCard({ feed: 'Hacker News', feedScore: score });
      const byline = card.querySelector<HTMLElement>('[data-part="byline"]');
      expect(byline).not.toBeNull();
      expect(within(byline!).getByText(`Feed Score ${score}`)).toBeInTheDocument();
    }
  );

  it('omits Feed Score when it is null', async () => {
    const { card } = await renderCard();
    expect(within(card).queryByText(/Feed Score/)).not.toBeInTheDocument();
  });

  const states: Array<{
    label: string;
    state: FeedCardState;
    reportId: string | null;
  }> = [
    { label: 'Not checked yet', state: { kind: 'not_checked_yet' }, reportId: null },
    { label: 'Checking', state: { kind: 'checking' }, reportId: null },
    {
      label: 'Claim Tally',
      state: {
        kind: 'checked',
        reportId: 'sample-all-verdicts',
        tally: { supported: 2, refuted: 1, mixed: 3, not_enough_evidence: 4 },
      },
      reportId: 'sample-all-verdicts',
    },
    {
      label: 'No checkable claims',
      state: { kind: 'no_checkable_claims', reportId: 'sample-no-checkable-claims' },
      reportId: 'sample-no-checkable-claims',
    },
    {
      label: 'We could not finish this check',
      state: { kind: 'could_not_finish', reportId: 'sample-could-not-finish' },
      reportId: 'sample-could-not-finish',
    },
  ];

  it.each(states)(
    'links the headline only when $label has a reportId',
    async ({ state, reportId }) => {
      const { card, article } = await renderCard({ state });
      const headline = within(card).getByRole('heading', { level: 2 });
      expect(headline).toHaveTextContent(article.headline);
      const link = within(headline).queryByRole('link');
      if (reportId) {
        expect(link).toHaveAttribute('href', `/report/${reportId}`);
        expect(link).toHaveAccessibleName(article.headline);
      } else {
        expect(link).not.toBeInTheDocument();
        expect(card.querySelector('a')).toBeNull();
      }
    }
  );

  it('keeps icon, words and count for every Claim Tally chip', async () => {
    const { card } = await renderCard({ state: states[2].state });
    const state = card.querySelector('[data-part="state"]');
    expect(state).not.toBeNull();

    const expected = [
      ['supported', 'Verified with evidence', 2],
      ['refuted', 'Evidence says this is false', 1],
      ['mixed', 'Evidence shows only part of this is true', 3],
      ['not_enough_evidence', 'Not enough evidence yet', 4],
    ] as const;

    expect(state!.querySelectorAll('[data-verdict]')).toHaveLength(4);
    for (const [verdict, label, count] of expected) {
      const chip = state!.querySelector<HTMLElement>(`[data-verdict="${verdict}"]`);
      expect(chip).not.toBeNull();
      expect(chip!.querySelector('svg')).not.toBeNull();
      expect(chip).toHaveTextContent(label);
      expect(within(chip!.parentElement!).getByText(String(count))).toBeInTheDocument();
    }
  });

  it.each(states.filter(({ state }) => state.kind !== 'checked'))(
    'uses a neutral label and no Verdict Chip for $label',
    async ({ state, label }) => {
      const { card } = await renderCard({ state });
      const statePart = card.querySelector<HTMLElement>('[data-part="state"]');
      expect(statePart).not.toBeNull();
      expect(within(statePart!).getByText(label)).toBeInTheDocument();
      expect(statePart!.querySelector('svg')).not.toBeNull();
      expect(statePart!.querySelector('[data-verdict]')).toBeNull();
    }
  );

  it('gives every Feed Card exactly one cover, meta, state and byline', async () => {
    render(<LiveFeedPage />);
    await waitFor(() => expect(screen.getAllByRole('article')).toHaveLength(8));
    for (const card of screen.getAllByRole('article')) {
      for (const part of ['cover', 'meta', 'state', 'byline']) {
        expect(card.querySelectorAll(`[data-part="${part}"]`)).toHaveLength(1);
      }
    }
  });

  it('omits the date element and separators when publishedAt is empty', async () => {
    const { card } = await renderCard({ publishedAt: '' });
    const meta = card.querySelector('[data-part="meta"]');
    expect(meta).not.toBeNull();
    expect(meta?.textContent?.trim()).toBe('Medium');
    expect(meta?.children).toHaveLength(1);
    expect(meta?.querySelector('time')).toBeNull();
  });

  it('uses cover and state blocks in the Loading Skeleton, without a spinner', () => {
    const dataSource = dataSourceModule.getDataSource();
    vi.spyOn(dataSourceModule, 'getDataSource').mockReturnValue({
      ...dataSource,
      listFeedArticles: () => new Promise<Article[]>(() => undefined),
    });
    const { container } = render(<LiveFeedPage />);
    const skeleton = screen.getByRole('status');
    expect(skeleton).toHaveTextContent('Loading the feed');
    expect(skeleton.querySelectorAll('[data-part="cover"]')).toHaveLength(6);
    expect(skeleton.querySelectorAll('[data-part="state"]')).toHaveLength(6);
    expect(container.querySelector('.animate-spin')).toBeNull();
  });
});
