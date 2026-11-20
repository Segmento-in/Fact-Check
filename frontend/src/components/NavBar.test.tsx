import '@testing-library/jest-dom/vitest';
import { render, screen } from '@testing-library/react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { NavBar } from './NavBar';
import { usePathname } from 'next/navigation';

vi.mock('next/navigation', () => ({
  usePathname: vi.fn(),
}));

describe('NavBar', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('renders the brand text "Fact Checker"', () => {
    vi.mocked(usePathname).mockReturnValue('/');
    render(<NavBar />);
    expect(screen.getByText('Fact Checker')).toBeInTheDocument();
  });

  it('renders a link "Check" with href "/" and a link "Live Feed" with href "/feed"', () => {
    vi.mocked(usePathname).mockReturnValue('/');
    render(<NavBar />);
    const checkLink = screen.getByRole('link', { name: 'Check' });
    const feedLink = screen.getByRole('link', { name: 'Live Feed' });

    expect(checkLink).toHaveAttribute('href', '/');
    expect(feedLink).toHaveAttribute('href', '/feed');
  });

  it('when path is /feed, "Live Feed" has aria-current="page" and "Check" has none', () => {
    vi.mocked(usePathname).mockReturnValue('/feed');
    render(<NavBar />);
    const checkLink = screen.getByRole('link', { name: 'Check' });
    const feedLink = screen.getByRole('link', { name: 'Live Feed' });

    expect(feedLink).toHaveAttribute('aria-current', 'page');
    expect(checkLink).not.toHaveAttribute('aria-current');
  });

  it('when path is /, "Check" has aria-current="page" and "Live Feed" has none', () => {
    vi.mocked(usePathname).mockReturnValue('/');
    render(<NavBar />);
    const checkLink = screen.getByRole('link', { name: 'Check' });
    const feedLink = screen.getByRole('link', { name: 'Live Feed' });

    expect(checkLink).toHaveAttribute('aria-current', 'page');
    expect(feedLink).not.toHaveAttribute('aria-current');
  });

  it('a "Skip to content" link is the first focusable element and points to #main', () => {
    vi.mocked(usePathname).mockReturnValue('/');
    render(<NavBar />);
    const allLinks = screen.getAllByRole('link');
    const firstLink = allLinks[0];

    expect(firstLink).toHaveTextContent('Skip to content');
    expect(firstLink).toHaveAttribute('href', '#main');
  });
});

