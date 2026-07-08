/**
 * Integration tests — Story 2.10 config_history schema + repository
 * (PC-2.6, AR-23, VAL-2, VAL-8 — G-2 closure).
 *
 * Verifies the `config_history` table directly against the LIVE Postgres
 * `information_schema` and exercises the ConfigHistoryRepository against the
 * real DB (not a mock executor). The test covers:
 *  - Schema structure (column presence, types, nullability, defaults, indexes)
 *  - Append-only enforcement (UPDATE/DELETE rejected by trigger)
 *  - CHECK constraints (full truth table for retention_class × legal_hold)
 *  - Default value verification on real INSERTs
 *  - Historical state reconstruction (getActiveConfigAt point-in-time query)
 *  - Clock-forgery prevention (effective_from server-stamped, not client-supplied)
 *  - UP/DOWN migration round-trip + idempotent re-run
 *  - Nullable columns (old_value accepts NULL)
 *
 * Pool: 'forks' + singleFork — Testcontainers holds TCP sockets.
 *
 * @rules PC-2.6, AR-23, VAL-2, VAL-8
 * @adr ADR-0027
 */
import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { GenericContainer, Wait, type StartedTestContainer } from 'testcontainers';
import { Client } from 'pg';
import { readFileSync } from 'node:fs';
import { z } from 'zod';
import {
  createConfigHistoryRepo,
  type Clock,
  type QueryExecutor,
} from '@iip/config';
import { ConfigKeySchema, ConfigHistoryIdSchema } from '@iip/contracts';
import { asConfigKey, asPrincipal } from '@iip/test-utils';

// ─────────────────────────────────────────────────────────────────────────
// Harness
// ─────────────────────────────────────────────────────────────────────────

const PG_IMAGE =
  process.env['IIP_PG_AGE_VECTOR_IMAGE'] ||
  'ghcr.io/iip/postgres-age-pgvector:pg16';

const DRIZZLE_DIR = new URL('../../packages/db/drizzle/', import.meta.url);

const MIGRATION_0003 = readFileSync(new URL('0003_config_history.sql', DRIZZLE_DIR), 'utf8');

/** zod schema for the journal entries we read from meta/_journal.json. */
const JournalSchema = z.object({
  entries: z.array(
    z.object({
      idx: z.number(),
      version: z.string(),
      when: z.number(),
      tag: z.string(),
      breakpoints: z.boolean(),
    }),
  ),
});

/**
 * The DOWN block is documented as commented SQL inside 0003_config_history.sql
 * (drizzle-kit migrate is forward-only). Parsing it from the file — rather
 * than hand-retyping the statements here — means a drift between the
 * documented DOWN and what the test exercises is caught, not silently masked
 * (mirrors the retention-schema integration test pattern from Story 2.6a).
 */
const MIGRATION_0003_DOWN_SQL = (() => {
  const downHeaderIdx = MIGRATION_0003.indexOf('-- DOWN');
  const afterHeader = MIGRATION_0003.slice(downHeaderIdx);
  const commentLines = afterHeader.match(/^--\s*(DROP.*;|ALTER.*;)\s*$/gm);
  if (!commentLines) {
    throw new Error('Could not parse DOWN block from 0003_config_history.sql');
  }
  return commentLines.map((l) => l.replace(/^--\s*/, '')).join('\n');
})();

let container: StartedTestContainer;
let client: Client;
let appRoleClient: Client;

