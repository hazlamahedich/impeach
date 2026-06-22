// target-path: tests/docs/adrs-seeded.test.ts
// RED — Story 1.10 19 ADRs Seeded (AR-7, PC-3, VAL-4)
// @rules PC-3, PC-5 @adr ADR-0001..0019

import { describe, it, expect } from 'vitest';
import { readFileSync, existsSync, readdirSync } from 'node:fs';
import { join } from 'node:path';
import { execaSync } from 'execa';

const ROOT = join(__dirname, '..', '..');
const ADR_DIR = join(ROOT, 'docs/adr');
const ADR_NUMBERS = Array.from({ length: 19 }, (_, i) => String(i + 1).padStart(4, '0'));

const parseFrontmatter = (src: string): Record<string, string> => {
  const m = src.match(/^---\n([\s\S]*?)\n---/);
  const out: Record<string, string> = {};
  if (m) for (const line of m[1].split('\n')) {
    const [k, ...v] = line.split(':');
    if (k.trim()) out[k.trim()] = v.join(':').trim();
  }
  return out;
};

describe.skip('Story 1.10 — 19 ADRs seeded (AR-7, PC-3, VAL-4)', () => {
  // RED — docs/adr/ directory absent

  it('docs/adr/ contains ADR-0001 through ADR-0019', () => {
    const files = readdirSync(ADR_DIR);
    for (const n of ADR_NUMBERS) {
      expect(files.some(f => f.startsWith(`${n}-`))).toBe(true);
    }
  });

  it('each ADR follows PC-3 template (frontmatter: id,title,status,date,supersedes,deciders,related,evidence[]; Context/Decision/Alternatives/Consequences/Open questions)', () => {
    for (const n of ADR_NUMBERS) {
      const files = readdirSync(ADR_DIR).filter(f => f.startsWith(`${n}-`));
      const src = readFileSync(join(ADR_DIR, files[0]), 'utf8');
      const fm = parseFrontmatter(src);
      for (const key of ['id', 'title', 'status', 'date', 'supersedes', 'deciders', 'related', 'review_trigger']) {
        expect(fm[key]).toBeDefined();
      }
      expect(src).toMatch(/## Context/);
      expect(src).toMatch(/## Decision/);
      expect(src).toMatch(/## Alternatives Considered/);
      expect(src).toMatch(/## Consequences[\s\S]*### Positive[\s\S]*### Negative[\s\S]*### Neutral/); // three subsections
      expect(src).toMatch(/## Open Questions/);
      // Alternatives >=2 with rejection rationale
      const alts = src.match(/-\s+\*\*[^*]+\*\*:/g) ?? [];
      expect(alts.length).toBeGreaterThanOrEqual(2);
    }
  });

  it('evidence[] required for Accepted status (PC-3 — Proposed without evidence fails)', () => {
    for (const n of ADR_NUMBERS) {
      const files = readdirSync(ADR_DIR).filter(f => f.startsWith(`${n}-`));
      const src = readFileSync(join(ADR_DIR, files[0]), 'utf8');
      const fm = parseFrontmatter(src);
      if (/Accepted/.test(fm.status)) {
        expect(src).toMatch(/evidence:\s*\n\s*-\s+/); // non-empty evidence array
      }
    }
  });

  it('ADR-0013/0016/0017/0018 have "evidence pending" markers (VAL-3.4)', () => {
    for (const n of ['0013', '0016', '0017', '0018']) {
      const files = readdirSync(ADR_DIR).filter(f => f.startsWith(`${n}-`));
      const src = readFileSync(join(ADR_DIR, files[0]), 'utf8');
      expect(src).toMatch(/evidence pending/i);
    }
  });

  it('ADR-0019 resolves the SEC-4 vs NFR-D-1 contradiction (VAL-4)', () => {
    const files = readdirSync(ADR_DIR).filter(f => f.startsWith('0019-'));
    const src = readFileSync(join(ADR_DIR, files[0]), 'utf8');
    expect(src).toMatch(/SEC-4/);
    expect(src).toMatch(/NFR-D-1/);
  });

  it('adr-lint runs in CI and passes', () => {
    const ci = readFileSync(join(ROOT, '.github/workflows/ci.yml'), 'utf8');
    expect(ci).toMatch(/adr-lint/);
    const result = execaSync('pnpm', ['exec', 'adr-lint'], { cwd: ROOT, reject: false });
    expect(result.exitCode).toBe(0);
  });

  it('related[] bidirectional (ADR-0003 ↔ referenced backlinks)', () => {
    // PC-3: related is bidirectional + machine-validated
    const result = execaSync('pnpm', ['exec', 'adr-lint', '--check-bidirectional'], { cwd: ROOT, reject: false });
    expect(result.exitCode).toBe(0);
  });
});
