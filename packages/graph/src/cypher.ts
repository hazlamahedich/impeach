/**
 * Cypher seam — the sole AGE Cypher entry point (PC-1e).
 *
 * Apache AGE is invoked via `ag_catalog.cypher(graph, query, params)` SQL.
 * Drizzle cannot type or compose Cypher (ADR-0015), so every Cypher query is
 * raw SQL. This wrapper centralizes that raw SQL into ONE audited file so:
 *
 *  1. The `$id`-inside-`$$` positional-binding injection footgun is caught
 *     here, not at every call site. Callers pass `params` as a separate typed
 *     object and reference values as `$name` (AGE's own binding) inside the
 *     `$$ ... $$` block — they NEVER JS-interpolate (`${id}`) into the query.
 *  2. The graph name is parameterized as a pg bind param (`$1`), never string-
 *     interpolated. The `GraphName` brand guarantees it is a valid AGE
 *     identifier (letters/digits/underscore), so it cannot carry SQL.
 *  3. `@iip/eslint-plugin` `no-raw-cypher` bans `ag_catalog.cypher(` everywhere
 *     except this file (PC-1e).
 *
 * Returns typed rows via a caller-supplied row mapper (ADR-0015 §1).
 *
 * @rules PC-1e, NFR-S-2, STR-5
 * @adr ADR-0015, ADR-0002
 */
import type { GraphName } from '@iip/contracts';

/**
 * Narrow executor port — `@iip/graph` imports only `@iip/contracts` (SC-5).
 *
 * Callers inject a `pg`-compatible query function (typically
 * `DbHandle.pool.query` bound, or a transaction's query method). This keeps the
 * graph package decoupled from `pg`/`@iip/db` at the import boundary.
 */
export interface CypherExecutor {
  query(text: string, values?: readonly unknown[]): Promise<{ readonly rows: ReadonlyArray<Record<string, unknown>> }>;
}

/**
 * Run a parameterized AGE Cypher query and return typed rows.
 *
 * Emits SQL of the form:
 *   SELECT * FROM ag_catalog.cypher($1, $$ <query> $$, $2::jsonb) AS (...)
 *
 * The graph name ($1) and params ($2::jsonb) are pg bind params — they are
 * NEVER interpolated into the SQL string. The `query` body is placed inside
 * AGE's `$$ ... $$` dollar-quoted block unchanged; callers MUST use AGE's
 * `$name` named binding for values (never JS `${name}` interpolation). The
 * `params` object is JSON-serialized and passed as the third argument to
 * `ag_catalog.cypher`, which AGE resolves against `$name` references.
 *
 * @param graph       Branded AGE named-graph identifier (e.g. `IIP_GRAPH`).
 * @param query       Cypher template with `$name` bindings inside (NO JS interpolation).
 * @param params      Values bound to `$name` references; JSON-serialized as agtype map.
 * @param executor    Injected query port (pg-compatible).
 * @param rowMapper   Caller-supplied mapper from raw agtype row → typed domain object.
 * @param columns     Optional `AS (col agtype, ...)` column-declaration clause. AGE
 *                    requires a column shape declaration; if omitted, defaults to
 *                    `(result agtype)` for single-column returns.
 * @returns Typed rows via `rowMapper`.
 * @throws if `query` is empty or `graph`/`params` are invalid.
 */
export async function cypher<T>(
  graph: GraphName,
  query: string,
  params: Readonly<Record<string, unknown>>,
  executor: CypherExecutor,
  rowMapper: (row: Record<string, unknown>) => T,
  columns = '(result agtype)',
): Promise<readonly T[]> {
  if (typeof query !== 'string' || query.length === 0) {
    throw new Error('cypher(): query must be a non-empty string');
  }
  if (params === null || typeof params !== 'object') {
    throw new Error('cypher(): params must be an object');
  }

  // The graph name is a bind param ($1). AGE accepts it as a string argument.
  // Params are JSON-serialized ($2::jsonb) so AGE resolves `$name` references.
  const sql = `SELECT * FROM ag_catalog.cypher($1, $$ ${query} $$, $2::jsonb) AS ${columns}`;
  const values: unknown[] = [graph, JSON.stringify(params)];

  const { rows } = await executor.query(sql, values);
  return rows.map(rowMapper);
}