beforeAll(async () => {
  const dbName = `iip_cfg_${crypto.randomUUID().slice(0, 8)}`;
  container = await new GenericContainer(PG_IMAGE)
    .withEnvironment({ POSTGRES_PASSWORD: 'iip', POSTGRES_DB: dbName })
    .withWaitStrategy(Wait.forLogMessage(/database system is ready to accept connections/, 2))
    .withExposedPorts(5432)
    .start();
  const host = container.getHost();
  const port = container.getMappedPort(5432);

  const superConnectionString = `postgres://postgres:iip@${host}:${port}/${dbName}`;
  client = new Client({ connectionString: superConnectionString });
  await client.connect();
  await client.query(MIGRATION_0003);

  // Create the application role used in production and grant only INSERT/SELECT
  // on config_history. UPDATE/DELETE are implicitly denied, so the append-only
  // trigger rejects them when the application role attempts a mutation.
  const appRole = 'iip_app';
  const appPassword = 'test';
  await client.query(`CREATE ROLE ${appRole} LOGIN PASSWORD '${appPassword}'`);
  await client.query(`GRANT USAGE ON SCHEMA public TO ${appRole}`);
  await client.query(`GRANT SELECT, INSERT ON config_history TO ${appRole}`);
  // The role must own (or hold TRIGGER privilege on) the table for its
  // row-level BEFORE UPDATE/DELETE trigger to fire when the role issues the
  // mutation. Without ownership, the mutation is rejected with "permission
  // denied" before the trigger runs, which still blocks the write but does
  // not exercise the trigger. Ownership is the simplest way to let the trigger
  // fire under the application role while keeping direct DDL/ownership changes
  // out of the role's reach via standard PostgreSQL privilege rules.
  await client.query(`ALTER TABLE config_history OWNER TO ${appRole}`);

  const appConnectionString = `postgres://${appRole}:${appPassword}@${host}:${port}/${dbName}`;
  appRoleClient = new Client({ connectionString: appConnectionString });
  await appRoleClient.connect();
}, 240_000);

afterAll(async () => {
  await appRoleClient?.end();
  await client?.end();
  await container?.stop();
});

/**
 * Reads one column's live DB metadata from information_schema.
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
      WHERE table_name = 'config_history' AND column_name = $1
      LIMIT 1`,
    [columnName],
  );
  return result.rows[0];
}

/**
 * Insert a minimal legal config_history row. By default the migration's
 * DEFAULT clauses populate retention_class='unbounded_legal_hold' and
 * legal_hold=true; callers can override any column.
 *
 * The default `config_key` is randomized per call so the unique index on
 * `(config_key, effective_from)` never collides when the truth-table tests
 * fire multiple inserts within the same millisecond. Callers that need a
 * STABLE key across inserts (e.g. the historical-reconstruction test)
 * override `config_key` explicitly.
 */
async function insertRow(overrides: Record<string, unknown> = {}): Promise<void> {
  const defaultKey = `test.insert.${crypto.randomUUID()}`;
  const merged: Record<string, unknown> = {
    config_key: defaultKey,
    new_value: JSON.stringify({ model_id: 'qwen3:14b' }),
    effective_from: new Date(),
    acting_principal: 'operator-001',
    ...overrides,
  };
  const cols = Object.keys(merged);
  const vals = Object.values(merged);
  const placeholders = cols.map((_, i) => `$${i + 1}`).join(', ');
  await client.query(
    `INSERT INTO config_history (${cols.join(', ')}) VALUES (${placeholders})`,
    vals,
  );
}

/** Adapter from pg.Client to the repo's QueryExecutor interface. */
function asExecutor(pgClient: Client): QueryExecutor {
  return {
    async query(text, params) {
      const result = await pgClient.query(text, params as unknown[]);
      return { rows: result.rows as readonly Record<string, unknown>[] };
    },
  };
}

/** Deterministic clock for point-in-time tests. */
function fixedClock(when: Date): Clock {
  return { now: () => when };
}

// ─────────────────────────────────────────────────────────────────────────
// AC #1 + AC #2 — Schema structure (column presence, types, nullability, defaults)
// ─────────────────────────────────────────────────────────────────────────

