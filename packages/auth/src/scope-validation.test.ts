/**
 * Scope validation — empty scope array must be rejected (SEC-1).
 *
 * @rules SEC-1
 */
import { describe, it, expect } from 'vitest';
import { generateKeyPair, SignJWT } from 'jose';
import { createVerifyJwt, InMemoryReplayDetector, NoopAuthEventLogger } from './index.js';
import type { KeyRegistry } from './verify.js';

describe('scope validation', () => {
  it('rejects empty scope array', async () => {
    const pair = await generateKeyPair('Ed25519', { extractable: true });
    const verifyJwt = createVerifyJwt({
      keyRegistry: { get: () => ({ kid: 'k1', publicKey: pair.publicKey }) } as unknown as KeyRegistry,
      replayDetector: new InMemoryReplayDetector(),
      eventLogger: NoopAuthEventLogger,
      revocationChecker: { isRevoked: () => false },
    });
    const now = Math.floor(Date.now() / 1000);
    const token = await new SignJWT({ sub: 'op', iss: 'i', scope: [] })
      .setProtectedHeader({ alg: 'EdDSA', kid: 'k1' })
      .setIssuedAt(now)
      .setExpirationTime(now + 60)
      .setJti('jti')
      .sign(pair.privateKey);
    await expect(verifyJwt(token)).rejects.toThrow(/malformed|invalid principal/i);
  });
});
