/**
 * Canonical application error shape.
 *
 * Every package that can fail in a domain-specific way throws a typed
 * subclass of AppError so callers can branch exhaustively. Raw `throw new
 * Error(...)` is banned outside of `@iip/contracts` tests (Winston #17).
 *
 * @rules AC-2, SEC-5, EI-7
 * @adr ADR-001
 */
export class AppError extends Error {
  override readonly name: string = 'AppError';
  constructor(
    message: string,
    readonly code: string,
  ) {
    super(message);
  }
}

/**
 * CitationEmitError — thrown by `@iip/citation` when a span cannot be
 * trusted: index/bounds violations or a mismatch between the caller's
 * asserted span.text and the source.content substring.
 *
 * Fail-closed: callers treat any CitationEmitError as an unverifiable
 * citation and withhold the claim (AC-2, SC-3).
 *
 * @rules AC-2, SC-2, SC-3
 * @adr ADR-010
 */
export class CitationEmitError extends AppError {
  override readonly name: string = 'CitationEmitError';
  constructor(message: string) {
    super(message, 'citation_emit_failed');
  }
}

// ── Story 3.5 — Provenance service error variants (FR-1.5, AC-5, AC-7, AC-10) ──

/**
 * SourceNotFoundError — the `source_id` referenced by a `registerDocument` call
 * does not exist in the `sources` table (foreign-key violation, AC-5). Wraps
 * Postgres error code `23503` so callers never see a raw DB error.
 *
 * @rules FR-1.5, AC-5, SEC-2
 */
export class SourceNotFoundError extends AppError {
  override readonly name: string = 'SourceNotFoundError';
  constructor(message: string) {
    super(message, 'source_not_found');
  }
}

/**
 * SourceHasDocumentsError — attempting to delete a source that has associated
 * documents fails (AC-10). The documents and their citation tuples remain
 * intact. Wraps Postgres error code `23503` so callers never see a raw DB error.
 *
 * @rules FR-1.5, AC-10, SEC-2
 */
export class SourceHasDocumentsError extends AppError {
  override readonly name: string = 'SourceHasDocumentsError';
  constructor(message: string) {
    super(message, 'source_has_documents');
  }
}

/**
 * InvalidSpanError — span boundaries fail validation (AC-7): `spanStart >=
 * spanEnd`, negative values, or `spanEnd` exceeds document content length.
 * Rejected with a typed AppError before any DB write.
 *
 * @rules FR-1.5, AC-7
 */
export class InvalidSpanError extends AppError {
  override readonly name: string = 'InvalidSpanError';
  constructor(message: string) {
    super(message, 'invalid_span');
  }
}