describe('Story 2.10 — config_history schema structure (AC #1, #2)', () => {
  it('id column exists as a uuid PRIMARY KEY with gen_random_uuid() default', async () => {
    const col = await getColumn('id');
    expect(col, 'id must exist').toBeDefined();
    expect(col?.data_type).toBe('uuid');
    expect(col?.is_nullable).toBe('NO'); // PRIMARY KEY
    expect(col?.column_default).toContain('gen_random_uuid()');
  });

  it('config_key column exists as NOT NULL text', async () => {
    const col = await getColumn('config_key');
    expect(col?.data_type).toBe('text');
    expect(col?.is_nullable).toBe('NO');
    expect(col?.column_default).toBeNull();
  });

  it('old_value column exists as a NULLABLE jsonb column', async () => {
    const col = await getColumn('old_value');
    expect(col?.data_type).toBe('jsonb');
    expect(col?.is_nullable).toBe('YES');
    expect(col?.column_default).toBeNull();
  });

  it('new_value column exists as NOT NULL jsonb', async () => {
    const col = await getColumn('new_value');
    expect(col?.data_type).toBe('jsonb');
    expect(col?.is_nullable).toBe('NO');
  });

  it('effective_from column exists as NOT NULL timestamptz', async () => {
    const col = await getColumn('effective_from');
    expect(col?.data_type).toBe('timestamp with time zone');
    expect(col?.is_nullable).toBe('NO');
    expect(col?.column_default).toBeNull(); // NO default — repo stamps server-side
  });

  it('acting_principal column exists as NOT NULL text', async () => {
    const col = await getColumn('acting_principal');
    expect(col?.data_type).toBe('text');
    expect(col?.is_nullable).toBe('NO');
  });

  it('retention_class column is NOT NULL with DEFAULT unbounded_legal_hold (VAL-8)', async () => {
    const col = await getColumn('retention_class');
    expect(col?.data_type).toBe('text');
    expect(col?.is_nullable).toBe('NO');
    expect(col?.column_default).toContain('unbounded_legal_hold');
  });

  it('legal_hold column is NOT NULL with DEFAULT true', async () => {
    const col = await getColumn('legal_hold');
    expect(col?.data_type).toBe('boolean');
    expect(col?.is_nullable).toBe('NO');
    expect(col?.column_default).toContain('true');
  });

  it('created_at column is NOT NULL timestamptz with DEFAULT now()', async () => {
    const col = await getColumn('created_at');
    expect(col?.data_type).toBe('timestamp with time zone');
    expect(col?.is_nullable).toBe('NO');
    expect(col?.column_default).toContain('now()');
  });

  it('effective_until column does NOT exist (AM-1 — derived at query time)', async () => {
    const col = await getColumn('effective_until');
    expect(col).toBeUndefined();
  });

  it('unique index on (config_key, effective_from) exists', async () => {
    const result = await client.query<{ exists: boolean }>(
      `SELECT EXISTS (
         SELECT 1 FROM pg_indexes
          WHERE tablename = 'config_history'
            AND indexname = 'config_history_key_effective_from_uq'
            AND indexdef ILIKE '%UNIQUE%'
       ) AS exists`,
    );
    expect(result.rows[0]?.exists).toBe(true);
  });

  it('partial index on legal_hold = true exists with the correct predicate', async () => {
    const result = await client.query<{ indexdef: string | null }>(
      `SELECT indexdef FROM pg_indexes
        WHERE tablename = 'config_history'
          AND indexname = 'config_history_legal_hold_idx'`,
    );
    expect(result.rows[0]?.indexdef).toBeDefined();
    // Postgres normalizes the predicate to `WHERE (legal_hold = true)`.
    expect(result.rows[0]?.indexdef?.toLowerCase()).toContain('where (legal_hold = true)');
  });
});

// ─────────────────────────────────────────────────────────────────────────
// AC #3 — Append-only enforcement (UPDATE/DELETE rejected by trigger)
// ─────────────────────────────────────────────────────────────────────────

describe('Story 2.10 — append-only trigger enforcement (AC #3)', () => {
  it('INSERT succeeds (the table is writable)', async () => {
    await expect(insertRow()).resolves.toBeUndefined();
  });

  it('INSERT succeeds as the application role (positive privilege check)', async () => {
    const key = `test.app.insert.${crypto.randomUUID()}`;
    await expect(
      appRoleClient.query(
        `INSERT INTO config_history (config_key, new_value, effective_from, acting_principal)
         VALUES ($1, '{}', now(), 'op')`,
        [key],
      ),
    ).resolves.toBeDefined();
  });

  it('UPDATE attempt fails as the application role (trigger rejects)', async () => {
    // Use a STABLE, unique key so the UPDATE matches exactly one row (the
    // trigger fires only on matched rows; a zero-row UPDATE would resolve
    // successfully and the assertion would spuriously fail).
    const key = `test.app.update.${crypto.randomUUID()}`;
    await insertRow({ config_key: key });
    await expect(
      appRoleClient.query(`UPDATE config_history SET new_value = '"tampered"' WHERE config_key = $1`, [key]),
    ).rejects.toMatchObject({
      // plpgsql RAISE EXCEPTION surfaces as a generic error; assert the message
      // contains the append-only marker. The constraint/code field varies
      // across pg driver versions, so the message is the stable signal.
      message: expect.stringMatching(/append-only/i),
    });
  });

  it('DELETE attempt fails as the application role (trigger rejects)', async () => {
    const key = `test.app.delete.${crypto.randomUUID()}`;
    await insertRow({ config_key: key });
    await expect(
      appRoleClient.query(`DELETE FROM config_history WHERE config_key = $1`, [key]),
    ).rejects.toMatchObject({
      message: expect.stringMatching(/append-only/i),
    });
  });

  it('UPDATE attempt fails as superuser too (trigger is role-independent)', async () => {
    const key = `test.superuser.update.${crypto.randomUUID()}`;
    await insertRow({ config_key: key });
    await expect(
      client.query(`UPDATE config_history SET new_value = '"tampered"' WHERE config_key = $1`, [key]),
    ).rejects.toMatchObject({
      message: expect.stringMatching(/append-only/i),
    });
  });
});

