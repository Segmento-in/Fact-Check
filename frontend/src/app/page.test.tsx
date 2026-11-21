import '@testing-library/jest-dom/vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import CheckPage from './page';
import * as dataSourceModule from '@/lib/data-source';
import { hasPercent, hasEmoji } from '@/test/text-rules';
import { getContrastBetweenTokens } from '@/lib/contrast';
import {
  CONTENT_KIND_ORDER,
  CONTENT_KIND_FIELD_LABEL,
  CONTENT_KIND_PLACEHOLDER,
  CONTENT_KIND_HELP,
} from '@/lib/vocabulary';

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

  it('renders correctly with no percent sign and no emoji in every kind', () => {
    const { container } = render(<CheckPage />);

    for (const kind of CONTENT_KIND_ORDER) {
      const radio = screen.getByDisplayValue(kind);
      fireEvent.click(radio);
      const text = container.textContent || '';
      expect(hasPercent(text)).toBe(false);
      expect(hasEmoji(text)).toBe(false);
    }
  });

  it('default submit sends contentKind: "claim_or_text"', async () => {
    const mockSubmit = vi.fn().mockResolvedValue({ reportId: 'sample-all-verdicts' });
    vi.spyOn(dataSourceModule, 'getDataSource').mockReturnValue({
      submitCheck: mockSubmit,
      getReport: vi.fn(),
      listFeedArticles: vi.fn(),
    });

    render(<CheckPage />);
    const textarea = screen.getByPlaceholderText(CONTENT_KIND_PLACEHOLDER.claim_or_text);
    const button = screen.getByRole('button', { name: 'Check this' });

    fireEvent.change(textarea, {
      target: { value: 'This is a checkable claim that exceeds twenty characters.' },
    });
    fireEvent.click(button);

    await waitFor(() => {
      expect(mockSubmit).toHaveBeenCalledWith({
        text: 'This is a checkable claim that exceeds twenty characters.',
        iWroteThis: false,
        contentKind: 'claim_or_text',
      });
      expect(pushMock).toHaveBeenCalledWith('/report/sample-all-verdicts');
    });
  });

  it('Article link plus text shows its message and sends nothing', async () => {
    const mockSubmit = vi.fn();
    vi.spyOn(dataSourceModule, 'getDataSource').mockReturnValue({
      submitCheck: mockSubmit,
      getReport: vi.fn(),
      listFeedArticles: vi.fn(),
    });

    render(<CheckPage />);
    const radio = screen.getByLabelText('Article link');
    fireEvent.click(radio);

    const textarea = screen.getByPlaceholderText(CONTENT_KIND_PLACEHOLDER.article_link);
    const button = screen.getByRole('button', { name: 'Check this' });

    fireEvent.change(textarea, { target: { value: 'Not a link at all, just plain text here.' } });
    fireEvent.click(button);

    expect(screen.getByRole('alert')).toHaveTextContent(
      'Paste a link that starts with http:// or https://.'
    );
    expect(mockSubmit).not.toHaveBeenCalled();
    expect(pushMock).not.toHaveBeenCalled();
  });

  it('Article link plus a link sends article_link', async () => {
    const mockSubmit = vi.fn().mockResolvedValue({ reportId: 'sample-all-verdicts' });
    vi.spyOn(dataSourceModule, 'getDataSource').mockReturnValue({
      submitCheck: mockSubmit,
      getReport: vi.fn(),
      listFeedArticles: vi.fn(),
    });

    render(<CheckPage />);
    const radio = screen.getByLabelText('Article link');
    fireEvent.click(radio);

    const textarea = screen.getByPlaceholderText(CONTENT_KIND_PLACEHOLDER.article_link);
    const button = screen.getByRole('button', { name: 'Check this' });

    fireEvent.change(textarea, { target: { value: 'https://apnews.com/article/local-story-123' } });
    fireEvent.click(button);

    await waitFor(() => {
      expect(mockSubmit).toHaveBeenCalledWith({
        text: 'https://apnews.com/article/local-story-123',
        iWroteThis: false,
        contentKind: 'article_link',
      });
      expect(pushMock).toHaveBeenCalledWith('/report/sample-all-verdicts');
    });
  });

  it('Headline plus a link shows its message', async () => {
    const mockSubmit = vi.fn();
    vi.spyOn(dataSourceModule, 'getDataSource').mockReturnValue({
      submitCheck: mockSubmit,
      getReport: vi.fn(),
      listFeedArticles: vi.fn(),
    });

    render(<CheckPage />);
    const radio = screen.getByLabelText('Headline');
    fireEvent.click(radio);

    const textarea = screen.getByPlaceholderText(CONTENT_KIND_PLACEHOLDER.headline);
    const button = screen.getByRole('button', { name: 'Check this' });

    fireEvent.change(textarea, { target: { value: 'https://reuters.com/news/story' } });
    fireEvent.click(button);

    expect(screen.getByRole('alert')).toHaveTextContent(
      'A headline is text, not a link. Choose Article link for a link.'
    );
    expect(mockSubmit).not.toHaveBeenCalled();
  });

  it('changing kind keeps typed text and clears the error', async () => {
    render(<CheckPage />);
    const button = screen.getByRole('button', { name: 'Check this' });

    // Empty click triggers error
    fireEvent.click(button);
    expect(screen.getByRole('alert')).toHaveTextContent('Paste some text or a link first.');

    // Type text
    const textarea = screen.getByPlaceholderText(CONTENT_KIND_PLACEHOLDER.claim_or_text);
    fireEvent.change(textarea, { target: { value: 'Retained draft text' } });

    // Switch to Social post
    const socialRadio = screen.getByLabelText('Social post');
    fireEvent.click(socialRadio);

    // Text is preserved and error is cleared
    expect(textarea).toHaveValue('Retained draft text');
    expect(screen.queryByRole('alert')).not.toBeInTheDocument();
  });

  it('placeholder and label change per kind', () => {
    const { container } = render(<CheckPage />);

    CONTENT_KIND_ORDER.forEach((kind) => {
      const radio = screen.getByDisplayValue(kind);
      fireEvent.click(radio);

      const fieldLabel = container.querySelector('label[for="check-input"]');
      expect(fieldLabel).toHaveTextContent(CONTENT_KIND_FIELD_LABEL[kind]);
      expect(
        screen.getByPlaceholderText(CONTENT_KIND_PLACEHOLDER[kind])
      ).toBeInTheDocument();
      expect(container.querySelector('#check-help')).toHaveTextContent(
        CONTENT_KIND_HELP[kind]
      );
    });
  });

  it('a rejected submitCheck shows Could Not Finish and Try again re-sends with the same kind', async () => {
    const mockSubmit = vi
      .fn()
      .mockRejectedValueOnce(new Error('Network failure'))
      .mockResolvedValueOnce({ reportId: 'sample-all-verdicts' });

    vi.spyOn(dataSourceModule, 'getDataSource').mockReturnValue({
      submitCheck: mockSubmit,
      getReport: vi.fn(),
      listFeedArticles: vi.fn(),
    });

    render(<CheckPage />);
    // Select Social post
    fireEvent.click(screen.getByLabelText('Social post'));

    const textarea = screen.getByPlaceholderText(CONTENT_KIND_PLACEHOLDER.social_post);
    const button = screen.getByRole('button', { name: 'Check this' });

    fireEvent.change(textarea, {
      target: { value: 'A forwarded post from a neighborhood discussion group.' },
    });
    fireEvent.click(button);

    await waitFor(() => {
      expect(screen.getByText('We could not finish this check')).toBeInTheDocument();
      expect(screen.getByText('We could not send it. Nothing was checked.')).toBeInTheDocument();
    });

    // Try again
    const tryAgainBtn = screen.getByRole('button', { name: 'Try again' });
    fireEvent.click(tryAgainBtn);

    await waitFor(() => {
      expect(mockSubmit).toHaveBeenCalledTimes(2);
      expect(mockSubmit).toHaveBeenLastCalledWith({
        text: 'A forwarded post from a neighborhood discussion group.',
        iWroteThis: false,
        contentKind: 'social_post',
      });
      expect(pushMock).toHaveBeenCalledWith('/report/sample-all-verdicts');
    });
  });

  it('verifies color contrast: ink on white, ink-secondary on white, and primary border on white at least 3.0', () => {
    const inkRatio = getContrastBetweenTokens('ink', 'canvas');
    const inkSecRatio = getContrastBetweenTokens('ink-secondary', 'canvas');
    const primaryBorderRatio = getContrastBetweenTokens('primary', 'canvas');

    console.info(`[Selector Contrast] ink on canvas: ${inkRatio.toFixed(2)}:1`);
    console.info(`[Selector Contrast] ink-secondary on canvas: ${inkSecRatio.toFixed(2)}:1`);
    console.info(`[Selector Contrast] primary border on canvas: ${primaryBorderRatio.toFixed(2)}:1`);

    expect(inkRatio).toBeGreaterThanOrEqual(4.5);
    expect(inkSecRatio).toBeGreaterThanOrEqual(4.5);
    expect(primaryBorderRatio).toBeGreaterThanOrEqual(3.0);
  });
});
