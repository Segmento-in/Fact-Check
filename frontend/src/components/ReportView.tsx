'use client';

import React, { useState } from 'react';
import Link from 'next/link';
import {
  ExternalLink,
  UserCheck,
  Timer,
  Megaphone,
  Hash,
  MousePointerClick,
} from 'lucide-react';
import { getDataSource } from '@/lib/data-source';
import { useLoad } from '@/lib/use-load';
import { VerdictChip } from '@/components/VerdictChip';
import { ConfidenceLine } from '@/components/ConfidenceLine';
import { splitProofGroups } from '@/lib/proof-groups';
import { formatDate } from '@/lib/format';
import {
  VERDICTS,
  STANCE_LABEL,
  WARNING_SIGN_LABEL,
  ICON_STROKE,
  ICON_SIZE_SM,
  tallyVerdicts,
} from '@/lib/vocabulary';
import type { WarningSign } from '@/lib/contract';

const WARNING_ICONS: Record<WarningSign['kind'], React.ComponentType<{ size: number; strokeWidth: number; className?: string }>> = {
  urgency: Timer,
  shouting: Megaphone,
  unsourced_number: Hash,
  clickbait: MousePointerClick,
};

export function ReportView({ id }: { id: string }) {
  const { status, data: report, retry } = useLoad(() => getDataSource().getReport(id));
  const [selectedClaimIndex, setSelectedClaimIndex] = useState(0);

  if (status === 'loading') {
    return (
      <div
        role="status"
        className="max-w-[1200px] mx-auto px-4 sm:px-6 py-10 animate-pulse motion-reduce:animate-none space-y-8"
      >
        <span className="sr-only">Loading the report</span>
        <div className="space-y-3">
          <div className="h-8 bg-hairline rounded w-1/2" />
          <div className="h-4 bg-hairline rounded w-1/4" />
        </div>
        <div className="grid grid-cols-2 sm:grid-cols-5 gap-4">
          {Array.from({ length: 5 }).map((_, i) => (
            <div key={i} className="h-24 bg-hairline rounded-lg" />
          ))}
        </div>
        <div className="grid grid-cols-1 lg:grid-cols-[280px_1fr_320px] gap-8">
          <div className="h-64 bg-hairline rounded-lg" />
          <div className="h-96 bg-hairline rounded-lg" />
          <div className="h-64 bg-hairline rounded-lg" />
        </div>
      </div>
    );
  }

  if (status === 'error' || !report) {
    return (
      <div className="max-w-md mx-auto px-4 py-16 text-center">
        <h1 className="text-2xl font-light text-ink tracking-tight">
          We could not find this report
        </h1>
        <p className="text-ink-secondary text-sm mt-2">
          It may have been removed, or the link is wrong.
        </p>
        <Link
          href="/"
          className="mt-6 inline-block rounded-pill bg-primary hover:bg-primary-deep text-on-primary px-6 py-2.5 text-sm font-medium transition-colors"
        >
          Check something
        </Link>
      </div>
    );
  }

  if (report.status === 'could_not_finish') {
    return (
      <div className="max-w-md mx-auto px-4 py-16 text-center">
        <h1 className="text-2xl font-light text-ink tracking-tight">
          We could not finish this check
        </h1>
        <p className="text-ink-secondary text-sm mt-2">
          {report.couldNotFinishReason || 'An unexpected issue stopped this check.'}
        </p>
        <button
          type="button"
          onClick={retry}
          className="mt-6 rounded-pill border border-hairline-input bg-canvas px-6 py-2 text-sm font-medium text-ink hover:border-primary-soft transition-colors"
        >
          Try again
        </button>
      </div>
    );
  }

  if (report.status === 'no_checkable_claims') {
    return (
      <div className="max-w-md mx-auto px-4 py-16 text-center">
        <h1 className="text-2xl font-light text-ink tracking-tight">
          Nothing here can be checked
        </h1>
        <p className="text-ink-secondary text-sm mt-2">
          We skipped {report.skippedCount} opinions, jokes or plans.
        </p>
        <Link
          href="/"
          className="mt-6 inline-block rounded-pill bg-primary hover:bg-primary-deep text-on-primary px-6 py-2.5 text-sm font-medium transition-colors"
        >
          Check something else
        </Link>
      </div>
    );
  }

  // Checked verification report
  const tally = tallyVerdicts(report.claims);
  const selectedClaim = report.claims[selectedClaimIndex] || report.claims[0];
  const proofGroups = selectedClaim ? splitProofGroups(selectedClaim.evidence) : { supports: [], challenges: [], saidNothing: 0 };
  const checkedByPersonCount = report.claims.filter((c) => c.checkedByPerson).length;

  return (
    <div className="min-h-[calc(100vh-64px)] bg-canvas-soft py-10 px-4 sm:px-6">
      <div className="max-w-[1200px] mx-auto space-y-8">
        <div className="pb-4 border-b border-hairline">
          <h1 className="text-2xl sm:text-3xl font-light text-ink tracking-tight">
            {report.contentTitle}
          </h1>
          <p className="text-xs text-ink-secondary mt-1">
            Checked on {formatDate(report.checkedOn)}
          </p>
        </div>

        {/* Count Tiles: ordered first on mobile */}
        <section data-section="count-tiles" aria-label="Summary count tiles">
          <ul className="grid grid-cols-2 sm:grid-cols-5 gap-4">
            {VERDICTS.map((v) => (
              <li
                key={v}
                className="bg-canvas p-4 rounded-lg border border-hairline flex flex-col justify-between gap-3 shadow-card"
              >
                <span className="text-2xl sm:text-3xl font-light text-ink tabular-nums">
                  {tally[v]}
                </span>
                <VerdictChip verdict={v} size="sm" />
              </li>
            ))}
            <li className="bg-canvas p-4 rounded-lg border border-hairline flex flex-col justify-between gap-3 shadow-card">
              <span className="text-2xl sm:text-3xl font-light text-ink tabular-nums">
                {report.skippedCount}
              </span>
              <span className="text-xs font-medium text-ink-secondary">Skipped Claims</span>
            </li>
          </ul>
        </section>

        {/* 3-column / stacked sections */}
        <div className="flex flex-col lg:grid lg:grid-cols-[280px_1fr_320px] gap-8">
          {/* Claim List */}
          <section
            data-section="claim-list"
            aria-label="Claims list"
            className="order-1 lg:order-none"
          >
            <h2 className="text-sm font-semibold uppercase tracking-wider text-ink-secondary mb-3">
              Claims
            </h2>
            <div className="space-y-2">
              {report.claims.map((claimItem, index) => {
                const isSelected = index === selectedClaimIndex;
                return (
                  <button
                    key={claimItem.claim.id}
                    type="button"
                    onClick={() => setSelectedClaimIndex(index)}
                    aria-current={isSelected ? 'true' : undefined}
                    className={`w-full text-left p-3.5 rounded-lg border transition-all flex flex-col gap-2.5 ${
                      isSelected
                        ? 'border-primary ring-1 ring-primary bg-canvas shadow-card'
                        : 'border-hairline bg-canvas hover:border-hairline-input'
                    }`}
                  >
                    <span className="text-sm font-normal text-ink line-clamp-2 leading-snug">
                      {claimItem.claim.claimText}
                    </span>
                    <VerdictChip verdict={claimItem.verdict} size="sm" />
                  </button>
                );
              })}
            </div>
          </section>

          {/* Selected Claim */}
          {selectedClaim && (
            <section
              data-section="selected-claim"
              aria-label="Selected claim details"
              className="order-2 lg:order-none bg-canvas rounded-lg border border-hairline p-6 shadow-card space-y-6"
            >
              <div>
                <h2 className="text-xl font-light text-ink tracking-tight leading-snug">
                  {selectedClaim.claim.claimText}
                </h2>
                <div className="flex flex-wrap items-center gap-3 mt-3">
                  <VerdictChip verdict={selectedClaim.verdict} size="md" />
                  <ConfidenceLine confidence={selectedClaim.confidence} />
                  {selectedClaim.checkedByPerson && (
                    <span className="inline-flex items-center gap-1.5 text-xs font-medium text-ink bg-canvas-soft px-2.5 py-1 rounded-pill border border-hairline">
                      <UserCheck size={ICON_SIZE_SM} strokeWidth={ICON_STROKE} aria-hidden="true" />
                      <span>Checked by a Person</span>
                    </span>
                  )}
                </div>
                <p className="text-sm text-ink-secondary mt-4">
                  From the text:{' '}
                  <span className="text-ink font-normal">
                    {selectedClaim.claim.originalSentence}
                  </span>
                </p>
              </div>

              {selectedClaim.verdict === 'not_enough_evidence' && (
                <div className="p-3.5 rounded-md bg-canvas-soft border border-hairline text-sm text-ink-secondary">
                  We found no proof from the trusted Sources yet. This does not mean the Claim is false.
                </div>
              )}

              {/* Proof Groups: Supports and Challenges */}
              <div className="space-y-6 pt-2">
                <div>
                  <h3 className="text-sm font-semibold uppercase tracking-wider text-ink-secondary mb-3">
                    Supports
                  </h3>
                  {proofGroups.supports.length === 0 ? (
                    <p className="text-sm text-ink-secondary italic">Nothing here.</p>
                  ) : (
                    <div className="space-y-3">
                      {proofGroups.supports.map((ev) => (
                        <ProofCard key={ev.tag} evidence={ev} />
                      ))}
                    </div>
                  )}
                </div>

                <div>
                  <h3 className="text-sm font-semibold uppercase tracking-wider text-ink-secondary mb-3">
                    Challenges
                  </h3>
                  {proofGroups.challenges.length === 0 ? (
                    <p className="text-sm text-ink-secondary italic">Nothing here.</p>
                  ) : (
                    <div className="space-y-3">
                      {proofGroups.challenges.map((ev) => (
                        <ProofCard key={ev.tag} evidence={ev} />
                      ))}
                    </div>
                  )}
                </div>

                {proofGroups.saidNothing > 0 && (
                  <p className="text-xs text-ink-secondary pt-2">
                    {proofGroups.saidNothing} passage(s) said nothing about this Claim.
                  </p>
                )}
              </div>
            </section>
          )}

          {/* Side Panel */}
          <aside
            data-section="side-panel"
            aria-label="Report overview and methodology"
            className="order-3 lg:order-none space-y-6"
          >
            {/* Warning Signs */}
            <div className="bg-canvas rounded-lg border border-hairline p-5 shadow-card">
              <h3 className="text-sm font-semibold uppercase tracking-wider text-ink-secondary mb-3">
                Warning Signs
              </h3>
              {report.warningSigns.length === 0 ? (
                <p className="text-sm text-ink-secondary">No Warning Signs found.</p>
              ) : (
                <ul className="space-y-2.5">
                  {report.warningSigns.map((ws, i) => {
                    const Icon = WARNING_ICONS[ws.kind] || Timer;
                    return (
                      <li key={i} className="text-xs text-ink flex items-start gap-2">
                        <Icon size={14} strokeWidth={ICON_STROKE} className="shrink-0 mt-0.5 text-ink-secondary" />
                        <div>
                          <span className="font-semibold text-ink">
                            {WARNING_SIGN_LABEL[ws.kind]}:
                          </span>{' '}
                          <span className="text-ink-secondary">{ws.text}</span>
                        </div>
                      </li>
                    );
                  })}
                </ul>
              )}
            </div>

            {/* Next Steps */}
            <div className="bg-canvas rounded-lg border border-hairline p-5 shadow-card">
              <h3 className="text-sm font-semibold uppercase tracking-wider text-ink-secondary mb-2">
                Next Steps
              </h3>
              <p className="text-sm text-ink leading-relaxed">{report.nextSteps}</p>
            </div>

            {/* How We Checked */}
            <div className="bg-canvas rounded-lg border border-hairline p-5 shadow-card">
              <h3 className="text-sm font-semibold uppercase tracking-wider text-ink-secondary mb-2">
                How We Checked
              </h3>
              <p className="text-sm text-ink leading-relaxed">{report.howWeChecked}</p>
            </div>

            {/* Fix List */}
            {report.iWroteThis && report.fixList.length > 0 && (
              <div className="bg-canvas rounded-lg border border-hairline p-5 shadow-card">
                <h3 className="text-sm font-semibold uppercase tracking-wider text-ink-secondary mb-3">
                  Fix List
                </h3>
                <div className="space-y-4">
                  {report.fixList.map((fix, idx) => (
                    <div key={idx} className="text-xs space-y-1.5 border-b border-hairline last:border-b-0 pb-3 last:pb-0">
                      <div>
                        <span className="font-medium text-ink-secondary block">Your words</span>
                        <blockquote className="italic text-ink">&quot;{fix.yourWords}&quot;</blockquote>
                      </div>
                      <div>
                        <span className="font-medium text-ink-secondary block">Evidence says</span>
                        <p className="text-ink-secondary">{fix.evidenceSays}</p>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* Checked by a Person */}
            <div className="bg-canvas rounded-lg border border-hairline p-5 shadow-card">
              <h3 className="text-sm font-semibold uppercase tracking-wider text-ink-secondary mb-2">
                Checked by a Person
              </h3>
              <p className="text-sm text-ink-secondary">
                {checkedByPersonCount > 0
                  ? `${checkedByPersonCount} of ${report.claims.length} Claims checked by a person.`
                  : 'No Claims have been checked by a person yet.'}
              </p>
            </div>
          </aside>
        </div>
      </div>
    </div>
  );
}

function ProofCard({ evidence }: { evidence: import('@/lib/contract').EvidenceRecord }) {
  let hostname = '';
  try {
    hostname = new URL(evidence.link).hostname;
  } catch {
    hostname = evidence.link;
  }

  return (
    <div className="p-4 rounded-lg bg-canvas-soft border border-hairline space-y-2 text-left">
      <div className="flex items-center justify-between text-xs text-ink-secondary">
        <span className="font-medium text-ink">
          {STANCE_LABEL[evidence.stance]}
        </span>
        <span className="font-mono text-xs text-ink-secondary">{evidence.tag}</span>
      </div>

      <blockquote className="text-sm text-ink italic pl-3 border-l-2 border-hairline my-2 leading-relaxed">
        &quot;{evidence.quote}&quot;
      </blockquote>

      <div className="flex flex-wrap items-center justify-between gap-2 text-xs pt-1 border-t border-hairline/60">
        <span className="text-ink-secondary truncate max-w-[200px]">{hostname}</span>
        <a
          href={evidence.link}
          target="_blank"
          rel="noopener noreferrer"
          className="inline-flex items-center gap-1 text-primary hover:underline font-medium focus:outline-none focus:ring-1 focus:ring-primary-soft rounded-xs"
        >
          <span>Open source</span>
          <ExternalLink size={12} strokeWidth={ICON_STROKE} aria-hidden="true" />
        </a>
      </div>

      <p className="text-[11px] text-ink-secondary">
        Page date {formatDate(evidence.pageDate)}, fetched {formatDate(evidence.fetchedOn)}
      </p>
    </div>
  );
}
