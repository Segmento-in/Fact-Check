import '@testing-library/jest-dom/vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import CheckPage from './page';
import * as dataSourceModule from '@/lib/data-source';
import { hasPercent, hasEmoji } from '@/test/text-rules';

const pushMock = vi.fn();
vi.mock('next/navigation', () => ({
  useRouter: () => ({
    push: pushMock,
  }),
}));

describe('CheckPage', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('renders correctly with no percent sign and no emoji', () => {
    const { container } = render(<CheckPage />);
    const text = container.textContent || '';
    expect(hasPercent(text)).toBe(false);
    expect(hasEmoji(text)).toBe(false);
    expect(screen.getByRole('heading', { level: 1, name: /Check a post, headline or link/i })).toBeInTheDocument();
  });

  it('shows error and sends nothing when input is empty', async () => {
    render(<CheckPage />);
    const button = screen.getByRole('button', { name: 'Check this' });

    fireEvent.click(button);

    expect(screen.getByRole('alert')).toHaveTextContent('Paste some text or a link first.');
    expect(pushMock).not.toHaveBeenCalled();
  });

  it('shows error when text is too short', async () => {
    render(<CheckPage />);
    const textarea = screen.getByPlaceholderText(/Paste a post/i);
    const button = screen.getByRole('button', { name: 'Check this' });

    fireEvent.change(textarea, { target: { value: 'Too short text' } });
    fireEvent.click(button);

    expect(screen.getByRole('alert')).toHaveTextContent('Add a little more text so we have something to check.');
    expect(pushMock).not.toHaveBeenCalled();
  });

  it('shows error when link format is invalid', async () => {
    render(<CheckPage />);
    const textarea = screen.getByPlaceholderText(/Paste a post/i);
    const button = screen.getByRole('button', { name: 'Check this' });

    fireEvent.change(textarea, { target: { value: 'https://' } });
    fireEvent.click(button);

    expect(screen.getByRole('alert')).toHaveTextContent('That link does not look right.');
    expect(pushMock).not.toHaveBeenCalled();
  });

  it('accepts valid text of 20+ chars and submits', async () => {
    render(<CheckPage />);
    const textarea = screen.getByPlaceholderText(/Paste a post/i);
    const button = screen.getByRole('button', { name: 'Check this' });

    fireEvent.change(textarea, {
      target: { value: 'This is a checkable assertion that exceeds twenty characters.' },
    });
    fireEvent.click(button);

    await waitFor(() => {
      expect(pushMock).toHaveBeenCalledWith('/report/sample-all-verdicts');
    });
  });

  it('accepts valid link and submits', async () => {
    render(<CheckPage />);
    const textarea = screen.getByPlaceholderText(/Paste a post/i);
    const button = screen.getByRole('button', { name: 'Check this' });

    fireEvent.change(textarea, {
      target: { value: 'https://reuters.com/sample/test' },
    });
    fireEvent.click(button);

    await waitFor(() => {
      expect(pushMock).toHaveBeenCalledWith('/report/sample-all-verdicts');
    });
  });

  it('routes to sample-i-wrote-this when author switch is toggled', async () => {
    render(<CheckPage />);
    const textarea = screen.getByPlaceholderText(/Paste a post/i);
    const switchEl = screen.getByRole('switch');
    const button = screen.getByRole('button', { name: 'Check this' });

    fireEvent.change(textarea, {
      target: { value: 'This is a checkable assertion that exceeds twenty characters.' },
    });
    fireEvent.click(switchEl);
    expect(switchEl).toHaveAttribute('aria-checked', 'true');

    fireEvent.click(button);

    await waitFor(() => {
      expect(pushMock).toHaveBeenCalledWith('/report/sample-i-wrote-this');
    });
  });

  it('submits on Ctrl+Enter in the textarea', async () => {
    render(<CheckPage />);
    const textarea = screen.getByPlaceholderText(/Paste a post/i);

    fireEvent.change(textarea, {
      target: { value: 'This is a checkable assertion that exceeds twenty characters.' },
    });
    fireEvent.keyDown(textarea, { key: 'Enter', ctrlKey: true });

    await waitFor(() => {
      expect(pushMock).toHaveBeenCalledWith('/report/sample-all-verdicts');
    });
  });

  it('shows Could-Not-Finish block when submitCheck rejects, keeping input, and re-sends on Try again', async () => {
    const mockSubmit = vi.fn().mockRejectedValueOnce(new Error('Network error')).mockResolvedValueOnce({ reportId: 'sample-all-verdicts' });
    vi.spyOn(dataSourceModule, 'getDataSource').mockReturnValue({
      submitCheck: mockSubmit,
      getReport: vi.fn(),
      listFeedArticles: vi.fn(),
    });

    render(<CheckPage />);
    const textarea = screen.getByPlaceholderText(/Paste a post/i);
    const button = screen.getByRole('button', { name: 'Check this' });

    fireEvent.change(textarea, {
      target: { value: 'This is a checkable assertion that exceeds twenty characters.' },
    });
    fireEvent.click(button);

    await waitFor(() => {
      expect(screen.getByText('We could not finish this check')).toBeInTheDocument();
      expect(screen.getByText('We could not send it. Nothing was checked.')).toBeInTheDocument();
    });

    // Input must stay
    expect(textarea).toHaveValue('This is a checkable assertion that exceeds twenty characters.');

    // Try again
    const tryAgainBtn = screen.getByRole('button', { name: 'Try again' });
    fireEvent.click(tryAgainBtn);

    await waitFor(() => {
      expect(pushMock).toHaveBeenCalledWith('/report/sample-all-verdicts');
    });
  });
});

