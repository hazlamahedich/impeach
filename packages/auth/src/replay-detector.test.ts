/**
 * InMemoryReplayDetector unit tests (SEC-1).
 *
 * @rules SEC-1
 */
import { describe, it, expect } from 'vitest';
import { InMemoryReplayDetector } from './index.js';

describe('InMemoryReplayDetector', () => {
  it('evicts expired entries', async () => {
    const now = { ms: 0 };
    const detector = new InMemoryReplayDetector(() => now.ms);
    const jti = 'jti' as never;
    expect(await detector.checkAndRecord(jti, 1)).toBe(true);
    now.ms = 1001;
    expect(await detector.checkAndRecord(jti, 1)).toBe(true);
  });

  it('keeps unexpired entries', async () => {
    const now = { ms: 0 };
    const detector = new InMemoryReplayDetector(() => now.ms);
    const jti = 'jti' as never;
    expect(await detector.checkAndRecord(jti, 2)).toBe(true);
    now.ms = 1999;
    expect(await detector.checkAndRecord(jti, 2)).toBe(false);
  });
});
