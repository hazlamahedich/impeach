/**
 * Clock-skew configuration validation (SEC-1).
 *
 * @rules SEC-1
 */
import { describe, it, expect } from 'vitest';
import { createVerifyJwt, InMemoryReplayDetector, NoopAuthEventLogger } from './index.js';
import type { KeyRegistry } from './verify.js';

function makeConfig(clockSkewSeconds: number) {
  return createVerifyJwt({
    keyRegistry: { get: () => undefined } as unknown as KeyRegistry,
    replayDetector: new InMemoryReplayDetector(),
    eventLogger: NoopAuthEventLogger,
    revocationChecker: { isRevoked: () => false },
    clockSkewSeconds,
  });
}

describe('clock skew validation', () => {
  it('rejects negative clock skew', () => {
    expect(() => makeConfig(-1)).toThrow(/clockSkewSeconds/);
  });

  it('rejects NaN clock skew', () => {
    expect(() => makeConfig(NaN)).toThrow(/clockSkewSeconds/);
  });

  it('rejects excessive clock skew', () => {
    expect(() => makeConfig(301)).toThrow(/clockSkewSeconds/);
  });

  it('accepts zero clock skew', () => {
    expect(() => makeConfig(0)).not.toThrow();
  });

  it('accepts maximum allowed clock skew', () => {
    expect(() => makeConfig(300)).not.toThrow();
  });
});
