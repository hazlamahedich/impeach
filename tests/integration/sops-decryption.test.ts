/**
 * SOPS Decryption Integration Test (TD2 — Epic 2 Prep Sprint)
 *
 * @rules D7, NFR-S-4, SEC-4
 * @adr ADR-019
 *
 * This test exercises the real sops+age decryption path: it reads an
 * encrypted secrets file from secrets/, decrypts it via the sops CLI,
 * and feeds the decrypted values to validateConfig().
 *
 * REQUIRES: `sops` and `age` installed + age private key at
 * ~/.config/sops/age/keys.txt. If tools are absent, the test skips with
 * a clear message (integration test, not unit test — tool availability
 * is the activation contract).
 *
 * @activates-in: sops+age installed and secrets/dev.sops.yaml encrypted
 */

import { describe, it, expect } from 'vitest';
import { spawnSync } from 'node:child_process';
import { existsSync, readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { validateConfig, bootOrDie } from '../../packages/config/src/secrets.js';

const SECRETS_FILE = resolve(import.meta.dirname, '../../secrets/dev.sops.yaml');
const SOPS_BINARY = spawnSync('which', ['sops'], { encoding: 'utf8' });
const AGE_BINARY = spawnSync('which', ['age'], { encoding: 'utf8' });
const AGE_KEY = existsSync(
  resolve(process.env['HOME'] ?? '', '.config/sops/age/keys.txt'),
);

const TOOLS_AVAILABLE =
  SOPS_BINARY.status === 0 && AGE_BINARY.status === 0 && AGE_KEY;

describe.skipIf(!TOOLS_AVAILABLE)(
  'SOPS Decryption Integration (TD2 — requires sops+age+key)',
  () => {
    it('secrets/dev.sops.yaml exists and is encrypted', () => {
      expect(existsSync(SECRETS_FILE)).toBe(true);
      const raw = readFileSync(SECRETS_FILE, 'utf8');
      // SOPS encrypted files contain the "sops" metadata block
      expect(raw).toContain('sops:');
      expect(raw).toContain('age');
    });

    it('decrypts successfully and produces valid DATABASE_URL + REDIS_URL', () => {
      const r = spawnSync(
        'sops',
        ['--decrypt', SECRETS_FILE],
        { encoding: 'utf8' },
      );
      expect(r.status).toBe(0);

      // Parse decrypted YAML into env-var shape
      const decrypted = r.stdout;
      const env: Record<string, string | undefined> = {};

      // Simple YAML key:value extraction (avoid yaml dep for integration test)
      for (const line of decrypted.split('\n')) {
        const match = line.match(/^\s*(DATABASE_URL|REDIS_URL|MINIO_ROOT_USER|MINIO_ROOT_PASSWORD|JWT_SECRET):\s*"?(.+?)"?\s*$/);
        if (match && match[1] && match[2]) {
          env[match[1]] = match[2];
        }
      }

      // validateConfig must accept the decrypted values
      const result = validateConfig(env);
      expect(result.ok).toBe(true);
      if (result.ok) {
        expect(result.value.databaseUrl).toMatch(/^postgres/);
        expect(result.value.redisUrl).toMatch(/^redis/);
      }
    });

    it('bootOrDie succeeds with decrypted values (fail-closed boot path)', () => {
      const r = spawnSync(
        'sops',
        ['--decrypt', SECRETS_FILE],
        { encoding: 'utf8' },
      );
      expect(r.status).toBe(0);

      const env: Record<string, string | undefined> = {};
      for (const line of r.stdout.split('\n')) {
        const match = line.match(/^\s*(DATABASE_URL|REDIS_URL):\s*"?(.+?)"?\s*$/);
        if (match && match[1] && match[2]) {
          env[match[1]] = match[2];
        }
      }

      // Should not throw / exit
      const cfg = bootOrDie(env);
      expect(cfg.databaseUrl).toMatch(/^postgres/);
    });
  },
);

describe.skipIf(TOOLS_AVAILABLE)(
  'SOPS Decryption Integration — SKIPPED (tools not installed)',
  () => {
    it('should install sops+age and encrypt secrets/dev.sops.yaml to activate', () => {
      // This test exists so the skip is visible in CI output with context.
      const missing: string[] = [];
      if (SOPS_BINARY.status !== 0) missing.push('sops');
      if (AGE_BINARY.status !== 0) missing.push('age');
      if (!AGE_KEY) missing.push('~/.config/sops/age/keys.txt');

      expect(missing).toEqual([]);
    });
  },
);
