export const packageName = '@iip/contracts';

export function hello(): string {
  return `alive: ${packageName}`;
}

export { AppError, CitationEmitError } from './error.js';
export { CitationTuple, CitationRef, SourceTier, CitationProvenance } from './citation.js';
export type {
  CitationTuple as CitationTupleType,
  CitationRef as CitationRefType,
  CorpusHash,
  SourceTier as SourceTierType,
  CitationProvenance as CitationProvenanceType,
} from './citation.js';
export {
  RenderSpan,
  RenderDocument,
  RenderInput,
  RenderViolation,
} from './render.js';
export type {
  RenderSpan as RenderSpanType,
  RenderDocument as RenderDocumentType,
  RenderInput as RenderInputType,
} from './render.js';
export {
  EVAL_SCHEMA_VERSION,
  EvalFixture,
  EvalInput,
  EvalMetric,
  EvalResult,
} from './eval.js';
export type {
  EvalSchemaVersion,
  EvalFixture as EvalFixtureType,
  EvalInput as EvalInputType,
  EvalMetric as EvalMetricType,
  EvalResult as EvalResultType,
} from './eval.js';

// Story 1.11 — PC-8 UTC helper
export { now } from './time.js';

// Story 2.2 — SEC-1 authentication contract types
export { Scope, PrincipalSchema, JtiSchema, IssuerSchema, KidSchema } from './auth.js';
export type {
  Scope as ScopeType,
  Principal,
  Jti,
  Issuer,
  Kid,
} from './auth.js';
