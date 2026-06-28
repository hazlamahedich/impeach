/**
 * Citation — Unicode / surrogate-pair span integrity + concurrent determinism (EXPANSION).
 *
 * Expands Story 1.6 coverage: defamation-grade spans containing astral
 * emoji and multi-codepoint characters, plus determinism under concurrent
 * emit() (BullMQ writer concurrency, PC-9).
 *
 * @rules AC-4, SC-2, PC-9
 * @adr ADR-010
 */

import { describe, it, expect } from 'vitest';
import { createHash } from 'node:crypto';
import { emit, verify } from '@iip/citation';

const UUID = '00000000-0000-4000-8000-000000000001';

/** Independent SHA-256 hex (NFC) via node:crypto — cross-checks the Web Crypto path. */
function expectedHash(text: string): string {
  return createHash('sha256').update(text.normalize('NFC'), 'utf8').digest('hex');
}

describe('Citation — astral / surrogate-pair span integrity (AC-4, ADR-010)', () => {
  it('[P0] emit over a span containing an astral emoji hashes the correct code units', async () => {
    // GIVEN content containing an astral-plane emoji (U+1F6A0, 2 UTF-16 code units)
    const content = 'Vote 🚠 yes';
    const span = { start: 0, end: content.length, text: content };

    // WHEN emit canonicalizes and hashes
    const citation = await emit(span, { doc_id: UUID, content });

    // THEN the digest matches the independent node:crypto computation
    expect(citation.content_hash).toBe(expectedHash(content));
    expect(citation.content_hash).toHaveLength(64);
  });

  it('[P0] verify round-trips for emoji-bearing content', async () => {
    // GIVEN an emitted citation over emoji content
    const content = 'Senator 🗳️ abstained.';
    const source = { doc_id: UUID, content };
    const citation = await emit({ start: 0, end: content.length, text: content }, source);

    // WHEN verify re-derives the hash
    // THEN it returns true (no surrogate corruption)
    expect(await verify(citation, { content })).toBe(true);
  });

  it('[P0] emit throws when the caller splits a surrogate pair (mis-slice defense)', async () => {
    // GIVEN a single astral char '🚠' occupies code-unit positions 0 and 1
    const content = '🚠';

    // WHEN the caller claims the span [0,1) with the full emoji text (splitting the pair)
    // THEN emit rejects it — content.substring(0,1) is the lone high surrogate, not '🚠'
    await expect(
      emit({ start: 0, end: 1, text: '🚠' }, { doc_id: UUID, content }),
    ).rejects.toThrow(/does not match/);
  });

  it('[P0] multi-codepoint Filipino/Tagalog characters (Ñ) round-trip verify', async () => {
    // GIVEN content with a precomposed multi-byte Latin char
    const content = 'Si Senator Ñg ang gumanap ng boto.';
    const source = { doc_id: UUID, content };
    const citation = await emit({ start: 0, end: content.length, text: content }, source);

    // WHEN verified
    // THEN the round-trip holds (Filipino production content, AR-24)
    expect(await verify(citation, source)).toBe(true);
    expect(citation.content_hash).toBe(expectedHash(content));
  });

  it('[P1] CJK content hashes deterministically across re-emits', async () => {
    // GIVEN Chinese-language content
    const content = '参议员对弹劾条款投了票。';
    const source = { doc_id: UUID, content };

    // WHEN emitted twice
    const a = await emit({ start: 0, end: content.length, text: content }, source);
    const b = await emit({ start: 0, end: content.length, text: content }, source);

    // THEN both digests are identical (deterministic across calls)
    expect(a.content_hash).toBe(b.content_hash);
    expect(a.content_hash).toBe(expectedHash(content));
  });
});

describe('Citation — concurrent emit determinism (PC-9, BullMQ concurrency)', () => {
  it('[P1] N=50 concurrent emit() calls on an identical span/source produce identical content_hash', async () => {
    // GIVEN one span/source
    const content = 'concurrent citation determinism check';
    const source = { doc_id: UUID, content };
    const span = { start: 0, end: content.length, text: content };

    // WHEN 50 concurrent emits race through the async Web Crypto path
    const results = await Promise.all(
      Array.from({ length: 50 }, () => emit(span, source)),
    );

    // THEN every hash is identical (no race-induced divergence)
    const first = results[0]!.content_hash;
    expect(results.every((r) => r.content_hash === first)).toBe(true);
    expect(first).toBe(expectedHash(content));
  });

  it('[P1] concurrent emits on DIFFERENT spans each produce their own correct hash (no cross-contamination)', async () => {
    // GIVEN 20 distinct spans of the same source
    const content = '0123456789ABCDEFGHIJ'; // 20 chars
    const source = { doc_id: UUID, content };
    const spans = Array.from({ length: 20 }, (_, i) => ({
      start: i,
      end: i + 1,
      text: content[i]!,
    }));

    // WHEN all 20 emit concurrently
    const results = await Promise.all(spans.map((s) => emit(s, source)));

    // THEN each hash matches the independent computation for ITS span text
    for (let i = 0; i < spans.length; i++) {
      expect(results[i]!.content_hash).toBe(expectedHash(spans[i]!.text));
    }
    // AND all 20 hashes are not uniformly identical (cross-contamination would collapse them)
    const unique = new Set(results.map((r) => r.content_hash));
    expect(unique.size).toBeGreaterThan(1);
  });

  it('[P1] concurrent emit + verify interleaved stays correct', async () => {
    // GIVEN 30 distinct spans
    const content = 'abcdefghijklmnopqrstuvwxyz0123'; // 30 chars
    const source = { doc_id: UUID, content };
    const spans = Array.from({ length: 30 }, (_, i) => ({
      start: i,
      end: i + 1,
      text: content[i]!,
    }));

    // WHEN emits run concurrently then verifies run concurrently
    const citations = await Promise.all(spans.map((s) => emit(s, source)));
    const verdicts = await Promise.all(citations.map((c) => verify(c, { content })));

    // THEN every verification passes (no concurrency-induced hash mismatch)
    expect(verdicts.every((v) => v === true)).toBe(true);
  });
});
