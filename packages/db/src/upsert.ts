/**
 * Upsert helpers — idempotent write primitives (PC-1a).
 *
 * Two strategies:
 *  - `upsertLastWriteWins` — the incoming row replaces the existing on conflict
 *    (the default for most ingestion: the latest fetch is authoritative).
 *  - `upsertFirstWriteWins` — the existing row is kept on conflict (the
 *    existing row is authoritative; used when first-seen provenance must be
 *    preserved, e.g. legal-hold timestamps).
 *
 * Both use Drizzle's `onConflictDoUpdate` / `onConflictDoNothing` on a unique
 * constraint/column. Blind `db.insert(...)` without `ON CONFLICT` is a defect
 * (project-context: PC-1a) — these helpers are the sanctioned form.
 *
 * @rules PC-1a
 */
import type { Db } from './client.js';
import type { PgTable, IndexColumn } from 'drizzle-orm/pg-core';

/**
 * Upsert where the incoming row wins on conflict (last-write-wins).
 *
 * On a unique-constraint conflict, the incoming row's values replace the
 * existing row's values for all columns EXCEPT the primary key (the PK is
 * immutable). Use this when the latest fetch is authoritative (e.g. re-ingest
 * with updated `fetch_metadata`).
 *
 * @param db    - the Db handle (pool or transaction)
 * @param table - the Drizzle table object
 * @param row   - the row to insert
 * @param conflictTarget - the unique column(s) that trigger the conflict
 * @returns the upserted row (inserted or updated)
 */
export async function upsertLastWriteWins<TTable extends Record<string, unknown>>(
  db: Db,
  table: PgTable,
  row: TTable,
  conflictTarget: IndexColumn | IndexColumn[],
): Promise<unknown> {
  // Build the SET clause: update every column except the primary key 'id'.
  const setClause = Object.keys(row as Record<string, unknown>)
    .filter((k) => k !== 'id')
    .reduce<Partial<TTable>>((acc, k) => {
      (acc as Record<string, unknown>)[k] = (row as Record<string, unknown>)[k];
      return acc;
    }, {});

  const result = await db
    .insert(table)
    .values(row as Record<string, unknown>)
    .onConflictDoUpdate({ target: conflictTarget, set: setClause as Record<string, unknown> })
    .returning();
  return (result as unknown[])[0];
}

/**
 * Upsert where the existing row wins on conflict (first-write-wins).
 *
 * On a unique-constraint conflict, the existing row is kept and the incoming
 * row is discarded (no-op). Use this when first-seen provenance must be
 * preserved (e.g. a legal-hold timestamp set at first ingest should not be
 * overwritten by a re-ingest).
 *
 * @param db    - the Db handle (pool or transaction)
 * @param table - the Drizzle table object
 * @param row   - the row to insert
 * @param conflictTarget - the unique column(s) that trigger the conflict
 * @returns the existing row (on conflict) or the inserted row (on insert)
 */
export interface UpsertFirstWriteWinsResult<T> {
  row: T;
  inserted: boolean;
}

export async function upsertFirstWriteWins<
  TTable extends Record<string, unknown>,
  TRow extends Record<string, unknown>,
>(
  db: Db,
  table: PgTable,
  row: TTable,
  conflictTarget: IndexColumn | IndexColumn[],
): Promise<UpsertFirstWriteWinsResult<TRow>> {
  const result = (await db
    .insert(table)
    .values(row as Record<string, unknown>)
    .onConflictDoNothing({ target: conflictTarget })
    .returning()) as TRow[];
  const inserted = result.length > 0;
  if (inserted && result[0] !== undefined) {
    return { row: result[0], inserted: true };
  }

  // Caller must re-fetch the existing row; onConflictDoNothing does not return it.
  return { row: undefined as unknown as TRow, inserted: false };
}
