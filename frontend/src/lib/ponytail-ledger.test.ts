import { describe, it, expect } from 'vitest';
import fs from 'fs';
import path from 'path';

const PONYTAIL_PATTERN = ['pony', 'tail:'].join('');

function findFilesRecursively(dir: string, extensions: string[]): string[] {
  let results: string[] = [];
  const list = fs.readdirSync(dir);

  for (const file of list) {
    const filePath = path.join(dir, file);
    const stat = fs.statSync(filePath);
    if (stat.isDirectory()) {
      results = results.concat(findFilesRecursively(filePath, extensions));
    } else {
      const ext = path.extname(file);
      if (extensions.includes(ext) && !file.endsWith('.test.ts') && !file.endsWith('.test.tsx')) {
        results.push(filePath);
      }
    }
  }

  return results;
}

describe('Ponytail Debt Ledger guard test', () => {
  it('count of ponytail markers in src equals the number of ledger rows in PONYTAIL_DEBT.md, triggers are non-empty, and count > 0', () => {
    const srcDir = path.resolve(import.meta.dirname, '..');
    const ledgerPath = path.resolve(import.meta.dirname, '../../PONYTAIL_DEBT.md');

    expect(fs.existsSync(srcDir)).toBe(true);
    expect(fs.existsSync(ledgerPath)).toBe(true);

    const sourceFiles = findFilesRecursively(srcDir, ['.ts', '.tsx', '.css']);
    let markerCount = 0;
    const foundMarkers: Array<{ file: string; line: string }> = [];

    for (const file of sourceFiles) {
      const content = fs.readFileSync(file, 'utf-8');
      const lines = content.split('\n');
      lines.forEach((line) => {
        if (line.includes(PONYTAIL_PATTERN)) {
          markerCount++;
          foundMarkers.push({
            file: path.relative(path.resolve(srcDir, '..'), file),
            line: line.trim(),
          });
        }
      });
    }

    const ledgerContent = fs.readFileSync(ledgerPath, 'utf-8');
    const tableLines = ledgerContent
      .split('\n')
      .map((l) => l.trim())
      .filter((l) => l.startsWith('|') && l.endsWith('|'));

    // Filter out table header and divider rows
    const dataRows = tableLines.filter((line) => {
      if (/^\|\s*File\s*\|/i.test(line)) return false;
      if (/^\|\s*---/i.test(line)) return false;
      return true;
    });

    console.info(`[Ponytail Guard] Found ${markerCount} source marker(s) and ${dataRows.length} ledger row(s).`);

    expect(markerCount).toBeGreaterThan(0);
    expect(dataRows.length).toBe(markerCount);

    // Verify every row has non-empty File, Shortcut, Limit, Trigger
    dataRows.forEach((row, i) => {
      const cols = row
        .split('|')
        .slice(1, -1)
        .map((c) => c.trim());
      expect(cols.length).toBe(4);
      const [file, shortcut, limit, trigger] = cols;

      expect(file, `Row ${i + 1} file should not be empty`).toBeTruthy();
      expect(shortcut, `Row ${i + 1} shortcut should not be empty`).toBeTruthy();
      expect(limit, `Row ${i + 1} limit should not be empty`).toBeTruthy();
      expect(trigger, `Row ${i + 1} trigger should not be empty`).toBeTruthy();
      expect(trigger.length, `Row ${i + 1} trigger length should be > 0`).toBeGreaterThan(0);
    });
  });
});
