// Story 1.6 — @iip/citation unit + property tests (AC: #2, #3, #5)
// Refs: SC-2, AC-4, PC-9, ADR-010
// @rules AC-2, AC-4, SC-2, PC-9 @adr ADR-010

import { describe, it, expect } from 'vitest';
import { createHash } from 'node:crypto';
import { readFileSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import fc from 'fast-check';
import { emit, verify } from '@iip/citation';
import { CitationTuple } from '@iip/contracts';
import type { CitationTuple as CitationTupleType } from '@iip/contracts';

const HERE = dirname(fileURLToPath(import.meta.url));
const ROOT = join(HERE, '..', '..', '..');
const UUID = '00000000-0000-4000-8000-000000000001'; // valid v4 (version nibble 4, variant 8)
const PKG_SRC = readFileSync(join(ROOT, 'packages/citation/src/index.ts'), 'utf8');

/** Independent SHA-256 hex (NFC) via node:crypto to cross-check the Web Crypto path. */
function expectedHash(text: string): string {
  return createHash('sha256').update(text.normalize('NFC'), 'utf8').digest('hex');
}

describe('@iip/citation — emit() happy paths (AC #2)', () => {
  it('returns a CitationTuple with the source id, span, and a 64-char hex hash', async () => {
    const content = 'The senator abstained on the third reading.';
    const source = { doc_id: UUID, content };
    const citation = await emit({ start: 4, end: 24, text: content.slice(4, 24) }, source);

    expect(citation).toEqual({
      source_doc_id: UUID,
      span_start: 4,
      span_end: 24,
      content_hash: expect.stringMatching(/^[a-f0-9]{64}$/),
    });
  });

  it('content_hash matches an independent node:crypto SHA-256 (NFC) computation', async () => {
    const content = 'cross-check digest equivalence';
    const text = content; // full span
    const citation = await emit({ start: 0, end: content.length, text }, { doc_id: UUID, content });
    expect(citation.content_hash).toBe(expectedHash(text));
  });

  it('is deterministic — identical span/source re-emit to the same hash', async () => {
    const content = 'deterministic input';
    const source = { doc_id: UUID, content };
    const a = await emit({ start: 0, end: content.length, text: content }, source);
    const b = await emit({ start: 0, end: content.length, text: content }, source);
    expect(a).toEqual(b);
  });

  it('validates the returned tuple against the CitationTuple zod schema', async () => {
    const content = 'schema-validated';
    const citation: CitationTupleType = await emit(
      { start: 0, end: content.length, text: content },
      { doc_id: UUID, content },
    );
    expect(CitationTuple.safeParse(citation).success).toBe(true);
  });
});

describe('@iip/citation — emit() fail-closed mismatch / bounds (AC #2, #3)', () => {
  const content = 'Senator voted against bill X.';

  it('throws on a 1-character text mismatch', async () => {
    await expect(
      emit(
        { start: 0, end: 8, text: 'Senatory' },
        { doc_id: UUID, content },
      ),
    ).rejects.toThrow(/span\.text does not match/);
  });

  it('throws when span.text is off by one in length', async () => {
    await expect(
      emit({ start: 0, end: 8, text: content.slice(0, 7) }, { doc_id: UUID, content }),
    ).rejects.toThrow(/span\.text does not match/);
  });

  it('throws when span.end exceeds source.content length (out of bounds)', async () => {
    await expect(
      emit({ start: 0, end: content.length + 1, text: content }, { doc_id: UUID, content }),
    ).rejects.toThrow(/exceeds source\.content length/);
  });

  it('throws when span.start > span.end', async () => {
    await expect(
      emit({ start: 10, end: 5, text: '' }, { doc_id: UUID, content }),
    ).rejects.toThrow(/span\.start .* must be <= span\.end/);
  });

  it('throws on a negative index', async () => {
    await expect(
      emit({ start: -1, end: 5, text: content.slice(0, 5) }, { doc_id: UUID, content }),
    ).rejects.toThrow(/non-negative/);
  });

  it('throws on a non-integer index', async () => {
    await expect(
      emit({ start: 0, end: 5.5, text: content.slice(0, 5) }, { doc_id: UUID, content }),
    ).rejects.toThrow(/must be an integer/);
  });

  it('throws on an invalid (non-UUID) source.doc_id via schema parse', async () => {
    await expect(
      emit({ start: 0, end: 5, text: content.slice(0, 5) }, { doc_id: 'not-a-uuid', content }),
    ).rejects.toThrow();
  });

  it('error messages are descriptive (contain context for a libel-defense audit)', async () => {
    const err = await emit({ start: 0, end: 4, text: 'XXXX' }, { doc_id: UUID, content }).catch(
      (e) => e,
    );
    expect(err).toBeInstanceOf(Error);
    expect((err as Error).message).toContain('does not match');
    expect((err as Error).message).toContain('XXXX');
    expect((err as Error).message).toContain('Sena'); // content[0..4) = 'Sena'
  });

  it('allows a zero-length span at any valid cursor position', async () => {
    const citation = await emit({ start: 5, end: 5, text: '' }, { doc_id: UUID, content });
    expect(citation.content_hash).toBe(expectedHash(''));
  });
});

describe('@iip/citation — verify() (AC #2, #4)', () => {
  const content = 'Senator voted against bill X.';
  const source = { doc_id: UUID, content };

  it('returns true for a freshly-emitted citation', async () => {
    const citation = await emit({ start: 0, end: content.length, text: content }, source);
    expect(await verify(citation, { content })).toBe(true);
  });

  it('returns false when source content has been tampered with', async () => {
    const citation = await emit({ start: 0, end: content.length, text: content }, source);
    expect(await verify(citation, { content: 'Senator voted FOR bill X.' })).toBe(false);
  });

  it('returns false when a single character within the span is altered (citation-swap defense)', async () => {
    const citation = await emit({ start: 0, end: content.length, text: content }, source);
    const tamperedWithin = 'x' + content.slice(1); // flip first char of the cited span
    expect(await verify(citation, { content: tamperedWithin })).toBe(false);
  });

  it('returns false when indices are shifted (off-by-one span)', async () => {
    const citation = await emit({ start: 0, end: content.length, text: content }, source);
    const shifted: CitationTupleType = { ...citation, span_start: 1, span_end: content.length + 1 };
    expect(await verify(shifted, { content })).toBe(false);
  });

  it('returns false (does not throw) for a structurally malformed citation', async () => {
    const malformed = { source_doc_id: 'nope', span_start: 0, span_end: 1, content_hash: 'abc' };
    expect(await verify(malformed as unknown as CitationTupleType, { content })).toBe(false);
  });

  it('returns false when content_hash is wrong but structurally valid', async () => {
    const citation = await emit({ start: 0, end: content.length, text: content }, source);
    const forged = CitationTuple.parse({ ...citation, content_hash: '0'.repeat(64) });
    expect(await verify(forged, { content })).toBe(false);
  });

  it('returns false when the cited span is out of bounds for the given source', async () => {
    const citation = await emit({ start: 0, end: content.length, text: content }, source);
    expect(await verify(citation, { content: 'short' })).toBe(false);
  });
});

describe('@iip/citation — Unicode / normalization (ADR-010)', () => {
  it('NFC-equivalent precomposed + decomposed spans hash identically', async () => {
    // 'é' precomposed U+00E9 vs decomposed U+0065 U+0301
    const precomposed = 'café';
    const decomposed = 'cafe\u0301';
    const content = precomposed;
    // NB: indices reference the precomposed content; text carries the decomposed form,
    // which emit compares against the raw substring. We compare hashes of normalized text.
    const hashPre = expectedHash(precomposed);
    const hashDec = expectedHash(decomposed);
    expect(hashPre).toBe(hashDec); // NFC normalization makes them equal
    // And emit over the precomposed content yields the normalized hash:
    const citation = await emit(
      { start: 0, end: content.length, text: content },
      { doc_id: UUID, content },
    );
    expect(citation.content_hash).toBe(hashPre);
  });
});

describe('@iip/citation — property tests (PC-9, AC #5)', () => {
  // Property 1: round-trip — verify(emit(span, source), source) === true for any valid span.
  it('verify(emit(...)) is always true for any valid substring (200 runs)', async () => {
    await fc.assert(
      fc.asyncProperty(
        fc.string({ minLength: 1, maxLength: 300 }),
        fc.nat(),
        fc.nat(),
        async (content, a, b) => {
          const n = content.length;
          const start = a % (n + 1);
          const end = start + (b % (n + 1 - start));
          const text = content.substring(start, end);
          const citation = await emit(
            { start, end, text },
            { doc_id: UUID, content },
          );
          expect(await verify(citation, { content })).toBe(true);
        },
      ),
      { numRuns: 200 },
    );
  });

  // Property 2: any single code-unit tamper inside the span → verify === false.
  it('any single-char tamper within the span breaks verification (200 runs)', async () => {
    await fc.assert(
      fc.asyncProperty(
        fc.string({ minLength: 2, maxLength: 300 }).filter((s) => s.length >= 2),
        fc.nat(),
        fc.nat(),
        fc.char(),
        async (content, a, b, replacement) => {
          const n = content.length;
          const start = a % (n - 1);
          const end = start + 1 + (b % (n - start - 1)); // span length >= 2
          const text = content.substring(start, end);
          const citation = await emit(
            { start, end, text },
            { doc_id: UUID, content },
          );
          // tamper the middle character of the content; ensure it lands inside the span
          const mid = Math.floor((start + end) / 2);
          const tampered = content.substring(0, mid) + replacement + content.substring(mid + 1);
          if (tampered === content) return; // replacement happened to equal original — skip
          expect(await verify(citation, { content: tampered })).toBe(false);
        },
      ),
      { numRuns: 200 },
    );
  });
});

describe('@iip/citation — package boundary (AC #3, SC-2)', () => {
  it('index.ts imports only @iip/contracts (no @iip/rag import, no node:crypto import)', () => {
    // Match actual import statements, not docstring mentions of "@iip/rag".
    const importLines = PKG_SRC.match(/^\s*import\s.+$/gm) ?? [];
    const importSources = importLines
      .map((l) => l.match(/from\s+['"]([^'"]+)['"]/)?.[1] ?? '')
      .filter(Boolean);
    // No @iip/rag, no node:crypto — only @iip/contracts among @iip/* and runtime globals otherwise.
    expect(importSources).not.toContain('node:crypto');
    expect(importSources.some((s) => s.startsWith('@iip/rag'))).toBe(false);
    const iipImports = importSources.filter((s) => s.startsWith('@iip/'));
    expect([...new Set(iipImports)]).toEqual(['@iip/contracts']);
    // Web Crypto global is used (portable per ADR-010)
    expect(PKG_SRC).toMatch(/crypto\.subtle\.digest/);
  });

  it('packages/rag does not depend on @iip/citation (decoupling)', () => {
    const ragPkg = readFileSync(join(ROOT, 'packages/rag/package.json'), 'utf8');
    expect(ragPkg).not.toMatch(/@iip\/citation/);
  });
});
