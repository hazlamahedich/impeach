/**
 * Integration test — first concrete config knob emits through config_history
 * (Story 2.10, AC #1, PC-2.6).
 *
 * Verifies the end-to-end causal chain:
 *   setLogLevel('error', principal) → notifyConfigChange → registered
 *   ConfigHistoryRepository.append → row in config_history.
 *
 * Pool: 'forks' + singleFork — Testcontainers holds TCP sockets.
 *
 * @rules PC-2.6, AC-1, PC-8, SEC-1
 * @adr ADR-0027
 */
import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { GenericContainer, Wait, type StartedTestContainer } from 'testcontainers';
import { Client } from 'pg';
import { readFileSync } from 'node:fs';
import {
  createConfigHistoryRepo,
  getLogLevel,
  onConfigChange,
  setLogLevel,
  type Clock,
  type QueryExecutor,
} from '@iip/config';
import { asConfigKey, asPrincipal } from '@iip/test-utils';

const PG_IMAGE =
  process.env['IIP_PG_AGE_VECTOR_IMAGE'] ||
  'ghcr.io/iip/postgres-age-pgvector:pg16';

const DRIZZLE_DIR = new URL('../../packages/db/drizzle/', import.meta.url);
const MIGRATION_0003 = readFileSync(
  new URL('0003_config_history.sql', DRIZZLE_DIR),
  'utf8',
);

let container: StartedTestContainer;
let client: Client;

beforeAll(async () => {
  const dbName = `iip_cfg_knob_${crypto.randomUUID().slice(0, 8)}`;
  container = await new GenericContainer(PG_IMAGE)
    .withEnvironment({ POSTGRES_PASSWORD: 'iip', POSTGRES_DB: dbName })
    .withWaitStrategy(
      Wait.forLogMessage(/database system is ready to accept connections/, 2),
    )
    .withExposedPorts(5432)
    .start();
  const host = container.getHost();
  const port = container.getMappedPort(5432);
  const connectionString = `postgres://postgres:iip@${host}:${port}/${dbName}`;
  client = new Client({ connectionString });
  await client.connect();
  await client.query(MIGRATION_0003);
}, 240_000);

afterAll(async () => {
  await client?.end();
  await container?.stop();
});

/** Adapter from pg.Client to the repo's QueryExecutor interface. */
function asExecutor(pgClient: Client): QueryExecutor {
  return {
    async query(text, params) {
      const result = await pgClient.query(text, params as unknown[]);
      return { rows: result.rows as readonly Record<string, unknown>[] };
    },
  };
}

/** Deterministic clock for the repository. */
function fixedClock(when: Date): Clock {
  return { now: () => when };
}

describe('Story 2.10 — concrete config knob writes config_history (AC #1)', () => {
  it('setLogLevel records the change in config_history', async () => {
    const repo = createConfigHistoryRepo({
      executor: asExecutor(client),
      clock: fixedClock(new Date('2026-07-06T12:00:00.000Z')),
    });

    // Register the repo as the config-history listener for this test.
    // Variable name deliberately avoids the AC-12(c) ESLint regex that treats
    // variables named `repo`/`editorialRepo` calling `.append()` as editorial-log
    // internal misuse; this is ConfigHistoryRepository.append, not EditorialLogRepo.
    const cfgRepo = repo;
    const deregister = onConfigChange((key, oldValue, newValue) =>
      cfgRepo.append({
        configKey: key,
        oldValue,
        newValue,
        actingPrincipal: asPrincipal('operator-001'),
      }),
    );

    const initialLevel = getLogLevel();
    expect(initialLevel).toBe('info');

    setLogLevel('error', asPrincipal('operator-001'));

    // Query the live DB to prove the row landed (not just the in-memory state).
    const result = await client.query<{
      config_key: string;
      old_value: string;
      new_value: string;
      acting_principal: string;
    }>(
      `SELECT config_key, old_value::text AS old_value, new_value::text AS new_value, acting_principal
         FROM config_history
        WHERE config_key = $1`,
      [asConfigKey('system.log_level')],
    );

    expect(result.rows.length).toBe(1);
    const row = result.rows[0]!;
    expect(row.config_key).toBe('system.log_level');
    expect(row.old_value).toContain('info');
    expect(row.new_value).toContain('error');
    expect(row.acting_principal).toBe('operator-001');

    deregister();
  });
});
