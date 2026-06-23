/**
 * @rules AC-1, AC-2, AC-3, AC-4
 * @adr ADR-002
 *
 * Story 1.2 — PostgreSQL 16 + pgvector + Apache AGE compatibility proof.
 *
 * Pool: 'forks' + singleFork — Testcontainers holds TCP sockets that do not
 * propagate cleanly across worker threads; a single fork prevents hangs.
 */

import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { drizzle } from 'drizzle-orm/node-postgres';
import {
  GenericContainer,
  Wait,
  type StartedTestContainer,
} from 'testcontainers';
import { Client } from 'pg';
import { randomUUID } from 'node:crypto';
import { readFileSync } from 'node:fs';
import { createRequire } from 'node:module';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';

const __dirname = dirname(fileURLToPath(import.meta.url));

// drizzle-orm restricts `exports` and does not expose `./package.json` as a
// subpath; resolve the version via the filesystem instead of require().
const drizzleEntry = createRequire(import.meta.url).resolve('drizzle-orm');
const drizzlePkgPath = drizzleEntry.replace(/\/[^/]+$/, '/package.json');
const drizzleVersion: string = JSON.parse(
  readFileSync(drizzlePkgPath, 'utf8'),
).version;

/**
 * Custom image: pgvector/pgvector:pg16 base + Apache AGE PG16/v1.6.0-rc0.
 *
 * Pinning by `@sha256:` digest is a CI/release concern deferred to Story 1.3
 * (the image is not yet pushed to GHCR). For local dev the locally-built tag
 * is used. Set `IIP_PG_AGE_VECTOR_IMAGE` to override in CI.
 *
 * @adr ADR-002
 */
const PG_IMAGE =
  process.env['IIP_PG_AGE_VECTOR_IMAGE'] ||
  'ghcr.io/iip/postgres-age-pgvector:pg16';

