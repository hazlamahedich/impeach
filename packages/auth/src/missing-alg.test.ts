/**
 * Missing alg header rejection (SEC-1).
 *
 * @rules SEC-1
 */
import { describe, it, expect } from 'vitest';
import { createVerifyJwt, InMemoryReplayDetector, NoopAuthEventLogger } from './index.js';
import type { KeyRegistry } from './verify.js';

describe('missing alg', () => {
  it('rejects token with missing alg header', async () => {
    const verifyJwt = createVerifyJwt({
      keyRegistry: { get: () => undefined } as unknown as KeyRegistry,
      replayDetector: new InMemoryReplayDetector(),
      eventLogger: NoopAuthEventLogger,
      revocationChecker: { isRevoked: () => false },
    });
    const header = Buffer.from(JSON.stringify({ kid: 'k1' })).toString('base64url');
    const payload = Buffer.from(JSON.stringify({ sub: 'op', iss: 'i', scope: ['read'], iat: 1, exp: 60, jti: 'j' })).toString('base64url');
    await expect(verifyJwt(`${header}.${payload}.sig`)).rejects.toThrow(/signature|EdDSA|alg|missing/i);
  });
});
