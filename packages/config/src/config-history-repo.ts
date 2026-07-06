/**
 * config_history repository (PC-2.6, Story 2.10).
 *
 * Implements the append + point-in-time read paths for the versioned,
 * append-only config-lineage table. The repository stamps `effective_from`
 * and `created_at` server-side via an injected `Clock` (PC-8: app NEVER sends
 * timestamps). No UPDATE is ever issued; supersession is recorded by a NEW
 * ROW with a new `effective_from` (AM-1).
 *
 * The repository is intentionally simpler than `editorial-log-repo.ts`:
 * `config_history` is NOT hash-chained (ADR-0027 §5 — conscious tradeoff).
 * // diverges — see ADR-0027
 * There is no signing callback, no CAS retry, no genesis bootstrap. The
 * unique index on `(config_key, effective_from)` prevents duplicate timestamps
 * for the same key; a duplicate insert surfaces as a Postgres unique violation
 * (23505), which we classify into a canonical `AppError` before propagating.
 *
 * @rules PC-2.6, AR-23, VAL-2, VAL-8, PC-8
 * @adr ADR-0027
 */
import {
  ConfigKeySchema,
  ConfigHistoryIdSchema,
  ConfigHistoryRetentionClass,
  PrincipalSchema,
  AppError,
} from '@iip/contracts';
import type {
  ConfigKey,
  ConfigHistoryRetentionClass as ConfigHistoryRetentionClassType,
} from '@iip/contracts';
import process from 'node:process';
import type {
  AppendParams,
  ConfigHistoryEntry,
  ConfigHistoryRepoConfig,
  ConfigHistoryRepository,
} from './config-history-types.js';

/**
 * Create the config_history repository with injected dependencies (PC-2.6).
 *
 * @param config — executor (DB connection) + clock (time provider)
 * @returns the repository
 *
 * @rules PC-2.6, PC-8
 * @adr ADR-0027
 */
export function createConfigHistoryRepo(config: ConfigHistoryRepoConfig): ConfigHistoryRepository {
  const { executor, clock } = config;

  /**
   * Append a new config_history row, stamping effective_from + created_at
   * server-side (PC-8 forgeability guard — the caller CANNOT supply
   * effective_from).
   *
   * The unique index on (config_key, effective_from) prevents two rows with
   * the same key + timestamp; a duplicate insert surfaces as a 23505
   * violation. `retention_class` defaults to `'unbounded_legal_hold'` and
   * `legal_hold` defaults to `true` at the DB level (VAL-8 — the default IS
   * the truth); we surface those defaults explicitly here so the returned
   * entry reflects what was actually persisted.
   *
   * @rules PC-2.6, PC-8, VAL-8
   */
  async function append(params: AppendParams): Promise<ConfigHistoryEntry> {
    // Stamp effective_from + created_at server-side via the injected clock.
    // The caller CANNOT supply effective_from (PC-8 forgeability guard).
    const now = clock.now();

    let result;
    try {
      result = await executor.query(
        `INSERT INTO config_history
           (config_key, old_value, new_value, effective_from, acting_principal)
         VALUES ($1, $2, $3, $4, $5)
         RETURNING
           id, config_key, old_value, new_value, effective_from,
           acting_principal, retention_class, legal_hold, created_at`,
        [
          params.configKey,
          JSON.stringify(params.oldValue),
          JSON.stringify(params.newValue),
          now,
          params.actingPrincipal,
        ],
      );
    } catch (error) {
      // Classify the unique violation on (config_key, effective_from) so
      // callers can retry or surface a canonical error instead of a raw
      // SQLSTATE 23505.
      if (isUniqueViolation(error)) {
        throw new AppError(
          `config_history append: duplicate effective_from for key ${params.configKey}`,
          'CONFIG_HISTORY_DUPLICATE_EFFECTIVE_FROM',
        );
      }
      throw error;
    }

    if (result.rows.length === 0) {
      // Defensive: a RETURNING clause with a successful INSERT always yields
      // a row. Reaching here implies a DB-level issue (e.g. the BEFORE
      // INSERT trigger — if one is ever added — returned NULL).
      throw new AppError(
        'config_history append: INSERT returned no rows',
        'CONFIG_HISTORY_APPEND_NO_ROWS',
      );
    }

    return rowToEntry(result.rows[0]!);
  }

  /**
   * Query the active config at a point in time.
   *
   * `ORDER BY effective_from DESC LIMIT 1` returns the row with the highest
   * `effective_from` ≤ the query time — that row is the active config at
   * `atTime`. No `effective_until` filter is needed (AM-1: the column does
   * not exist; temporal validity is derived from successor ordering).
   *
   * @rules PC-2.6
   * @adr ADR-0027 §2
   */
  async function getActiveConfigAt(
    key: ConfigKey,
    atTime: Date,
  ): Promise<ConfigHistoryEntry | null> {
    const result = await executor.query(
      `SELECT
         id, config_key, old_value, new_value, effective_from,
         acting_principal, retention_class, legal_hold, created_at
       FROM config_history
       WHERE config_key = $1 AND effective_from <= $2
       ORDER BY effective_from DESC
       LIMIT 1`,
      [key, atTime],
    );

    if (result.rows.length === 0) return null;
    return rowToEntry(result.rows[0]!);
  }

  return { append, getActiveConfigAt };
}

