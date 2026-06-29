/**
 * alg=none attack prevention (SEC-1).
 *
 * @rules SEC-1
 */
import { describe, it, expect } from 'vitest';
import { createVerifyJwt, InMemoryReplayDetector, NoopAuthEventLogger } from './index.js';
import type { KeyRegistry } from './verify.js';

describe('alg=none', () => {
  it('rejects unsigned token', async () => {
    const verifyJwt = createVerifyJwt({
      keyRegistry: { get: () => undefined } as unknown as KeyRegistry,
      replayDetector: new InMemoryReplayDetector(),
      eventLogger: NoopAuthEventLogger,
      revocationChecker: { isRevoked: () => false },
    });
    const header = Buffer.from(JSON.stringify({ alg: 'none', kid: 'k1' })).toString('base64url');
    const payload = Buffer.from(JSON.stringify({ sub: 'op', iss: 'i', scope: ['read'], iat: 1, exp: 60, jti: 'j' })).toString('base64url');
    await expect(verifyJwt(`${header}.${payload}.`)).rejects.toThrow(/signature|EdDSA|alg/i);
  });
});
