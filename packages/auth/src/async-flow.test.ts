/**
 * End-to-end async flow — verifyJwt + async ReplayDetector (SEC-1).
 *
 * @rules SEC-1
 */
import { describe, it, expect } from 'vitest';
import { generateKeyPair, SignJWT } from 'jose';
import { createVerifyJwt, InMemoryReplayDetector, NoopAuthEventLogger } from './index.js';
import type { KeyRegistry } from './verify.js';

describe('full flow with async detector', () => {
  it('valid token resolves and replay is rejected', async () => {
    const pair = await generateKeyPair('Ed25519', { extractable: true });
    const verifyJwt = createVerifyJwt({
      keyRegistry: { get: (kid: string) => ({ kid, publicKey: pair.publicKey }) } as unknown as KeyRegistry,
      replayDetector: new InMemoryReplayDetector(),
      eventLogger: NoopAuthEventLogger,
      revocationChecker: { isRevoked: () => false },
    });
    const now = Math.floor(Date.now() / 1000);
    const token = await new SignJWT({ sub: 'op', iss: 'i', scope: ['read'] })
      .setProtectedHeader({ alg: 'EdDSA', kid: 'k1' })
      .setIssuedAt(now)
      .setExpirationTime(now + 60)
      .setJti('jti1')
      .sign(pair.privateKey);
    const principal = await verifyJwt(token);
    expect(principal.sub).toBe('op');
    await expect(verifyJwt(token)).rejects.toThrow(/replay/i);
  });
});
