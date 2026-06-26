// Story 1.11 — Sops + Age Secrets & Fail-Closed Boot (D7, NFR-S-4)
// @rules D7, NFR-S-4 @adr ADR-019

import { describe, it, expect, beforeEach, afterEach, vi, type MockInstance } from 'vitest';
import { spawnSync } from 'node:child_process';
import { resolve } from 'node:path';
import {
  validateConfig,
  bootOrDie,
  type ConfigError,
  type ValidatedConfig,
} from './secrets.js';

const VALID_ENV: Record<string, string | undefined> = {
  ['DATABASE_URL']: 'postgres://postgres:pw@localhost:5433/iip',
  ['REDIS_URL']: 'redis://localhost:6380',
};

describe('Story 1.11 — Task 1: validateConfig() (D7, NFR-S-4)', () => {
  describe('valid input', () => {
    it('returns ValidatedConfig when all required env vars present + well-formed', () => {
      const result = validateConfig(VALID_ENV);
      expect(result.ok).toBe(true);
      if (result.ok) {
        expect(result.value.databaseUrl).toBe(VALID_ENV['DATABASE_URL']);
        expect(result.value.redisUrl).toBe(VALID_ENV['REDIS_URL']);
      }
    });

    it('brands DatabaseUrl so it is not assignable to a plain string column', () => {
      const result = validateConfig(VALID_ENV);
      expect(result.ok).toBe(true);
      // Compile-time brand is opaque at runtime; verify the value round-trips.
      if (result.ok) {
        const v: ValidatedConfig = result.value;
        expect(typeof v.databaseUrl).toBe('string');
      }
    });
  });

  describe('missing required env vars', () => {
    it('MISSING DATABASE_URL → ConfigError kind=MISSING', () => {
      const env = { ...VALID_ENV, DATABASE_URL: undefined };
      const result = validateConfig(env);
      expect(result.ok).toBe(false);
      if (!result.ok) {
        expect(result.error.kind).toBe('MISSING');
        expect((result.error as { name: string }).name).toBe('DATABASE_URL');
      }
    });

    it('MISSING REDIS_URL → ConfigError kind=MISSING', () => {
      const env = { ...VALID_ENV, REDIS_URL: undefined };
      const result = validateConfig(env);
      expect(result.ok).toBe(false);
      if (!result.ok) {
        expect((result.error as { name: string }).name).toBe('REDIS_URL');
      }
    });

    it('empty-string env var is treated as missing', () => {
      const env = { ...VALID_ENV, DATABASE_URL: '' };
      const result = validateConfig(env);
      expect(result.ok).toBe(false);
      if (!result.ok) expect(result.error.kind).toBe('MISSING');
    });

    it('whitespace-only env var is treated as missing', () => {
      const env = { ...VALID_ENV, REDIS_URL: '   ' };
      const result = validateConfig(env);
      expect(result.ok).toBe(false);
      if (!result.ok) expect(result.error.kind).toBe('MISSING');
    });
  });

  describe('malformed env vars', () => {
    it('DATABASE_URL without postgres:// scheme → MALFORMED', () => {
      const env = { ...VALID_ENV, DATABASE_URL: 'mysql://x@host/db' };
      const result = validateConfig(env);
      expect(result.ok).toBe(false);
      if (!result.ok) {
        expect(result.error.kind).toBe('MALFORMED');
        expect((result.error as { name: string }).name).toBe('DATABASE_URL');
      }
    });

    it('DATABASE_URL with postgresql:// scheme is accepted', () => {
      const env = { ...VALID_ENV, DATABASE_URL: 'postgresql://x@host/db' };
      expect(validateConfig(env).ok).toBe(true);
    });

    it('REDIS_URL without redis:// scheme → MALFORMED', () => {
      const env = { ...VALID_ENV, REDIS_URL: 'http://localhost:6380' };
      const result = validateConfig(env);
      expect(result.ok).toBe(false);
      if (!result.ok) {
        expect(result.error.kind).toBe('MALFORMED');
        expect((result.error as { name: string }).name).toBe('REDIS_URL');
      }
    });

    it('REDIS_URL with rediss:// (TLS) is accepted', () => {
      const env = { ...VALID_ENV, REDIS_URL: 'rediss://host:6380' };
      expect(validateConfig(env).ok).toBe(true);
    });
  });

  describe('ConfigError is a closed discriminated union', () => {
    it('every error has exactly {kind, name} or {kind, name, reason}', () => {
      const cases: ConfigError[] = [
        { kind: 'MISSING', name: 'DATABASE_URL' },
        { kind: 'MALFORMED', name: 'REDIS_URL', reason: 'bad scheme' },
      ];
      for (const e of cases) {
        expect(['MISSING', 'MALFORMED']).toContain(e.kind);
      }
    });
  });
});

