#!/usr/bin/env tsx
/**
 * AGE Boot Runner — applies the AGE graph boot migration AFTER relational
 * Drizzle migrations have completed.
 *
 * @rules AC-2, AC-6, STR-12
 * @adr ADR-002 §Decision #5
 *
 * INVARIANT (B-14): Drizzle relational migrations MUST complete and commit
 * before this runner executes. The ordering is enforced by:
 *   1. Compose dependency: this service starts after postgres is healthy
 *   2. Process exit code: if Drizzle migrations fail, the compose entrypoint
 *      chain aborts before this runner is invoked
 *   3. This runner's own precondition check (logs a warning if no relational
 *      tables exist — they should have been created by Drizzle first)
 *
 * IDEMPOTENT: guards with `SELECT * FROM ag_graph WHERE name = 'iip_graph'`
 * before running `create_graph()`.
 *
 * SUPERUSER-ONLY: CREATE EXTENSION age + create_graph() require superuser.
 */

import { readFileSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = dirname(fileURLToPath(import.meta.url));

const DATABASE_URL = process.env['DATABASE_URL'];
if (!DATABASE_URL) {
  process.stderr.write('AGE boot runner: DATABASE_URL is not set. Refusing to start.\n');
  process.exit(1);
}

const MAX_RETRIES = 30;
const RETRY_DELAY_MS = 2000;

async function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

async function waitForPostgres(url: string): Promise<void> {
  const { Pool } = await import('pg');
  const probe = new Pool({ connectionString: url, connectionTimeoutMillis: 3000 });

  for (let attempt = 1; attempt <= MAX_RETRIES; attempt++) {
    try {
      const client = await probe.connect();
      await client.query('SELECT 1');
      client.release();
      await probe.end();
      process.stdout.write(`AGE boot runner: postgres is ready (attempt ${attempt}).\n`);
      return;
    } catch {
      process.stdout.write(
        `AGE boot runner: waiting for postgres (attempt ${attempt}/${MAX_RETRIES})...\n`,
      );
      await sleep(RETRY_DELAY_MS);
    }
  }

  await probe.end();
  process.stderr.write(
    `AGE boot runner: postgres did not become ready after ${MAX_RETRIES} attempts.\n`,
  );
  process.exit(1);
}

async function checkPrecondition(url: string): Promise<void> {
  const { Pool } = await import('pg');
  const pool = new Pool({ connectionString: url });

  try {
    // B-14 invariant: warn if no relational tables exist (Drizzle should have
    // created them first). This is a SOFT check — we warn, not block, because
    // in a fresh database the first run may have no migrations yet.
    const result = await pool.query(
      `SELECT count(*) FROM information_schema.tables
       WHERE table_schema = 'public' AND table_type = 'BASE TABLE'`,
    );
    const tableCount = parseInt(result.rows[0]?.count ?? '0', 10);

    if (tableCount === 0) {
      process.stdout.write(
        'AGE boot runner: WARNING — no relational tables found in public schema. ' +
          'Drizzle migrations may not have run yet. Proceeding anyway (B-14 soft check).\n',
      );
    } else {
      process.stdout.write(
        `AGE boot runner: ${tableCount} relational table(s) found — Drizzle migrations appear to have run.\n`,
      );
    }
  } finally {
    await pool.end();
  }
}

async function graphExists(url: string): Promise<boolean> {
  const { Pool } = await import('pg');
  const pool = new Pool({
    connectionString: url,
  });

  try {
    // AGE's ag_graph table lives in ag_catalog. We need to SET search_path first.
    const client = await pool.connect();
    try {
      await client.query(`SET search_path = ag_catalog, "$user", public`);
      const result = await client.query(
        `SELECT * FROM ag_graph WHERE name = 'iip_graph'`,
      );
      return result.rows.length > 0;
    } finally {
      client.release();
    }
  } catch {
    // If ag_graph doesn't exist yet (extension not loaded), the graph definitely doesn't exist.
    return false;
  } finally {
    await pool.end();
  }
}

async function applyAgeMigration(url: string): Promise<void> {
  const migrationPath = join(__dirname, '..', 'infra', 'sql', 'age', 'migrations', '0001-iip-graph.sql');
  const migrationSql = readFileSync(migrationPath, 'utf-8');

  const { Pool } = await import('pg');
  const pool = new Pool({ connectionString: url });

  try {
    const client = await pool.connect();
    try {
      process.stdout.write('AGE boot runner: applying AGE boot migration...\n');

      // Execute migration SQL statement-by-statement. The migration file
      // contains semicolons that pg can execute individually. We split on
      // semicolons but handle the LOAD/SET/SELECT statements properly.
      //
      // Note: We run in autocommit mode (no explicit BEGIN) because
      // create_graph() needs to be committed to be visible to other sessions.
      // The migration file ends with an explicit COMMIT for this reason.
      await client.query(migrationSql);

      process.stdout.write('AGE boot runner: AGE boot migration applied successfully.\n');
    } finally {
      client.release();
    }
  } finally {
    await pool.end();
  }
}

async function main(): Promise<void> {
  process.stdout.write('AGE boot runner: starting.\n');

  // Step 1: Wait for postgres to be ready.
  await waitForPostgres(DATABASE_URL);

  // Step 2: Soft precondition check (B-14 invariant — Drizzle should have run first).
  await checkPrecondition(DATABASE_URL);

  // Step 3: Idempotency guard — skip if graph already exists.
  const exists = await graphExists(DATABASE_URL);
  if (exists) {
    process.stdout.write('AGE boot runner: iip_graph already exists — skipping (idempotent).\n');
    process.exit(0);
  }

  // Step 4: Apply the AGE boot migration.
  try {
    await applyAgeMigration(DATABASE_URL);
    process.stdout.write('AGE boot runner: complete.\n');
    process.exit(0);
  } catch (err) {
    process.stderr.write(
      `AGE boot runner: FAILED — ${err instanceof Error ? err.message : String(err)}\n`,
    );
    process.exit(1);
  }
}

main();
