/**
 * Integration tests — Story 2.6a Retention/Takedown Schema (AR-23, VAL-2 G-2).
 *
 * Verifies the retention metadata columns on `intake_documents` directly
 * against the LIVE Postgres `information_schema` (NOT the Drizzle object) so
 * the test catches DB-level drift the ORM would hide: column presence,
 * nullability, the `legal_hold` NOT NULL DEFAULT false contract, the
 * vocabulary CHECK, the partial indexes, and the UP/DOWN migration
 * round-trip. Also covers the defamation-grade nullability discipline (NULL
 * retention_class = "no decision yet", never a fabricated 'standard' default).
 *
 * The (2.6b) Filipino eval fixture location is intentionally NOT asserted
 * here — it is blocked on native-Filipino annotator sourcing (Story 2.6b
 * blocker; see story-2-6-review-report.md Open Item #1).
 *
 * Pool: 'forks' + singleFork — Testcontainers holds TCP sockets.
 *
 * @rules AR-23, VAL-2, G-2
 *
 * Note: ADR-0017 (supersession-orchestration, status `Proposed`) is the new
 * home of the evicted `superseded_at` column, not the authority for these
 * retention columns; it is therefore not cited via the `@adr` form (PC-3).
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

const MIGRATION_0000 = readFileSync(new URL('0000_intake_documents.sql', DRIZZLE_DIR), 'utf8');
const MIGRATION_0002 = readFileSync(new URL('0002_intake_retention.sql', DRIZZLE_DIR), 'utf8');

/**
 * The DOWN block is documented as commented SQL inside 0002_intake_retention.sql
 * (drizzle-kit migrate is forward-only). Parsing it from the file — rather than
 * hand-retyping the statements here — means a drift between the documented DOWN
 * and what the test exercises is caught, not silently masked.
 */
const MIGRATION_0002_DOWN_SQL = (() => {
  const downHeaderIdx = MIGRATION_0002.indexOf('-- DOWN');
  const afterHeader = MIGRATION_0002.slice(downHeaderIdx);
  // The documented DOWN statements are commented with `-- ` prefixes.
  const commentLines = afterHeader.match(/^--\s*(DROP.*;|ALTER.*;)\s*$/gm);
  if (!commentLines) {
    throw new Error('Could not parse DOWN block from 0002_intake_retention.sql');
  }
  return commentLines.map((l) => l.replace(/^--\s*/, '')).join('\n');
})();

let container: StartedTestContainer;
let client: Client;

beforeAll(async () => {
  const dbName = `iip_ret_${crypto.randomUUID().slice(0, 8)}`;
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
  // Apply the baseline intake_documents table, then the 0002 retention migration.
  await client.query(MIGRATION_0000);
  await client.query(MIGRATION_0002);
}, 240_000);

afterAll(async () => {
  await client?.end();
  await container?.stop();
});

/**
 * Reads one column's live DB metadata from information_schema. Returns
 * undefined if the column does not exist so presence can be asserted
 * separately from nullability.
 */
