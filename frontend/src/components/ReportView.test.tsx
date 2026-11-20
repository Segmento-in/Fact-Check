import '@testing-library/jest-dom/vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { describe, it, expect } from 'vitest';
import { ReportView } from './ReportView';
import { SAMPLE_REPORTS } from '@/lib/data-source/sample-data';
import { tallyVerdicts, VERDICTS } from '@/lib/vocabulary';
import { hasPercent, hasEmoji } from '@/test/text-rules';

describe('ReportView component', () => {
  it('for each checked sample report: Count Tiles equal Claim List counts, no emoji and no percent', async () => {
    const checkedReports = SAMPLE_REPORTS.filter((r) => r.status === 'checked');

    for (const report of checkedReports) {
      const { container, unmount } = render(<ReportView id={report.id} />);

      await waitFor(() => {
        expect(screen.getByRole('heading', { level: 1, name: report.contentTitle })).toBeInTheDocument();
      });

      const text = container.textContent || '';
      expect(hasPercent(text)).toBe(false);
      expect(hasEmoji(text)).toBe(false);

      const tally = tallyVerdicts(report.claims);
      const countTilesSection = container.querySelector('[data-section="count-tiles"]');
      expect(countTilesSection).toBeInTheDocument();
      VERDICTS.forEach((v) => {
        expect(countTilesSection?.textContent).toContain(String(tally[v]));
      });

      const claimListSection = container.querySelector('[data-section="claim-list"]');
      expect(claimListSection).toBeInTheDocument();

      // Check number of claim buttons
      const claimButtons = claimListSection!.querySelectorAll('button');
      expect(claimButtons.length).toBe(report.claims.length);

      unmount();
    }
  });

  it('selecting a claim changes the selected-claim section', async () => {
    const { container } = render(<ReportView id="sample-all-verdicts" />);

    await waitFor(() => {
      expect(screen.getByRole('heading', { level: 2, name: /Harbor City council approved/ })).toBeInTheDocument();
    });

    const claimButtons = container.querySelectorAll('[data-section="claim-list"] button');
    expect(claimButtons.length).toBe(4);

    // Click the second claim
    fireEvent.click(claimButtons[1]);

    await waitFor(() => {
      expect(
        screen.getByRole('heading', { level: 2, name: /The transit measure immediately triples/ })
      ).toBeInTheDocument();
    });
  });

  it('proof cards show quote, link, page date, fetch date, and stance grouped', async () => {
    render(<ReportView id="sample-all-verdicts" />);

    await waitFor(() => {
      expect(screen.getByRole('heading', { level: 2, name: /Harbor City council approved/ })).toBeInTheDocument();
    });

    expect(screen.getAllByText(/municipal council approved the five million transit levy/).length).toBeGreaterThanOrEqual(1);
    expect(screen.getAllByText('Page date 12 Oct 2026, fetched 13 Oct 2026').length).toBeGreaterThanOrEqual(1);
  });

  it('not enough evidence reads distinctly different from false', async () => {
    render(<ReportView id="sample-not-enough" />);

    await waitFor(() => {
      expect(
        screen.getByText('We found no proof from the trusted Sources yet. This does not mean the Claim is false.')
      ).toBeInTheDocument();
    });
  });

  it('Checked by a Person appears only when flagged', async () => {
    const { container } = render(<ReportView id="sample-all-verdicts" />);

    await waitFor(() => {
      expect(screen.getByRole('heading', { level: 2, name: /Harbor City council approved/ })).toBeInTheDocument();
    });

    const claimButtons = container.querySelectorAll('[data-section="claim-list"] button');
    // First claim: checkedByPerson is false
    expect(container.querySelector('[data-section="selected-claim"]')?.textContent).not.toMatch(/Checked by a Person/);

    // Second claim: checkedByPerson is true
    fireEvent.click(claimButtons[1]);
    await waitFor(() => {
      expect(container.querySelector('[data-section="selected-claim"]')?.textContent).toMatch(/Checked by a Person/);
    });
  });

  it('Fix List renders only when iWroteThis is true and list is non-empty', async () => {
    const { unmount } = render(<ReportView id="sample-all-verdicts" />);
    await waitFor(() => {
      expect(screen.queryByText('Fix List')).not.toBeInTheDocument();
    });
    unmount();

    render(<ReportView id="sample-i-wrote-this" />);
    await waitFor(() => {
      expect(screen.getByText('Fix List')).toBeInTheDocument();
      expect(screen.getByText('"Riverbend suspension bridge was condemned yesterday due to cable fraying."')).toBeInTheDocument();
    });
  });

  it('unknown id renders Empty State', async () => {
    render(<ReportView id="unknown-report-xyz" />);

    await waitFor(() => {
      expect(screen.getByRole('heading', { level: 1, name: 'We could not find this report' })).toBeInTheDocument();
      expect(screen.getByRole('link', { name: 'Check something' })).toHaveAttribute('href', '/');
    });
  });

  it('could_not_finish report shows screen, Try again, and no Verdict Chip or tile', async () => {
    const { container } = render(<ReportView id="sample-could-not-finish" />);

    await waitFor(() => {
      expect(screen.getByRole('heading', { level: 1, name: 'We could not finish this check' })).toBeInTheDocument();
      expect(screen.getByRole('button', { name: 'Try again' })).toBeInTheDocument();
    });

    expect(container.querySelector('[data-verdict]')).toBeNull();
    expect(container.querySelector('[data-section="count-tiles"]')).toBeNull();
  });

  it('no_checkable_claims report shows message and link, no tiles or verdict', async () => {
    const { container } = render(<ReportView id="sample-no-checkable-claims" />);

    await waitFor(() => {
      expect(screen.getByRole('heading', { level: 1, name: 'Nothing here can be checked' })).toBeInTheDocument();
      expect(screen.getByRole('link', { name: 'Check something else' })).toHaveAttribute('href', '/');
    });

    expect(container.querySelector('[data-verdict]')).toBeNull();
    expect(container.querySelector('[data-section="count-tiles"]')).toBeNull();
  });
});

