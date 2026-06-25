/**
 * @iip/citation — Citation provenance package (SC-2, AC-4).
 *
 * Owns the synchronous-ish emit/verify API that binds a rendered span to its
 * source document via a SHA-256 content hash. Decoupled from `@iip/rag` so
 * citation validity survives embedding/re-indexing runs (AC-4 essence).
 *
 * Hash algorithm: SHA-256 via the global Web Crypto API (`crypto.subtle`),
 * formatted as a 64-character lowercase hex string (NO prefix), per ADR-010.
 * NFC Unicode normalization is applied to the extracted span text before
 * hashing so the digest is stable across process boundaries.
 *
 * @rules AC-4, SC-2, EI-4
 * @adr ADR-010
 */

import { CitationTuple } from '@iip/contracts';
import type { CitationTuple as CitationTupleType } from '@iip/contracts';

/** A span over a source document, with the text the caller asserts lives there. */
export interface CitationSpan {
  /** Inclusive start index into `source.content`. */
  start: number;
  /** Exclusive end index into `source.content`. */
  end: number;
  /** The text the caller believes occupies `[start, end)`. Verified fail-closed. */
  text: string;
}

/** A source document against which a citation is emitted/verified. */
export interface CitationSource {
  /** UUID v4 of the source document — becomes `source_doc_id` on the tuple. */
  doc_id: string;
  /** Full document text the span indices reference. */
  content: string;
}

/** Minimal source shape required by `verify` (no id needed). */
export interface VerificationSource {
  content: string;
}

/**
 * Compute the SHA-256 digest of canonicalized text as 64-char lowercase hex.
 * Uses the global Web Crypto API (portable across Node/edge/browser/RSC).
 */
async function sha256Hex(text: string): Promise<string> {
  const data = new TextEncoder().encode(text.normalize('NFC'));
  const digest = await crypto.subtle.digest('SHA-256', data);
  const bytes = new Uint8Array(digest);
  let hex = '';
  for (const b of bytes) {
    hex += b.toString(16).padStart(2, '0');
  }
  return hex;
}

function assertIntegerIndex(value: number, name: string): void {
  if (!Number.isInteger(value)) {
    throw new Error(
      `citation emit: ${name} must be an integer (got ${value})`,
    );
  }
  if (!Number.isFinite(value) || value < 0) {
    throw new Error(
      `citation emit: ${name} must be a non-negative finite integer (got ${value})`,
    );
  }
}

/**
 * Emit a citation tuple for `span` over `source`.
 *
 * Fail-closed: throws a descriptive error if `span.text` does not exactly equal
 * `source.content.substring(span.start, span.end)`, or if the indices are out of
 * bounds / non-integral. Never returns an unverified tuple.
 *
 * @returns a `CitationTuple` whose `content_hash` is the SHA-256 hex of the span.
 */
export async function emit(
  span: CitationSpan,
  source: CitationSource,
): Promise<CitationTupleType> {
  assertIntegerIndex(span.start, 'span.start');
  assertIntegerIndex(span.end, 'span.end');

  if (span.start > span.end) {
    throw new Error(
      `citation emit: span.start (${span.start}) must be <= span.end (${span.end})`,
    );
  }
  if (span.end > source.content.length) {
    throw new Error(
      `citation emit: span.end (${span.end}) exceeds source.content length (${source.content.length})`,
    );
  }

  const extracted = source.content.substring(span.start, span.end);
  if (extracted !== span.text) {
    throw new Error(
      `citation emit: span.text does not match source.content[${span.start}..${span.end}). ` +
        `expected ${JSON.stringify(span.text)}, found ${JSON.stringify(extracted)}`,
    );
  }

  const contentHash = await sha256Hex(extracted);

  return CitationTuple.parse({
    source_doc_id: source.doc_id,
    span_start: span.start,
    span_end: span.end,
    content_hash: contentHash,
  });
}

/**
 * Verify a citation against a source.
 *
 * Re-derives the SHA-256 hash of `source.content[citation.span_start..span_end)`
 * and compares it to `citation.content_hash`. Returns `false` for any structural
 * problem (malformed citation, out-of-bounds indices) — fail-closed to silence.
 *
 * @returns `true` iff the recomputed hash matches.
 */
export async function verify(
  citation: CitationTupleType,
  source: VerificationSource,
): Promise<boolean> {
  const parsed = CitationTuple.safeParse(citation);
  if (!parsed.success) {
    return false;
  }
  const tuple = parsed.data;

  if (tuple.span_start > tuple.span_end || tuple.span_end > source.content.length) {
    return false;
  }

  const extracted = source.content.substring(tuple.span_start, tuple.span_end);
  const recomputed = await sha256Hex(extracted);
  return recomputed === tuple.content_hash;
}
