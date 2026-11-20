import { ExtractionStatus, VerdictKey } from "./contract";

export type ChipColor = "green" | "red" | "yellow" | "grey";

export interface VerdictLabelConfig {
  label: string;
  color: ChipColor;
}

export const UNCHECKED_LABEL = "Not checked yet";

export const VERDICT_CONFIG: Record<VerdictKey, VerdictLabelConfig> = {
  supported: {
    label: "Verified with evidence",
    color: "green",
  },
  refuted: {
    label: "Evidence says this is false",
    color: "red",
  },
  mixed: {
    label: "Evidence shows only part of this is true",
    color: "yellow",
  },
  not_enough_evidence: {
    label: "Not enough evidence yet",
    color: "grey",
  },
};

export const EXTRACTION_STATUS_LABELS: Record<ExtractionStatus, string> = {
  ok: "Article text read",
  too_short: "Too short to check",
  no_text: "No readable text found",
  not_html: "Not a web page (PDF or file)",
  fetch_failed: "Could not open the page",
};

/**
 * Returns human-readable verdict display configuration for a given backend VerdictKey.
 * If unknown, logs a warning and returns safe "Unknown verdict" chip configuration.
 */
export function getVerdictConfig(key: string | null | undefined): VerdictLabelConfig {
  if (!key || !(key in VERDICT_CONFIG)) {
    console.warn(`Unknown verdict key: "${key}"`);
    return {
      label: "Unknown verdict",
      color: "grey",
    };
  }
  return VERDICT_CONFIG[key as VerdictKey];
}

/**
 * Returns human-readable label for a backend ExtractionStatus.
 * If unknown, logs a warning and returns safe "Unknown status".
 */
export function getExtractionStatusLabel(status: string | null | undefined): string {
  if (!status || !(status in EXTRACTION_STATUS_LABELS)) {
    console.warn(`Unknown extraction status: "${status}"`);
    return "Unknown status";
  }
  return EXTRACTION_STATUS_LABELS[status as ExtractionStatus];
}

