import { pgTable, uuid, timestamp, text, boolean, jsonb, uniqueIndex, index } from 'drizzle-orm/pg-core';
import { sql } from 'drizzle-orm';
import type {
  ConfigKey,
  ConfigHistoryId,
  ConfigHistoryRetentionClass,
  Principal,
} from '@iip/contracts';

/**
 * `config_history` — the versioned, append-only config-lineage table
 * (PC-2.6, AR-23, VAL-2, VAL-8 — Story 2.10).
 *
 * Every output-affecting config knob change (model IDs, thresholds, k, fusion
 * weights, eval splits) is recorded as a NEW ROW here. This is the
 * legal-defense prerequisite: without it, the team cannot prove what
 * model/prompt/threshold produced any given answer at the moment of alleged
 * harm — a spoliation gap in any Philippine defamation (RA 10175 / Civil
 * Code) defense.
 *
 * **Append-only discipline (DoD-17, AC #3):** `UPDATE` and `DELETE` are
 * rejected at the PostgreSQL level via a `BEFORE UPDATE OR DELETE` trigger
 * (self-contained, no role dependency — see migration `0003_config_history.sql`).
 * Supersession is recorded by a NEW ROW with `effective_from`; temporal
 * validity is derived at query time via `ORDER BY effective_from DESC` (AM-1).
 *
 * **No `effective_until` column (AM-1).** Temporal validity is derived at
 * query time: a row is effective from `effective_from` until the
 * `effective_from` of the next row for the same key. This avoids the
 * contradiction between append-only (no UPDATE) and closing a previous row's
 * window (which would require UPDATE). The `getActiveConfigAt` query uses
 * `ORDER BY effective_from DESC LIMIT 1` — the successor's `effective_from`
 * implicitly closes the predecessor's window.
 *
 * **Retention vocabulary is DIFFERENT from `intake_documents`.** `config_history`
 * uses `unbounded_legal_hold`/`superseded_retain`/`purged_after_audit` — a
 * different vocabulary from `intake_documents`'s
 * `standard`/`litigation_hold`/`immediate_takedown`. This is intentional: the
 * tables serve different purposes. `config_history`'s default
 * (`unbounded_legal_hold`) is HONEST — the default IS the truth (VAL-8),
 * unlike `intake_documents` where a default would fabricate a classification.
 *
 * **No hash-chaining (conscious tradeoff, see Dev Notes).** `config_history`
 * is append-only at the DB level (trigger) but NOT hash-chained at the
 * cryptographic level. This is a deliberate divergence from `editorial_log`
 * (which uses SEC-6 hash-chaining). The trigger is a database-level guard,
 * not a cryptographic one.
 * // diverges — see ADR-0027
 *
 * **No `takedown_trigger` (Dev Notes).** No public-facing content is served
 * directly from `config_history`, so the removal-rationale column from
 * `intake_documents` does not apply.
 *
 * **No `superseded_at` (Dev Notes).** `config_history` tracks its own
 * supersession implicitly via sequential `effective_from` ordering — no
 * separate timestamp is needed.
 *
 * Nullability discipline (project-context: `.notNull()` by default): only
 * `old_value` is `.nullable()` — the first-ever value for a key has no
 * predecessor (`old_value = NULL` is the honest "no previous value").
 *
 * @rules PC-2.6, AR-23, VAL-2, VAL-8
 * @adr ADR-0027
 */
export const configHistory = pgTable(
  'config_history',
  {
    id: uuid('id').$type<ConfigHistoryId>().primaryKey().default(sql`gen_random_uuid()`),
    config_key: text('config_key').$type<ConfigKey>().notNull(),
    old_value: jsonb('old_value'),
    new_value: jsonb('new_value').notNull(),
    effective_from: timestamp('effective_from', { withTimezone: true, mode: 'date' }).notNull(),
    acting_principal: text('acting_principal').$type<Principal>().notNull(),
    // The default is expressed as a raw SQL literal because the branded TS
    // type `ConfigHistoryRetentionClass` does not accept a plain string
    // literal directly (the brand is a phantom type — runtime value is a
    // plain string, but the static type narrows it). `sql\`'unbounded_legal_hold'\``
    // produces the correct DDL (`DEFAULT 'unbounded_legal_hold'`) and is the
    // same approach Drizzle takes internally for branded columns. The CHECK
    // constraint in the migration enforces the vocabulary at the DB level.
    retention_class: text('retention_class')
      .$type<ConfigHistoryRetentionClass>()
      .notNull()
      .default(sql`'unbounded_legal_hold'`),
    legal_hold: boolean('legal_hold').notNull().default(true),
    created_at: timestamp('created_at', { withTimezone: true, mode: 'date' })
      .defaultNow()
      .notNull(),

    // ─────────────────────────────────────────────────────────────────────
    // FORGEABILITY GUARD (PC-8 — "app NEVER sends timestamps"):
    // `effective_from` and `created_at` are stamped server-side via an
    // injected `now(): Date` clock in `ConfigHistoryRepository.append()` (see
    // packages/config/src/config-history-repo.ts). They have NO DB default
    // that accepts client input, and the repository NEVER accepts a
    // client-supplied `effective_from` — a back-dated or forward-dated
    // effective window would undermine audit defensibility in a
    // defamation-grade system. The migration-level default on `created_at`
    // (`now()`) is belt-and-suspenders for raw SQL inserts ONLY; the
    // repository always supplies an explicit value. `effective_from` has NO
    // default at all — the value is ALWAYS supplied by the repository's
    // injected clock.
    // ─────────────────────────────────────────────────────────────────────
  },
  (table) => ({
    // Unique index prevents two rows with the same key + timestamp (mirrors
    // editorial_log's (partition_key, seq) composite PK pattern). This is the
    // no-fork guarantee for config_history: two writes to the same key at the
    // same `effective_from` cannot both succeed.
    configKeyEffectiveFromUq: uniqueIndex('config_history_key_effective_from_uq').on(
      table.config_key,
      table.effective_from,
    ),
    // Partial index scoped to legal_hold = true (sparse: few rows are ever
    // released from hold, so the index stays small). Backs the "what is
    // still on legal hold?" scan. Mirrors the `intake_documents_legal_hold_idx`
    // pattern from Story 2.6a.
    legalHoldIdx: index('config_history_legal_hold_idx')
      .on(table.legal_hold)
      .where(sql`${table.legal_hold} = true`),
  }),
);
