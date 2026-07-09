export const packageName = '@iip/contracts';

export function hello(): string {
  return `alive: ${packageName}`;
}

export { AppError, CitationEmitError } from './error.js';
export { CitationTuple, CitationRef, SourceTier, CitationProvenance } from './citation.js';
export type {
  CitationTuple as CitationTupleType,
  CitationRef as CitationRefType,
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
  SourceDocSnapshot,
  SourceResolver,
  EntailmentChecker,
  CitationVerifier,
  AuditHealthProbe,
  GateContext,
  GateInvocationObservation,
  GateViolation,
  GateViolationKind,
  GateSpan,
  GateOutput,
  GateInput,
} from './render.js';
export {
  TRUST_TIERS,
  isValidTrustTier,
} from './trust-tier.js';
export type {
  TrustTierNumber,
  TrustTierLabel,
} from './trust-tier.js';
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

// Story 2.3 — SEC-2 two-person intake state machine contract types
export {
  DocumentStatusLiteral,
  DocumentStatus,
  Ed25519Signature,
  KeyId,
  IntakeContentHash,
  IntakeEventName,
  IntakeEvent,
  NoopIntakeEventLogger,
  computeContentHash,
  signaturePayloadFromHash,
  CONTENT_HASH_REGEX,
} from './intake/index.js';
export type {
  DocumentStatusLiteral as DocumentStatusLiteralType,
  DocumentStatus as DocumentStatusType,
  Ed25519Signature as Ed25519SignatureType,
  KeyId as KeyIdType,
  IntakeContentHash as IntakeContentHashType,
  IntakeEventName as IntakeEventNameType,
  IntakeEvent as IntakeEventType,
  IntakeEventLogger,
} from './intake/index.js';

// Story 2.6a — AR-23 / VAL-2 G-2 retention/takedown contract types
export {
  RetentionPolicyLiteral,
  RetentionPolicy,
} from './intake/index.js';
export type {
  RetentionPolicyLiteral as RetentionPolicyLiteralType,
  RetentionPolicy as RetentionPolicyType,
} from './intake/index.js';

// Story 2.4 — SEC-6 hash-chained editorial log contract types
export {
  PrevHash,
  CorpusHash,
  Signature,
  Seq,
  PartitionKey,
  GENESIS_PREV_HASH,
  EVENT_NAME_REGEX,
  EditorialLogEvent,
  ExternalPd2Day90Payload,
  LogEntry,
  jcsCanonicalize,
  hashEntry,
  makeEntry,
  makeGenesisEntry,
  EditorialError,
} from './editorial-log.js';
export type {
  PrevHash as PrevHashType,
  CorpusHash as CorpusHashType,
  Signature as SignatureType,
  Seq as SeqType,
  PartitionKey as PartitionKeyType,
  EditorialLogEvent as EditorialLogEventType,
  LogEntry as LogEntryType,
  LogEntryCanonical,
  MakeEntryParams,
  LogQueryFilter,
  ChainFailureType,
  ChainFailure,
  ChainWarningType,
  ChainWarning,
  VerificationReport,
  EditorialErrorCode,
} from './editorial-log.js';

// Story 2.10 — PC-2.6 / AR-23 / VAL-2 / VAL-8 config_history contract types
export {
  ConfigKeySchema,
  ConfigHistoryIdSchema,
  ConfigHistoryRetentionClassLiteral,
  ConfigHistoryRetentionClass,
} from './config-history.js';
export type {
  ConfigKey,
  ConfigHistoryId,
  ConfigHistoryRetentionClassLiteral as ConfigHistoryRetentionClassLiteralType,
  ConfigHistoryRetentionClass as ConfigHistoryRetentionClassType,
} from './config-history.js';

// PC-1e — AGE named-graph identity for the sole Cypher seam (packages/graph/src/cypher.ts)
export { GraphName, IIP_GRAPH } from './graph.js';
export type { GraphName as GraphNameType } from './graph.js';

// Epic 3 prep (TD3) — ingest domain contract types (FR-1.1, FR-1.3, FR-1.4, FR-1.5, FR-1.6)
export {
  SourceIdSchema,
  SourceSourceTypeLiteral,
  SourceSourceType,
  CrawlStrategyLiteral,
  CrawlStrategy,
  DocumentIdSchema,
  ContentChecksumSchema,
  RawSnapshotKeySchema,
  JobIdSchema,
  JobStateLiteral,
  JobState,
  StateRunIdSchema,
  IngestJobPayloadSchema,
  INGEST_QUEUE_NAME,
  INGEST_DLQ_NAME,
  STAGE_COMPLETED_SUFFIX,
  // Story 3.1 — source registry API schemas (FR-1.1)
  DEFAULT_TRUST_TIER_BY_SOURCE_TYPE,
  RegisterSourcePayloadSchema,
  UpdateSourcePayloadSchema,
  ConfirmationStatusLiteral,
  SourceResponseSchema,
  SourceListFiltersSchema,
  // Story 3.2 — lawful-access gate schemas (FR-1.2)
  LawfulAccessInputSchema,
  LawfulAccessCheckResultSchema,
  ConfirmLawfulAccessPayloadSchema,
  OverrideLawfulAccessPayloadSchema,
} from './ingest.js';
export type {
  SourceId,
  SourceSourceTypeLiteral as SourceSourceTypeLiteralType,
  SourceSourceType as SourceSourceTypeType,
  CrawlStrategyLiteral as CrawlStrategyLiteralType,
  CrawlStrategy as CrawlStrategyType,
  DocumentId,
  ContentChecksum,
  RawSnapshotKey,
  JobId,
  JobStateLiteral as JobStateLiteralType,
  JobState as JobStateType,
  StateRunId,
  IngestJobPayload,
  // Story 3.1 — source registry API schemas (FR-1.1)
  RegisterSourcePayload,
  UpdateSourcePayload,
  ConfirmationStatusLiteral as ConfirmationStatusLiteralType,
  SourceResponse,
  SourceListFilters,
  // Story 3.2 — lawful-access gate schemas (FR-1.2)
  LawfulAccessInput,
  LawfulAccessCheckResult,
  ConfirmLawfulAccessPayload,
  OverrideLawfulAccessPayload,
} from './ingest.js';
