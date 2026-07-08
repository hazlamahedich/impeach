/**
 * Integration tests — Epic 3 prep (TD3): sources, documents, ingestion_jobs schema.
 *
 * Verifies the three new tables directly against the LIVE Postgres
 * `information_schema` (NOT the Drizzle object) so the test catches DB-level
 * drift the ORM would hide: column presence, types, nullability, FK
 * constraints, the vocabulary CHECKs, the unique indexes (dedupe anchors),
 * and the UP/DOWN migration round-trip.
 *
 * Pool: 'forks' + singleFork — Testcontainers holds TCP sockets.
 *
 * @rules FR-1.1, FR-1.3, FR-1.5, FR-1.6, SEC-3, PC-1a, PC-2.4
 */
import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { GenericContainer, Wait, type StartedTestContainer } from 'testcontainers';
import { Client } from 'pg';
import { readFileSync } from 'node:fs';

// ─────────────────────────────────────────────────────────────────────────
// Harness
// ─────────────────────────────────────────────────────────────────────────

const PG_IMAGE =
  process.env['IIP_PG_AGE_VECTOR_IMAGE'] ||
  'ghcr.io/iip/postgres-age-pgvector:pg16';

const DRIZZLE_DIR = new URL('../../packages/db/drizzle/', import.meta.url);

const MIGRATION_0004 = readFileSync(new URL('0004_epic3_ingest_tables.sql', DRIZZLE_DIR), 'utf8');

/**
 * The DOWN block is documented as commented SQL inside the migration file
 * (drizzle-kit migrate is forward-only). Parsing it from the file catches drift
 * between the documented DOWN and what the test exercises.
 */
const MIGRATION_0004_DOWN_SQL = (() => {
  const downHeaderIdx = MIGRATION_0004.indexOf('-- DOWN');
  const afterHeader = MIGRATION_0004.slice(downHeaderIdx);
  const commentLines = afterHeader.match(/^--\s*(DROP.*;|ALTER.*;)\s*$/gm);
  if (!commentLines) {
    throw new Error('Could not parse DOWN block from 0004_epic3_ingest_tables.sql');
  }
  return commentLines.map((l) => l.replace(/^--\s*/, '')).join('\n');
})();

let container: StartedTestContainer;
let client: Client;

beforeAll(async () => {
  const dbName = `iip_ing_${crypto.randomUUID().slice(0, 8)}`;
  container = await new GenericContainer(PG_IMAGE)
    .withEnvironment({ POSTGRES_PASSWORD: 'iip', POSTGRES_DB: dbName })
    .withWaitStrategy(Wait.forLogMessage(/database system is ready to accept connections/, 2))
    .withExposedPorts(5432)
    .start();
  const host = container.getHost();
  const port = container.getMappedPort(5432);
  const connectionString = `postgres://postgres:iip@${host}:${port}/${dbName}`;
  client = new Client({ connectionString });
  await client.connect();
  await client.query(MIGRATION_0004);
}, 240_000);

afterAll(async () => {
  await client?.end();
  await container?.stop();
});

/**
 * Reads one column's live DB metadata from information_schema.
 */
async function getColumn(table: string, column: string): Promise<{
  data_type: string;
  is_nullable: 'YES' | 'NO';
  column_default: string | null;
} | undefined> {
  const result = await client.query<{
    data_type: string;
    is_nullable: 'YES' | 'NO';
    column_default: string | null;
  }>(
    `SELECT data_type, is_nullable, column_default
       FROM information_schema.columns
      WHERE table_name = $1 AND column_name = $2
      LIMIT 1`,
    [table, column],
  );
  return result.rows[0];
}

async function tableExists(table: string): Promise<boolean> {
  const result = await client.query<{ exists: boolean }>(
    `SELECT EXISTS (
       SELECT 1 FROM information_schema.tables
        WHERE table_name = $1
     ) AS exists`,
    [table],
  );
  return Boolean(result.rows[0]?.exists);
}

async function indexExists(table: string, indexName: string): Promise<boolean> {
  const result = await client.query<{ exists: boolean }>(
    `SELECT EXISTS (
       SELECT 1 FROM pg_indexes
        WHERE tablename = $1 AND indexname = $2
     ) AS exists`,
    [table, indexName],
  );
  return Boolean(result.rows[0]?.exists);
}

// ─────────────────────────────────────────────────────────────────────────
// Table presence
// ─────────────────────────────────────────────────────────────────────────

describe('TD3 — three tables exist', () => {
  it('sources table exists', async () => {
    expect(await tableExists('sources')).toBe(true);
  });
  it('documents table exists', async () => {
    expect(await tableExists('documents')).toBe(true);
  });
  it('ingestion_jobs table exists', async () => {
    expect(await tableExists('ingestion_jobs')).toBe(true);
  });
});

