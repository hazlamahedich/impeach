/**
 * Event-logger fail-safe — logging outages must not lock operators out (SEC-1, AC-11).
 *
 * @rules SEC-1, AC-11
 */
import { describe, it, expect } from 'vitest';
import { generateKeyPair, SignJWT } from 'jose';
import { createVerifyJwt, InMemoryReplayDetector } from './index.js';
import type { KeyRegistry } from './verify.js';
import type { AuthEventLogger } from './event-logger.js';

const throwingLogger: AuthEventLogger = {
  revoked: async () => { throw new Error('logger boom'); },
  expired: async () => { throw new Error('logger boom'); },
  invalidSignature: async () => { throw new Error('logger boom'); },
  missingKid: async () => { throw new Error('logger boom'); },
  insufficientScope: async () => { throw new Error('logger boom'); },
  replay: async () => { throw new Error('logger boom'); },
  expiredKey: async () => { throw new Error('logger boom'); },
};

async function makeToken(): Promise<{ token: string; pair: CryptoKeyPair }> {
  const pair = await generateKeyPair('Ed25519', { extractable: true });
  const now = Math.floor(Date.now() / 1000);
  const token = await new SignJWT({ sub: 'op', iss: 'i', scope: ['read'] })
    .setProtectedHeader({ alg: 'EdDSA', kid: 'k1' })
    .setIssuedAt(now)
    .setExpirationTime(now + 60)
    .setJti('jti1')
    .sign(pair.privateKey);
  return { token, pair };
}

describe('event logger fail-safe', () => {
  it('verification succeeds on first use even when logger throws', async () => {
    const { token, pair } = await makeToken();
    const verifyJwt = createVerifyJwt({
      keyRegistry: { get: () => ({ kid: 'k1', publicKey: pair.publicKey }) } as unknown as KeyRegistry,
      replayDetector: new InMemoryReplayDetector(),
      eventLogger: throwingLogger,
      revocationChecker: { isRevoked: () => false },
    });
    const principal = await verifyJwt(token);
    expect(principal.sub).toBe('op');
  });

  it('replay still rejected even when logger throws', async () => {
    const { token, pair } = await makeToken();
    const verifyJwt = createVerifyJwt({
      keyRegistry: { get: () => ({ kid: 'k1', publicKey: pair.publicKey }) } as unknown as KeyRegistry,
      replayDetector: new InMemoryReplayDetector(),
      eventLogger: throwingLogger,
      revocationChecker: { isRevoked: () => false },
    });
    await verifyJwt(token);
    await expect(verifyJwt(token)).rejects.toThrow(/replay/i);
  });
});
