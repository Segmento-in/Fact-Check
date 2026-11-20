/**
 * Shared test helpers for enforcing formatting rules:
 * - No literal percent signs in user-facing text
 * - No emoji anywhere
 * - Deep string collection from objects and arrays
 */

export function hasPercent(s: string): boolean {
  return s.includes('%');
}

export function hasEmoji(s: string): boolean {
  return /\p{Extended_Pictographic}/u.test(s);
}

export function collectStrings(value: unknown): string[] {
  const result: string[] = [];

  function walk(val: unknown) {
    if (typeof val === 'string') {
      result.push(val);
    } else if (Array.isArray(val)) {
      for (const item of val) {
        walk(item);
      }
    } else if (val !== null && typeof val === 'object') {
      for (const key of Object.keys(val as Record<string, unknown>)) {
        walk((val as Record<string, unknown>)[key]);
      }
    }
  }

  walk(value);
  return result;
}

