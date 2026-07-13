/**
 * Shared Testcontainers PG helper for integration tests.
 *
 * Starts a PG16 + AGE + pgvector container (the custom image shared with
 * `infra/docker-compose.yml`), applies ALL Drizzle migrations (0000–0007),
 * and returns a Drizzle `Db` handle + raw `pg.Client` + teardown.
 *
 * Container reuse is NOT enabled (parallel suites under `singleFork` would
 * share state). Instead each call starts a fresh container with a unique DB
 * name. The ~30s cold start is amortized by running the entire suite in one
 * `beforeAll`.
 *
 * @rules FR-1.5, SEC-2, PC-1a, AC-1
 * @adr ADR-001, ADR-002
 */
import { GenericContainer, Wait, type StartedTestContainer } from 'testcontainers';
import { Client } from 'pg';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { createDb, type Db, type DbHandle } from '@iip/db';

const PG_IMAGE =
  process.env['IIP_PG_AGE_VECTOR_IMAGE'] || 'ghcr.io/iip/postgres-age-pgvector:pg16';

// Resolve the drizzle migrations directory relative to the project root.
// The helper lives at tests/support/helpers/test-db.ts; the project root is
// 3 directories up from this file's directory.
const PROJECT_ROOT = resolve(import.meta.dirname, '..', '..', '..');
const DRIZZLE_DIR = resolve(PROJECT_ROOT, 'packages', 'db', 'drizzle');

/**
 * Migration files in order. Applied sequentially inside `startTestDb`.
 * Each migration is read once at module load (no per-test file I/O).
 */
const MIGRATIONS = [
  '0000_intake_documents.sql',
  '0001_editorial_log.sql',
  '0002_intake_retention.sql',
  '0003_config_history.sql',
  '0004_epic3_ingest_tables.sql',
  '0005_sources_deferred_fields.sql',
  '0006_lawful_access_gate_fields.sql',
  '0007_document_embeddings_composite_uq.sql',
].map((name) => ({
  name,
  sql: readFileSync(resolve(DRIZZLE_DIR, name), 'utf8'),
}));

export interface TestDbHandle {
  /** Drizzle ORM handle (type-safe query builder). */
  db: Db;
  /** Raw pg.Client for direct SQL (migrations, TRUNCATE, information_schema). */
  client: Client;
  /** The Drizzle DbHandle (pool + db). Call `teardown` to close. */
  dbHandle: DbHandle;
  /** Stop the container + close the pool. Call in `afterAll`. */
  teardown: () => Promise<void>;
  /** TRUNCATE all tables (call in `beforeEach` for per-test isolation). */
  truncateAll: () => Promise<void>;
}

/**
 * Start a Testcontainers PG instance with all migrations applied.
 *
 * @returns the `TestDbHandle` — `db` for Drizzle queries, `client` for raw SQL,
 * `teardown` for cleanup, `truncateAll` for per-test isolation.
 */
export async function startTestDb(): Promise<TestDbHandle> {
  const dbName = `iip_prov_${crypto.randomUUID().slice(0, 8)}`;
  const container: StartedTestContainer = await new GenericContainer(PG_IMAGE)
    .withEnvironment({ POSTGRES_PASSWORD: 'iip', POSTGRES_DB: dbName })
    .withWaitStrategy(Wait.forLogMessage(/database system is ready to accept connections/, 2))
    .withExposedPorts(5432)
    .start();

  const host = container.getHost();
  const port = container.getMappedPort(5432);
  const connectionString = `postgres://postgres:iip@${host}:${port}/${dbName}`;

  // Raw client for applying migrations + TRUNCATE.
  const client = new Client({ connectionString });
  await client.connect();

  // Apply all migrations in order.
  for (const migration of MIGRATIONS) {
    await client.query(migration.sql);
  }

  // Drizzle handle for typed queries.
  const dbHandle = createDb(connectionString);

  return {
    db: dbHandle.db,
    client,
    dbHandle,
    teardown: async () => {
      await dbHandle.pool.end();
      await client.end();
      await container.stop();
    },
    truncateAll: async () => {
      // TRUNCATE in FK-safe order: child tables first, then parent tables.
      // CASCADE handles the FK chain; the explicit list is for clarity.
      await client.query(
        'TRUNCATE document_embeddings, ingestion_jobs, documents, sources, intake_documents, editorial_log, config_history RESTART IDENTITY CASCADE',
      );
    },
  };
}
