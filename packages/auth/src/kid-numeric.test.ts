/**
 * Numeric `kid` header rejection — non-string `kid` must never reach the registry (SEC-1).
 *
 * @rules SEC-1
 */
import { describe, it, expect } from 'vitest';
import { createVerifyJwt, InMemoryReplayDetector, NoopAuthEventLogger } from './index.js';
import type { KeyRegistry } from './verify.js';

describe('non-string kid header', () => {
  it('numeric kid rejected before registry lookup', async () => {
    const verifyJwt = createVerifyJwt({
      keyRegistry: {
        get: (kid: string) => {
          if (kid === '123') throw new Error('registry should not be called');
          return undefined;
        },
      } as unknown as KeyRegistry,
      replayDetector: new InMemoryReplayDetector(),
      eventLogger: NoopAuthEventLogger,
      revocationChecker: { isRevoked: () => false },
    });
    const header = Buffer.from(JSON.stringify({ alg: 'EdDSA', kid: 123 })).toString('base64url');
    const payload = Buffer.from(JSON.stringify({ sub: 'op', iss: 'i', scope: ['read'], iat: 1, exp: 60, jti: 'j' })).toString('base64url');
    await expect(verifyJwt(`${header}.${payload}.sig`)).rejects.toThrow(/kid/i);
  });
});
