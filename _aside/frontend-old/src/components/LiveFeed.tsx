"use client";

import React, { useEffect, useState, useCallback, useRef } from "react";
import { ArticleReport, fetchArticles } from "../lib/contract";
import { ArticleCard } from "./ArticleCard";

export const LOADING_TEXT = "Reading the latest Articles...";
export const EMPTY_TEXT = "No articles available right now.";

export const LiveFeed: React.FC = () => {
  const [reports, setReports] = useState<ArticleReport[]>([]);
  const [loading, setLoading] = useState<boolean>(true);
  const [error, setError] = useState<string | null>(null);
  const requestIdRef = useRef<number>(0);

  const loadFeed = useCallback(async () => {
    const currentRequestId = ++requestIdRef.current;
    setLoading(true);
    setError(null);
    try {
      const response = await fetchArticles(20);
      if (currentRequestId === requestIdRef.current) {
        setReports(response.articles);
      }
    } catch (err: unknown) {
      if (currentRequestId === requestIdRef.current) {
        const message =
          err instanceof Error ? err.message : "Unable to reach the Fact Checker backend.";
        setError(message);
      }
    } finally {
      if (currentRequestId === requestIdRef.current) {
        setLoading(false);
      }
    }
  }, []);

  useEffect(() => {
    let ignore = false;
    const currentRequestId = ++requestIdRef.current;

    async function initialFetch() {
      try {
        const response = await fetchArticles(20);
        if (!ignore && currentRequestId === requestIdRef.current) {
          setReports(response.articles);
        }
      } catch (err: unknown) {
        if (!ignore && currentRequestId === requestIdRef.current) {
          const message =
            err instanceof Error ? err.message : "Unable to reach the Fact Checker backend.";
          setError(message);
        }
      } finally {
        if (!ignore && currentRequestId === requestIdRef.current) {
          setLoading(false);
        }
      }
    }

    void initialFetch();

    return () => {
      ignore = true;
    };
  }, []);

  return (
    <div className="min-h-screen bg-[#f8fafd] text-[#061b31]">
      {/* Header */}
      <header className="sticky top-0 z-40 bg-white/95 backdrop-blur border-b border-[#e5edf5]">
        <div className="max-w-7xl mx-auto flex items-center justify-between px-4 sm:px-6 py-4">
          <div className="flex items-center gap-3">
            <h1 className="text-xl font-medium tracking-tight text-[#061b31]">
              Fact Checker
            </h1>
            <span className="text-xs font-mono px-2 py-0.5 rounded-[4px] bg-[#f1f5f9] text-[#475569]">
              Live Feed
            </span>
          </div>

          <button
            type="button"
            onClick={loadFeed}
            className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium text-[#533afd] bg-white border border-[#b9b9f9] hover:border-[#675dff] rounded-[4px] transition-colors"
          >
            Refresh Feed
          </button>
        </div>
      </header>

      {/* Main Content Area */}
      <main className="max-w-7xl mx-auto px-4 sm:px-6 py-8">
        {/* Loading State */}
        {loading && (
          <div
            data-testid="loading-indicator"
            className="p-12 text-center rounded-[6px] bg-white border border-[#e5edf5] shadow-sm my-6 space-y-2"
          >
            <p className="text-sm font-medium text-[#061b31] animate-pulse">
              {LOADING_TEXT}
            </p>
          </div>
        )}

        {/* Error State */}
        {!loading && error && (
          <div
            data-testid="error-container"
            className="p-8 text-center rounded-[6px] bg-[#fff1f2] border border-[#fecdd3] shadow-sm my-6 space-y-4"
          >
            <div className="space-y-1">
              <h2 className="text-base font-semibold text-[#9f1239]">
                Unable to load articles
              </h2>
              <p className="text-xs text-[#be123c] font-mono">{error}</p>
            </div>
            <button
              type="button"
              onClick={loadFeed}
              data-testid="retry-button"
              className="px-4 py-2 text-xs font-medium text-white bg-[#533afd] hover:bg-[#4434d4] rounded-[4px] transition-colors shadow-sm"
            >
              Retry
            </button>
          </div>
        )}

        {/* Empty State */}
        {!loading && !error && reports.length === 0 && (
          <div
            data-testid="empty-indicator"
            className="p-12 text-center rounded-[6px] bg-white border border-[#e5edf5] shadow-sm my-6"
          >
            <p className="text-sm text-[#64748d]">{EMPTY_TEXT}</p>
          </div>
        )}

        {/* Article Cards Grid */}
        {!loading && !error && reports.length > 0 && (
          <div
            data-testid="articles-grid"
            className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6"
          >
            {reports.map((report, idx) => (
              <ArticleCard
                key={report.article.id || `${report.article.url}-${idx}`}
                report={report}
              />
            ))}
          </div>
        )}
      </main>
    </div>
  );
};

