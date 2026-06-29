/**
 * Revocation backend fail-safe — backend outage must not allow revoked tokens (SEC-1).
 *
 * @rules SEC-1
 */
import { describe, it, expect } from 'vitest';
import { generateKeyPair, SignJWT } from 'jose';
import { createVerifyJwt, InMemoryReplayDetector, NoopAuthEventLogger } from './index.js';
import type { KeyRegistry } from './verify.js';

describe('revocation backend fail-safe', () => {
  it('fails closed when revocation checker throws', async () => {
    const pair = await generateKeyPair('Ed25519', { extractable: true });
    const verifyJwt = createVerifyJwt({
      keyRegistry: { get: () => ({ kid: 'k1', publicKey: pair.publicKey }) } as unknown as KeyRegistry,
      replayDetector: new InMemoryReplayDetector(),
      eventLogger: NoopAuthEventLogger,
      revocationChecker: { isRevoked: () => { throw new Error('redis down'); } },
    });
    const now = Math.floor(Date.now() / 1000);
    const token = await new SignJWT({ sub: 'op', iss: 'i', scope: ['read'] })
      .setProtectedHeader({ alg: 'EdDSA', kid: 'k1' })
      .setIssuedAt(now)
      .setExpirationTime(now + 60)
      .setJti('jti1')
      .sign(pair.privateKey);
    await expect(verifyJwt(token)).rejects.toThrow(/revocation backend unavailable/i);
  });
});
