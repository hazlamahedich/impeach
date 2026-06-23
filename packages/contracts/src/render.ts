import { z } from 'zod';
import { CitationRef } from './citation.js';

/**
 * RenderSpan — a single unit of rendered output.
 *
 * A claim-bearing clause. Either carries a citation (served) or
 * does not (must be stripped by the render gate).
 *
 * @rules AC-2, EI-1, EI-7
 * @adr ADR-001
 */
export const RenderSpan = z.object({
  text: z.string().min(1),
  is_claim: z.boolean(),
  claim_type: z.union([
    z.literal('fact'),
    z.literal('attributed'),
  ]).optional(),
  citation: CitationRef.nullable(),
});

export type RenderSpan = z.infer<typeof RenderSpan>;

/**
 * RenderDocument — the sealed typed AST output of the render pipeline.
 *
 * NEVER a raw string. The only sanctioned serializer lives in
 * packages/render/src/serialize.ts (Winston #4).
 *
 * @rules AC-2, SEC-5
 * @adr ADR-001
 */
export const RenderDocument = z.object({
  spans: z.array(RenderSpan),
  no_evidence: z.boolean().default(false),
  essence_sentence: z.string().optional(),
});

export type RenderDocument = z.infer<typeof RenderDocument>;

/**
 * RenderInput — the shared symbol between rag and render.
 *
 * This is the ONLY type that crosses the rag→render boundary (SC-3).
 *
 * @rules SC-3, STR-4
 */
export const RenderInput = z.object({
  query: z.string(),
  answer_text: z.string(),
  spans: z.array(z.object({
    text: z.string(),
    is_claim: z.boolean(),
    claim_type: z.union([
      z.literal('fact'),
      z.literal('attributed'),
    ]).optional(),
    citation_ref: CitationRef.nullable(),
  })),
});

export type RenderInput = z.infer<typeof RenderInput>;

/**
 * RenderViolation — error thrown when the render gate detects
 * an uncited claim-bearing clause.
 *
 * @rules AC-2, SEC-5
 */
export class RenderViolation extends Error {
  override readonly name = 'RenderViolation';
  constructor(
    message: string,
    readonly span_text: string,
  ) {
    super(message);
  }
}
