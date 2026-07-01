import { describe, it, expect } from 'vitest';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

/**
 * adr-lint — PC-3 template compliance for every ADR (Story 1.10, AC #1–#5).
 *
 * @rules AC-1, AC-2, AC-3, AC-4, AC-5, SC-9, VAL-4
 *
 * Validates the complete ADR set (ADR-001 … ADR-024) for:
 *  - Presence + filename convention (four-digit kebab-case)  (AC #1)
 *  - YAML frontmatter: required keys, exact types, 3-digit `id`  (AC #2)
 *  - The `supersedes_by` typo is rejected in favour of `superseded_by`  (AC #2)
 *  - Five required section headers, exact case-sensitive match  (AC #2)
 *  - Evidence requirement: `Accepted` needs real paths/URLs;
 *    "evidence pending" markers ONLY valid for `Proposed`  (AC #3, #4)
 *  - Bidirectional `related` links for ADR↔ADR references  (AC #4)
 */

import {
  REQUIRED_SECTIONS,
  ALLOWED_STATUSES,
  FILENAME_RE,
  isRealEvidence,
  isPlaceholderEvidence,
  normalizeEvidence,
  resolveEvidencePath,
  loadAdrs,
  h2Headers,
  existsSync,
} from './adr-helpers';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ADR_DIR = path.resolve(__dirname, '../../docs/adr');

