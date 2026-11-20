export type CheckInputValidationResult =
  | { ok: true; mode: 'link' | 'text'; value: string }
  | { ok: false; message: string };

/**
 * Validates raw input from the Check Box:
 * - Empty: "Paste some text or a link first."
 * - Over 20,000 characters: "That is too long. Paste up to 20,000 characters."
 * - Link: Single token starting http:// or https:// accepted by new URL.
 * - Bad link: Single token starting http:// or https:// that new URL rejects: "That link does not look right."
 * - Text: Under 20 characters: "Add a little more text so we have something to check."
 * - Text 20+ chars: valid text mode.
 * - A bare domain counts as text.
 */
export function validateCheckInput(raw: string): CheckInputValidationResult {
  const trimmed = raw.trim();

  if (!trimmed) {
    return { ok: false, message: 'Paste some text or a link first.' };
  }

  if (trimmed.length > 20000) {
    return { ok: false, message: 'That is too long. Paste up to 20,000 characters.' };
  }

  // A link is one token starting http:// or https:// that new URL accepts. Anything else is text.
  const isHttpToken =
    (trimmed.startsWith('http://') || trimmed.startsWith('https://')) &&
    !/\s/.test(trimmed);

  if (isHttpToken) {
    try {
      new URL(trimmed);
      return { ok: true, mode: 'link', value: trimmed };
    } catch {
      return { ok: false, message: 'That link does not look right.' };
    }
  }

  // If it starts with http:// or https:// but contains whitespace, or non-http: treated as text
  if (trimmed.length < 20) {
    return { ok: false, message: 'Add a little more text so we have something to check.' };
  }

  return { ok: true, mode: 'text', value: trimmed };
}

