import { describe, it, expect, vi } from "vitest";
import {
  EXTRACTION_STATUS_LABELS,
  getExtractionStatusLabel,
  getVerdictConfig,
  VERDICT_CONFIG,
} from "./labels";

describe("Labels & Wordings Contract", () => {
  // Test 3: Four verdict labels and five status words match required strings exactly
  it("defines exact verdict labels and colors without jargon or 'fake'", () => {
    // Bug caught: jargon or 'fake' leaks
    expect(VERDICT_CONFIG.supported).toEqual({
      label: "Verified with evidence",
      color: "green",
    });
    expect(VERDICT_CONFIG.refuted).toEqual({
      label: "Evidence says this is false",
      color: "red",
    });
    expect(VERDICT_CONFIG.mixed).toEqual({
      label: "Evidence shows only part of this is true",
      color: "yellow",
    });
    expect(VERDICT_CONFIG.not_enough_evidence).toEqual({
      label: "Not enough evidence yet",
      color: "grey",
    });

    // Verify none contains "fake", "Refuted", "Supported", "Mixed", or "factuality"
    Object.values(VERDICT_CONFIG).forEach(({ label }) => {
      const lower = label.toLowerCase();
      expect(lower).not.toContain("fake");
      expect(lower).not.toContain("refuted");
      expect(lower).not.toContain("supported");
      expect(lower).not.toContain("factuality");
    });
  });

  it("defines exact extraction status words", () => {
    // Bug caught: jargon or mismatched status text
    expect(EXTRACTION_STATUS_LABELS.ok).toBe("Article text read");
    expect(EXTRACTION_STATUS_LABELS.too_short).toBe("Too short to check");
    expect(EXTRACTION_STATUS_LABELS.no_text).toBe("No readable text found");
    expect(EXTRACTION_STATUS_LABELS.not_html).toBe("Not a web page (PDF or file)");
    expect(EXTRACTION_STATUS_LABELS.fetch_failed).toBe("Could not open the page");
  });

  it("renders safe fallback and logs warning on unknown verdict key or extraction status", () => {
    // Bug caught: crash or silent wrong label on unexpected backend key
    const warnSpy = vi.spyOn(console, "warn").mockImplementation(() => {});

    const unknownVerdict = getVerdictConfig("completely_unexpected_verdict");
    expect(unknownVerdict.label).toBe("Unknown verdict");
    expect(warnSpy).toHaveBeenCalledWith(
      expect.stringContaining('Unknown verdict key: "completely_unexpected_verdict"')
    );

    const unknownStatus = getExtractionStatusLabel("unknown_status_code");
    expect(unknownStatus).toBe("Unknown status");
    expect(warnSpy).toHaveBeenCalledWith(
      expect.stringContaining('Unknown extraction status: "unknown_status_code"')
    );

    warnSpy.mockRestore();
  });
});