// ─────────────────────────────────────────────────────────────────────────
// sources columns (FR-1.1)
// ─────────────────────────────────────────────────────────────────────────

describe('TD3 — sources columns (FR-1.1)', () => {
  it('id is a UUID PK with gen_random_uuid() default', async () => {
    const col = await getColumn('sources', 'id');
    expect(col?.data_type).toBe('uuid');
    expect(col?.is_nullable).toBe('NO');
    expect(col?.column_default).toContain('gen_random_uuid()');
  });
  it('trust_tier is NOT NULL integer', async () => {
    const col = await getColumn('sources', 'trust_tier');
    expect(col?.data_type).toBe('integer');
    expect(col?.is_nullable).toBe('NO');
  });
  it('confirmed defaults false (honest "not yet validated")', async () => {
    const col = await getColumn('sources', 'confirmed');
    expect(col?.data_type).toBe('boolean');
    expect(col?.is_nullable).toBe('NO');
    expect(col?.column_default).toContain('false');
  });
  it('wire_service + original_publisher are nullable text', async () => {
    expect((await getColumn('sources', 'wire_service'))?.is_nullable).toBe('YES');
    expect((await getColumn('sources', 'original_publisher'))?.is_nullable).toBe('YES');
  });
});

// ─────────────────────────────────────────────────────────────────────────
// Vocabulary CHECKs (sources)
// ─────────────────────────────────────────────────────────────────────────

describe('TD3 — sources vocabulary CHECKs', () => {
  async function insertSource(overrides: Record<string, unknown> = {}): Promise<unknown> {
    // Merge overrides INTO the base defaults (override wins) so a test can
    // override e.g. trust_tier without it appearing twice in the column list.
    const merged: Record<string, unknown> = {
      name: 'Senate',
      url: 'https://senate.gov',
      source_type: 'government',
      crawl_strategy: 'sitemap',
      trust_tier: 1,
      ...overrides,
    };
    const cols = Object.keys(merged);
    const vals = Object.values(merged);
    const placeholders = cols.map((_, i) => `$${i + 1}`).join(', ');
    return client.query(
      `INSERT INTO sources (${cols.join(', ')}) VALUES (${placeholders})`,
      vals,
    );
  }

  it.each(['government', 'court', 'media', 'press_release', 'transcript'])(
    'accepts source_type %s',
    async (value) => {
      await expect(insertSource({ source_type: value, url: `https://${value}.test` })).resolves.toBeDefined();
    },
  );
  it('rejects invalid source_type', async () => {
    await expect(insertSource({ source_type: 'blog', url: 'https://blog.test' })).rejects.toMatchObject({
      code: '23514',
    });
  });
  it.each([1, 2, 3])('accepts trust_tier %s', async (tier) => {
    await expect(insertSource({ trust_tier: tier, url: `https://t${tier}.test` })).resolves.toBeDefined();
  });
  it('rejects trust_tier 4 (out of range)', async () => {
    await expect(insertSource({ trust_tier: 4, url: 'https://t4.test' })).rejects.toMatchObject({
      code: '23514',
    });
  });
});

// ─────────────────────────────────────────────────────────────────────────
// documents columns + FK (FR-1.5)
// ─────────────────────────────────────────────────────────────────────────

describe('TD3 — documents columns + FK (FR-1.5)', () => {
  it('content_checksum is NOT NULL text (dedupe anchor)', async () => {
    const col = await getColumn('documents', 'content_checksum');
    expect(col?.data_type).toBe('text');
    expect(col?.is_nullable).toBe('NO');
  });
  it('source_id is NOT NULL (provenance is mandatory)', async () => {
    const col = await getColumn('documents', 'source_id');
    expect(col?.data_type).toBe('uuid');
    expect(col?.is_nullable).toBe('NO');
  });
  it('intake_document_id is nullable (manual uploads skip the gate)', async () => {
    const col = await getColumn('documents', 'intake_document_id');
    expect(col?.is_nullable).toBe('YES');
  });
  it('FK rejects a document with a non-existent source_id', async () => {
    await expect(
      client.query(
        `INSERT INTO documents (source_id, content_checksum, raw_snapshot_key, fetch_metadata)
         VALUES ('00000000-0000-4000-a000-000000000000', $1, 'key', '{}'::jsonb)`,
        ['a'.repeat(64)],
      ),
    ).rejects.toMatchObject({ code: '23503' }); // foreign_key_violation
  });
});

