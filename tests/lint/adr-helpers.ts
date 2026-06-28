/**
 * Helper functions, constants, and types for the ADR lint test suite.
 *
 * Extracted from adr-lint.test.ts to keep the test file under 300 lines.
 *
 * @rules AC-1, AC-2, AC-3, AC-4, AC-5, SC-9, VAL-4
 */

import matter from 'gray-matter';
import { readFileSync, readdirSync, existsSync } from 'node:fs';
import path from 'node:path';

/** Required top-level (H2) section headers — exact, case-sensitive (AC #2). */
export const REQUIRED_SECTIONS = [
  '## Context',
  '## Decision',
  '## Alternatives',
  '## Consequences',
  '## Open questions',
] as const;

/** Allowed `status` values (AC #2). */
export const ALLOWED_STATUSES = new Set(['Proposed', 'Accepted', 'Superseded', 'Deprecated']);

/** ADR-id reference shape: ADR-NNN (used to scope the bidirectional check, AC #4). */
export const ADR_ID_RE = /^ADR-\d{3}$/;

/** Filename convention: four-digit kebab-case (AC #1). */
export const FILENAME_RE = /^\d{4}-.+\.md$/;

/** Markers that count as evidence "placeholders" (AC #3/#4). */
export const PLACEHOLDER_RE = /^(evidence\s+pending|tbd|todo|n\/a|none|\s*)$/i;

/**
 * Typed frontmatter shape. gray-matter returns `Record<string, unknown>` (an
 * index signature) which the project's `noPropertyAccessFromIndexSignature`
 * flag forbids dot-access on; naming the keys here restores dot-access.
 */
export interface AdrFrontmatter {
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

export interface AdrRecord {
  fileName: string;
  id: string;
  status: string;
  frontmatter: AdrFrontmatter;
  relatedIds: Set<string>;
  raw: string;
}

/**
 * Normalize an evidence entry to a string. gray-matter (js-yaml) parses list
 * items containing `: ` as maps and bare dates as Date objects; the path/URL
 * text lives in the resulting key/value, so we collapse any non-string entry
 * to a single searchable string before validating.
 */
export function normalizeEvidence(entry: unknown): string {
  if (typeof entry === 'string') return entry;
  if (entry instanceof Date) return entry.toISOString();
  if (entry !== null && typeof entry === 'object') {
    const pairs = Object.entries(entry as Record<string, unknown>);
    return pairs.map(([k, v]) => `${k} ${typeof v === 'string' ? v : ''}`).join(' ');
  }
  return String(entry ?? '');
}

/** An evidence entry is "real" if it is a URL or a path with a separator. */
export function isRealEvidence(entry: unknown): boolean {
  const text = normalizeEvidence(entry).trim();
  if (text === '') return false;
  if (PLACEHOLDER_RE.test(text)) return false;
  return /^https?:\/\//i.test(text) || text.includes('/') || /\.\w+/.test(text);
}

/** True when the (normalized) entry is an "evidence pending"-style placeholder. */
export function isPlaceholderEvidence(entry: unknown): boolean {
  return PLACEHOLDER_RE.test(normalizeEvidence(entry).trim());
}

/**
 * Extract the first resolvable path token from an evidence entry, or null if
 * none can be parsed. URLs (http/https) are returned as-is; local paths are
 * returned relative to the project root.
 */
export function resolveEvidencePath(entry: unknown): { type: 'url' | 'path'; value: string } | null {
  const text = normalizeEvidence(entry).trim();
  if (text === '') return null;

  const urlMatch = text.match(/https?:\/\/[^\s]+/);
  if (urlMatch) return { type: 'url', value: urlMatch[0] };

  const pathMatch = text.match(/[_a-zA-Z0-9][^\s]*\.[a-zA-Z0-9]+/);
  if (pathMatch) return { type: 'path', value: pathMatch[0] };

  const barePathMatch = text.match(/[_a-zA-Z0-9-][^\s]*\/[^\s]+/);
  if (barePathMatch) return { type: 'path', value: barePathMatch[0] };

  return null;
}

/** Load every ADR file, skipping macOS AppleDouble (`._*`) artefacts. */
export function loadAdrs(adrDir: string): AdrRecord[] {
  const files = readdirSync(adrDir)
    .filter((f) => f.endsWith('.md') && !f.startsWith('._'))
    .sort();
  return files.map((fileName) => {
    const fullPath = path.join(adrDir, fileName);
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
export function h2Headers(raw: string): Set<string> {
  const headers = new Set<string>();
  for (const line of raw.split('\n')) {
    const trimmed = line.trimEnd();
    if (/^## /.test(trimmed) && /^## /.test(line)) headers.add(trimmed);
  }
  return headers;
}

/** Re-export existsSync for convenience in the test file. */
export { existsSync };