// ─────────────────────────────────────────────────────────────────────────
// AC #2 — CHECK constraints (full truth table: retention_class × legal_hold)
// ─────────────────────────────────────────────────────────────────────────

describe('Story 2.10 — CHECK constraint truth table (AC #2)', () => {
  // Truth table: (retention_class, legal_hold) → ACCEPT | REJECT
  // The legal_hold CHECK rejects legal_hold=false UNLESS retention_class='purged_after_audit'.
  // The retention_class vocab CHECK rejects any value outside the sanctioned set.
  it.each([
    { retentionClass: 'unbounded_legal_hold', legalHold: true, expected: 'ACCEPT' },
    { retentionClass: 'unbounded_legal_hold', legalHold: false, expected: 'REJECT' },
    { retentionClass: 'superseded_retain', legalHold: true, expected: 'ACCEPT' },
    { retentionClass: 'superseded_retain', legalHold: false, expected: 'REJECT' },
    { retentionClass: 'purged_after_audit', legalHold: true, expected: 'ACCEPT' },
    { retentionClass: 'purged_after_audit', legalHold: false, expected: 'ACCEPT' },
    { retentionClass: 'misspelled_value', legalHold: true, expected: 'REJECT' },
    { retentionClass: 'misspelled_value', legalHold: false, expected: 'REJECT' },
  ])(
    'retention_class=$retentionClass, legal_hold=$legalHold → $expected',
    async ({ retentionClass, legalHold, expected }) => {
      const attempt = insertRow({
        retention_class: retentionClass,
        legal_hold: legalHold,
      });
      if (expected === 'ACCEPT') {
        await expect(attempt).resolves.toBeUndefined();
      } else {
        await expect(attempt).rejects.toMatchObject({
          // 23514 = check_violation (covers both the vocab CHECK and the legal_hold CHECK)
          code: '23514',
        });
      }
    },
  );
});

// ─────────────────────────────────────────────────────────────────────────
// Default value verification on real INSERTs
// ─────────────────────────────────────────────────────────────────────────

describe('Story 2.10 — DEFAULT clauses verified on real INSERTs (VAL-8)', () => {
  it('INSERT without retention_class → row has unbounded_legal_hold', async () => {
    const key = `test.default.class.${crypto.randomUUID()}`;
    await client.query(
      `INSERT INTO config_history (config_key, new_value, effective_from, acting_principal)
       VALUES ($1, '{}', now(), 'op')`,
      [key],
    );
    const result = await client.query<{ rc: string }>(
      `SELECT retention_class AS rc FROM config_history WHERE config_key = $1`,
      [key],
    );
    expect(result.rows[0]?.rc).toBe('unbounded_legal_hold');
  });

  it('INSERT without legal_hold → row has legal_hold = true', async () => {
    const key = `test.default.hold.${crypto.randomUUID()}`;
    await client.query(
      `INSERT INTO config_history (config_key, new_value, effective_from, acting_principal)
       VALUES ($1, '{}', now(), 'op')`,
      [key],
    );
    const result = await client.query<{ lh: boolean }>(
      `SELECT legal_hold AS lh FROM config_history WHERE config_key = $1`,
      [key],
    );
    expect(result.rows[0]?.lh).toBe(true);
  });
});

// ─────────────────────────────────────────────────────────────────────────
// Historical state reconstruction (getActiveConfigAt — point-in-time query)
// ─────────────────────────────────────────────────────────────────────────

