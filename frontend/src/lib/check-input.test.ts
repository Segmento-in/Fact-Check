import { describe, it, expect } from 'vitest';
import { validateCheckInput } from './check-input';

describe('validateCheckInput', () => {
  it('returns empty message when input is empty or whitespace only', () => {
    expect(validateCheckInput('')).toEqual({
      ok: false,
      message: 'Paste some text or a link first.',
    });
    expect(validateCheckInput('   \n\t  ')).toEqual({
      ok: false,
      message: 'Paste some text or a link first.',
    });
  });

  it('returns too long message when trimmed input exceeds 20,000 characters', () => {
    const longString = 'a'.repeat(20001);
    expect(validateCheckInput(longString)).toEqual({
      ok: false,
      message: 'That is too long. Paste up to 20,000 characters.',
    });
  });

  it('identifies valid links starting with http:// or https://', () => {
    expect(validateCheckInput('https://reuters.com/world/news')).toEqual({
      ok: true,
      mode: 'link',
      value: 'https://reuters.com/world/news',
    });
    expect(validateCheckInput('http://apnews.com/article/123')).toEqual({
      ok: true,
      mode: 'link',
      value: 'http://apnews.com/article/123',
    });
    // Link under 20 characters is still valid
    expect(validateCheckInput('https://fec.gov')).toEqual({
      ok: true,
      mode: 'link',
      value: 'https://fec.gov',
    });
  });

  it('returns bad link message for invalid single-token urls starting with http:// or https://', () => {
    expect(validateCheckInput('https://')).toEqual({
      ok: false,
      message: 'That link does not look right.',
    });
    expect(validateCheckInput('http://')).toEqual({
      ok: false,
      message: 'That link does not look right.',
    });
    expect(validateCheckInput('https://[invalid-host]')).toEqual({
      ok: false,
      message: 'That link does not look right.',
    });
  });

  it('treats bare domains as text and enforces 20 character minimum', () => {
    // 11 chars < 20
    expect(validateCheckInput('example.com')).toEqual({
      ok: false,
      message: 'Add a little more text so we have something to check.',
    });
    // 33 chars >= 20
    expect(validateCheckInput('example.com/some/long/story/path')).toEqual({
      ok: true,
      mode: 'text',
      value: 'example.com/some/long/story/path',
    });
  });

  it('treats non-http schemes as text', () => {
    // 16 chars < 20
    expect(validateCheckInput('ftp://server.org')).toEqual({
      ok: false,
      message: 'Add a little more text so we have something to check.',
    });
    // >= 20 chars
    expect(validateCheckInput('ftp://server.org/archive/reports/file.txt')).toEqual({
      ok: true,
      mode: 'text',
      value: 'ftp://server.org/archive/reports/file.txt',
    });
  });

  it('handles the exact 19 and 20 character boundaries for text', () => {
    const nineteen = '1234567890123456789';
    expect(nineteen.length).toBe(19);
    expect(validateCheckInput(nineteen)).toEqual({
      ok: false,
      message: 'Add a little more text so we have something to check.',
    });

    const twenty = '12345678901234567890';
    expect(twenty.length).toBe(20);
    expect(validateCheckInput(twenty)).toEqual({
      ok: true,
      mode: 'text',
      value: twenty,
    });
  });
});

