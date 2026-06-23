// target-path: tests/integration/pg-age-pgvector.compat.test.ts
// RED — Story 1.2 PostgreSQL + pgvector + AGE Compatibility Proof
// Refs: AC (implicit F1-04), ADR-002, STR-12
// Pool: 'forks' + singleFork (Testcontainers holds TCP; threads propagate hangs)

import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { GenericContainer, Wait, type StartedTestContainer } from 'testcontainers';
import { drizzle } from 'drizzle-orm/node-postgres';
import { Client } from 'pg';
import { randomUUID } from 'node:crypto';

const PG_IMAGE_DIGEST = process.env.IIP_PG_AGE_VECTOR_IMAGE
  ?? 'ghcr.io/iip/postgres-age-pgvector:pg16@sha256:TODO_PIN_DIGEST';

describe.skip('Story 1.2 — PG16 + pgvector + AGE compatibility', () => {
  // RED — custom image not built; docker digest not pinned
  let container: StartedTestContainer;
  let client: Client;

  beforeAll(async () => {
    const dbName = `iip_test_${randomUUID().slice(0, 8)}`;
    container = await new GenericContainer(PG_IMAGE_DIGEST)
      .withEnvironment({ POSTGRES_PASSWORD: 'iip', POSTGRES_DB: dbName })
      .withWaitStrategy(Wait.forLogMessage(/database system is ready to accept connections.*\n.*database system is ready to accept connections/, 2))
      .withExposedPorts(5432)
      .start();
    const port = container.getMappedPort(5432);
    const connectionString = `postgres://postgres:iip@localhost:${port}/${dbName}?options=-c%20search_path%3Dag_catalog%2C%20public`;
    client = new Client({ connectionString });
    await client.connect();
  }, 240_000);

  afterAll(async () => {
    await client?.end();
    await container?.stop();
  });

  it('pgvector 0.8.x extension enabled', async () => {
    const { rows } = await client.query(`SELECT extversion FROM pg_extension WHERE extname = 'vector'`);
    expect(rows[0]?.extversion).toMatch(/^0\.8\./);
  });

  it('Apache AGE extension enabled', async () => {
    const { rows } = await client.query(`SELECT extversion FROM pg_extension WHERE extname = 'age'`);
    // AGE PG16/v1.6.0-rc0 — the only official PG16 artifact; no PG16/v1.7.0 exists; AGE has no GA release
    expect(rows[0]?.extversion).toMatch(/^1\.6\.0/);
  });

  it('pg_trgm and uuid-ossp extensions enabled', async () => {
    const { rows } = await client.query(
      `SELECT extname FROM pg_extension WHERE extname IN ('pg_trgm', 'uuid-ossp') ORDER BY extname`,
    );
    expect(rows.map(r => r.extname)).toEqual(['pg_trgm', 'uuid-ossp']);
  });

  it('cypher() query against iip_graph succeeds', async () => {
    // search_path = ag_catalog, public is set at the connection level via DSN options
    await client.query(`SELECT create_graph('iip_graph')`).catch(() => {}); // ignore "already exists"
    const { rows } = await client.query(
      `SELECT * FROM cypher('iip_graph', $$ RETURN 1 $$) AS (a agtype)`,
    );
    expect(rows[0]?.a).toBe('1'); // agtype serializes as string
  });

  it('vector(1024) column usable in the same schema', async () => {
    await client.query(`
      CREATE TABLE IF NOT EXISTS compat_probe (
        id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
        embedding vector(1024)
      )
    `);
    // 1024-dim zero vector literal
    await client.query(
      `INSERT INTO compat_probe (embedding) VALUES (vector(1024))`,
    );
    const { rows } = await client.query(`SELECT count(*)::int AS n FROM compat_probe`);
    expect(rows[0].n).toBeGreaterThanOrEqual(1);
  });

  it('vector(1024) round-trip and ANN query', async () => {
    await client.query(`DELETE FROM compat_probe`);
    await client.query(`INSERT INTO compat_probe (embedding) VALUES ('[0.1, ${Array(1023).fill(0).join(', ')}]')`);
    const { rows } = await client.query(`SELECT id FROM compat_probe ORDER BY embedding <-> '[0, ${Array(1023).fill(0).join(", ")}]' LIMIT 1`);
    expect(rows.length).toBe(1);
  });

  it('vector(1025) is rejected (dimension boundary)', async () => {
    await expect(
      client.query(`CREATE TABLE bad_dim (embedding vector(1025))`),
    ).rejects.toThrow();
  });

  it('cypher() on non-existent graph errors predictably', async () => {
    await expect(
      client.query(`SELECT * FROM cypher('nonexistent_graph', $$ RETURN 1 $$) AS (a agtype)`),
    ).rejects.toThrow();
  });

  it('Drizzle 0.35.x connects and runs a basic query', async () => {
    // RED — packages/db not created
    const db = drizzle(client);
    const result = await db.execute('SELECT 1 AS one');
    expect(result.rows[0]?.one).toBe(1);
    // Note: this proves connectivity only. Drizzle version pin is enforced via package.json + lockfile, not runtime query.
    const drizzleVersion = require('drizzle-orm/package.json').version;
    expect(drizzleVersion).toMatch(/^0\.35\./);
  });
});
