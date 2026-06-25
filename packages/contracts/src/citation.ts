import { z } from 'zod';

/**
 * CorpusHash — branded type for SHA-256 content hashes.
 *
 * Prevents accidental assignment of arbitrary strings to content_hash.
 * `corpusHash = prevHash` is a compile error without this brand.
 *
 * @rules AC-4, SEC-2
 * @adr ADR-010
 */
const CorpusHash = z.string().regex(/^[a-f0-9]{64}$/, 'must be a 64-char hex SHA-256 hash').brand('CorpusHash');
export type CorpusHash = z.infer<typeof CorpusHash>;

/**
 * CitationTuple — the provenance data structure (AC-4, SC-2).
 *
 * Decouples citation from embeddings. Survives re-indexing.
 * Hash algorithm: SHA-256 via Web Crypto API (ADR-010).
 *
 * @rules AC-4, SC-2, EI-4, NFR-A-1
 * @adr ADR-001, ADR-010
 */
export const CitationTuple = z.object({
  source_doc_id: z.string().uuid({ message: 'must be a valid UUID v4' }),
  span_start: z.number().int().nonnegative(),
  span_end: z.number().int().nonnegative(),
  content_hash: CorpusHash,
});

export type CitationTuple = z.infer<typeof CitationTuple>;

/**
 * CitationRef — a reference to a citation on a rendered assertion.
 *
 * Citations are a typed top-level array on the answer contract,
 * never inline markup in answerText (Winston #6, mechanical AC-4).
 *
 * @rules AC-4, EI-1
 * @adr ADR-001, ADR-010
 */
export const CitationRef = z.object({
  citation_id: z.string().min(1),
  source_id: z.string().uuid({ message: 'must be a valid UUID v4' }),
  trust_tier: z.union([
    z.literal(1),
    z.literal(2),
    z.literal(3),
  ]),
  tuple: CitationTuple,
});

export type CitationRef = z.infer<typeof CitationRef>;
