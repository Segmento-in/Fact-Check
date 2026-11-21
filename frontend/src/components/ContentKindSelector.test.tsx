import '@testing-library/jest-dom/vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { describe, it, expect, vi } from 'vitest';
import { ContentKindSelector } from './ContentKindSelector';
import { CONTENT_KIND_ORDER, CONTENT_KIND_LABEL } from '@/lib/vocabulary';

describe('ContentKindSelector component', () => {
  it('renders a fieldset with visible legend "What are you checking?"', () => {
    render(<ContentKindSelector value="claim_or_text" onChange={vi.fn()} />);
    const legend = screen.getByText('What are you checking?');
    expect(legend).toBeInTheDocument();
  });

  it('renders all four radio options in exact required order', () => {
    render(<ContentKindSelector value="claim_or_text" onChange={vi.fn()} />);
    const radios = screen.getAllByRole('radio');
    expect(radios.length).toBe(4);

    CONTENT_KIND_ORDER.forEach((kind, idx) => {
      expect(radios[idx]).toHaveAttribute('value', kind);
      expect(screen.getByText(CONTENT_KIND_LABEL[kind])).toBeInTheDocument();
    });
  });

  it('selects the default Claim or text option', () => {
    render(<ContentKindSelector value="claim_or_text" onChange={vi.fn()} />);
    const radios = screen.getAllByRole('radio');
    expect(radios[0]).toBeChecked();
    expect(radios[1]).not.toBeChecked();
    expect(radios[2]).not.toBeChecked();
    expect(radios[3]).not.toBeChecked();
  });

  it('calls onChange with selected kind when an option is clicked', () => {
    const handleChange = vi.fn();
    render(<ContentKindSelector value="claim_or_text" onChange={handleChange} />);

    const articleLinkRadio = screen.getByLabelText('Article link');
    fireEvent.click(articleLinkRadio);

    expect(handleChange).toHaveBeenCalledWith('article_link');
  });

  it('disables all radio inputs when disabled prop is true', () => {
    render(<ContentKindSelector value="claim_or_text" onChange={vi.fn()} disabled />);
    const radios = screen.getAllByRole('radio');
    radios.forEach((radio) => {
      expect(radio).toBeDisabled();
    });
  });

  it('renders an icon alongside each label', () => {
    const { container } = render(
      <ContentKindSelector value="claim_or_text" onChange={vi.fn()} />
    );
    const svgs = container.querySelectorAll('svg');
    expect(svgs.length).toBe(4);
  });
});

