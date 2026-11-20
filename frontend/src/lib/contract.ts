/**
 * Typed API contract and data types for the Fact Checker frontend.
 * Defines models aligned with the Ubiquitous Language (UL).
 */

// Verdict: From UL term "Verdict" - The final label on a Claim, set by our code from the Stances. Four kinds.
export type Verdict = "supported" | "refuted" | "mixed" | "not_enough_evidence";

// Confidence: From UL term "Confidence" - How sure we are about a Verdict, shown in words only: Very sure, Fairly sure, Not very sure.
export type Confidence = "very_sure" | "fairly_sure" | "not_very_sure";

// Stance: From UL term "Stance" - How one piece of Evidence relates to a Claim: supports, opposes, supports only part, or says nothing.
export type Stance = "supports" | "opposes" | "supports_only_part" | "says_nothing";

// SensitiveDomain: From UL term "Sensitive Domain" - A subject area (health, elections, money, safety) where a wrong Verdict can cause serious harm.
export type SensitiveDomain = "health" | "elections" | "money" | "safety";

// ClaimRecord: From UL term "Claim Record" - The saved Claim: id, rewritten Claim, original sentence, its place in Content, previous sentence, and Sensitive Domain tag.
export interface ClaimRecord {
  id: string;
  claimText: string;
  originalSentence: string;
  placeInContent: number; // chunk position, 0-based
  previousSentence: string;
  sensitiveDomain: SensitiveDomain | null;
}

// EvidenceRecord: From UL term "Evidence Record" - The saved Evidence: tag like E1, passage, link, real link, Copy Group id, page date, fetch date, Stance, quote, fence result.
export interface EvidenceRecord {
  tag: string; // like "E1"
  passage: string;
  link: string; // the real link, copy tricks removed
  copyGroupId: string;
  pageDate: string; // "YYYY-MM-DD"
  fetchedOn: string; // "YYYY-MM-DD"
  stance: Stance;
  quote: string;
  fenceResult: "accepted" | "rejected";
}

// ReportClaim: From UL term "Claim" / "Selected Claim" - One Claim in a Verification Report with its Verdict, Confidence, Evidence list and human review flag.
export interface ReportClaim {
  claim: ClaimRecord;
  verdict: Verdict;
  confidence: Confidence;
  evidence: EvidenceRecord[];
  checkedByPerson: boolean;
}

// WarningSign: From UL term "Warning Sign" - A pattern found by code (urgency, shouting, unsourced_number, clickbait). It is not a Verdict.
export interface WarningSign {
  kind: "urgency" | "shouting" | "unsourced_number" | "clickbait";
  text: string;
}

// FixItem: From UL term "Fix List" - In a Report on the User's own writing: places where the writing disagrees with Evidence.
export interface FixItem {
  claimId: string;
  yourWords: string;
  evidenceSays: string;
}

// ReportStatus: From UL term "Verification Report" / "Could Not Finish" - The status of a verification report check.
export type ReportStatus = "checked" | "no_checkable_claims" | "could_not_finish";

// VerificationReport: From UL term "Verification Report" - The result for one Content: its Claims, each with a Verdict, a Confidence and its proof.
export interface VerificationReport {
  id: string;
  isSample: boolean;
  status: ReportStatus;
  contentTitle: string;
  iWroteThis: boolean;
  claims: ReportClaim[];
  skippedCount: number;
  warningSigns: WarningSign[];
  nextSteps: string;
  howWeChecked: string;
  fixList: FixItem[];
  couldNotFinishReason: string | null;
  checkedOn: string;
}

// ClaimTally: From UL term "Claim Tally" - On a Feed Card: how many Claims got each Verdict, shown as small Verdict Chips with counts. Never one Verdict for the whole Article.
export type ClaimTally = Record<Verdict, number>;

// FeedCardState: From UL term "Feed Card State" - What a Feed Card says about its check: Not checked yet, Checking, a Claim Tally, No checkable claims, or Could Not Finish.
export type FeedCardState =
  | { kind: "not_checked_yet" }
  | { kind: "checking" }
  | { kind: "checked"; reportId: string; tally: ClaimTally }
  | { kind: "no_checkable_claims"; reportId: string }
  | { kind: "could_not_finish"; reportId: string };

// Article: From UL term "Article" - One item that arrives from a Feed. It is a kind of Content.
export interface Article {
  id: string;
  isSample: boolean;
  headline: string;
  publisher: string;
  feedScore: number;
  publishedAt: string;
  url: string;
  state: FeedCardState;
}

// CheckSubmission: From UL term "Check Page" / "Check Box" - The input from the Check Page: text or link, and the "I wrote this" switch.
export interface CheckSubmission {
  text: string;
  iWroteThis: boolean;
}

