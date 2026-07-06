/**
 * config_history public types (PC-2.6, Story 2.10).
 *
 * Defines the repository interface, the Clock injection contract, and the
 * ConfigHistoryEntry row shape. The repository implementation lives in
 * `./config-history-repo.js`. The QueryExecutor abstraction mirrors
 * `packages/editorial/src/types.ts` so the repository is testable without
 * coupling to a specific connection library.
 *
 * @rules PC-2.6, AR-23, VAL-2, VAL-8
 * @adr ADR-0027
 */
import type {
  ConfigKey,
  ConfigHistoryId,
  ConfigHistoryRetentionClass,
  Principal,
} from '@iip/contracts';

/**
 * QueryExecutor — the minimal database interface the repository needs.
 *
 * Accepts a parameterized query and returns rows. Implemented by `pg.Client`,
 * `pg.PoolClient`, or a test double. This abstraction keeps the repository
 * testable without coupling to a specific connection library. Mirrors
 * `packages/editorial/src/types.ts → QueryExecutor` (SEC-6).
 *
 * @rules PC-2.6
 */
export interface QueryExecutor {
  query(
    text: string,
    params?: readonly unknown[],
  ): Promise<{ rows: readonly Record<string, unknown>[] }>;
}

/**
 * Clock — injected time provider returning a JS `Date`.
 *
 * PC-8 requires "app NEVER sends timestamps"; the repository stamps
 * `effective_from` and `created_at` server-side via this injected clock.
 * The clock returns `Date` (NOT `string`) to match Drizzle's
 * `timestamp('...', { mode: 'date' })` column type — `packages/contracts/src/time.ts → now()`
 * returns an ISO-8601 `string` and is therefore NOT suitable for direct use
 * as the clock. Tests inject a deterministic clock; production wires
 * `() => new Date()`.
 *
 * @rules PC-2.6, PC-8
 */
export interface Clock {
  now(): Date;
}

/**
 * ConfigHistoryEntry — a single `config_history` row.
 *
 * Mirrors the `config_history` Drizzle schema
 * (`packages/db/src/schema/config-history.ts`). The branded types prevent
 * transposition with other string IDs (Winston #1).
 *
 * `old_value` is nullable: the first-ever value for a key has no predecessor
 * (`old_value = null` is the honest "no previous value").
 *
 * @rules PC-2.6, VAL-8
 */
export interface ConfigHistoryEntry {
  readonly id: ConfigHistoryId;
  readonly config_key: ConfigKey;
  readonly old_value: unknown | null;
  readonly new_value: unknown;
  readonly effective_from: Date;
  readonly acting_principal: Principal;
  readonly retention_class: ConfigHistoryRetentionClass;
  readonly legal_hold: boolean;
  readonly created_at: Date;
}

/**
 * AppendParams — parameters for `ConfigHistoryRepository.append`.
 *
 * `actingPrincipal` is REQUIRED (SEC-1 — every editorial action must be
 * attributable). `effective_from` is NOT accepted here — the repository stamps
 * it server-side via the injected `Clock` (PC-8 forgeability guard: a
 * client-supplied effective_from could back-date or forward-date a config
 * lineage entry, undermining audit defensibility).
 *
 * @rules PC-2.6, PC-8, SEC-1
 */
export interface AppendParams {
  readonly configKey: ConfigKey;
  readonly oldValue: unknown | null;
  readonly newValue: unknown;
  readonly actingPrincipal: Principal;
}

/**
 * ConfigHistoryRepository — the write + point-in-time read interface.
 *
 * `append` inserts a new row, stamping `effective_from` and `created_at`
 * server-side via the injected Clock. No UPDATE is ever issued — supersession
 * is recorded by a NEW ROW with a new `effective_from`. The DB-level trigger
 * (`reject_config_history_mutation()`) rejects UPDATE/DELETE attempts at the
 * PostgreSQL level regardless of what the application does.
 *
 * `getActiveConfigAt` derives the active config at a point in time via
 * `ORDER BY effective_from DESC LIMIT 1` — the row with the highest
 * `effective_from` ≤ the query time is the active config. No `effective_until`
 * filter is needed (AM-1: the column does not exist).
 *
 * @rules PC-2.6, AR-23, VAL-2, VAL-8
 * @adr ADR-0027
 */
export interface ConfigHistoryRepository {
  append(params: AppendParams): Promise<ConfigHistoryEntry>;
  getActiveConfigAt(key: ConfigKey, atTime: Date): Promise<ConfigHistoryEntry | null>;
}

/**
 * ConfigHistoryRepoConfig — injected dependencies for the repository.
 *
 * Mirrors `packages/editorial/src/types.ts → EditorialRepoConfig`:
 * dependencies are injected (not module-level) so tests can run without a
 * real DB connection.
 *
 * @rules PC-2.6
 */
export interface ConfigHistoryRepoConfig {
  readonly executor: QueryExecutor;
  readonly clock: Clock;
}
