// Story 1.6 Citation Package (SC-2, AC-4)
// Refs: SC-2, AC-4, ADR-010
// @rules AC-4, SC-2 @adr ADR-010

import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const HERE = dirname(fileURLToPath(import.meta.url));
const ROOT = join(HERE, '..', '..', '..');

const UUID = '00000000-0000-4000-8000-000000000001';

describe('Story 1.6 — Citation package (SC-2, AC-4)', () => {
  it('CitationTuple zod schema lives in packages/contracts (AC-4 shape)', async () => {
    const { CitationTuple } = await import('@iip/contracts');
    const tuple = {
      source_doc_id: UUID,
      span_start: 42,
      span_end: 117,
      content_hash: '0'.repeat(64),
    };
    expect(CitationTuple.safeParse(tuple).success).toBe(true);
  });

  it('tuple is (source_doc_id, span_start, span_end, content_hash) — exact AC-4 shape', async () => {
    const { CitationTuple } = await import('@iip/contracts');
    const keys = Object.keys(CitationTuple.shape).sort();
    expect(keys).toEqual(['content_hash', 'source_doc_id', 'span_end', 'span_start']);
  });

  it('hash algorithm defined per ADR-010 (SHA-256 via Web Crypto)', () => {
    const adr = readFileSync(
      join(ROOT, 'docs/adr/0010-citation-hash-algorithm.md'),
      'utf8',
    );
    expect(adr).toMatch(/status:\s+Accepted/);
    expect(adr).toMatch(/sha-256|SHA-256/i);
    expect(adr).toMatch(/evidence:/);
  });

  it('emit(span, source) API exists and produces a valid CitationTuple', async () => {
    const { emit } = await import('@iip/citation');
    const content = 'Senator voted against bill X.';
    const source = { doc_id: UUID, content };
    const end = content.length;
    const citation = await emit({ start: 0, end, text: content }, source);
    expect(citation.source_doc_id).toBe(UUID);
    expect(citation.span_start).toBe(0);
    expect(citation.span_end).toBe(end);
    expect(citation.content_hash).toMatch(/^[a-f0-9]{64}$/); // sha256 hex, no prefix (ADR-010)
  });

  it('verify(citation, source) API exists and re-derives the hash', async () => {
    const { emit, verify } = await import('@iip/citation');
    const content = 'Senator voted against bill X.';
    const source = { doc_id: UUID, content };
    const citation = await emit({ start: 0, end: content.length, text: content }, source);
    expect(await verify(citation, source)).toBe(true);
    // Tampered source text → hash mismatch → verify false (SEC-2/SEC-6 citation-swap defense)
    expect(await verify(citation, { content: 'Senator voted FOR bill X.' })).toBe(false);
  });

  it('packages/citation is NOT coupled into packages/rag (AC-4 decoupling)', () => {
    const ragPkg = readFileSync(join(ROOT, 'packages/rag/package.json'), 'utf8');
    expect(ragPkg).not.toMatch(/@iip\/citation/);
  });

  it('content_hash survives re-indexing (binds to span, not vector)', async () => {
    const { emit } = await import('@iip/citation');
    const content = 'stable text here';
    const source = { doc_id: UUID, content };
    const citation = await emit({ start: 0, end: content.length, text: content }, source);
    expect(citation.content_hash).not.toContain('embedding');
    const reEmitted = await emit({ start: 0, end: content.length, text: content }, source);
    expect(citation.content_hash).toBe(reEmitted.content_hash);
  });
});
