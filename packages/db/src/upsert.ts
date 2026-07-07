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
  table: { $inferInsert: TTable; insert: (values: TTable) => { onConflictDoUpdate: (config: { target: unknown; set: Partial<TTable> }) => { returning: () => Promise<unknown[]> } } },
  row: TTable,
  conflictTarget: unknown,
): Promise<unknown> {
  // Build the SET clause: update every column except the primary key 'id'.
  const setClause = Object.keys(row as Record<string, unknown>)
    .filter((k) => k !== 'id')
    .reduce<Partial<TTable>>((acc, k) => {
      (acc as Record<string, unknown>)[k] = (row as Record<string, unknown>)[k];
      return acc;
    }, {});

  const result = await table
    .insert(row)
    .onConflictDoUpdate({ target: conflictTarget, set: setClause })
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
export async function upsertFirstWriteWins<TTable extends Record<string, unknown>>(
  db: Db,
  table: { $inferInsert: TTable; insert: (values: TTable) => { onConflictDoNothing: (config: { target: unknown }) => { returning: () => Promise<unknown[]> } } },
  row: TTable,
  conflictTarget: unknown,
): Promise<unknown> {
  const result = await table
    .insert(row)
    .onConflictDoNothing({ target: conflictTarget })
    .returning();
  // On conflict, returning() yields an empty array; the caller should re-fetch
  // if it needs the existing row. This matches Drizzle's onConflictDoNothing semantics.
  return (result as unknown[])[0];
}
