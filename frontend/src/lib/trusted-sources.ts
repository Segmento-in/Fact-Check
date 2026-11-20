// Source: the earlier project notes. The UL does not list them.
export const TRUSTED_SOURCE_HOSTS = [
  'apnews.com',
  'reuters.com',
  'fec.gov',
  'nist.gov',
  'arxiv.org',
  'github.com',
  'arstechnica.com',
  'factcheck.org',
] as const;

export type TrustedSourceHost = (typeof TRUSTED_SOURCE_HOSTS)[number];

/**
 * Checks whether a URL is an allowed trusted link:
 * - Must use HTTPS protocol
 * - Host must match exactly one of the 8 trusted source domains or be a valid subdomain of one
 * - Never throws on invalid or garbage input
 */
export function isTrustedLink(url: string): boolean {
  if (typeof url !== 'string' || !url.trim()) {
    return false;
  }

  try {
    const parsed = new URL(url);
    if (parsed.protocol !== 'https:') {
      return false;
    }

    const host = parsed.hostname.toLowerCase();
    return TRUSTED_SOURCE_HOSTS.some(
      (trustedHost) => host === trustedHost || host.endsWith(`.${trustedHost}`)
    );
  } catch {
    return false;
  }
}

