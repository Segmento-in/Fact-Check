'use client';

import React from 'react';
import Link from 'next/link';
import {
  RefreshCw,
  Newspaper,
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
            className="inline-flex items-center justify-center gap-2 rounded-pill bg-canvas text-ink border border-hairline-input hover:border-primary-soft px-5 py-2 font-medium text-sm transition-colors motion-reduce:transition-none disabled:opacity-60 focus:outline-none focus:ring-2 focus:ring-primary-soft"
          >
            <RefreshCw
              size={14}
              strokeWidth={ICON_STROKE}
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
                aria-hidden="true"
                className="flex h-full flex-col overflow-hidden rounded-lg border border-hairline bg-canvas"
              >
                <div data-part="cover" className="aspect-video bg-hairline" />
                <div className="flex flex-1 flex-col p-5">
                  <div className="flex items-center justify-between">
                    <div className="h-6 w-20 rounded-pill bg-hairline" />
                    <div className="h-3 w-16 rounded bg-hairline" />
                  </div>
                  <div className="mt-4 space-y-2">
                    <div className="h-5 w-full rounded bg-hairline" />
                    <div className="h-5 w-4/5 rounded bg-hairline" />
                  </div>
                  <div data-part="state" className="mt-auto pt-6">
                    <div className="h-6 w-3/4 rounded-pill bg-hairline" />
                  </div>
                  <div className="mt-4 flex items-center gap-2 border-t border-hairline pt-3">
                    <div className="h-6 w-6 rounded-full bg-hairline" />
                    <div className="h-3 w-1/2 rounded bg-hairline" />
                  </div>
                </div>
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
              className="mt-4 rounded-pill border border-hairline-input bg-canvas px-5 py-2 text-sm font-medium text-ink hover:border-primary-soft transition-colors motion-reduce:transition-none focus:outline-none focus:ring-2 focus:ring-primary-soft"
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
  const [failedImageUrl, setFailedImageUrl] = React.useState<string | null>(null);
  const imageUrl =
    article.imageUrl && article.imageUrl !== failedImageUrl
      ? article.imageUrl
      : null;
  const publishedDate = formatDate(article.publishedAt);

  return (
    <article
      className={`relative isolate flex h-full flex-col overflow-hidden rounded-lg border border-hairline bg-canvas text-left shadow-card transition-colors motion-reduce:transition-none focus-within:ring-2 focus-within:ring-primary-soft ${reportId ? 'hover:border-primary-soft' : ''}`}
    >
      <div
        data-part="cover"
        className="aspect-video w-full shrink-0 overflow-hidden bg-canvas-soft"
      >
        {imageUrl ? (
          // ponytail: cover images are hotlinked from the Publisher or Feed host, so that host sees the reader's IP. Revisit before any public deploy (proxy or cache images).
          // eslint-disable-next-line @next/next/no-img-element
          <img
            src={imageUrl}
            alt=""
            width={640}
            height={360}
            loading="lazy"
            referrerPolicy="no-referrer"
            decoding="async"
            onError={() => setFailedImageUrl(imageUrl)}
            className="h-full w-full object-cover"
          />
        ) : (
          <div
            data-cover-tile
            aria-hidden="true"
            className="flex h-full w-full items-center justify-center text-primary-soft"
          >
            <Newspaper size={40} strokeWidth={ICON_STROKE} aria-hidden="true" />
          </div>
        )}
      </div>

      <div className="flex min-w-0 flex-1 flex-col p-5">
        <div
          data-part="meta"
          className="flex min-w-0 items-center justify-between gap-3 text-xs"
        >
          <span className="min-w-0 truncate rounded-pill bg-canvas-soft px-3 py-1 font-medium text-ink-secondary">
            {article.feed}
          </span>
          {publishedDate ? (
            <time
              dateTime={article.publishedAt}
              className="shrink-0 tabular-nums text-ink-mute"
            >
              {publishedDate}
            </time>
          ) : null}
        </div>

        <h2 className="mt-4 line-clamp-3 text-lg font-medium leading-snug text-ink">
          {reportId ? (
            <Link
              href={`/report/${reportId}`}
              className="font-medium after:absolute after:inset-0 after:content-[''] hover:underline focus:outline-none"
            >
              {article.headline}
            </Link>
          ) : (
            <span className="font-medium">{article.headline}</span>
          )}
        </h2>

        <div data-part="state" className="mt-auto pt-4">
          {state.kind === 'checked' ? (
            <div className="flex flex-wrap items-center gap-2">
              {VERDICTS.map((verdict) => {
                const count = state.tally[verdict];
                if (!count || count <= 0) return null;
                return (
                  <span key={verdict} className="inline-flex items-center gap-1.5">
                    <VerdictChip verdict={verdict} size="sm" />
                    <span className="font-mono text-sm tabular-nums text-ink">
                      {count}
                    </span>
                  </span>
                );
              })}
            </div>
          ) : (
            <FeedStateLabel stateKind={state.kind} />
          )}
        </div>

        <div
          data-part="byline"
          className="mt-4 flex min-w-0 items-center justify-between gap-3 border-t border-hairline pt-3"
        >
          <div className="flex min-w-0 flex-1 items-center gap-2">
            <span
              aria-hidden="true"
              className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-canvas-soft text-xs font-medium text-ink-secondary"
            >
              {article.publisher.trim().charAt(0).toUpperCase()}
            </span>
            <span className="truncate text-xs text-ink-secondary">
              By {article.publisher}
            </span>
          </div>
          {typeof article.feedScore === 'number' ? (
            <span className="shrink-0 font-mono text-xs tabular-nums text-ink-mute">
              Feed Score {article.feedScore}
            </span>
          ) : null}
        </div>
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
