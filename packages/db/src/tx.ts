/**
 * Transaction helper — `withTx` (PC-1b).
 *
 * Wraps multi-write operations in a single Drizzle transaction so an
 * intake state transition + signature persistence is atomic: either both
 * commit or neither does (SEC-2, DoD-8).
 *
 * NOTE: full AsyncLocalStorage-based transaction-context propagation (so
 * nested `withTx` calls reuse the ambient transaction instead of creating
 * SAVEPOINTs) is the PC-1b target; this minimal implementation covers the
 * non-nesting API-route usage in Story 2.3. Lint-bans raw `BEGIN`/`COMMIT`
 * outside `withTx` per project-context PC-1b.
 *
 * @rules PC-1b, SEC-2, DoD-8
 * @adr ADR-0001
 */
import type { Db } from './client.js';

export interface WithTxOptions {
  isolationLevel?: 'read uncommitted' | 'read committed' | 'repeatable read' | 'serializable';
}

/**
 * Run `fn` inside a Drizzle transaction. The callback receives the
 * transaction-bound query builder (typed as {@link Db} for ergonomic query
 * reuse; the runtime value is the Drizzle `PgTransaction`, which exposes the
 * same query surface).
 *
 * @rules PC-1b
 */
export async function withTx<T>(
  db: Db,
  fn: (tx: Db) => Promise<T>,
  options?: WithTxOptions,
): Promise<T> {
  return db.transaction(async (tx) => fn(tx as unknown as Db), options);
}
