import { drizzle } from 'drizzle-orm/node-postgres';
import { Pool, type PoolOptions } from 'pg';
import * as schema from './schema/index.js';

export type Db = ReturnType<typeof drizzle<typeof schema>>;

export interface DbHandle {
  db: Db;
  pool: Pool;
}

function validateAgeSearchPath(connectionUrl: string): void {
  const decoded = decodeURIComponent(connectionUrl);
  // The DSN must include search_path with ag_catalog and NO space after the
  // comma, otherwise PostgreSQL's options parser splits on whitespace and
  // truncates the path to `ag_catalog,`.
  if (decoded.includes('search_path=')) {
    const match = decoded.match(/search_path=([^&]+)/);
    if (match != null) {
      const value = match[1] ?? '';
      if (!value.includes('ag_catalog')) {
        throw new Error(
          'AGE search_path DSN must include ag_catalog; see ADR-002.',
        );
      }
      if (value.includes('ag_catalog, ')) {
        throw new Error(
          'AGE search_path DSN must not contain a space after the comma.',
        );
      }
    }
  }
}

/**
 * Create a Drizzle handle backed by a `pg.Pool`.
 *
 * The `connectionUrl` MAY carry an `?options=` query parameter so that every
 * pooled session starts with the correct AGE `search_path` (e.g.
 * `?options=-c%20search_path%3Dag_catalog%2Cpublic`). Connection pools do
 * not preserve session-level `SET` statements, so the search path is passed via
 * the DSN instead. Note: no space after the comma — PostgreSQL's options parser
 * splits on whitespace, so `ag_catalog, public` becomes two broken options.
 *
 * @rules AC-1
 * @adr ADR-002
 */
export function createDb(connectionUrl: string, opts?: Partial<PoolOptions>): DbHandle {
  if (!connectionUrl.startsWith('postgres://') && !connectionUrl.startsWith('postgresql://')) {
    throw new Error('createDb expects a postgres:// or postgresql:// URL');
  }
  validateAgeSearchPath(connectionUrl);

  // Ensure the explicit connectionUrl wins over any opts.connectionString.
  const { connectionString: _, ...restOpts } = opts ?? {};
  const pool = new Pool({
    connectionString: connectionUrl,
    // Sensible defaults for containerized/Testcontainers workloads. Callers
    // can override via opts.
    max: 10,
    connectionTimeoutMillis: 10_000,
    idleTimeoutMillis: 30_000,
    ...restOpts,
  });

  // Prevent an idle-client backend kill from crashing the process.
  pool.on('error', (err) => {
    // Pino is the project-wide logger, but @iip/db intentionally has no logger
    // dependency. Log to stderr; consumers should attach their own listener if
    // they need structured output.
    process.stderr.write(`Unexpected pg pool error: ${String(err)}\n`);
  });

  const db = drizzle(pool, { schema });
  return { db, pool };
}

/**
 * Close the Drizzle handle and its underlying `pg.Pool`.
 *
 * Callers MUST await this before process exit to avoid Testcontainers/CI hangs
 * and PostgreSQL max-connection exhaustion.
 */
export async function closeDb(handle: DbHandle): Promise<void> {
  await handle.pool.end();
}