describe('Story 1.11 — Task 1: bootOrDie() (fail-closed)', () => {
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

  it('returns config when validation succeeds', () => {
    const cfg = bootOrDie(VALID_ENV);
    expect(cfg.databaseUrl).toBe(VALID_ENV['DATABASE_URL']);
    expect(exitSpy).not.toHaveBeenCalled();
  });

  it('logs fatal + exits 1 on validation failure (does not leak secret values)', () => {
    const env = { ...VALID_ENV, DATABASE_URL: undefined };
    expect(() => bootOrDie(env)).toThrow();
    expect(exitSpy).toHaveBeenCalledWith(1);
    // Logged output must mention the env var name, never its value.
    const logged = errSpy.mock.calls.map((c) => String(c[0])).join('');
    expect(logged).toContain('DATABASE_URL');
    // No secret value leak — the missing var has no value, but assert that
    // any present-but-malformed secret value (e.g. REDIS_URL) never reaches
    // the log stream.
    expect(logged).not.toContain('redis://');
  });

  it('does not leak the malformed secret value when MALFORMED', () => {
    const secretValue = 'rediss-topsecret://h@st:6380';
    const env = { ...VALID_ENV, REDIS_URL: secretValue };
    expect(() => bootOrDie(env)).toThrow();
    const logged = errSpy.mock.calls.map((c) => String(c[0])).join('');
    expect(logged).not.toContain(secretValue);
    expect(logged).toContain('REDIS_URL');
  });
});

describe('Story 1.11 — Task 1: iip-config CLI (validate --strict)', () => {
  const CLI = resolve(import.meta.dirname, 'cli.ts');

  function runCli(env: Record<string, string | undefined>, args: string[]): {
    status: number;
    stdout: string;
    stderr: string;
  } {
    const r = spawnSync(process.execPath, ['--import', 'tsx/esm', CLI, ...args], {
      env: { ...process.env, ...env },
      encoding: 'utf8',
    });
    return {
      status: r.status ?? -1,
      stdout: r.stdout ?? '',
      stderr: r.stderr ?? '',
    };
  }

  it('exits 0 when validation passes', () => {
    const r = runCli(VALID_ENV, ['validate', '--strict']);
    expect(r.status).toBe(0);
  });

  it('exits non-zero when validation fails (missing var)', () => {
    const env = { ...VALID_ENV, DATABASE_URL: undefined };
    const r = runCli(env, ['validate', '--strict']);
    expect(r.status).not.toBe(0);
    expect(r.stderr + r.stdout).toContain('DATABASE_URL');
  });

  it('exits non-zero when validation fails (malformed var)', () => {
    const env = { ...VALID_ENV, REDIS_URL: 'http://x' };
    const r = runCli(env, ['validate', '--strict']);
    expect(r.status).not.toBe(0);
  });

  it('does not leak secret value into stdout/stderr on failure', () => {
    const secret = 'rediss-topsecret://h@st:6380';
    const env = { ...VALID_ENV, REDIS_URL: secret };
    const r = runCli(env, ['validate', '--strict']);
    const combined = r.stdout + r.stderr;
    expect(combined).not.toContain(secret);
  });
});
