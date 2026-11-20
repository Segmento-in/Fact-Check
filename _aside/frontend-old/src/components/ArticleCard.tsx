import React from "react";
import { ArticleReport } from "../lib/contract";
import {
  ChipColor,
  getExtractionStatusLabel,
  getVerdictConfig,
  UNCHECKED_LABEL,
} from "../lib/labels";

export function isValidHttpUrl(urlString: string): boolean {
  try {
    const parsed = new URL(urlString);
    return parsed.protocol === "http:" || parsed.protocol === "https:";
  } catch {
    return false;
  }
}

function formatPublishedTime(dateString: string | null): string {
  if (!dateString) return "";
  try {
    const d = new Date(dateString);
    return isNaN(d.getTime()) ? "" : d.toLocaleString();
  } catch {
    return "";
  }
}

const VERDICT_CHIP_STYLES: Record<ChipColor, string> = {
  green: "bg-[#ecfdf5] border-[#a7f3d0] text-[#065f46]",
  red: "bg-[#fff1f2] border-[#fecdd3] text-[#9f1239]",
  yellow: "bg-[#fffbeb] border-[#fde68a] text-[#92400e]",
  grey: "bg-[#f1f5f9] border-[#cbd5e1] text-[#334155]",
};

export interface ArticleCardProps {
  report: ArticleReport;
}

export const ArticleCard: React.FC<ArticleCardProps> = ({ report }) => {
  const { article, extraction, checked } = report;
  const isHttp = isValidHttpUrl(article.url);
  const formattedTime = formatPublishedTime(article.publishedAt);
  const extractionLabel = getExtractionStatusLabel(extraction.status);

  // Verdict config only evaluated when article is checked
  const verdictConfig = checked ? getVerdictConfig(report.overallVerdictKey) : null;

  return (
    <article
      data-testid="article-card"
      className="flex flex-col justify-between p-5 rounded-[6px] bg-white border border-[#e5edf5] hover:border-[#b9b9f9] shadow-sm transition-all text-left"
    >
      <div className="space-y-3">
        {/* Header Metadata Bar */}
        <div className="flex flex-wrap items-center gap-1.5 text-xs text-[#64748d] font-mono">
          <span className="font-semibold text-[#061b31]" data-testid="feed-name">
            {article.source}
          </span>

          {/* Show score ONLY for Hacker News articles */}
          {article.source === "Hacker News" && (
            <>
              <span aria-hidden="true">·</span>
              <span className="text-[#533afd]" data-testid="hn-score">
                Score {article.hnScore}
              </span>
            </>
          )}

          {formattedTime && (
            <>
              <span aria-hidden="true">·</span>
              <time dateTime={article.publishedAt || undefined} data-testid="published-time">
                {formattedTime}
              </time>
            </>
          )}
        </div>

        {/* Article Title */}
        <h2 className="text-lg font-light leading-snug tracking-[-0.2px] text-[#061b31]">
          {isHttp ? (
            <a
              href={article.url}
              target="_blank"
              rel="noopener noreferrer"
              className="hover:underline text-[#061b31] hover:text-[#533afd] transition-colors"
            >
              {article.title}
            </a>
          ) : (
            <span className="text-[#061b31]">{article.title}</span>
          )}
        </h2>

        {/* Status and Verification Badges */}
        <div className="flex flex-wrap items-center gap-2 pt-1">
          {/* Extraction Status Chip */}
          <span
            data-testid="extraction-chip"
            className="inline-flex items-center px-2.5 py-0.5 rounded-[4px] text-xs font-mono bg-[#f8fafd] border border-[#e5edf5] text-[#475569]"
          >
            {extractionLabel}
          </span>

          {/* Verification / Verdict Badge */}
          {!checked ? (
            <span
              data-testid="unchecked-chip"
              className="inline-flex items-center px-2.5 py-0.5 rounded-[4px] text-xs font-medium border-2 border-dashed border-[#94a3b8] text-[#475569] bg-transparent"
            >
              {UNCHECKED_LABEL}
            </span>
          ) : (
            verdictConfig && (
              <span
                data-testid="verdict-chip"
                className={`inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-[4px] text-xs font-medium border ${VERDICT_CHIP_STYLES[verdictConfig.color]}`}
              >
                <span>{verdictConfig.label}</span>
                {report.overallConfidence && (
                  <>
                    <span aria-hidden="true">·</span>
                    <span className="font-mono" data-testid="confidence-word">
                      {report.overallConfidence}
                    </span>
                  </>
                )}
              </span>
            )
          )}
        </div>

        {/* Text Preview: Max 2 lines only when status is ok */}
        {extraction.status === "ok" && extraction.textPreview && (
          <p
            data-testid="text-preview"
            className="text-xs text-[#64748d] font-light line-clamp-2 leading-relaxed pt-1"
          >
            {extraction.textPreview}
          </p>
        )}
      </div>
    </article>
  );
};

