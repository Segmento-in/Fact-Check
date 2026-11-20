import { describe, it, expect } from 'vitest';
import { TRUSTED_SOURCE_HOSTS, isTrustedLink } from './trusted-sources';

describe('trusted-sources module', () => {
  it('TRUSTED_SOURCE_HOSTS matches exactly the 8 hand-picked hosts', () => {
    // Source: earlier project notes. The UL does not list the specific hosts.
    expect(TRUSTED_SOURCE_HOSTS).toEqual([
      'apnews.com',
      'reuters.com',
      'fec.gov',
      'nist.gov',
      'arxiv.org',
      'github.com',
      'arstechnica.com',
      'factcheck.org',
    ]);
  });

  describe('isTrustedLink', () => {
    it('returns true for trusted https links and subdomains', () => {
      expect(isTrustedLink('https://www.reuters.com/x')).toBe(true);
      expect(isTrustedLink('https://apnews.com/a')).toBe(true);
      expect(isTrustedLink('https://sub.reuters.com/story')).toBe(true);
      expect(isTrustedLink('https://factcheck.org/2026/01/sample-claim/')).toBe(true);
    });

    it('returns false for lookalike sites, wrong protocol, non-trusted domains and garbage', () => {
      expect(isTrustedLink('https://apnews.com.fake-site.com/a')).toBe(false);
      expect(isTrustedLink('https://notreuters.com/a')).toBe(false);
      expect(isTrustedLink('http://reuters.com/a')).toBe(false);
      expect(isTrustedLink('javascript:alert(1)')).toBe(false);
      expect(isTrustedLink('garbage-not-a-url')).toBe(false);
      expect(isTrustedLink('')).toBe(false);
    });

    it('never throws on unexpected input types or malformed URLs', () => {
      expect(() => isTrustedLink('https://')).not.toThrow();
      expect(() => isTrustedLink(null as unknown as string)).not.toThrow();
      expect(() => isTrustedLink(undefined as unknown as string)).not.toThrow();
      expect(() => isTrustedLink('://bad-url')).not.toThrow();
    });
  });
});