describe('Story 2.10 — historical state reconstruction (getActiveConfigAt)', () => {
  it('returns the active config at a point in time (3 entries, 3 queries)', async () => {
    // Use the repository so the query path is exercised end-to-end.
    const t1 = new Date('2026-01-01T00:00:00Z');
    const t2 = new Date('2026-02-01T00:00:00Z');
    const t3 = new Date('2026-03-01T00:00:00Z');
    const key = asConfigKey(`test.history.${crypto.randomUUID()}`);

    // Three appends with distinct clock values, using a fresh repo per append
    // so the clock is the only time source. Variable names avoid the
    // `repo`/`editorialRepo` regex of the AC-12(c) ESLint rule (this is a
    // ConfigHistoryRepository, not an EditorialLogRepo).
    const cfgRepo1 = createConfigHistoryRepo({
      executor: asExecutor(client),
      clock: fixedClock(t1),
    });
    const cfgRepo2 = createConfigHistoryRepo({
      executor: asExecutor(client),
      clock: fixedClock(t2),
    });
    const cfgRepo3 = createConfigHistoryRepo({
      executor: asExecutor(client),
      clock: fixedClock(t3),
    });
    await cfgRepo1.append({ configKey: key, oldValue: null, newValue: 'v1', actingPrincipal: asPrincipal('op') });
    await cfgRepo2.append({ configKey: key, oldValue: 'v1', newValue: 'v2', actingPrincipal: asPrincipal('op') });
    await cfgRepo3.append({ configKey: key, oldValue: 'v2', newValue: 'v3', actingPrincipal: asPrincipal('op') });

    // Read with a neutral repo (clock irrelevant for reads).
    const cfgRepo = createConfigHistoryRepo({
      executor: asExecutor(client),
      clock: fixedClock(new Date()),
    });

    // Query at T1.5 → active is T1 (v1).
    const atT1_5 = await cfgRepo.getActiveConfigAt(key, new Date('2026-01-15T00:00:00Z'));
    expect(atT1_5?.new_value).toBe('v1');

    // Query at T2.5 → active is T2 (v2).
    const atT2_5 = await cfgRepo.getActiveConfigAt(key, new Date('2026-02-15T00:00:00Z'));
    expect(atT2_5?.new_value).toBe('v2');

    // Query at T3+1 → active is T3 (v3).
    const atT3_plus = await cfgRepo.getActiveConfigAt(key, new Date('2026-04-01T00:00:00Z'));
    expect(atT3_plus?.new_value).toBe('v3');
  });

  it('returns null when no entry exists for the key at the given time', async () => {
    const cfgRepo = createConfigHistoryRepo({
      executor: asExecutor(client),
      clock: fixedClock(new Date()),
    });
    const result = await cfgRepo.getActiveConfigAt(
      asConfigKey(`test.empty.${crypto.randomUUID()}`),
      new Date(),
    );
    expect(result).toBeNull();
  });
});

// ─────────────────────────────────────────────────────────────────────────
// Clock-forgery prevention (PC-8 — effective_from server-stamped)
// ─────────────────────────────────────────────────────────────────────────

describe('Story 2.10 — clock-forgery prevention (PC-8)', () => {
  it('the repository stamps effective_from from the injected clock (not caller-supplied)', async () => {
    // The repository's AppendParams does NOT accept effective_from at all —
    // the clock is the only source. This test verifies the stored value is
    // exactly the injected clock's value.
    const injected = new Date('2026-05-15T12:34:56.789Z');
    const cfgRepo = createConfigHistoryRepo({
      executor: asExecutor(client),
      clock: fixedClock(injected),
    });
    const key = asConfigKey(`test.clock.${crypto.randomUUID()}`);
    const entry = await cfgRepo.append({
      configKey: key,
      oldValue: null,
      newValue: { v: 'forged?' },
      actingPrincipal: asPrincipal('op'),
    });
    expect(entry.effective_from.toISOString()).toBe(injected.toISOString());

    // Verify against the live DB (not just the returned entry).
    const result = await client.query<{ ef: Date }>(
      `SELECT effective_from AS ef FROM config_history WHERE config_key = $1`,
      [key],
    );
    expect(result.rows[0]?.ef.toISOString()).toBe(injected.toISOString());
  });
});

