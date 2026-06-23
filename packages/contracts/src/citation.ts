import { z } from 'zod';

/**
 * CitationTuple — the provenance data structure (AC-4, SC-2).
 *
 * Decouples citation from embeddings. Survives re-indexing.
 *
 * @rules AC-4, SC-2, EI-4, NFR-A-1
 * @adr ADR-001
 */
export const CitationTuple = z.object({
  source_doc_id: z.string().uuid(),
  span_start: z.number().int().nonnegative(),
  span_end: z.number().int().nonnegative(),
  content_hash: z.string().min(1),
});

export type CitationTuple = z.infer<typeof CitationTuple>;

/**
 * CitationRef — a reference to a citation on a rendered assertion.
 *
 * Citations are a typed top-level array on the answer contract,
 * never inline markup in answerText (Winston #6, mechanical AC-4).
 *
 * @rules AC-4, EI-1
 * @adr ADR-001
 */
export const CitationRef = z.object({
  citation_id: z.string().min(1),
  source_id: z.string().uuid(),
  trust_tier: z.union([
    z.literal(1),
    z.literal(2),
    z.literal(3),
  ]),
  tuple: CitationTuple,
});

export type CitationRef = z.infer<typeof CitationRef>;
