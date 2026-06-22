// target-path: tests/integration/pg-age-pgvector.compat.test.ts
// RED — Story 1.2 PostgreSQL + pgvector + AGE Compatibility Proof
// Refs: AC (implicit F1-04), ADR-002, STR-12
// Pool: 'forks' + singleFork (Testcontainers holds TCP; threads propagate hangs)

import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { GenericContainer, type StartedTestContainer } from 'testcontainers';
import { drizzle } from 'drizzle-orm/node-postgres';
import { Client } from 'pg';

const PG_IMAGE_DIGEST = process.env.IIP_PG_AGE_VECTOR_IMAGE
  ?? 'ghcr.io/iip/postgres-age-pgvector:pg16@sha256:TODO_PIN_DIGEST';

describe.skip('Story 1.2 — PG16 + pgvector + AGE compatibility', () => {
  // RED — custom image not built; docker digest not pinned
  let container: StartedTestContainer;
  let client: Client;

  beforeAll(async () => {
    container = await new GenericContainer(PG_IMAGE_DIGEST)
      .withEnvironment({ POSTGRES_PASSWORD: 'iip', POSTGRES_DB: 'iip_test' })
      .withWaitStrategy(/* matches "ready to accept connections" twice */)
      .withExposedPorts(5432)
      .start();
    const port = container.getMappedPort(5432);
    client = new Client({ connectionString: `postgres://postgres:iip@localhost:${port}/iip_test` });
    await client.connect();
  }, 120_000);

  afterAll(async () => {
    await client?.end();
    await container?.stop();
  });

  it('pgvector 0.8.x extension enabled', async () => {
    const { rows } = await client.query(`SELECT extversion FROM pg_extension WHERE extname = 'vector'`);
    expect(rows[0]?.extversion).toMatch(/^0\.8\./);
  });

  it('Apache AGE extension enabled', async () => {
    // RED — AGE version pin unverified (ADR-002 says >=1.7.0; latest GA may be 1.5.0 — open item)
    const { rows } = await client.query(`SELECT extversion FROM pg_extension WHERE extname = 'age'`);
    expect(rows[0]?.extversion).toBeTruthy();
  });

  it('pg_trgm and uuid-ossp extensions enabled', async () => {
    const { rows } = await client.query(
      `SELECT extname FROM pg_extension WHERE extname IN ('pg_trgm', 'uuid-ossp') ORDER BY extname`,
    );
    expect(rows.map(r => r.extname)).toEqual(['pg_trgm', 'uuid-ossp']);
  });

  it('cypher() query against iip_graph succeeds', async () => {
    // AGE requires SET search_path = ag_catalog per session
    await client.query(`SET search_path = ag_catalog`);
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

  it('Drizzle 0.35.x connects and runs a basic query', async () => {
    // RED — packages/db not created
    const db = drizzle(client);
    const result = await db.execute('SELECT 1 AS one');
    expect(result.rows[0]?.one).toBe(1);
  });
});
