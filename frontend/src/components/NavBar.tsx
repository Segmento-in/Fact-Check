"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

export function NavBar() {
  const pathname = usePathname();

  // ponytail: static pathname comparison is minimal and fast; revisit if nested /feed/[id] or query params are introduced
  const isCheckActive = pathname === "/";
  const isFeedActive = pathname === "/feed";

  return (
    <header className="h-16 w-full bg-[var(--color-canvas)] border-b border-[var(--color-hairline)] shrink-0">
      <a
        href="#main"
        className="sr-only focus:not-sr-only focus:fixed focus:top-4 focus:left-4 focus:z-50 focus:px-4 focus:py-2 focus:bg-[var(--color-canvas)] focus:text-[var(--color-primary)] focus:outline-2 focus:outline-[var(--color-primary-soft)] focus:outline-offset-2 focus:rounded-md focus:shadow-[var(--shadow-card)] font-medium text-sm"
      >
        Skip to content
      </a>
      <div className="max-w-[1200px] h-full mx-auto px-6 flex items-center justify-between whitespace-nowrap">
        <span className="text-lg font-medium text-[var(--color-ink)] tracking-tight select-none">
          Fact Checker
        </span>
        <nav aria-label="Main Navigation" className="flex items-center gap-6">
          <Link
            href="/"
            aria-current={isCheckActive ? "page" : undefined}
            className={`text-sm transition-colors focus-visible:outline-2 focus-visible:outline-[var(--color-primary-soft)] focus-visible:outline-offset-2 rounded-sm ${
              isCheckActive
                ? "text-[var(--color-primary)] font-medium"
                : "text-[var(--color-ink-secondary)] font-normal hover:text-[var(--color-ink)]"
            }`}
          >
            Check
          </Link>
          <Link
            href="/feed"
            aria-current={isFeedActive ? "page" : undefined}
            className={`text-sm transition-colors focus-visible:outline-2 focus-visible:outline-[var(--color-primary-soft)] focus-visible:outline-offset-2 rounded-sm ${
              isFeedActive
                ? "text-[var(--color-primary)] font-medium"
                : "text-[var(--color-ink-secondary)] font-normal hover:text-[var(--color-ink)]"
            }`}
          >
            Live Feed
          </Link>
        </nav>
      </div>
    </header>
  );
}