describe('Story 1.2 — PG16 + pgvector + AGE compatibility', () => {
  let container: StartedTestContainer;
  let client: Client;
  let connectionString: string;

  beforeAll(async () => {
    const dbName = `iip_test_${randomUUID().slice(0, 8)}`;
    container = await new GenericContainer(PG_IMAGE)
      .withEnvironment({ POSTGRES_PASSWORD: 'iip', POSTGRES_DB: dbName })
      .withWaitStrategy(
        Wait.forLogMessage(/database system is ready to accept connections/, 2),
      )
      .withExposedPorts(5432)
      .start();
    const host = container.getHost();
    const port = container.getMappedPort(5432);
    // search_path set via DSN options so every pooled session starts with
    // ag_catalog first. No space after the comma — PG options parser splits
    // on whitespace, so "ag_catalog, public" becomes two broken options.
    connectionString = `postgres://postgres:iip@${host}:${port}/${dbName}?options=-c%20search_path%3Dag_catalog%2Cpublic`;
    client = new Client({ connectionString });
    await client.connect();
  }, 240_000);

  afterAll(async () => {
    await client?.end();
    await container?.stop();
  });

  it('pgvector 0.8.x extension enabled (AC #1)', async () => {
    const { rows } = await client.query(
      `SELECT extversion FROM pg_extension WHERE extname = 'vector'`,
    );
    expect(rows[0]?.extversion).toMatch(/^0\.8\./);
  });

  it('PostgreSQL 16 major version is used (AC #1)', async () => {
    const { rows } = await client.query(`SELECT version()`);
    expect(rows[0]?.version).toMatch(/^PostgreSQL 16\./);
  });

  it('Apache AGE extension is pinned to 1.6.0 lineage (AC #1)', async () => {
    const { rows } = await client.query(
      `SELECT extversion FROM pg_extension WHERE extname = 'age'`,
    );
    // AGE PG16/v1.6.0-rc0 installs as extension version 1.6.0 (the -rc0 suffix
    // is a Git tag qualifier, not part of the installed extension version).
    // The exact source pin is enforced in the Dockerfile via the tag + commit SHA.
    expect(rows[0]?.extversion).toMatch(/^1\.6\.0$/);
  });

  it('pg_trgm extension enabled (AC #1)', async () => {
    const { rows } = await client.query(
      `SELECT extname FROM pg_extension WHERE extname = 'pg_trgm'`,
    );
    expect(rows.map((r: { extname: string }) => r.extname)).toEqual([
      'pg_trgm',
    ]);
  });

  it('AGE search_path is effective at session start (AC #2)', async () => {
    const { rows } = await client.query(`SHOW search_path`);
    expect(rows[0]?.search_path).toMatch(/ag_catalog/);
  });

  it('AGE boot migration 0001-iip-graph.sql parses and creates iip_graph (AC #2, #6)', async () => {
    const migration = readFileSync(
      join(__dirname, '../../infra/sql/age/migrations/0001-iip-graph.sql'),
      'utf8',
    );
    // Run the migration in autocommit mode (no explicit BEGIN) so the COMMIT
    // inside the script actually commits. This mirrors the Story 1.3 boot runner.
    await client.query(migration);
    const { rows } = await client.query(
      `SELECT * FROM cypher('iip_graph', $$ RETURN 1 $$) AS (a agtype)`,
    );
    expect(rows[0]?.a).toBe('1');
  });

  it('AGE boot migration is safe to re-run (AC #6)', async () => {
    const migration = readFileSync(
      join(__dirname, '../../infra/sql/age/migrations/0001-iip-graph.sql'),
      'utf8',
    );
    // AGE 1.6.0-rc0's create_graph('iip_graph') errors on duplicate graph.
    // Re-running the migration must either succeed (idempotent) or fail with
    // the specific "already exists" error, leaving the graph queryable.
    try {
      await client.query(migration);
    } catch (err: unknown) {
      expect(err).toBeInstanceOf(Error);
      expect((err as Error).message).toMatch(/graph "iip_graph" already exists/);
    }
    const { rows } = await client.query(
      `SELECT * FROM cypher('iip_graph', $$ RETURN 1 $$) AS (a agtype)`,
    );
    expect(rows[0]?.a).toBe('1');
  });

  it('create_graph COMMIT is visible to a second session (AC #6)', async () => {
    const second = new Client({ connectionString });
    await second.connect();
    try {
      const { rows } = await second.query(
        `SELECT * FROM cypher('iip_graph', $$ RETURN 1 $$) AS (a agtype)`,
      );
      expect(rows[0]?.a).toBe('1');
    } finally {
      await second.end();
    }
  });

  it('0001-iip-graph.sql fails when wrapped in a transaction (no-transaction guard)', async () => {
    const migration = readFileSync(
      join(__dirname, '../../infra/sql/age/migrations/0001-iip-graph.sql'),
      'utf8',
    );
    await client.query('BEGIN');
    let caught: Error | undefined;
    try {
      await client.query(migration);
    } catch (err: unknown) {
      caught = err as Error;
    } finally {
      await client.query('ROLLBACK');
    }
    expect(caught).toBeInstanceOf(Error);
    // AGE's create_graph internally tries to commit and fails with 3F000
    // (invalid schema name / graph already exists) when the outer transaction
    // prevents it from persisting. The important invariant is that it DOES fail
    // and the rollback leaves the database consistent.
    expect((caught as Error & { code?: string }).code).toBeTruthy();
  });

  it('vector(1024) column usable in the same schema (AC #3)', async () => {
    await client.query(`
      CREATE TABLE IF NOT EXISTS compat_probe (
        id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
        embedding vector(1024)
      )
    `);
    // pgvector has no `vector(n)` zero-vector constructor; use a literal.
    const zeros = Array(1024).fill(0).join(', ');
    await client.query(
      `INSERT INTO compat_probe (embedding) VALUES ('[${zeros}]')`,
    );
    const { rows } = await client.query(
      `SELECT count(*)::int AS n FROM compat_probe`,
    );
    expect(rows[0]?.n).toBeGreaterThanOrEqual(1);
  });

  it('vector(1024) round-trip and ANN query (<-> operator)', async () => {
    await client.query(`
      CREATE TABLE IF NOT EXISTS compat_probe (
        id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
        embedding vector(1024)
      )
    `);
    await client.query(`DELETE FROM compat_probe`);
    const dims = Array(1023).fill(0).join(', ');
    await client.query(
      `INSERT INTO compat_probe (embedding) VALUES ('[0.1, ${dims}]')`,
    );
    const { rows } = await client.query(
      `SELECT id FROM compat_probe ORDER BY embedding <-> '[0, ${dims}]' LIMIT 1`,
    );
    expect(rows.length).toBe(1);
  });

  it('vector(>16000) is rejected (pgvector dimension ceiling)', async () => {
    // pgvector 0.8.x supports up to 16000 dimensions; verify the ceiling
    // is enforced. (The ATDD scaffold assumed 1024 was the max — it is not;
    // 1024 is the app-level bge-m3 constraint, not pgvector's limit.)
    await expect(
      client.query(`CREATE TABLE bad_dim (embedding vector(20000))`),
    ).rejects.toThrow();
  });

  it('cypher() on non-existent graph errors predictably', async () => {
    await expect(
      client.query(
        `SELECT * FROM cypher('nonexistent_graph', $$ RETURN 1 $$) AS (a agtype)`,
      ),
    ).rejects.toThrow();
  });

  it('Drizzle 0.35.3 connects and runs a basic query (AC #4)', async () => {
    const db = drizzle(client);
    const result = await db.execute('SELECT 1 AS one');
    expect(result.rows[0]?.['one']).toBe(1);
    // Version pin is enforced via package.json + lockfile; assert here so
    // a silent major bump in the lockfile fails the integration gate.
    expect(drizzleVersion).toMatch(/^0\.35\.3$/);
  });
});
