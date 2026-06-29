/**
 * Malformed JWT rejection (SEC-1).
 *
 * @rules SEC-1
 */
import { describe, it, expect } from 'vitest';
import { createVerifyJwt, InMemoryReplayDetector, NoopAuthEventLogger } from './index.js';
import type { KeyRegistry } from './verify.js';

describe('malformed JWT', () => {
  it('rejects garbage token', async () => {
    const verifyJwt = createVerifyJwt({
      keyRegistry: { get: () => undefined } as unknown as KeyRegistry,
      replayDetector: new InMemoryReplayDetector(),
      eventLogger: NoopAuthEventLogger,
      revocationChecker: { isRevoked: () => false },
    });
    await expect(verifyJwt('not-a-jwt')).rejects.toThrow(/malformed/i);
  });
});
