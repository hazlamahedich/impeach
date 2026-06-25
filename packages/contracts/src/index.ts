export const packageName = '@iip/contracts';

export function hello(): string {
  return `alive: ${packageName}`;
}

export { CitationTuple, CitationRef } from './citation.js';
export type { CitationTuple as CitationTupleType, CitationRef as CitationRefType, CorpusHash } from './citation.js';
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
