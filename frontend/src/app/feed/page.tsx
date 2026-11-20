'use client';

import React from 'react';
import Link from 'next/link';
import {
  RefreshCw,
  TrendingUp,
  Clock,
  Hourglass,
  CircleMinus,
  CircleAlert,
} from 'lucide-react';
import { getDataSource } from '@/lib/data-source';
import { useLoad } from '@/lib/use-load';
import { VerdictChip } from '@/components/VerdictChip';
import { formatDate } from '@/lib/format';
import { VERDICTS, ICON_STROKE } from '@/lib/vocabulary';
import type { Article } from '@/lib/contract';

export default function LiveFeedPage() {
  const {
    status,
    data: articles,
    retry,
  } = useLoad(() => getDataSource().listFeedArticles());

  return (
    <div className="min-h-[calc(100vh-64px)] bg-canvas-soft py-10 px-4 sm:px-6">
      <div className="max-w-[1200px] mx-auto">
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 pb-8 border-b border-hairline">
          <div>
            <h1 className="text-3xl sm:text-4xl font-light text-ink tracking-tight">
              Live Feed
            </h1>
            <p className="text-ink-secondary text-base font-light mt-1">
              Articles we check by ourselves. You only read.
            </p>
          </div>
          <button
            type="button"
            disabled={status === 'loading'}
            onClick={retry}
            className="inline-flex items-center justify-center gap-2 rounded-pill bg-canvas text-ink border border-hairline-input hover:border-primary-soft px-5 py-2 font-medium text-sm transition-colors disabled:opacity-60 focus:outline-none focus:ring-2 focus:ring-primary-soft"
          >
            <RefreshCw
              size={14}
              strokeWidth={ICON_STROKE}
              className={status === 'loading' ? 'animate-spin' : ''}
              aria-hidden="true"
            />
            <span>Refresh Feed</span>
          </button>
        </div>

        {status === 'loading' && (
          <div
            role="status"
            className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6 mt-8 animate-pulse motion-reduce:animate-none"
          >
            <span className="sr-only">Loading the feed</span>
            {Array.from({ length: 6 }).map((_, i) => (
              <div
                key={i}
                className="bg-canvas rounded-lg p-5 border border-hairline h-48 flex flex-col justify-between"
              >
                <div className="space-y-3">
                  <div className="h-4 bg-hairline rounded w-1/3" />
                  <div className="h-5 bg-hairline rounded w-5/6" />
                </div>
                <div className="h-6 bg-hairline rounded w-1/2" />
              </div>
            ))}
          </div>
        )}

        {status === 'error' && (
          <div
            role="alert"
            className="bg-canvas rounded-lg p-8 border border-hairline text-center my-12 max-w-md mx-auto"
          >
            <h2 className="text-lg font-medium text-ink">
              We could not load the Feed
            </h2>
            <button
              type="button"
              onClick={retry}
              className="mt-4 rounded-pill border border-hairline-input bg-canvas px-5 py-2 text-sm font-medium text-ink hover:border-primary-soft transition-colors focus:outline-none focus:ring-2 focus:ring-primary-soft"
            >
              Try again
            </button>
          </div>
        )}

        {status === 'ready' && articles && articles.length === 0 && (
          <div className="bg-canvas rounded-lg p-12 border border-hairline text-center my-12">
            <p className="text-ink-secondary text-base">
              No Articles yet. Try Refresh Feed.
            </p>
          </div>
        )}

        {status === 'ready' && articles && articles.length > 0 && (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6 mt-8">
            {articles.map((article) => (
              <FeedCard key={article.id} article={article} />
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

function FeedCard({ article }: { article: Article }) {
  const { state } = article;
  const reportId = 'reportId' in state ? state.reportId : null;

  return (
    <article className="bg-canvas rounded-lg shadow-card border border-hairline p-5 flex flex-col justify-between text-left">
      <div>
        <div className="flex items-center justify-between text-xs text-ink-mute mb-3">
          <span className="font-normal truncate max-w-[65%]">
            {article.publisher} · {formatDate(article.publishedAt)}
          </span>
          <span className="font-mono flex items-center gap-1 shrink-0">
            <TrendingUp size={12} strokeWidth={ICON_STROKE} aria-hidden="true" />
            <span>Feed Score {article.feedScore}</span>
          </span>
        </div>

        <h2 className="text-lg font-light text-ink tracking-tight leading-snug">
          {reportId ? (
            <Link
              href={`/report/${reportId}`}
              className="hover:underline focus:outline-none focus:ring-2 focus:ring-primary-soft rounded-sm"
            >
              {article.headline}
            </Link>
          ) : (
            <span>{article.headline}</span>
          )}
        </h2>
      </div>

      <div className="pt-4 mt-4 border-t border-hairline flex flex-wrap items-center gap-2">
        {state.kind === 'checked' ? (
          <div className="flex flex-wrap items-center gap-2">
            {VERDICTS.map((v) => {
              const count = state.tally[v];
              if (!count || count <= 0) return null;
              return (
                <span key={v} className="inline-flex items-center gap-1.5">
                  <VerdictChip verdict={v} size="sm" />
                  <span className="font-mono text-sm text-ink">{count}</span>
                </span>
              );
            })}
          </div>
        ) : (
          <FeedStateLabel stateKind={state.kind} />
        )}
      </div>
    </article>
  );
}

function FeedStateLabel({ stateKind }: { stateKind: Article['state']['kind'] }) {
  if (stateKind === 'not_checked_yet') {
    return (
      <span className="inline-flex items-center gap-1.5 text-xs text-ink-secondary font-medium">
        <Clock size={14} strokeWidth={ICON_STROKE} aria-hidden="true" />
        <span>Not checked yet</span>
      </span>
    );
  }

  if (stateKind === 'checking') {
    return (
      <span className="inline-flex items-center gap-1.5 text-xs text-ink-secondary font-medium">
        <Hourglass size={14} strokeWidth={ICON_STROKE} aria-hidden="true" />
        <span>Checking</span>
      </span>
    );
  }

  if (stateKind === 'no_checkable_claims') {
    return (
      <span className="inline-flex items-center gap-1.5 text-xs text-ink-secondary font-medium">
        <CircleMinus size={14} strokeWidth={ICON_STROKE} aria-hidden="true" />
        <span>No checkable claims</span>
      </span>
    );
  }

  if (stateKind === 'could_not_finish') {
    return (
      <span className="inline-flex items-center gap-1.5 text-xs text-ink-secondary font-medium">
        <CircleAlert size={14} strokeWidth={ICON_STROKE} aria-hidden="true" />
        <span>We could not finish this check</span>
      </span>
    );
  }

  return null;
}