describe('adr-lint — PC-3 template compliance (AC #1–#5)', () => {
  const adrs = loadAdrs(ADR_DIR);
  const byId = new Map(adrs.map((a) => [a.id, a]));

  it('docs/adr/ contains the complete ADR-001 … ADR-024 set with unique ids (AC #1)', () => {
    expect(adrs.length).toBe(24);
    const seenIds = new Set<string>();
    for (let n = 1; n <= 24; n += 1) {
      const id = `ADR-${String(n).padStart(3, '0')}`;
      expect(byId.has(id), `missing ${id}`).toBe(true);
    }
    for (const adr of adrs) {
      expect(
        seenIds.has(adr.id),
        `${adr.fileName}: duplicate ADR id ${adr.id}`,
      ).toBe(false);
      seenIds.add(adr.id);
    }
  });

  it('every file uses the four-digit kebab-case naming convention (AC #1)', () => {
    for (const adr of adrs) {
      expect(
        FILENAME_RE.test(adr.fileName),
        `${adr.fileName}: must match \\d{4}-kebab-case.md`,
      ).toBe(true);
    }
  });

  describe('frontmatter (AC #2)', () => {
    const REQUIRED_KEYS = [
      'id',
      'title',
      'status',
      'date',
      'supersedes',
      'superseded_by',
      'deciders',
      'related',
      'evidence',
    ] as const;

    for (const adr of adrs) {
      describe(`${adr.id} (${adr.fileName})`, () => {
        it('has all required keys with correct types', () => {
          const fm = adr.frontmatter;
          for (const key of REQUIRED_KEYS) {
            expect(
              Object.prototype.hasOwnProperty.call(fm, key),
              `${adr.fileName}: missing frontmatter key \`${key}\``,
            ).toBe(true);
          }
          expect(typeof fm.id, `${adr.fileName}: id must be a string`).toBe('string');
          expect(fm.id, `${adr.fileName}: id must match ADR-NNN (3-digit)`).toMatch(/^ADR-\d{3}$/);
          expect(typeof fm.title, `${adr.fileName}: title must be a string`).toBe('string');
          expect((fm.title as string).trim().length, `${adr.fileName}: title empty`).toBeGreaterThan(0);
          expect(
            ALLOWED_STATUSES.has(fm.status as string),
            `${adr.fileName}: status ${JSON.stringify(fm.status)} not in {${[...ALLOWED_STATUSES].join(',')}}`,
          ).toBe(true);
          const dateStr =
            fm.date instanceof Date ? fm.date.toISOString().slice(0, 10) : String(fm.date);
          expect(dateStr, `${adr.fileName}: date must be YYYY-MM-DD`).toMatch(/^\d{4}-\d{2}-\d{2}$/);
          for (const k of ['supersedes', 'superseded_by'] as const) {
            const v = fm[k];
            expect(
              v === null || typeof v === 'string',
              `${adr.fileName}: ${k} must be null or string`,
            ).toBe(true);
          }
          expect(Array.isArray(fm.deciders), `${adr.fileName}: deciders must be an array`).toBe(true);
          expect((fm.deciders as unknown[]).length, `${adr.fileName}: deciders empty`).toBeGreaterThan(0);
          expect(Array.isArray(fm.related), `${adr.fileName}: related must be an array`).toBe(true);
          expect(Array.isArray(fm.evidence), `${adr.fileName}: evidence must be an array`).toBe(true);
        });

        it('does NOT carry the `supersedes_by` typo (must be `superseded_by`)', () => {
          expect(
            Object.prototype.hasOwnProperty.call(adr.frontmatter, 'supersedes_by'),
            `${adr.fileName}: found typo key \`supersedes_by\` — use \`superseded_by\``,
          ).toBe(false);
        });
      });
    }
  });

  describe('section headers — exact, case-sensitive (AC #2)', () => {
    for (const adr of adrs) {
      it(`${adr.id} has exactly the five required H2 headers`, () => {
        const headers = h2Headers(adr.raw);
        for (const required of REQUIRED_SECTIONS) {
          expect(
            headers.has(required),
            `${adr.fileName}: missing exact header \`${required}\` (case-sensitive)`,
          ).toBe(true);
        }
        expect(
          headers.size,
          `${adr.fileName}: expected exactly 5 H2 headers, found ${[...headers].join(', ')}`,
        ).toBe(REQUIRED_SECTIONS.length);
      });
    }
  });

  describe('evidence requirement (AC #3, #4)', () => {
    for (const adr of adrs) {
      it(`${adr.id} (${adr.status}) has compliant evidence`, () => {
        const evidence = adr.frontmatter.evidence as unknown[];
        const isProposed = adr.status === 'Proposed';
        const placeholders = evidence.filter(isPlaceholderEvidence);
        const reals = evidence.filter(isRealEvidence);

        if (isProposed) {
          expect(
            evidence.length > 0,
            `${adr.fileName}: Proposed ADR must still declare an evidence array`,
          ).toBe(true);
        } else {
          expect(
            evidence.length > 0,
            `${adr.fileName}: ${adr.status} ADR must have non-empty evidence`,
          ).toBe(true);
          expect(
            reals.length,
            `${adr.fileName}: ${adr.status} ADR needs real evidence paths/URLs (got ${JSON.stringify(evidence.map(normalizeEvidence))})`,
          ).toBe(evidence.length);
          expect(
            placeholders.length,
            `${adr.fileName}: "evidence pending" markers only valid for Proposed status`,
          ).toBe(0);

          for (const entry of evidence) {
            const resolved = resolveEvidencePath(entry);
            if (resolved?.type === 'path') {
              const full = path.resolve(resolved.value);
              expect(
                existsSync(full),
                `${adr.fileName}: evidence path does not exist: ${resolved.value} (from ${JSON.stringify(normalizeEvidence(entry))})`,
              ).toBe(true);
            }
          }
        }
      });
    }
  });

  describe('bidirectional related links — ADR↔ADR (AC #4)', () => {
    it('every ADR↔ADR reference is symmetric', () => {
      const failures: string[] = [];
      for (const adr of adrs) {
        for (const targetId of adr.relatedIds) {
          const target = byId.get(targetId);
          if (!target) {
            failures.push(`${adr.id} -> ${targetId}: target ADR does not exist`);
            continue;
          }
          if (!target.relatedIds.has(adr.id)) {
            failures.push(
              `${adr.id} references ${targetId} but ${targetId}.related does not reference ${adr.id} back`,
            );
          }
        }
      }
      expect(
        failures,
        `bidirectional related violations:\n  - ${failures.join('\n  - ')}`,
      ).toEqual([]);
    });
  });
});
