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
