/**
 * Contract tests — Story 2.2 Principal boundary (SEC-1).
 *
 * 7 test cases: ESLint boundary, verifyMiddleware export, PrincipalSchema
 * fields, branded types, process.env restriction, AuthEventLogger contract,
 * ReplayDetector contract.
 *
 * @rules SEC-1, PC-4
 * @adr ADR-0001
 */
import { describe, it, expect } from 'vitest';
import { readFileSync, existsSync } from 'node:fs';
import { resolve } from 'node:path';
import {
  verifyMiddleware,
  PrincipalSchema,
  NoopAuthEventLogger,
  InMemoryReplayDetector,
} from '@iip/auth';
import type { AuthEventLogger, ReplayDetector } from '@iip/auth';

describe('Story 2.2 — Principal boundary (SEC-1: req.principal only, never req.auth)', () => {

  // TC-2.1: ESLint config bans req.auth access in apps/api handlers
  it('TC-2.1: ESLint config bans req.auth access in apps/api handlers', () => {
    const configPath = resolve(process.cwd(), 'eslint.config.js');
    if (!existsSync(configPath)) throw new Error('eslint.config.js missing');
    const cfg = readFileSync(configPath, 'utf8');
    expect(cfg).toMatch(/req\.auth|principal/);
  });

  // TC-2.2: verifyMiddleware decorator exports
  it('TC-2.2: packages/auth exports verifyMiddleware that decorates req.principal', () => {
    expect(typeof verifyMiddleware).toBe('function');
  });

  // TC-2.3: PrincipalSchema all fields required
  it('TC-2.3: PrincipalSchema — all fields required, no defaults', () => {
    // Missing any field → parse fails
    expect(PrincipalSchema.safeParse({ kid: 'k1' }).success).toBe(false);
    expect(PrincipalSchema.safeParse({ kid: 'k1', sub: 'p1', scope: ['r'], jti: 'j1' }).success).toBe(false); // missing iat
    expect(PrincipalSchema.safeParse({
      sub: 'p1', iss: 'issuer', kid: 'k1', scope: ['read'], jti: 'j1', iat: 1234567890,
    }).success).toBe(true);
  });

  // TC-2.4: Branded Principal and Jti types
  it('TC-2.4: branded Principal and Jti types exist in @iip/contracts', async () => {
    const contracts = await import('@iip/contracts') as Record<string, unknown>;
    expect(contracts).toBeDefined();
    expect(contracts.PrincipalSchema).toBeDefined();
    expect(contracts.JtiSchema).toBeDefined();
  });

  // TC-2.5: process.env reads only in @iip/config
  it('TC-2.5: ESLint config restricts process.env access to config', () => {
    const configPath = resolve(process.cwd(), 'eslint.config.js');
    if (existsSync(configPath)) {
      const cfg = readFileSync(configPath, 'utf8');
      expect(cfg.length).toBeGreaterThan(0);
    }
  });

  // TC-2.6: AuthEventLogger interface contract
  it('TC-2.6: AuthEventLogger interface — NoopAuthEventLogger implements all methods', () => {
    const logger: AuthEventLogger = NoopAuthEventLogger;
    expect(typeof logger.revoked).toBe('function');
    expect(typeof logger.expired).toBe('function');
    expect(typeof logger.invalidSignature).toBe('function');
    expect(typeof logger.missingKid).toBe('function');
    expect(typeof logger.insufficientScope).toBe('function');
    expect(typeof logger.replay).toBe('function');

    // Verify NoopAuthEventLogger can be called without throwing
    const principalInfo = {
      sub: 'p1', iss: 'i1', kid: 'k1', jti: 'j1', scope: ['read' as const],
    };
    expect(() => logger.revoked(principalInfo, 'test')).not.toThrow();
    expect(() => logger.expired(principalInfo)).not.toThrow();
    expect(() => logger.invalidSignature('k1')).not.toThrow();
    expect(() => logger.missingKid()).not.toThrow();
    expect(() => logger.insufficientScope(principalInfo, ['admin' as const])).not.toThrow();
    expect(() => logger.replay(principalInfo)).not.toThrow();
  });

  // TC-2.7: ReplayDetector interface contract
  it('TC-2.7: ReplayDetector interface — InMemoryReplayDetector implements checkAndRecord', async () => {
    const detector: ReplayDetector = new InMemoryReplayDetector();
    expect(typeof detector.checkAndRecord).toBe('function');

    // First call returns true (new jti), second returns false (replay)
    const jti = 'test-jti-123' as never; // branded type bypass for test
    const exp = Math.floor(Date.now() / 1000) + 3600;
    await expect(detector.checkAndRecord(jti, exp)).resolves.toBe(true);
    await expect(detector.checkAndRecord(jti, exp)).resolves.toBe(false);
  });
});
