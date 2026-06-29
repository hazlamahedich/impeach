/**
 * Signature mismatch rejection (SEC-1).
 *
 * @rules SEC-1
 */
import { describe, it, expect } from 'vitest';
import { generateKeyPair, SignJWT } from 'jose';
import { createVerifyJwt, InMemoryReplayDetector, NoopAuthEventLogger } from './index.js';
import type { KeyRegistry } from './verify.js';

describe('signature mismatch', () => {
  it('rejects token signed with wrong key', async () => {
    const pair1 = await generateKeyPair('Ed25519', { extractable: true });
    const pair2 = await generateKeyPair('Ed25519', { extractable: true });
    const verifyJwt = createVerifyJwt({
      keyRegistry: { get: () => ({ kid: 'k1', publicKey: pair1.publicKey }) } as unknown as KeyRegistry,
      replayDetector: new InMemoryReplayDetector(),
      eventLogger: NoopAuthEventLogger,
      revocationChecker: { isRevoked: () => false },
    });
    const now = Math.floor(Date.now() / 1000);
    const token = await new SignJWT({ sub: 'op', iss: 'i', scope: ['read'] })
      .setProtectedHeader({ alg: 'EdDSA', kid: 'k1' })
      .setIssuedAt(now)
      .setExpirationTime(now + 60)
      .setJti('jti')
      .sign(pair2.privateKey);
    await expect(verifyJwt(token)).rejects.toThrow(/signature/i);
  });
});
