/**
 * Contract test — Story 3.5 Citation Tuple Interop (AC-12, SC-1).
 *
 * Verifies that a CitationTuple emitted by `@iip/ingest/provenance` (via
 * `@iip/citation`) deserializes correctly in `@iip/citation` using the shared
 * `CitationTuple` schema from `@iip/contracts`. This is the SC-1 polyglot
 * contract boundary: the tuple shape MUST be identical across producer
 * (`@iip/ingest/provenance`) and consumer (`@iip/citation`).
 *
 * @rules FR-1.5, AC-2, AC-12, SC-1
 * @adr ADR-010
 */

import { describe, it, expect } from 'vitest';
import { CitationTuple } from '@iip/contracts';
import type { CitationTuple as CitationTupleType } from '@iip/contracts';
import * as citation from '@iip/citation';

describe('Story 3.5 — Citation Tuple Interop contract (AC-12, SC-1)', () => {

  it('PR-15: CitationTuple emitted by @iip/citation parses via @iip/contracts CitationTuple schema', async () => {
    // Emit a citation tuple using @iip/citation (the same path provenance uses).
    const content = 'The Senate voted on the impeachment article on July 4.';
    const tuple = await citation.emit(
      { start: 0, end: 11, text: content.substring(0, 11) },
      { doc_id: '11111111-1111-4111-8111-111111111111', content },
    );

    // The tuple MUST parse via the shared CitationTuple schema from @iip/contracts.
    const result = CitationTuple.safeParse(tuple);
    expect(result.success).toBe(true);

    // Fields are exactly as specified by the shared schema.
    const parsed = result.success ? result.data : null;
    expect(parsed).not.toBeNull();
    expect(parsed!.source_doc_id).toBe('11111111-1111-4111-8111-111111111111');
    expect(parsed!.span_start).toBe(0);
    expect(parsed!.span_end).toBe(11);
    expect(parsed!.content_hash).toHaveLength(64);
    expect(parsed!.content_hash).toMatch(/^[a-f0-9]{64}$/);
  });

  it("PR-15b: a CitationTuple round-trips through JSON (serialization doesn't break the schema)", async () => {
    const content = 'Round-trip serialization test content.';
    const tuple = await citation.emit(
      { start: 0, end: 7, text: content.substring(0, 7) },
      { doc_id: '22222222-2222-4222-8222-222222222222', content },
    );

    // Simulate serialization across a process/queue boundary.
    const json = JSON.stringify(tuple);
    const deserialized = JSON.parse(json) as CitationTupleType;

    // The deserialized tuple MUST still parse + verify.
    const result = CitationTuple.safeParse(deserialized);
    expect(result.success).toBe(true);

    const isValid = await citation.verify(deserialized, { content });
    expect(isValid).toBe(true);
  });

  it('PR-15c: CitationTuple rejects malformed source_doc_id (not a UUID)', () => {
    const result = CitationTuple.safeParse({
      source_doc_id: 'not-a-uuid',
      span_start: 0,
      span_end: 10,
      content_hash: 'a'.repeat(64),
    });
    expect(result.success).toBe(false);
  });

  it('PR-15d: CitationTuple rejects malformed content_hash (not 64-char hex)', () => {
    const result = CitationTuple.safeParse({
      source_doc_id: '11111111-1111-4111-8111-111111111111',
      span_start: 0,
      span_end: 10,
      content_hash: 'too-short',
    });
    expect(result.success).toBe(false);
  });

  it('PR-15e: CitationTuple rejects negative span indices', () => {
    const result = CitationTuple.safeParse({
      source_doc_id: '11111111-1111-4111-8111-111111111111',
      span_start: -1,
      span_end: 10,
      content_hash: 'a'.repeat(64),
    });
    expect(result.success).toBe(false);
  });
});
