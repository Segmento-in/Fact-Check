import type { ContentKind } from './contract';

export type CheckInputValidationResult =
  | { ok: true; mode: 'link' | 'text'; value: string }
  | { ok: false; message: string };

/**
 * Validates raw input from the Check Box based on Content Kind:
 *
 * - claim_or_text and social_post:
 *   - Empty: "Paste some text or a link first."
 *   - Over 20,000 characters: "That is too long. Paste up to 20,000 characters."
 *   - Link: Single token starting http:// or https:// accepted by new URL -> mode: "link"
 *   - Bad link: Single token starting http:// or https:// that new URL rejects: "That link does not look right."
 *   - Text: Under 20 characters: "Add a little more text so we have something to check."
 *   - Text 20+ chars: valid text mode -> mode: "text"
 *
 * - article_link:
 *   - Empty: "Paste a link first."
 *   - Not a link-looking token: "Paste a link that starts with http:// or https://."
 *   - Looks like a link but new URL rejects: "That link does not look right."
 *   - Over 2,000 characters: "That link is too long."
 *   - Result mode: "link"
 *
 * - headline:
 *   - Check order: empty, link, short, long.
 *   - Empty: "Paste a headline first."
 *   - A link: "A headline is text, not a link. Choose Article link for a link."
 *   - Under 10 characters: "A headline needs at least 10 characters."
 *   - Over 300: "That is too long for a headline. Choose Claim or text for longer pieces."
 *   - Result mode: "text"
 */
export function validateCheckInput(
  raw: string,
  kind: ContentKind = 'claim_or_text'
): CheckInputValidationResult {
  const trimmed = raw.trim();

  if (kind === 'article_link') {
    if (!trimmed) {
      return { ok: false, message: 'Paste a link first.' };
    }

    const isHttpToken =
      (trimmed.startsWith('http://') || trimmed.startsWith('https://')) &&
      !/\s/.test(trimmed);

    if (!isHttpToken) {
      return { ok: false, message: 'Paste a link that starts with http:// or https://.' };
    }

    try {
      new URL(trimmed);
    } catch {
      return { ok: false, message: 'That link does not look right.' };
    }

    if (trimmed.length > 2000) {
      return { ok: false, message: 'That link is too long.' };
    }

    return { ok: true, mode: 'link', value: trimmed };
  }

  if (kind === 'headline') {
    if (!trimmed) {
      return { ok: false, message: 'Paste a headline first.' };
    }

    const isLink =
      (trimmed.startsWith('http://') || trimmed.startsWith('https://')) &&
      !/\s/.test(trimmed);

    if (isLink) {
      return {
        ok: false,
        message: 'A headline is text, not a link. Choose Article link for a link.',
      };
    }

    if (trimmed.length < 10) {
      return { ok: false, message: 'A headline needs at least 10 characters.' };
    }

    if (trimmed.length > 300) {
      return {
        ok: false,
        message: 'That is too long for a headline. Choose Claim or text for longer pieces.',
      };
    }

    return { ok: true, mode: 'text', value: trimmed };
  }

  // claim_or_text and social_post share identical rules
  if (!trimmed) {
    return { ok: false, message: 'Paste some text or a link first.' };
  }

  if (trimmed.length > 20000) {
    return { ok: false, message: 'That is too long. Paste up to 20,000 characters.' };
  }

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

  if (trimmed.length < 20) {
    return { ok: false, message: 'Add a little more text so we have something to check.' };
  }

  return { ok: true, mode: 'text', value: trimmed };
}

