import { describe, it, expect } from 'vitest';
import { createSampleDataSource } from './sample';
import { SAMPLE_REPORTS, SAMPLE_ARTICLES } from './sample-data';
import { isTrustedLink } from '../trusted-sources';
import { tallyVerdicts } from '../vocabulary';
import { hasPercent, hasEmoji, collectStrings } from '../../test/text-rules';
import type { Stance, Verdict } from '../contract';

function expectedVerdict(stances: Stance[]): Verdict {
  const supports = stances.includes('supports');
  const opposes = stances.includes('opposes');
  const partial = stances.includes('supports_only_part');
  const allSaysNothing = stances.length > 0 && stances.every((s) => s === 'says_nothing');

  if (supports && !opposes && !partial) {
    return 'supported';
  }
  if (opposes && !supports && !partial) {
    return 'refuted';
  }
  if ((supports && opposes) || partial) {
    return 'mixed';
  }
  if (allSaysNothing || stances.length === 0) {
    return 'not_enough_evidence';
  }
  return 'not_enough_evidence';
}

describe('sample data source and sample data set', () => {
  const ds = createSampleDataSource();

  describe('behavior', () => {
    it('getReport returns the report for a known id and null for an unknown id', async () => {
      const known = await ds.getReport('sample-all-verdicts');
      expect(known).not.toBeNull();
      expect(known?.id).toBe('sample-all-verdicts');

      const unknown = await ds.getReport('non-existent-id');
      expect(unknown).toBeNull();
    });

    it('submitCheck with iWroteThis=true returns sample-i-wrote-this', async () => {
      const result = await ds.submitCheck({ text: 'Some text', iWroteThis: true, contentKind: 'claim_or_text' });
      expect(result).toEqual({ reportId: 'sample-i-wrote-this' });
    });

    it('submitCheck with iWroteThis=false returns sample-all-verdicts', async () => {
      const result = await ds.submitCheck({ text: 'Some text', iWroteThis: false, contentKind: 'claim_or_text' });
      expect(result).toEqual({ reportId: 'sample-all-verdicts' });
    });

    it('listFeedArticles returns exactly 8 Articles', async () => {
      const articles = await ds.listFeedArticles();
      expect(articles.length).toBe(8);
    });
  });

  describe('Sample Data honesty and integrity rules', () => {
    it('every report and article has isSample === true and unique ids', () => {
      const reportIds = new Set<string>();
      SAMPLE_REPORTS.forEach((report) => {
        expect(report.isSample).toBe(true);
        expect(reportIds.has(report.id)).toBe(false);
        reportIds.add(report.id);
      });

      const articleIds = new Set<string>();
      SAMPLE_ARTICLES.forEach((article) => {
        expect(article.isSample).toBe(true);
        expect(articleIds.has(article.id)).toBe(false);
        articleIds.add(article.id);
      });
    });

    it('every Evidence link passes isTrustedLink', () => {
      SAMPLE_REPORTS.forEach((report) => {
        report.claims.forEach((c) => {
          c.evidence.forEach((ev) => {
            expect(isTrustedLink(ev.link)).toBe(true);
          });
        });
      });
    });

    it('evidence quote rules: non-says_nothing has exact passage substring; says_nothing has empty quote', () => {
      SAMPLE_REPORTS.forEach((report) => {
        report.claims.forEach((c) => {
          c.evidence.forEach((ev) => {
            if (ev.stance === 'says_nothing') {
              expect(ev.quote).toBe('');
            } else {
              expect(ev.quote.trim().length).toBeGreaterThan(0);
              expect(ev.passage.includes(ev.quote)).toBe(true);
            }
          });
        });
      });
    });

    it('every Evidence has required metadata and unique tag per claim', () => {
      SAMPLE_REPORTS.forEach((report) => {
        report.claims.forEach((c) => {
          const tags = new Set<string>();
          c.evidence.forEach((ev) => {
            expect(tags.has(ev.tag)).toBe(false);
            tags.add(ev.tag);

            expect(ev.passage.trim().length).toBeGreaterThan(0);
            expect(ev.link.trim().length).toBeGreaterThan(0);
            expect(ev.pageDate).toMatch(/^\d{4}-\d{2}-\d{2}$/);
            expect(ev.fetchedOn).toMatch(/^\d{4}-\d{2}-\d{2}$/);
          });
        });
      });
    });

    it('Evidence that share a copyGroupId inside one Claim have the same Stance', () => {
      SAMPLE_REPORTS.forEach((report) => {
        report.claims.forEach((c) => {
          const groupStances = new Map<string, Stance>();
          c.evidence.forEach((ev) => {
            if (groupStances.has(ev.copyGroupId)) {
              expect(
                ev.stance,
                `Evidence ${ev.tag} in claim ${c.claim.id} of report ${report.id} has stance ${ev.stance} which does not match group ${ev.copyGroupId} stance ${groupStances.get(ev.copyGroupId)}`
              ).toBe(groupStances.get(ev.copyGroupId));
            } else {
              groupStances.set(ev.copyGroupId, ev.stance);
            }
          });
        });
      });
    });

    it('every sample Claim Verdict equals expectedVerdict(stances)', () => {
      SAMPLE_REPORTS.forEach((report) => {
        report.claims.forEach((c) => {
          const stances = c.evidence.map((e) => e.stance);
          const expected = expectedVerdict(stances);
          expect(c.verdict).toBe(expected);
        });
      });
    });

    it('could_not_finish report has zero claims and non-empty reason; other reports have null reason', () => {
      SAMPLE_REPORTS.forEach((report) => {
        if (report.status === 'could_not_finish') {
          expect(report.claims.length).toBe(0);
          expect(report.couldNotFinishReason).toBeTruthy();
        } else {
          expect(report.couldNotFinishReason).toBeNull();
        }
      });
    });

    it('fixList is non-empty only when iWroteThis is true', () => {
      SAMPLE_REPORTS.forEach((report) => {
        if (report.iWroteThis) {
          expect(report.fixList.length).toBeGreaterThan(0);
        } else {
          expect(report.fixList.length).toBe(0);
        }
      });
    });

    it('no_checkable_claims report has zero claims and skippedCount > 0', () => {
      const noClaimsReport = SAMPLE_REPORTS.find(
        (r) => r.status === 'no_checkable_claims'
      );
      expect(noClaimsReport).toBeDefined();
      expect(noClaimsReport?.claims.length).toBe(0);
      expect((noClaimsReport?.skippedCount ?? 0)).toBeGreaterThan(0);
    });

    it('across the whole set: covers all 4 verdicts, 3 confidences, checkedByPerson, warning sign, sensitive domain, copy group pair', () => {
      const allVerdicts = new Set<string>();
      const allConfidences = new Set<string>();
      let hasCheckedByPerson = false;
      let hasWarningSign = false;
      let hasSensitiveDomain = false;
      const copyGroupCounts: Record<string, number> = {};

      SAMPLE_REPORTS.forEach((report) => {
        if (report.warningSigns.length > 0) hasWarningSign = true;

        report.claims.forEach((c) => {
          allVerdicts.add(c.verdict);
          allConfidences.add(c.confidence);
          if (c.checkedByPerson) hasCheckedByPerson = true;
          if (c.claim.sensitiveDomain) hasSensitiveDomain = true;

          c.evidence.forEach((ev) => {
            copyGroupCounts[ev.copyGroupId] = (copyGroupCounts[ev.copyGroupId] || 0) + 1;
          });
        });
      });

      expect(allVerdicts.size).toBe(4);
      expect(allConfidences.size).toBe(3);
      expect(hasCheckedByPerson).toBe(true);
      expect(hasWarningSign).toBe(true);
      expect(hasSensitiveDomain).toBe(true);

      const hasSharedCopyGroup = Object.values(copyGroupCounts).some((count) => count >= 2);
      expect(hasSharedCopyGroup).toBe(true);
    });

    it('every checked Feed Article has tally equal to tallyVerdicts of report claims', () => {
      SAMPLE_ARTICLES.forEach((article) => {
        const state = article.state;
        if (state.kind === 'checked') {
          const report = SAMPLE_REPORTS.find((r) => r.id === state.reportId);
          expect(report).toBeDefined();
          const expectedTally = tallyVerdicts(report!.claims);
          expect(state.tally).toEqual(expectedTally);
        }
      });
    });

    it('the 8 Feed Articles cover all 5 FeedCardState kinds', () => {
      const kinds = new Set(SAMPLE_ARTICLES.map((a) => a.state.kind));
      expect(kinds).toEqual(
        new Set([
          'not_checked_yet',
          'checking',
          'checked',
          'no_checkable_claims',
          'could_not_finish',
        ])
      );
    });

    it('no emoji and no percent in any string across all sample reports and articles', () => {
      const reportStrings = collectStrings(SAMPLE_REPORTS);
      reportStrings.forEach((s) => {
        expect(hasEmoji(s)).toBe(false);
        expect(hasPercent(s)).toBe(false);
      });

      const articleStrings = collectStrings(SAMPLE_ARTICLES);
      articleStrings.forEach((s) => {
        expect(hasEmoji(s)).toBe(false);
        expect(hasPercent(s)).toBe(false);
      });
    });
  });
});