/**
 * Convert a database row to a ConfigHistoryEntry.
 *
 * The branded types are reconstructed via `.parse()` so the row's string
 * values are validated against their zod schemas (e.g. ConfigHistoryId's UUID
 * v4 regex). `retention_class` is parsed via the branded schema so a
 * misspelled value (somehow inserted past the CHECK constraint — e.g. by a
 * superuser) fails closed here rather than propagating as a raw string.
 *
 * @rules PC-2.6
 */
function rowToEntry(row: Record<string, unknown>): ConfigHistoryEntry {
  return {
    id: ConfigHistoryIdSchema.parse(row['id']),
    config_key: ConfigKeySchema.parse(row['config_key']),
    old_value: row['old_value'] ?? null,
    new_value: row['new_value'],
    effective_from: row['effective_from'] instanceof Date
      ? (row['effective_from'] as Date)
      : new Date(row['effective_from'] as string),
    acting_principal: PrincipalSchema.parse(row['acting_principal']),
    retention_class: ConfigHistoryRetentionClass.parse(row['retention_class']) as ConfigHistoryRetentionClassType,
    legal_hold: Boolean(row['legal_hold']),
    created_at: row['created_at'] instanceof Date
      ? (row['created_at'] as Date)
      : new Date(row['created_at'] as string),
  };
}

// Re-export the types + Clock interface so consumers can import everything
// from a single module (`@iip/config`).
export type {
  AppendParams,
  Clock,
  ConfigHistoryEntry,
  ConfigHistoryRepoConfig,
  ConfigHistoryRepository,
  QueryExecutor,
} from './config-history-types.js';

/**
 * Narrow an unknown error to a Postgres unique violation (SQLSTATE 23505).
 *
 * Mirrors the error-classification helper in `packages/editorial/src/`.
 */
function isUniqueViolation(error: unknown): boolean {
  return (
    typeof error === 'object' &&
    error !== null &&
    'code' in error &&
    error.code === '23505'
  );
}

// ─────────────────────────────────────────────────────────────────────────
// onConfigChange hook (AM-11 — knob-change integration point for PC-2.6)
// ─────────────────────────────────────────────────────────────────────────

/**
 * ConfigChangeListener — invoked when a config knob changes (PC-2.6).
 *
 * The listener receives the key, the old value, and the new value. It is
 * invoked synchronously by `notifyConfigChange`; if it throws, the error
 * propagates to the caller of `notifyConfigChange` (fail-loud, not
 * fail-silent — a missed config_history row is a spoliation gap).
 *
 * @rules PC-2.6
 */
export type ConfigChangeListener = (
  key: ConfigKey,
  oldValue: unknown | null,
  newValue: unknown,
) => void | Promise<void>;

// Module-level listener set. In production this holds at most ONE listener
// (the ConfigHistoryRepository.append adapter); the array form supports test
// isolation (register + deregister per test). The set is module-scoped
// because the hook is the process-wide integration point between the
// operator-config surface and config_history.
const configChangeListeners = new Set<ConfigChangeListener>();
let warnedAboutDuplicateListener = false;

/**
 * Register a listener for config knob changes (PC-2.6, AM-11).
 *
 * Returns a deregister function (callable-idempotent). The listener is
 * invoked on every `notifyConfigChange` call; production wiring registers
 * the ConfigHistoryRepository adapter once at boot.
 *
 * A warning is logged if more than one listener is registered without the
 * prior one being deregistered, to prevent accidental duplicate writes in
 * long-running worker or test processes.
 *
 * Example (production boot):
 * ```ts
 * const repo = createConfigHistoryRepo({ executor, clock });
 * onConfigChange((key, oldVal, newVal) => repo.append({
 *   configKey: key, oldValue: oldVal, newValue: newVal, actingPrincipal,
 * }));
 * ```
 *
 * @rules PC-2.6
 */
export function onConfigChange(listener: ConfigChangeListener): () => void {
  if (configChangeListeners.size > 0 && !warnedAboutDuplicateListener) {
    warnedAboutDuplicateListener = true;
    // Use stderr directly: this package intentionally avoids a pino dependency.
    process.stderr.write(
      JSON.stringify({
        level: 40,
        time: Date.now(),
        msg: 'config_history: multiple onConfigChange listeners registered without deregistering — possible duplicate config_history writes (PC-2.6)',
      }) + '\n',
    );
  }
  configChangeListeners.add(listener);
  return () => {
    configChangeListeners.delete(listener);
    if (configChangeListeners.size === 0) {
      warnedAboutDuplicateListener = false;
    }
  };
}

/**
 * Notify all registered listeners of a config knob change (PC-2.6).
 *
 * Called by the operator-config surface when a knob is adjusted at runtime
 * (e.g. a threshold change). Each listener is invoked in registration order;
 * a thrown error aborts the notification and propagates to the caller.
 *
 * @rules PC-2.6
 */
export async function notifyConfigChange(
  key: ConfigKey,
  oldValue: unknown | null,
  newValue: unknown,
): Promise<void> {
  for (const listener of configChangeListeners) {
    await listener(key, oldValue, newValue);
  }
}
