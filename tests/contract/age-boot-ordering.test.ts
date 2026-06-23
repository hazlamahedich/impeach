/**
 * AGE Boot Runner Ordering Invariant Test (B-14)
 *
 * @rules AC-2, AC-6, STR-12
 * @adr ADR-002 §Decision #5
 *
 * Verifies the invariant: Drizzle relational migrations MUST complete
 * before AGE boot migration runs. This is a UNIT test of the boot runner's
 * enforcement mechanisms — the full integration test requires Docker
 * (tests/integration/).
 */

import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = dirname(fileURLToPath(import.meta.url));

describe('AGE Boot Runner Ordering Invariant (B-14)', () => {
  const migrationPath = join(
    __dirname,
    '..',
    '..',
    'infra',
    'sql',
    'age',
    'migrations',
    '0001-iip-graph.sql',
  );
  const migrationSql = readFileSync(migrationPath, 'utf-8');

  it('AGE migration file exists and is readable', () => {
    expect(migrationSql).toBeTruthy();
    expect(migrationSql.length).toBeGreaterThan(100);
  });

  it('AGE migration does NOT register under /docker-entrypoint-initdb.d/', () => {
    // The header comment must explicitly state this — STR-12 / ADR-002.
    expect(migrationSql).toContain('DO NOT run this file via /docker-entrypoint-initdb.d/');
  });

  it('AGE migration header states it runs AFTER Drizzle', () => {
    expect(migrationSql).toContain('AFTER relational Drizzle migrations');
  });

  it('AGE migration creates extension with explicit version', () => {
    expect(migrationSql).toContain("CREATE EXTENSION IF NOT EXISTS age WITH VERSION '1.6.0'");
  });

  it('AGE migration loads age hooks explicitly', () => {
    expect(migrationSql).toContain("LOAD 'age';");
  });

  it('AGE migration sets search_path for AGE catalog', () => {
    expect(migrationSql).toContain('SET search_path = ag_catalog');
  });

  it('AGE migration creates iip_graph named graph', () => {
    expect(migrationSql).toContain("create_graph('iip_graph')");
  });

  it('AGE migration has explicit COMMIT boundary for cross-session visibility', () => {
    expect(migrationSql).toContain('COMMIT');
  });

  it('boot runner script exists', () => {
    const runnerPath = join(__dirname, '..', '..', 'scripts', 'age-migrate.ts');
    const runner = readFileSync(runnerPath, 'utf-8');
    expect(runner).toBeTruthy();
  });

  it('boot runner has idempotency guard', () => {
    const runnerPath = join(__dirname, '..', '..', 'scripts', 'age-migrate.ts');
    const runner = readFileSync(runnerPath, 'utf-8');
    expect(runner).toContain("ag_graph WHERE name = 'iip_graph'");
    expect(runner).toContain('iip_graph already exists');
  });

  it('boot runner has precondition check for relational tables (B-14 soft invariant)', () => {
    const runnerPath = join(__dirname, '..', '..', 'scripts', 'age-migrate.ts');
    const runner = readFileSync(runnerPath, 'utf-8');
    expect(runner).toContain('information_schema.tables');
    expect(runner).toContain('B-14');
  });

  it('boot runner exits non-zero on DATABASE_URL missing', () => {
    const runnerPath = join(__dirname, '..', '..', 'scripts', 'age-migrate.ts');
    const runner = readFileSync(runnerPath, 'utf-8');
    expect(runner).toContain('DATABASE_URL is not set');
    expect(runner).toContain('process.exit(1)');
  });
});