async function getColumn(columnName: string): Promise<{
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
      WHERE table_name = 'intake_documents' AND column_name = $1
      LIMIT 1`,
    [columnName],
  );
  return result.rows[0];
}

/**
 * Inserts a minimal legal intake_documents row (the migration only adds
 * nullable/defaulted columns + NOT-NULL content_hash/status/tier that already
 * existed), so the NOT NULL + DEFAULT behaviour of `legal_hold` can be
 * exercised against real writes, not just metadata.
 */
async function insertRow(overrides: Record<string, unknown> = {}): Promise<void> {
  const cols = ['content_hash', 'status', 'tier', ...Object.keys(overrides)];
  const vals: unknown[] = [
    'a'.repeat(64), // IntakeContentHash shape (64-char hex); DB does not enforce
    'staging',
    1,
    ...Object.values(overrides),
  ];
  const placeholders = cols.map((_, i) => `$${i + 1}`).join(', ');
  await client.query(
    `INSERT INTO intake_documents (${cols.join(', ')}) VALUES (${placeholders})`,
    vals,
  );
}

// ─────────────────────────────────────────────────────────────────────────
// AC #1 — Drizzle Schema Retention Metadata (column presence + types)
// ─────────────────────────────────────────────────────────────────────────

describe('Story 2.6a — retention columns exist on intake_documents (AC #1)', () => {
  it('retention_class column exists as a nullable text column', async () => {
    const col = await getColumn('retention_class');
    expect(col, 'retention_class must exist').toBeDefined();
    expect(col?.data_type).toBe('text');
    expect(col?.is_nullable).toBe('YES'); // Option A: NULL = "no decision yet"
    expect(col?.column_default).toBeNull(); // NO fabricated 'standard' default
  });

  it('takedown_trigger column exists as a nullable text column', async () => {
    const col = await getColumn('takedown_trigger');
    expect(col, 'takedown_trigger must exist').toBeDefined();
    expect(col?.data_type).toBe('text');
    expect(col?.is_nullable).toBe('YES');
    expect(col?.column_default).toBeNull();
  });

  it('retention_set_at column exists as a nullable timestamptz column', async () => {
    const col = await getColumn('retention_set_at');
    expect(col, 'retention_set_at must exist').toBeDefined();
    // Must be WITH time zone — a regression to plain `timestamp` (dropping the
    // timezone) is exactly the silent UTC-drift defect this test exists to
    // catch at defamation grade. Do NOT accept 'timestamp without time zone'.
    expect(col?.data_type, `unexpected retention_set_at type: ${col?.data_type}`).toBe(
      'timestamp with time zone',
    );
    expect(col?.is_nullable).toBe('YES');
  });

  it('legal_hold column exists as NOT NULL with DEFAULT false', async () => {
    const col = await getColumn('legal_hold');
    expect(col, 'legal_hold must exist').toBeDefined();
    expect(col?.data_type).toBe('boolean');
    expect(col?.is_nullable).toBe('NO'); // boolean-NULL is an anti-pattern
    expect(col?.column_default).toContain('false');
  });
});

// ─────────────────────────────────────────────────────────────────────────
// AC #1 — Write behaviour (NOT NULL + DEFAULT enforced on real rows)
// ─────────────────────────────────────────────────────────────────────────

describe('Story 2.6a — legal_hold DEFAULT false on real writes', () => {
  it('omitting legal_hold writes a row with legal_hold = false (the honest "not held")', async () => {
    const before = await client.query<{ c: string }>(
      "SELECT count(*)::text AS c FROM intake_documents WHERE legal_hold = false",
    );
    await insertRow();
    const after = await client.query<{ c: string }>(
      "SELECT count(*)::text AS c FROM intake_documents WHERE legal_hold = false",
    );
    expect(Number(after.rows[0]?.c)).toBe(Number(before.rows[0]?.c) + 1);
  });

  it('retention_class / takedown_trigger / retention_set_at accept NULL (no decision yet)', async () => {
    // A row that sets legal_hold explicitly true (so we can target it) and
    // leaves the three nullable retention columns absent.
    await insertRow({ legal_hold: true });
    const result = await client.query<{
      rc: string | null;
      tt: string | null;
      rsa: Date | null;
    }>(
      `SELECT retention_class AS rc, takedown_trigger AS tt, retention_set_at AS rsa
         FROM intake_documents WHERE legal_hold = true LIMIT 1`,
    );
    expect(result.rows[0]?.rc).toBeNull();
    expect(result.rows[0]?.tt).toBeNull();
    expect(result.rows[0]?.rsa).toBeNull();
  });
});

// ─────────────────────────────────────────────────────────────────────────
// Vocabulary CHECK (belt-and-suspenders)
// ─────────────────────────────────────────────────────────────────────────

describe('Story 2.6a — retention_class vocabulary CHECK', () => {
  it.each(['standard', 'litigation_hold', 'immediate_takedown'])(
    'accepts the sanctioned value %s',
    async (value) => {
      await expect(
        insertRow({ retention_class: value }),
      ).resolves.toBeUndefined();
    },
  );

  it('rejects a misspelled retention_class (CHECK constraint)', async () => {
    // Postgres raises check_violation (23514) for a value outside the
    // sanctioned vocabulary.
    await expect(insertRow({ retention_class: 'immediat_takedown' })).rejects.toMatchObject({
      code: '23514',
    });
  });
});

// ─────────────────────────────────────────────────────────────────────────
// Partial indexes (backing the hold + retention-class scans)
// ─────────────────────────────────────────────────────────────────────────

describe('Story 2.6a — partial indexes exist', () => {
  async function indexExists(name: string): Promise<boolean> {
    const result = await client.query<{ exists: boolean }>(
      `SELECT EXISTS (
         SELECT 1 FROM pg_indexes
          WHERE tablename = 'intake_documents' AND indexname = $1
       ) AS exists`,
      [name],
    );
    return Boolean(result.rows[0]?.exists);
  }

  async function indexPredicate(name: string): Promise<string | null> {
    const result = await client.query<{ indexdef: string | null }>(
      `SELECT indexdef FROM pg_indexes
        WHERE tablename = 'intake_documents' AND indexname = $1`,
      [name],
    );
    // indexdef is the full CREATE INDEX text; return it for a substring check
    // rather than parsing the partial predicate precisely.
    return result.rows[0]?.indexdef ?? null;
  }

  it('legal_hold partial index exists and is scoped to legal_hold = true', async () => {
    expect(await indexExists('intake_documents_legal_hold_idx')).toBe(true);
    const def = await indexPredicate('intake_documents_legal_hold_idx');
    // Assert the EXACT partial predicate (Postgres normalizes to
    // `WHERE (legal_hold = true)`), not just loose 'true' substring presence
    // — a non-partial index or a differently-scoped predicate would otherwise
    // pass and the sparse-hold-scan invariant would silently regress.
    expect(def?.toLowerCase()).toContain('where (legal_hold = true)');
  });

  it('retention_class partial index exists and is scoped to retention_class IS NOT NULL', async () => {
    expect(await indexExists('intake_documents_retention_class_idx')).toBe(true);
    const def = await indexPredicate('intake_documents_retention_class_idx');
    expect(def?.toLowerCase()).toContain('where (retention_class is not null)');
  });
});

// ─────────────────────────────────────────────────────────────────────────
// DOWN migration restores the schema (DoD)
// ─────────────────────────────────────────────────────────────────────────

describe('Story 2.6a — DOWN migration restores the schema', () => {
  it('the four retention columns + indexes + CHECK are dropped by the documented DOWN block', async () => {
    // Execute the DOWN block parsed directly from 0002_intake_retention.sql so
    // a drift between the documented rollback and what this test exercises is
    // caught (a hand-retyped copy would silently mask such drift).
    await client.query(MIGRATION_0002_DOWN_SQL);

    // All four retention columns are gone.
    expect(await getColumn('retention_class')).toBeUndefined();
    expect(await getColumn('takedown_trigger')).toBeUndefined();
    expect(await getColumn('retention_set_at')).toBeUndefined();
    expect(await getColumn('legal_hold')).toBeUndefined();

    // The baseline intake_documents columns are untouched (DOWN does not
    // over-reach into the Story 2.3 schema).
    expect(await getColumn('content_hash')).toBeDefined();
    expect(await getColumn('status')).toBeDefined();

    // Re-apply UP and verify the round-tripped schema re-establishes the
    // load-bearing `legal_hold` NOT NULL DEFAULT false write contract
    // (UP→DOWN→UP must not leave the table in a degraded state).
    await client.query(MIGRATION_0002);
    const before = await client.query<{ c: string }>(
      "SELECT count(*)::text AS c FROM intake_documents WHERE legal_hold = false",
    );
    await insertRow();
    const after = await client.query<{ c: string }>(
      "SELECT count(*)::text AS c FROM intake_documents WHERE legal_hold = false",
    );
    expect(Number(after.rows[0]?.c)).toBe(Number(before.rows[0]?.c) + 1);
  });
});
