import React from "react";
import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { LiveFeed, LOADING_TEXT, EMPTY_TEXT } from "./LiveFeed";

describe("LiveFeed Component", () => {
  beforeEach(() => {
    vi.restoreAllMocks();
  });

  // Test 4: Unchecked reports show "Not checked yet" and never show verdict labels
  it("shows 'Not checked yet' on every card and no verdict labels for unchecked reports", async () => {
    // Bug caught: fake verdict on an unchecked Article
    const uncheckedResponse = {
      articles: [
        {
          article: {
            id: "hn_1",
            hn_id: 101,
            title: "Unchecked Tech Headline 1",
            url: "https://example.com/1",
            published_at: "2026-11-09T10:00:00Z",
            hn_score: 45,
            source: "Hacker News",
            image_url: null,
            category: null,
          },
          extraction: {
            status: "ok",
            word_count: 250,
            text_preview: "Article text preview...",
            final_url: null,
          },
          checked: false,
          overall_verdict_key: null,
          overall_confidence: null,
          claims: [],
          skipped_statements: [],
        },
        {
          article: {
            id: "hn_2",
            hn_id: 102,
            title: "Unchecked Tech Headline 2",
            url: "https://example.com/2",
            published_at: "2026-11-09T11:00:00Z",
            hn_score: 88,
            source: "Hacker News",
            image_url: null,
            category: null,
          },
          extraction: {
            status: "too_short",
            word_count: 40,
            text_preview: "",
            final_url: null,
          },
          checked: false,
          overall_verdict_key: null,
          overall_confidence: null,
          claims: [],
          skipped_statements: [],
        },
      ],
      total: 2,
      cached: false,
    };

    vi.spyOn(globalThis, "fetch").mockResolvedValueOnce({
      ok: true,
      json: async () => uncheckedResponse,
    } as Response);

    render(<LiveFeed />);

    await waitFor(() => {
      expect(screen.queryByTestId("loading-indicator")).not.toBeInTheDocument();
    });

    const uncheckedChips = screen.getAllByTestId("unchecked-chip");
    expect(uncheckedChips).toHaveLength(2);
    uncheckedChips.forEach((chip) => {
      expect(chip).toHaveTextContent("Not checked yet");
    });

    // Ensure none of the verdict labels leak into unchecked cards
    expect(screen.queryByText("Verified with evidence")).not.toBeInTheDocument();
    expect(screen.queryByText("Evidence says this is false")).not.toBeInTheDocument();
    expect(
      screen.queryByText("Evidence shows only part of this is true")
    ).not.toBeInTheDocument();
    expect(screen.queryByText("Not enough evidence yet")).not.toBeInTheDocument();
  });

  // Test 5: Checked report displays verdict label and confidence word
  it("shows 'Verified with evidence' and 'High' when checked=true with supported verdict", async () => {
    // Bug caught: the verdict mapping is not wired
    const checkedResponse = {
      articles: [
        {
          article: {
            id: "hn_3",
            hn_id: 103,
            title: "Verified Autonomous Agent Discovery",
            url: "https://example.com/agent-discovery",
            published_at: "2026-11-09T09:00:00Z",
            hn_score: 210,
            source: "Hacker News",
            image_url: null,
            category: "ai",
          },
          extraction: {
            status: "ok",
            word_count: 850,
            text_preview: "Independent tests confirmed the findings...",
            final_url: null,
          },
          checked: true,
          overall_verdict_key: "supported",
          overall_confidence: "High",
          claims: [],
          skipped_statements: [],
        },
      ],
      total: 1,
      cached: false,
    };

    vi.spyOn(globalThis, "fetch").mockResolvedValueOnce({
      ok: true,
      json: async () => checkedResponse,
    } as Response);

    render(<LiveFeed />);

    await waitFor(() => {
      expect(screen.getByText("Verified with evidence")).toBeInTheDocument();
    });

    expect(screen.getByTestId("confidence-word")).toHaveTextContent("High");
    expect(screen.queryByTestId("unchecked-chip")).not.toBeInTheDocument();
  });

  // Test 6: Unknown verdict key renders "Unknown verdict" without crashing
  it("renders 'Unknown verdict' without crashing when verdict key is unrecognized", async () => {
    // Bug caught: silent wrong label or crash on unexpected key
    const warnSpy = vi.spyOn(console, "warn").mockImplementation(() => {});

    const unknownVerdictResponse = {
      articles: [
        {
          article: {
            id: "hn_4",
            hn_id: 104,
            title: "Mysterious Future Architecture",
            url: "https://example.com/future",
            published_at: null,
            hn_score: 15,
            source: "Hacker News",
          },
          extraction: {
            status: "ok",
            word_count: 120,
            text_preview: "Text preview",
          },
          checked: true,
          overall_verdict_key: "unrecognized_future_key",
          overall_confidence: "Low",
          claims: [],
          skipped_statements: [],
        },
      ],
      total: 1,
      cached: false,
    };

    vi.spyOn(globalThis, "fetch").mockResolvedValueOnce({
      ok: true,
      json: async () => unknownVerdictResponse,
    } as Response);

    render(<LiveFeed />);

    await waitFor(() => {
      expect(screen.getByText("Unknown verdict")).toBeInTheDocument();
    });

    expect(warnSpy).toHaveBeenCalledWith(
      expect.stringContaining('Unknown verdict key: "unrecognized_future_key"')
    );

    warnSpy.mockRestore();
  });

  // Test 7: Loading state, empty state, and fetch error with Retry flow
  it("shows loading text, handles empty lists, and handles error state with retry", async () => {
    // Bug caught: blank screen or dead end on failure
    let resolveFirstFetch: (value: Response) => void;
    const firstFetchPromise = new Promise<Response>((resolve) => {
      resolveFirstFetch = resolve;
    });

    const fetchSpy = vi
      .spyOn(globalThis, "fetch")
      .mockReturnValueOnce(firstFetchPromise);

    render(<LiveFeed />);

    // 1. Loading text must match exact prompt requirement
    expect(screen.getByText(LOADING_TEXT)).toBeInTheDocument();

    // 2. Resolve first fetch as an error
    resolveFirstFetch!({
      ok: false,
      status: 503,
      statusText: "Service Unavailable",
    } as Response);

    await waitFor(() => {
      expect(screen.getByTestId("error-container")).toBeInTheDocument();
    });
    expect(screen.getByText(/503 Service Unavailable/i)).toBeInTheDocument();

    // 3. Setup second fetch to resolve with empty list
    fetchSpy.mockResolvedValueOnce({
      ok: true,
      json: async () => ({ articles: [], total: 0, cached: false }),
    } as Response);

    const retryButton = screen.getByTestId("retry-button");
    await userEvent.click(retryButton);

    await waitFor(() => {
      expect(screen.getByText(EMPTY_TEXT)).toBeInTheDocument();
    });
  });

  // Test 8: Medium article (hn_id 0) shows no score; Hacker News shows its score
  it("shows no score for Medium articles (hn_id 0) and displays score for Hacker News", async () => {
    // Bug caught: fake zeros on Medium articles
    const mixedFeedsResponse = {
      articles: [
        {
          article: {
            id: "med_123",
            hn_id: 0,
            title: "Medium Editorial on Neural Nets",
            url: "https://medium.com/@dev/neural-nets",
            published_at: "2026-11-09T08:00:00Z",
            hn_score: 0,
            source: "Medium",
          },
          extraction: { status: "ok", word_count: 500, text_preview: "Summary..." },
          checked: false,
        },
        {
          article: {
            id: "hn_501",
            hn_id: 501,
            title: "Hacker News Story With Real Points",
            url: "https://news.ycombinator.com/item?id=501",
            published_at: "2026-11-09T07:30:00Z",
            hn_score: 93,
            source: "Hacker News",
          },
          extraction: { status: "ok", word_count: 600, text_preview: "Details..." },
          checked: false,
        },
      ],
      total: 2,
      cached: false,
    };

    vi.spyOn(globalThis, "fetch").mockResolvedValueOnce({
      ok: true,
      json: async () => mixedFeedsResponse,
    } as Response);

    render(<LiveFeed />);

    await waitFor(() => {
      expect(screen.getByText("Medium Editorial on Neural Nets")).toBeInTheDocument();
    });

    // Hacker news card displays real score
    expect(screen.getByTestId("hn-score")).toHaveTextContent("Score 93");

    // Medium card does NOT display "Score 0"
    expect(screen.queryByText(/Score 0/i)).not.toBeInTheDocument();
  });

  // Test 9: Script-URL injection prevented; valid https has rel="noopener noreferrer"
  it("renders 'javascript:alert(1)' as text and secure https url as link with rel='noopener noreferrer'", async () => {
    // Bug caught: script-URL injection from an external Feed
    const urlSecurityResponse = {
      articles: [
        {
          article: {
            id: "malicious_1",
            hn_id: 111,
            title: "Malicious Script Link",
            url: "javascript:alert(1)",
            source: "Hacker News",
          },
          extraction: { status: "fetch_failed", word_count: 0, text_preview: "" },
          checked: false,
        },
        {
          article: {
            id: "safe_2",
            hn_id: 222,
            title: "Legitimate HTTPS Source",
            url: "https://reuters.com/investigation",
            source: "Hacker News",
          },
          extraction: { status: "ok", word_count: 400, text_preview: "Good preview" },
          checked: false,
        },
      ],
      total: 2,
      cached: false,
    };

    vi.spyOn(globalThis, "fetch").mockResolvedValueOnce({
      ok: true,
      json: async () => urlSecurityResponse,
    } as Response);

    render(<LiveFeed />);

    await waitFor(() => {
      expect(screen.getByText("Malicious Script Link")).toBeInTheDocument();
    });

    // Malicious link must NOT render as an anchor element
    const maliciousAnchor = screen.queryByRole("link", {
      name: "Malicious Script Link",
    });
    expect(maliciousAnchor).toBeNull();

    // Valid HTTPS link must render with target="_blank" and rel="noopener noreferrer"
    const safeAnchor = screen.getByRole("link", {
      name: "Legitimate HTTPS Source",
    });
    expect(safeAnchor).toHaveAttribute("href", "https://reuters.com/investigation");
    expect(safeAnchor).toHaveAttribute("target", "_blank");
    expect(safeAnchor).toHaveAttribute("rel", "noopener noreferrer");
  });

  // Test 10: Race condition: older request resolving late does not overwrite newer response
  it("does not overwrite a newer response with an older request's late response", async () => {
    // Bug caught: out-of-order responses overwriting latest data
    let resolveFirstFetch!: (value: Response) => void;
    const firstFetchPromise = new Promise<Response>((resolve) => {
      resolveFirstFetch = resolve;
    });

    const articlesEarly = [
      {
        article: {
          id: "hn_newer",
          hn_id: 202,
          title: "Newer Article From Fast Request",
          url: "https://example.com/newer",
          published_at: "2026-11-09T12:00:00Z",
          hn_score: 99,
          source: "Hacker News",
        },
        extraction: { status: "ok", word_count: 300, text_preview: "Newer preview" },
        checked: false,
      },
    ];

    const articlesLate = [
      {
        article: {
          id: "hn_older",
          hn_id: 101,
          title: "Stale Article From Slow Request",
          url: "https://example.com/older",
          published_at: "2026-11-09T10:00:00Z",
          hn_score: 10,
          source: "Hacker News",
        },
        extraction: { status: "ok", word_count: 100, text_preview: "Older preview" },
        checked: false,
      },
    ];

    // Spy on fetch:
    // First call (mount): returns firstFetchPromise (slow)
    // Second call (Refresh Feed click): resolves fast with articlesEarly
    vi.spyOn(globalThis, "fetch")
      .mockReturnValueOnce(firstFetchPromise)
      .mockResolvedValueOnce({
        ok: true,
        json: async () => ({ articles: articlesEarly, total: 1, cached: false }),
      } as Response);

    render(<LiveFeed />);

    // Initial fetch is in flight. UI displays loading indicator.
    expect(screen.getByText(LOADING_TEXT)).toBeInTheDocument();

    // User triggers second fetch via Refresh Feed button
    const refreshButton = screen.getByRole("button", { name: "Refresh Feed" });
    await userEvent.click(refreshButton);

    // Wait for the faster second fetch to render
    await waitFor(() => {
      expect(
        screen.getByText("Newer Article From Fast Request")
      ).toBeInTheDocument();
    });

    // Now resolve the older first fetch late
    resolveFirstFetch({
      ok: true,
      json: async () => ({ articles: articlesLate, total: 1, cached: false }),
    } as Response);

    // Verify UI still displays newer article and does NOT revert to stale older article
    await waitFor(() => {
      expect(
        screen.getByText("Newer Article From Fast Request")
      ).toBeInTheDocument();
    });
    expect(
      screen.queryByText("Stale Article From Slow Request")
    ).not.toBeInTheDocument();
  });
});

