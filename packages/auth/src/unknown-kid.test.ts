/**
 * Unknown `kid` rejection and logging (SEC-1).
 *
 * @rules SEC-1
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
    async revoked(...args: unknown[]) { calls.push({ method: 'revoked', args }); },
    async expired(...args: unknown[]) { calls.push({ method: 'expired', args }); },
    async invalidSignature(...args: unknown[]) { calls.push({ method: 'invalidSignature', args }); },
    async missingKid(...args: unknown[]) { calls.push({ method: 'missingKid', args }); },
    async insufficientScope(...args: unknown[]) { calls.push({ method: 'insufficientScope', args }); },
    async replay(...args: unknown[]) { calls.push({ method: 'replay', args }); },
    async expiredKey(...args: unknown[]) { calls.push({ method: 'expiredKey', args }); },
  };
}

describe('unknown kid', () => {
  it('rejects tokens with unknown kid and logs invalidSignature', async () => {
    const pair = await generateKeyPair('Ed25519', { extractable: true });
    const logger = makeRecordingLogger();
    const verifyJwt = createVerifyJwt({
      keyRegistry: { get: () => undefined } as unknown as KeyRegistry,
      replayDetector: new InMemoryReplayDetector(),
      eventLogger: logger,
      revocationChecker: { isRevoked: () => false },
    });
    const now = Math.floor(Date.now() / 1000);
    const token = await new SignJWT({ sub: 'op', iss: 'i', scope: ['read'] })
      .setProtectedHeader({ alg: 'EdDSA', kid: 'missing-kid' })
      .setIssuedAt(now)
      .setExpirationTime(now + 60)
      .setJti('jti')
      .sign(pair.privateKey);
    await expect(verifyJwt(token)).rejects.toThrow(/unknown key identifier|missing-kid/i);
    expect(logger.calls.some((c: LogCall) => c.method === 'invalidSignature')).toBe(true);
  });
});
