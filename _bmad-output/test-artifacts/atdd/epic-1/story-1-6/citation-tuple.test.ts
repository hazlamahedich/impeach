// target-path: packages/citation/citation-tuple.test.ts
// RED — Story 1.6 Citation Package (SC-2, AC-4)
// Refs: SC-2, AC-4, ADR-010
// @rules AC-4, SC-2 @adr ADR-010

import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';

const ROOT = join(__dirname, '..', '..');

describe.skip('Story 1.6 — Citation package (SC-2, AC-4)', () => {
  // RED — packages/citation + packages/contracts absent

  it('CitationTuple zod schema lives in packages/contracts (AC-4 shape)', async () => {
    // RED — contracts absent
    const { CitationTuple } = await import('@iip/contracts');
    const tuple = {
      source_doc_id: '00000000-0000-4000-8000-000000000001',
      span_start: 42,
      span_end: 117,
      content_hash: '0'.repeat(64),
    };
    expect(CitationTuple.safeParse(tuple).success).toBe(true);
  });

  it('tuple is (source_doc_id, span_start, span_end, content_hash) — exact AC-4 shape', async () => {
    // RED — defends against field drift (adding 'score' or 'embedding' would break AC-4)
    const { CitationTuple } = await import('@iip/contracts');
    const keys = Object.keys(CitationTuple.shape).sort();
    expect(keys).toEqual(['content_hash', 'source_doc_id', 'span_end', 'span_start']);
  });

  it('hash algorithm defined per ADR-010 (SHA-256 via Web Crypto)', () => {
    // RED — ADR-010 not yet Accepted
    const adr = readFileSync(join(ROOT, 'docs/adr/0010-citation-hash-algorithm.md'), 'utf8');
    expect(adr).toMatch(/status:\s+Accepted/);
    expect(adr).toMatch(/sha-256|SHA-256/i);
    expect(adr).toMatch(/evidence:/); // PC-3: Accepted requires evidence
  });

  it('emit(span, source) API exists and produces a valid CitationTuple', async () => {
    // RED — emit() absent
    const { emit } = await import('@iip/citation');
    const source = { id: '00000000-0000-4000-8000-000000000001', text: 'Senator voted against bill X.' };
    const span = { start: 0, end: 30 };
    const citation = emit(span, source);
    expect(citation.source_doc_id).toBe(source.id);
    expect(citation.span_start).toBe(0);
    expect(citation.span_end).toBe(30);
    expect(citation.content_hash).toMatch(/^[a-f0-9]{64}$/); // sha256 hex
  });

  it('verify(citation, source) API exists and re-derives the hash', async () => {
    // RED — verify() absent; defends against citation-swap (SEC-2/SEC-6 concern)
    const { emit, verify } = await import('@iip/citation');
    const source = { id: 'doc-1', text: 'Senator voted against bill X.' };
    const citation = emit({ start: 0, end: 30 }, source);
    expect(verify(citation, source)).toBe(true);
    // Tampered source text → hash mismatch → verify false
    expect(verify(citation, { ...source, text: 'Senator voted FOR bill X.' })).toBe(false);
  });

  it('packages/citation is NOT coupled into packages/rag (AC-4 decoupling)', () => {
    // RED — mechanical check that rag doesn't import citation at compile time
    const ragPkg = readFileSync(join(ROOT, 'packages/rag/package.json'), 'utf8');
    expect(ragPkg).not.toMatch(/@iip\/citation/);
  });

  it('content_hash survives re-indexing (binds to span, not vector)', async () => {
    // RED — AC-4 essence: re-embedding preserves citation validity
    const { emit } = await import('@iip/citation');
    const source = { id: 'doc-1', text: 'stable text' };
    const citation = emit({ start: 0, end: 12 }, source);
    // Simulate re-index: embedding changes but text span does not
    expect(citation.content_hash).not.toContain('embedding');
    expect(citation.content_hash).toBe(emit({ start: 0, end: 12 }, source).content_hash);
  });
});
