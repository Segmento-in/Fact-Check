import { describe, it, expect } from 'vitest';
import { validateCheckInput } from './check-input';

describe('validateCheckInput', () => {
  describe('claim_or_text (default)', () => {
    it('returns empty message when input is empty or whitespace only', () => {
      expect(validateCheckInput('', 'claim_or_text')).toEqual({
        ok: false,
        message: 'Paste some text or a link first.',
      });
      expect(validateCheckInput('   \n\t  ', 'claim_or_text')).toEqual({
        ok: false,
        message: 'Paste some text or a link first.',
      });
    });

    it('returns too long message when trimmed input exceeds 20,000 characters', () => {
      const longString = 'a'.repeat(20001);
      expect(validateCheckInput(longString, 'claim_or_text')).toEqual({
        ok: false,
        message: 'That is too long. Paste up to 20,000 characters.',
      });
    });

    it('identifies valid links starting with http:// or https://', () => {
      expect(validateCheckInput('https://reuters.com/world/news', 'claim_or_text')).toEqual({
        ok: true,
        mode: 'link',
        value: 'https://reuters.com/world/news',
      });
      expect(validateCheckInput('http://apnews.com/article/123', 'claim_or_text')).toEqual({
        ok: true,
        mode: 'link',
        value: 'http://apnews.com/article/123',
      });
      // Link under 20 characters is still valid
      expect(validateCheckInput('https://fec.gov', 'claim_or_text')).toEqual({
        ok: true,
        mode: 'link',
        value: 'https://fec.gov',
      });
    });

    it('returns bad link message for invalid single-token urls starting with http:// or https://', () => {
      expect(validateCheckInput('https://', 'claim_or_text')).toEqual({
        ok: false,
        message: 'That link does not look right.',
      });
      expect(validateCheckInput('http://', 'claim_or_text')).toEqual({
        ok: false,
        message: 'That link does not look right.',
      });
      expect(validateCheckInput('https://[invalid-host]', 'claim_or_text')).toEqual({
        ok: false,
        message: 'That link does not look right.',
      });
    });

    it('treats bare domains as text and enforces 20 character minimum', () => {
      // 11 chars < 20
      expect(validateCheckInput('example.com', 'claim_or_text')).toEqual({
        ok: false,
        message: 'Add a little more text so we have something to check.',
      });
      // 33 chars >= 20
      expect(validateCheckInput('example.com/some/long/story/path', 'claim_or_text')).toEqual({
        ok: true,
        mode: 'text',
        value: 'example.com/some/long/story/path',
      });
    });

    it('treats non-http schemes as text', () => {
      // 16 chars < 20
      expect(validateCheckInput('ftp://server.org', 'claim_or_text')).toEqual({
        ok: false,
        message: 'Add a little more text so we have something to check.',
      });
      // >= 20 chars
      expect(validateCheckInput('ftp://server.org/archive/reports/file.txt', 'claim_or_text')).toEqual({
        ok: true,
        mode: 'text',
        value: 'ftp://server.org/archive/reports/file.txt',
      });
    });

    it('handles the exact 19 and 20 character boundaries for text', () => {
      const nineteen = '1234567890123456789';
      expect(nineteen.length).toBe(19);
      expect(validateCheckInput(nineteen, 'claim_or_text')).toEqual({
        ok: false,
        message: 'Add a little more text so we have something to check.',
      });

      const twenty = '12345678901234567890';
      expect(twenty.length).toBe(20);
      expect(validateCheckInput(twenty, 'claim_or_text')).toEqual({
        ok: true,
        mode: 'text',
        value: twenty,
      });
    });
  });

  describe('social_post', () => {
    it('returns empty message when input is empty', () => {
      expect(validateCheckInput('', 'social_post')).toEqual({
        ok: false,
        message: 'Paste some text or a link first.',
      });
    });

    it('accepts valid links for social posts', () => {
      expect(validateCheckInput('https://x.com/user/status/123456', 'social_post')).toEqual({
        ok: true,
        mode: 'link',
        value: 'https://x.com/user/status/123456',
      });
    });

    it('enforces 20 char minimum on text', () => {
      expect(validateCheckInput('Short post text', 'social_post')).toEqual({
        ok: false,
        message: 'Add a little more text so we have something to check.',
      });
      const validPost = 'This is a forwarded message from a chat group.';
      expect(validateCheckInput(validPost, 'social_post')).toEqual({
        ok: true,
        mode: 'text',
        value: validPost,
      });
    });

    it('rejects input over 20,000 characters', () => {
      const longPost = 'x'.repeat(20001);
      expect(validateCheckInput(longPost, 'social_post')).toEqual({
        ok: false,
        message: 'That is too long. Paste up to 20,000 characters.',
      });
    });
  });

  describe('article_link', () => {
    it('returns empty message when empty', () => {
      expect(validateCheckInput('', 'article_link')).toEqual({
        ok: false,
        message: 'Paste a link first.',
      });
    });

    it('returns link-looking message for bare domain or regular text', () => {
      expect(validateCheckInput('example.com/news', 'article_link')).toEqual({
        ok: false,
        message: 'Paste a link that starts with http:// or https://.',
      });
      expect(validateCheckInput('Council votes on transit levy in local election', 'article_link')).toEqual({
        ok: false,
        message: 'Paste a link that starts with http:// or https://.',
      });
      expect(validateCheckInput('https://reuters.com with whitespace', 'article_link')).toEqual({
        ok: false,
        message: 'Paste a link that starts with http:// or https://.',
      });
    });

    it('returns bad link message when new URL rejects', () => {
      expect(validateCheckInput('https://', 'article_link')).toEqual({
        ok: false,
        message: 'That link does not look right.',
      });
      expect(validateCheckInput('http://[invalid-host]', 'article_link')).toEqual({
        ok: false,
        message: 'That link does not look right.',
      });
    });

    it('accepts valid links and returns mode link', () => {
      expect(validateCheckInput('https://apnews.com/article/harbor-levy-123', 'article_link')).toEqual({
        ok: true,
        mode: 'link',
        value: 'https://apnews.com/article/harbor-levy-123',
      });
    });

    it('enforces 2,000 character maximum on links', () => {
      const validUrl2000 = 'https://reuters.com/' + 'a'.repeat(2000 - 'https://reuters.com/'.length);
      expect(validUrl2000.length).toBe(2000);
      expect(validateCheckInput(validUrl2000, 'article_link')).toEqual({
        ok: true,
        mode: 'link',
        value: validUrl2000,
      });

      const longUrl2001 = 'https://reuters.com/' + 'a'.repeat(2001 - 'https://reuters.com/'.length);
      expect(longUrl2001.length).toBe(2001);
      expect(validateCheckInput(longUrl2001, 'article_link')).toEqual({
        ok: false,
        message: 'That link is too long.',
      });
    });
  });

  describe('headline', () => {
    it('returns empty message when empty', () => {
      expect(validateCheckInput('', 'headline')).toEqual({
        ok: false,
        message: 'Paste a headline first.',
      });
    });

    it('rejects links with specific guidance to choose Article link', () => {
      expect(validateCheckInput('https://reuters.com/news/article', 'headline')).toEqual({
        ok: false,
        message: 'A headline is text, not a link. Choose Article link for a link.',
      });
      expect(validateCheckInput('http://apnews.com', 'headline')).toEqual({
        ok: false,
        message: 'A headline is text, not a link. Choose Article link for a link.',
      });
    });

    it('handles exact 9 and 10 character boundaries', () => {
      const nine = '123456789';
      expect(nine.length).toBe(9);
      expect(validateCheckInput(nine, 'headline')).toEqual({
        ok: false,
        message: 'A headline needs at least 10 characters.',
      });

      const ten = '1234567890';
      expect(ten.length).toBe(10);
      expect(validateCheckInput(ten, 'headline')).toEqual({
        ok: true,
        mode: 'text',
        value: ten,
      });
    });

    it('handles exact 300 and 301 character boundaries', () => {
      const threeHundred = 'h'.repeat(300);
      expect(threeHundred.length).toBe(300);
      expect(validateCheckInput(threeHundred, 'headline')).toEqual({
        ok: true,
        mode: 'text',
        value: threeHundred,
      });

      const threeHundredOne = 'h'.repeat(301);
      expect(threeHundredOne.length).toBe(301);
      expect(validateCheckInput(threeHundredOne, 'headline')).toEqual({
        ok: false,
        message: 'That is too long for a headline. Choose Claim or text for longer pieces.',
      });
    });
  });
});
