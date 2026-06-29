/**
 * Algorithm confusion attack prevention (SEC-1).
 *
 * @rules SEC-1
 */
import { describe, it, expect } from 'vitest';
import { generateKeyPair } from 'jose';
import { createVerifyJwt, InMemoryReplayDetector, NoopAuthEventLogger } from './index.js';
import type { KeyRegistry } from './verify.js';

describe('algorithm confusion', () => {
  it('rejects HS256 token', async () => {
    const pair = await generateKeyPair('Ed25519', { extractable: true });
    const verifyJwt = createVerifyJwt({
      keyRegistry: { get: () => ({ kid: 'k1', publicKey: pair.publicKey }) } as unknown as KeyRegistry,
      replayDetector: new InMemoryReplayDetector(),
      eventLogger: NoopAuthEventLogger,
      revocationChecker: { isRevoked: () => false },
    });
    const now = Math.floor(Date.now() / 1000);
    const header = Buffer.from(JSON.stringify({ alg: 'HS256', kid: 'k1' })).toString('base64url');
    const payload = Buffer.from(JSON.stringify({ sub: 'op', iss: 'i', scope: ['read'], iat: now, exp: now + 60, jti: 'jti' })).toString('base64url');
    await expect(verifyJwt(`${header}.${payload}.fake`)).rejects.toThrow(/signature|EdDSA|alg/i);
  });
});