// ─────────────────────────────────────────────────────────────────────────
// ingestion_jobs columns + state CHECK (FR-1.6)
// ─────────────────────────────────────────────────────────────────────────

describe('TD3 — ingestion_jobs columns + state CHECK (FR-1.6)', () => {
  it('job_id is NOT NULL text (idempotency key)', async () => {
    const col = await getColumn('ingestion_jobs', 'job_id');
    expect(col?.data_type).toBe('text');
    expect(col?.is_nullable).toBe('NO');
  });
  it('state defaults pending', async () => {
    const col = await getColumn('ingestion_jobs', 'state');
    expect(col?.column_default).toContain('pending');
  });
  it('attempts defaults 0, max_attempts defaults 5', async () => {
    expect((await getColumn('ingestion_jobs', 'attempts'))?.column_default).toContain('0');
    expect((await getColumn('ingestion_jobs', 'max_attempts'))?.column_default).toContain('5');
  });

  async function insertJob(overrides: Record<string, unknown> = {}): Promise<unknown> {
    // Unique job_id per call (the unique index would otherwise reject repeats).
    const jobId = crypto.randomUUID().replace(/-/g, '').padEnd(64, '0').slice(0, 64);
    const merged: Record<string, unknown> = { job_id: jobId, payload: {}, ...overrides };
    const cols = Object.keys(merged);
    const vals = Object.values(merged);
    const placeholders = cols.map((_, i) => `$${i + 1}`).join(', ');
    return client.query(
      `INSERT INTO ingestion_jobs (${cols.join(', ')}) VALUES (${placeholders})`,
      vals,
    );
  }
  it.each(['pending', 'running', 'completed', 'failed', 'dead_lettered', 'cancelled'])(
    'accepts state %s',
    async (state) => {
      await expect(insertJob({ state })).resolves.toBeDefined();
    },
  );
  it('rejects invalid state', async () => {
    await expect(insertJob({ state: 'paused' })).rejects.toMatchObject({ code: '23514' });
  });
});

// ─────────────────────────────────────────────────────────────────────────
// Unique indexes (dedupe anchors — PC-1a, PC-2.4)
// ─────────────────────────────────────────────────────────────────────────

describe('TD3 — dedupe-anchor unique indexes', () => {
  it('sources_url_uq exists', async () => {
    expect(await indexExists('sources', 'sources_url_uq')).toBe(true);
  });
  it('documents_content_checksum_uq exists (PC-1a dedupe)', async () => {
    expect(await indexExists('documents', 'documents_content_checksum_uq')).toBe(true);
  });
  it('ingestion_jobs_job_id_uq exists (PC-2.4 idempotency)', async () => {
    expect(await indexExists('ingestion_jobs', 'ingestion_jobs_job_id_uq')).toBe(true);
  });
  it('duplicate content_checksum is rejected', async () => {
    // Insert a valid source first, then attempt a duplicate-checksum document.
    await client.query(
      `INSERT INTO sources (name, url, source_type, crawl_strategy, trust_tier)
       VALUES ('DupTest', 'https://dup.test', 'government', 'manual', 1)`,
    );
    const source = await client.query<{ id: string }>(`SELECT id FROM sources WHERE url = 'https://dup.test'`);
    const checksum = 'c'.repeat(64);
    await client.query(
      `INSERT INTO documents (source_id, content_checksum, raw_snapshot_key, fetch_metadata)
       VALUES ($1, $2, 'key1', '{}'::jsonb)`,
      [source.rows[0]?.id, checksum],
    );
    await expect(
      client.query(
        `INSERT INTO documents (source_id, content_checksum, raw_snapshot_key, fetch_metadata)
         VALUES ($1, $2, 'key2', '{}'::jsonb)`,
        [source.rows[0]?.id, checksum],
      ),
    ).rejects.toMatchObject({ code: '23505' }); // unique_violation
  });
});

// ─────────────────────────────────────────────────────────────────────────
// DOWN migration restores the schema
// ─────────────────────────────────────────────────────────────────────────

describe('TD3 — DOWN migration restores the schema', () => {
  it('the three tables + indexes + CHECKs are dropped by the documented DOWN block', async () => {
    await client.query(MIGRATION_0004_DOWN_SQL);
    expect(await tableExists('sources')).toBe(false);
    expect(await tableExists('documents')).toBe(false);
    expect(await tableExists('ingestion_jobs')).toBe(false);
    // Re-apply UP and verify round-trip
    await client.query(MIGRATION_0004);
    expect(await tableExists('sources')).toBe(true);
    expect(await tableExists('documents')).toBe(true);
    expect(await tableExists('ingestion_jobs')).toBe(true);
  });
});
