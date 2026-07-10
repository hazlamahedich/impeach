export const packageName = '@iip/config';

export function hello(): string {
  return `alive: ${packageName}`;
}

// Story 1.11 — Sops + Age secrets + fail-closed boot (D7, NFR-S-4, ADR-019)
export {
  validateConfig,
  bootOrDie,
  type Result,
  type ConfigError,
  type ValidatedConfig,
  type DatabaseUrl,
  type RedisUrl,
  type MinioPassword,
  type OperatorKeyConfig,
  type IntakeOperatorKeyring,
  type IntakePartnerKeyring,
} from './secrets.js';

// Story 3.4 — MinIO non-secret infrastructure config (FR-1.4, PC-2.6, NFR-S-5).
//
// Secrets (MINIO_ROOT_PASSWORD) live in secrets.ts as minioRootPassword; the
// non-secret endpoint/bucket config lives here so config changes do not look
// like secret rotations (PC-2.6).
export {
  getMinioConfig,
  DEFAULT_RAW_SNAPSHOTS_BUCKET,
  type MinioConfig,
} from './minio.js';

// Story 2.10 — config_history repository + onConfigChange hook (PC-2.6, VAL-8).
//
// The repository lives in the domain package (not in packages/db), mirroring
// the editorial-log pattern (`packages/editorial/src/editorial-log-repo.ts`).
// The `onConfigChange` hook is the integration point: when a knob changes at
// runtime (e.g. a threshold is adjusted via operator action), the hook fires
// and the registered listener (the ConfigHistoryRepository.append) records
// the change to config_history. Production wiring is the operator-config
// surface; tests inject a deterministic clock + a mock executor.
export {
  createConfigHistoryRepo,
  type AppendParams,
  type Clock,
  type ConfigHistoryEntry,
  type ConfigHistoryRepoConfig,
  type ConfigHistoryRepository,
  type QueryExecutor,
  onConfigChange,
  notifyConfigChange,
} from './config-history-repo.js';

// Story 2.10 — first concrete config knob wired to config_history (PC-2.6, AC #1).
export { getLogLevel, setLogLevel, LOG_LEVEL_KEY, type LogLevel } from './log-level.js';

// Epic 3 prep (TD4) — ingest-queue backoff config knob (PC-1d, PC-2.4, NFR-R-2).
export {
  getBackoff,
  setBackoff,
  backoffDelayMs,
  QUEUES_BACKOFF_KEY,
  type BackoffConfig,
} from './queues.js';

// Story 2.11 — Audit Health Client + Circuit-Breaker (ADR-0029 §5, OQ-29.6).
//
// The single load-bearing mechanism for the 6-process blast-radius matrix:
// when audit-worker is unreachable, the serving path fail-closes for
// claim-serving /query. Fresh poll per request (no cached authorization),
// 100ms correctness budget, in-memory per-process state (no Redis dep), and
// editorial-log transition events. The API /query route and the render gate
// both read the circuit-breaker state through this client.
export {
  createAuditHealthClient,
  type AuditHealthConfig,
  type AuditHealthClient,
  type CircuitState,
  type HealthStatus,
  type TransitionObserver,
} from './audit-health.js';
