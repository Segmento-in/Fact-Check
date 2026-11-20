import fs from 'fs';
import path from 'path';

let tokenCache: Record<string, string> | null = null;

function loadCssTokens(): Record<string, string> {
  if (tokenCache) return tokenCache;

  const cssPath = path.resolve(import.meta.dirname, '../app/globals.css');
  if (!fs.existsSync(cssPath)) {
    throw new Error(`Could not find globals.css to extract theme color tokens at ${cssPath}`);
  }
  const cssContent = fs.readFileSync(cssPath, 'utf-8');

  const tokens: Record<string, string> = {};
  const regex = /--color-([a-zA-Z0-9-]+)\s*:\s*(#[0-9a-fA-F]+)\s*;/g;
  let match: RegExpExecArray | null;
  while ((match = regex.exec(cssContent)) !== null) {
    tokens[match[1]] = match[2];
  }

  tokenCache = tokens;
  return tokens;
}

function parseHex(hex: string): { r: number; g: number; b: number } {
  const clean = hex.replace(/^#/, '').trim();
  const hexPattern = /^([0-9a-fA-F]{3}|[0-9a-fA-F]{6})$/;
  if (!hexPattern.test(clean)) {
    throw new Error(`Color '${hex}' is not a valid 3 or 6 digit hex string.`);
  }

  if (clean.length === 3) {
    const r = parseInt(clean[0] + clean[0], 16);
    const g = parseInt(clean[1] + clean[1], 16);
    const b = parseInt(clean[2] + clean[2], 16);
    return { r, g, b };
  }

  const r = parseInt(clean.slice(0, 2), 16);
  const g = parseInt(clean.slice(2, 4), 16);
  const b = parseInt(clean.slice(4, 6), 16);
  return { r, g, b };
}

function getRelativeLuminance(hex: string): number {
  const { r, g, b } = parseHex(hex);
  const toLinear = (c: number) => {
    const sRGB = c / 255;
    return sRGB <= 0.04045 ? sRGB / 12.92 : Math.pow((sRGB + 0.055) / 1.055, 2.4);
  };

  const R = toLinear(r);
  const G = toLinear(g);
  const B = toLinear(b);

  return 0.2126 * R + 0.7152 * G + 0.0722 * B;
}

export function getContrastRatio(hex1: string, hex2: string): number {
  const l1 = getRelativeLuminance(hex1);
  const l2 = getRelativeLuminance(hex2);
  const lighter = Math.max(l1, l2);
  const darker = Math.min(l1, l2);
  const ratio = (lighter + 0.05) / (darker + 0.05);

  if (ratio === 0 || !Number.isFinite(ratio)) {
    throw new Error(`Calculated invalid contrast ratio: ${ratio}`);
  }
  return ratio;
}

export function getContrastBetweenTokens(fgToken: string, bgToken: string): number {
  const tokens = loadCssTokens();
  const fgClean = fgToken.replace(/^--color-/, '');
  const bgClean = bgToken.replace(/^--color-/, '');

  const fgHex = tokens[fgClean];
  if (!fgHex) {
    throw new Error(`Token '--color-${fgClean}' is missing from globals.css`);
  }

  const bgHex = tokens[bgClean];
  if (!bgHex) {
    throw new Error(`Token '--color-${bgClean}' is missing from globals.css`);
  }

  return getContrastRatio(fgHex, bgHex);
}
