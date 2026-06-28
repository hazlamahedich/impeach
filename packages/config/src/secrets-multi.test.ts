/**
 * Config secrets — multi-var failure reporting + no-leak (EXPANSION).
 *
 * Expands Story 1.11 coverage: determinism of fail-closed reporting when
 * multiple secrets are simultaneously invalid, unknown-var tolerance, and
 * multi-secret no-leak under bootOrDie.
 *
 * @rules D7, NFR-S-4, SEC-4
 * @adr ADR-019
 */

import { describe, it, expect, beforeEach, afterEach, vi, type MockInstance } from 'vitest';
import { validateConfig, bootOrDie } from './secrets.js';

const VALID_ENV: Record<string, string | undefined> = {
  ['DATABASE_URL']: 'postgres://postgres:pw@localhost:5433/iip',
  ['REDIS_URL']: 'redis://localhost:6380',
};

describe('Story 1.11 — multi-var failure reporting (NFR-S-4 determinism)', () => {
  it('[P1] short-circuits on the FIRST failure when both DATABASE_URL and REDIS_URL are missing', () => {
    // GIVEN both required vars are missing (DATABASE_URL is validated first)
    const env = { DATABASE_URL: undefined, REDIS_URL: undefined };

    // WHEN validateConfig runs (sequential, short-circuit on first error)
    const result = validateConfig(env);

    // THEN a single ConfigError is returned for DATABASE_URL (first-failure reporting)
    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.error.kind).toBe('MISSING');
      expect((result.error as { name: string }).name).toBe('DATABASE_URL');
    }
  });

  it('[P1] short-circuits on the first MALFORMED var before reading the second', () => {
    // GIVEN DATABASE_URL is malformed and REDIS_URL is also malformed
    const env = {
      DATABASE_URL: 'mysql://x@host/db',
      REDIS_URL: 'http://broken',
    };

    // WHEN validateConfig runs
    const result = validateConfig(env);

    // THEN it reports DATABASE_URL (checked first) and never reaches REDIS_URL
    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.error.kind).toBe('MALFORMED');
      expect((result.error as { name: string }).name).toBe('DATABASE_URL');
    }
  });

  it('[P1] ignores extra/unknown env vars (only DATABASE_URL + REDIS_URL are validated)', () => {
    // GIVEN valid required vars plus unrelated extra keys
    const env = {
      ...VALID_ENV,
      EXTRA_VAR: 'whatever',
      UNRELATED_SECRET: 'topsecret-value',
    };

    // WHEN validateConfig runs
    const result = validateConfig(env);

    // THEN validation succeeds (extras do not affect the closed required-set)
    expect(result.ok).toBe(true);
  });

  it('[P1] accepts a DATABASE_URL with embedded credentials', () => {
    // GIVEN a postgres DSN carrying user:password credentials
    const env = { ...VALID_ENV, DATABASE_URL: 'postgres://admin:s3cret-pw@db.host:5432/iip' };

    // WHEN validated
    const result = validateConfig(env);

    // THEN it is accepted (credentials do not break scheme validation)
    expect(result.ok).toBe(true);
  });
});

describe('Story 1.11 — multi-secret no-leak under bootOrDie (NFR-S-4)', () => {
  let exitSpy: MockInstance;
  let errSpy: MockInstance;

  beforeEach(() => {
    exitSpy = vi
      .spyOn(process, 'exit')
      .mockImplementation(((code?: string | number | null) => {
        throw new Error(`process.exit(${code ?? 0})`);
      }) as (code?: string | number | null) => never);
    errSpy = vi
      .spyOn(process.stderr, 'write')
      .mockImplementation((() => true) as never);
  });

  afterEach(() => {
    exitSpy.mockRestore();
    errSpy.mockRestore();
  });

  it('[P1] does not leak ANY secret value when multiple vars carry secrets and one is malformed', () => {
    // GIVEN two env vars each carrying a distinctive secret, one malformed
    const dbSecret = 'postgres://admin:db-topsecret@host:5432/iip';
    const redisSecret = 'rediss-not-a-valid-scheme://redis-topsecret@host:6380';
    const env = { DATABASE_URL: dbSecret, REDIS_URL: redisSecret };

    // WHEN bootOrDie runs and fails closed
    expect(() => bootOrDie(env)).toThrow();

    // THEN neither secret value appears in stderr — only the failing var NAME
    const logged = errSpy.mock.calls.map((c) => String(c[0])).join('');
    expect(logged).not.toContain('redis-topsecret');
    expect(logged).not.toContain('db-topsecret');
    expect(logged).toContain('REDIS_URL');
    expect(exitSpy).toHaveBeenCalledWith(1);
  });
});
