/**
 * Package entry smoke test — @iip/auth barrel exports (SEC-1).
 *
 * Guards against broken re-exports or missing symbols after refactors.
 *
 * @rules SEC-1
 */
import { describe, it, expect } from 'vitest';
import {
  createVerifyJwt,
  requireScope,
  PrincipalSchema,
  AuthError,
  signJwt,
  InMemoryReplayDetector,
  NoopAuthEventLogger,
  createVerifyMiddleware,
  verifyMiddleware,
} from '@iip/auth';
import type {
  ReplayDetector,
  AuthEventLogger,
} from '@iip/auth';

describe('@iip/auth barrel exports', () => {
  it('exports all runtime values', () => {
    expect(typeof createVerifyJwt).toBe('function');
    expect(typeof requireScope).toBe('function');
    expect(typeof PrincipalSchema).toBe('object');
    expect(typeof AuthError).toBe('function');
    expect(typeof signJwt).toBe('function');
    expect(typeof InMemoryReplayDetector).toBe('function');
    expect(typeof NoopAuthEventLogger).toBe('object');
    expect(typeof createVerifyMiddleware).toBe('function');
    expect(typeof verifyMiddleware).toBe('function');
  });

  it('verifyMiddleware is an alias for createVerifyMiddleware', () => {
    expect(verifyMiddleware).toBe(createVerifyMiddleware);
  });

  it('NoopAuthEventLogger implements all methods', () => {
    const logger: AuthEventLogger = NoopAuthEventLogger;
    const info = { sub: 's', iss: 'i', kid: 'k', jti: 'j', scope: ['read' as const] };
    expect(() => logger.revoked(info, 'reason')).not.toThrow();
    expect(() => logger.expired(info)).not.toThrow();
    expect(() => logger.invalidSignature('k')).not.toThrow();
    expect(() => logger.missingKid()).not.toThrow();
    expect(() => logger.insufficientScope(info, ['admin' as const])).not.toThrow();
    expect(() => logger.replay(info)).not.toThrow();
  });

  it('InMemoryReplayDetector is awaitable', async () => {
    const detector: ReplayDetector = new InMemoryReplayDetector();
    const jti = 'barrel-jti' as never;
    const exp = Math.floor(Date.now() / 1000) + 3600;
    await expect(detector.checkAndRecord(jti, exp)).resolves.toBe(true);
    await expect(detector.checkAndRecord(jti, exp)).resolves.toBe(false);
  });
});
