import { describe, it, expect } from 'vitest';
import fs from 'fs';
import path from 'path';
import { hasEmoji } from '../test/text-rules';

function getFilesRecursively(dir: string): string[] {
  let results: string[] = [];
  const list = fs.readdirSync(dir, { withFileTypes: true });

  for (const entry of list) {
    const fullPath = path.join(dir, entry.name);
    if (entry.isDirectory()) {
      results = results.concat(getFilesRecursively(fullPath));
    } else {
      results.push(fullPath);
    }
  }

  return results;
}

describe('source-rules check', () => {
  const srcDir = path.resolve(import.meta.dirname, '..');
  const allFiles = getFilesRecursively(srcDir);

  const nonTestFiles = allFiles.filter((filePath) => {
    const rel = path.relative(srcDir, filePath).replace(/\\/g, '/');
    if (rel.startsWith('test/')) return false;
    if (rel.includes('.test.') || rel.includes('.spec.')) return false;
    if (!rel.endsWith('.ts') && !rel.endsWith('.tsx') && !rel.endsWith('.css')) return false;
    return true;
  });

  it('scanner finds more than 10 non-test source files', () => {
    expect(nonTestFiles.length).toBeGreaterThan(10);
  });

  it('no emoji in any source file under src', () => {
    nonTestFiles.forEach((file) => {
      const content = fs.readFileSync(file, 'utf-8');
      expect(hasEmoji(content), `Found emoji in ${file}`).toBe(false);
    });
  });

  it('no dangerouslySetInnerHTML in any source file under src', () => {
    nonTestFiles.forEach((file) => {
      const content = fs.readFileSync(file, 'utf-8');
      expect(
        content.includes('dangerouslySetInnerHTML'),
        `Found dangerouslySetInnerHTML in ${file}`
      ).toBe(false);
    });
  });

  it('verdict colour class names: positive control matches vocabulary.ts (>= 4 hits), and 0 hits in other source files', () => {
    // Colour class names with any utility prefix: text-verified, bg-verified, bg-verified-tint, text-ruby, bg-ruby-tint, etc.
    const verdictColorClassRegex = /\b[a-z]+-(?:verified|ruby|lemon)(?:-tint)?\b/g;

    const vocabFile = nonTestFiles.find((f) =>
      path.relative(srcDir, f).replace(/\\/g, '/') === 'lib/vocabulary.ts'
    );
    expect(vocabFile, 'vocabulary.ts must be found by source scanner').toBeDefined();

    const vocabContent = fs.readFileSync(vocabFile!, 'utf-8');
    const vocabMatches = vocabContent.match(verdictColorClassRegex) || [];
    expect(vocabMatches.length).toBeGreaterThanOrEqual(4);

    nonTestFiles.forEach((file) => {
      const rel = path.relative(srcDir, file).replace(/\\/g, '/');
      if (rel.endsWith('.css')) return; // CSS variables in globals.css are allowed
      if (rel === 'lib/vocabulary.ts') return;

      const content = fs.readFileSync(file, 'utf-8');
      const rawMatches = content.match(verdictColorClassRegex) || [];
      // 'sample-verified' is a sample report ID in sample-data.ts, not a UI colour class name
      const classMatches = rawMatches.filter((m) => m !== 'sample-verified');
      expect(
        classMatches.length > 0 ? classMatches : null,
        `Verdict colour class names (${classMatches.join(', ')}) found outside vocabulary.ts in ${rel}`
      ).toBeNull();
    });
  });
});
