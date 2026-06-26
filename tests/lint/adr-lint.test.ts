import { describe, it, expect } from 'vitest';
import matter from 'gray-matter';
import { readFileSync, readdirSync, existsSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

/**
 * adr-lint — PC-3 template compliance for every ADR (Story 1.10, AC #1–#5).
 *
 * @rules AC-1, AC-2, AC-3, AC-4, AC-5, SC-9, VAL-4
 *
 * Validates the complete ADR set (ADR-001 … ADR-022) for:
 *  - Presence + filename convention (four-digit kebab-case)  (AC #1)
 *  - YAML frontmatter: required keys, exact types, 3-digit `id`  (AC #2)
 *  - The `supersedes_by` typo is rejected in favour of `superseded_by`  (AC #2)
 *  - Five required section headers, exact case-sensitive match  (AC #2)
 *  - Evidence requirement: `Accepted` needs real paths/URLs;
 *    "evidence pending" markers ONLY valid for `Proposed`  (AC #3, #4)
 *  - Bidirectional `related` links for ADR↔ADR references  (AC #4)
 */

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ADR_DIR = path.resolve(__dirname, '../../docs/adr');

/** Required top-level (H2) section headers — exact, case-sensitive (AC #2). */
const REQUIRED_SECTIONS = [
  '## Context',
  '## Decision',
  '## Alternatives',
  '## Consequences',
  '## Open questions',
] as const;

/** Allowed `status` values (AC #2). */
const ALLOWED_STATUSES = new Set(['Proposed', 'Accepted', 'Superseded', 'Deprecated']);

/** ADR-id reference shape: ADR-NNN (used to scope the bidirectional check, AC #4). */
const ADR_ID_RE = /^ADR-\d{3}$/;

/** Filename convention: four-digit kebab-case (AC #1). */
const FILENAME_RE = /^\d{4}-.+\.md$/;

/** Markers that count as evidence "placeholders" (AC #3/#4). */
const PLACEHOLDER_RE = /^(evidence\s+pending|tbd|todo|n\/a|none|\s*)$/i;

/**
 * Typed frontmatter shape. gray-matter returns `Record<string, unknown>` (an
 * index signature) which the project's `noPropertyAccessFromIndexSignature`
 * flag forbids dot-access on; naming the keys here restores dot-access.
 */
interface AdrFrontmatter {
  id?: unknown;
  title?: unknown;
  status?: unknown;
  date?: unknown;
  supersedes?: unknown;
  superseded_by?: unknown;
  deciders?: unknown;
  related?: unknown;
  evidence?: unknown;
}

/**
 * Normalize an evidence entry to a string. gray-matter (js-yaml) parses list
 * items containing `: ` as maps and bare dates as Date objects; the path/URL
 * text lives in the resulting key/value, so we collapse any non-string entry
 * to a single searchable string before validating.
 */
function normalizeEvidence(entry: unknown): string {
  if (typeof entry === 'string') return entry;
  if (entry instanceof Date) return entry.toISOString();
  if (entry !== null && typeof entry === 'object') {
    const pairs = Object.entries(entry as Record<string, unknown>);
    return pairs.map(([k, v]) => `${k} ${typeof v === 'string' ? v : ''}`).join(' ');
  }
  return String(entry ?? '');
}

/** An evidence entry is "real" if it is a URL or a path with a separator. */
function isRealEvidence(entry: unknown): boolean {
  const text = normalizeEvidence(entry).trim();
  if (text === '') return false;
  if (PLACEHOLDER_RE.test(text)) return false;
  // URL or a filesystem path containing a separator/extension.
  return /^https?:\/\//i.test(text) || text.includes('/') || /\.\w+/.test(text);
}

/** True when the (normalized) entry is an "evidence pending"-style placeholder. */
function isPlaceholderEvidence(entry: unknown): boolean {
  return PLACEHOLDER_RE.test(normalizeEvidence(entry).trim());
}

/**
 * Extract the first resolvable path token from an evidence entry, or null if
 * none can be parsed. URLs (http/https) are returned as-is; local paths are
 * returned relative to the project root.
 */
function resolveEvidencePath(entry: unknown): { type: 'url' | 'path'; value: string } | null {
  const text = normalizeEvidence(entry).trim();
  if (text === '') return null;

  // URL: first http(s) URL in the string.
  const urlMatch = text.match(/https?:\/\/[^\s]+/);
  if (urlMatch) return { type: 'url', value: urlMatch[0] };

  // Local path: first token that contains a path separator or a file extension.
  const pathMatch = text.match(/[_a-zA-Z0-9][^\s]*\.[a-zA-Z0-9]+/);
  if (pathMatch) return { type: 'path', value: pathMatch[0] };

  // Bare directory-like token with a slash.
  const barePathMatch = text.match(/[_a-zA-Z0-9-][^\s]*\/[^\s]+/);
  if (barePathMatch) return { type: 'path', value: barePathMatch[0] };

  return null;
}

interface AdrRecord {
  fileName: string;
  id: string;
  status: string;
  frontmatter: AdrFrontmatter;
  relatedIds: Set<string>;
  raw: string;
}

/** Load every ADR file, skipping macOS AppleDouble (`._*`) artefacts. */
function loadAdrs(): AdrRecord[] {
  const files = readdirSync(ADR_DIR)
    .filter((f) => f.endsWith('.md') && !f.startsWith('._'))
    .sort();
  return files.map((fileName) => {
    const fullPath = path.join(ADR_DIR, fileName);
    const raw = readFileSync(fullPath, 'utf8');
    const parsed = matter(raw);
    const fm = parsed.data as AdrFrontmatter;
    const related = Array.isArray(fm.related) ? (fm.related as unknown[]) : [];
    const relatedIds = new Set(
      related.filter((r): r is string => typeof r === 'string' && ADR_ID_RE.test(r)),
    );
    return {
      fileName,
      id: typeof fm.id === 'string' ? fm.id : '',
      status: typeof fm.status === 'string' ? fm.status : '',
      frontmatter: fm,
      relatedIds,
      raw,
    };
  });
}

/** Extract the set of H2 headers present (exact lines), case-sensitive. */
function h2Headers(raw: string): Set<string> {
  const headers = new Set<string>();
  for (const line of raw.split('\n')) {
    // H2 must start at the beginning of the line (no leading whitespace) to be
    // an "exact" match under the PC-3 template.
    const trimmed = line.trimEnd();
    if (/^## /.test(trimmed) && /^## /.test(line)) headers.add(trimmed);
  }
  return headers;
}

describe('adr-lint — PC-3 template compliance (AC #1–#5)', () => {
  const adrs = loadAdrs();
  const byId = new Map(adrs.map((a) => [a.id, a]));

  it('docs/adr/ contains the complete ADR-001 … ADR-022 set with unique ids (AC #1)', () => {
    expect(adrs.length).toBe(22);
    const seenIds = new Set<string>();
    for (let n = 1; n <= 22; n += 1) {
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
          // id: 3-digit exactly, e.g. ADR-001.
          expect(typeof fm.id, `${adr.fileName}: id must be a string`).toBe('string');
          expect(fm.id, `${adr.fileName}: id must match ADR-NNN (3-digit)`).toMatch(/^ADR-\d{3}$/);
          // title: non-empty string.
          expect(typeof fm.title, `${adr.fileName}: title must be a string`).toBe('string');
          expect((fm.title as string).trim().length, `${adr.fileName}: title empty`).toBeGreaterThan(0);
          // status: allowed enum.
          expect(
            ALLOWED_STATUSES.has(fm.status as string),
            `${adr.fileName}: status ${JSON.stringify(fm.status)} not in {${[...ALLOWED_STATUSES].join(',')}}`,
          ).toBe(true);
          // date: YYYY-MM-DD (gray-matter parses YAML dates to Date objects — coerce).
          const dateStr =
            fm.date instanceof Date ? fm.date.toISOString().slice(0, 10) : String(fm.date);
          expect(dateStr, `${adr.fileName}: date must be YYYY-MM-DD`).toMatch(/^\d{4}-\d{2}-\d{2}$/);
          // supersedes / superseded_by: null or string.
          for (const k of ['supersedes', 'superseded_by'] as const) {
            const v = fm[k];
            expect(
              v === null || typeof v === 'string',
              `${adr.fileName}: ${k} must be null or string`,
            ).toBe(true);
          }
          // deciders: non-empty array of strings.
          expect(Array.isArray(fm.deciders), `${adr.fileName}: deciders must be an array`).toBe(true);
          expect((fm.deciders as unknown[]).length, `${adr.fileName}: deciders empty`).toBeGreaterThan(0);
          // related: array.
          expect(Array.isArray(fm.related), `${adr.fileName}: related must be an array`).toBe(true);
          // evidence: array.
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
          // Proposed: may carry "evidence pending" markers; real evidence optional.
          // AC #4: "evidence pending" markers ONLY allowed for Proposed.
          expect(
            evidence.length > 0,
            `${adr.fileName}: Proposed ADR must still declare an evidence array`,
          ).toBe(true);
        } else {
          // Accepted / Superseded / Deprecated: non-empty, all real paths/URLs.
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

          // Local evidence paths must resolve relative to the project root.
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
