/**
 * Expired-token logging — verify the logger receives full principal info (SEC-1, AC-11).
 *
 * @rules SEC-1, AC-11
 */
import { describe, it, expect } from 'vitest';
import { generateKeyPair, SignJWT } from 'jose';
import { createVerifyJwt, InMemoryReplayDetector } from './index.js';
import type { KeyRegistry } from './verify.js';
import type { AuthEventLogger } from './event-logger.js';

interface LogCall {
  method: string;
  args: unknown[];
}

function makeRecordingLogger(): AuthEventLogger & { calls: LogCall[] } {
  const calls: LogCall[] = [];
  return {
    calls,
    revoked(...args: unknown[]) { calls.push({ method: 'revoked', args }); },
    expired(...args: unknown[]) { calls.push({ method: 'expired', args }); },
    invalidSignature(...args: unknown[]) { calls.push({ method: 'invalidSignature', args }); },
    missingKid(...args: unknown[]) { calls.push({ method: 'missingKid', args }); },
    insufficientScope(...args: unknown[]) { calls.push({ method: 'insufficientScope', args }); },
    replay(...args: unknown[]) { calls.push({ method: 'replay', args }); },
  };
}

describe('expired token logging', () => {
  it('logs expired event with principal info from decoded payload', async () => {
    const pair = await generateKeyPair('Ed25519', { extractable: true });
    const logger = makeRecordingLogger();
    const verifyJwt = createVerifyJwt({
      keyRegistry: { get: () => ({ kid: 'k1', publicKey: pair.publicKey }) } as unknown as KeyRegistry,
      replayDetector: new InMemoryReplayDetector(),
      eventLogger: logger,
      revocationChecker: { isRevoked: () => false },
    });
    const now = Math.floor(Date.now() / 1000);
    const token = await new SignJWT({ sub: 'exp-op', iss: 'exp-i', scope: ['read'] })
      .setProtectedHeader({ alg: 'EdDSA', kid: 'k1' })
      .setIssuedAt(now - 120)
      .setExpirationTime(now - 60)
      .setJti('expired-jti')
      .sign(pair.privateKey);
    await expect(verifyJwt(token)).rejects.toThrow(/expired/i);
    const expiredCall = logger.calls.find((c: LogCall) => c.method === 'expired');
    expect(expiredCall).toBeDefined();
    const info = expiredCall!.args[0] as { sub: string; iss: string; kid: string; jti: string; scope: string[] };
    expect(info.sub).toBe('exp-op');
    expect(info.iss).toBe('exp-i');
    expect(info.kid).toBe('k1');
    expect(info.jti).toBe('expired-jti');
    expect(info.scope).toEqual(['read']);
  });
});
