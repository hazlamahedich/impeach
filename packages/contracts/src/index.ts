export const packageName = '@iip/contracts';

export function hello(): string {
  return `alive: ${packageName}`;
}

export { CitationTuple, CitationRef } from './citation.js';
export type { CitationTuple as CitationTupleType, CitationRef as CitationRefType } from './citation.js';
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