// ─────────────────────────────────────────────────────────────────────────
// Nullable columns (old_value accepts NULL)
// ─────────────────────────────────────────────────────────────────────────

describe('Story 2.10 — nullable old_value (first-ever config value semantic)', () => {
  it('old_value accepts NULL via raw SQL (first-ever value for a key)', async () => {
    const key = `test.null.${crypto.randomUUID()}`;
    await expect(
      client.query(
        `INSERT INTO config_history (config_key, old_value, new_value, effective_from, acting_principal)
         VALUES ($1, NULL, '{}', now(), 'op')`,
        [key],
      ),
    ).resolves.toBeDefined();
    const result = await client.query<{ ov: unknown }>(
      `SELECT old_value AS ov FROM config_history WHERE config_key = $1`,
      [key],
    );
    expect(result.rows[0]?.ov).toBeNull();
  });

  it('old_value accepts NULL via the repository (AppendParams.oldValue = null)', async () => {
    const cfgRepo = createConfigHistoryRepo({
      executor: asExecutor(client),
      clock: fixedClock(new Date()),
    });
    const key = asConfigKey(`test.null.repo.${crypto.randomUUID()}`);
    const entry = await cfgRepo.append({
      configKey: key,
      oldValue: null,
      newValue: { first: true },
      actingPrincipal: asPrincipal('op'),
    });
    expect(entry.old_value).toBeNull();
  });
});

// ─────────────────────────────────────────────────────────────────────────
// UP/DOWN migration round-trip + idempotent re-run
// ─────────────────────────────────────────────────────────────────────────

describe('Story 2.10 — UP/DOWN migration round-trip + idempotent re-run', () => {
  it('DOWN drops the table; UP restores it; re-running UP is idempotent', async () => {
    // Execute the DOWN block parsed from 0003_config_history.sql.
    await client.query(MIGRATION_0003_DOWN_SQL);

    // The table is gone.
    const afterDown = await getColumn('config_key');
    expect(afterDown).toBeUndefined();

    // Re-apply UP.
    await client.query(MIGRATION_0003);
    const afterUp = await getColumn('config_key');
    expect(afterUp?.data_type).toBe('text');

    // Re-running UP must NOT error (CREATE TABLE IF NOT EXISTS).
    await expect(client.query(MIGRATION_0003)).resolves.toBeDefined();

    // The table is still writable after the round-trip.
    await expect(insertRow()).resolves.toBeUndefined();
  });

  it('meta/_journal.json has exactly 6 entries (idx 0–5)', async () => {
    const raw = readFileSync(new URL('meta/_journal.json', DRIZZLE_DIR), 'utf8');
    const journal = JournalSchema.parse(JSON.parse(raw));
    expect(journal.entries.length).toBe(6);
    expect(journal.entries[3]?.tag).toBe('0003_config_history');
    expect(journal.entries[3]?.idx).toBe(3);
    expect(journal.entries[4]?.tag).toBe('0004_epic3_ingest_tables');
    expect(journal.entries[4]?.idx).toBe(4);
    expect(journal.entries[5]?.tag).toBe('0005_sources_deferred_fields');
    expect(journal.entries[5]?.idx).toBe(5);
  });
});

// ─────────────────────────────────────────────────────────────────────────
// Repository row mapping (branded types preserved through round-trip)
// ─────────────────────────────────────────────────────────────────────────

describe('Story 2.10 — repository row mapping (branded types)', () => {
  it('append returns a ConfigHistoryEntry with branded id + config_key', async () => {
    const cfgRepo = createConfigHistoryRepo({
      executor: asExecutor(client),
      clock: fixedClock(new Date()),
    });
    const entry = await cfgRepo.append({
      configKey: asConfigKey(`test.branded.${crypto.randomUUID()}`),
      oldValue: null,
      newValue: { branded: true },
      actingPrincipal: asPrincipal('op-001'),
    });
    // The branded types are phantom at runtime, but the runtime values must
    // round-trip through the zod .parse() gate in rowToEntry.
    expect(() => ConfigHistoryIdSchema.parse(entry.id)).not.toThrow();
    expect(() => ConfigKeySchema.parse(entry.config_key)).not.toThrow();
    expect(entry.retention_class).toBe('unbounded_legal_hold');
    expect(entry.legal_hold).toBe(true);
  });
});
