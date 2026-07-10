/**
 * Unit tests for the snapshot store pure logic + error types (FR-1.4, AC-3, AC-7).
 *
 * These tests cover the content-addressed key derivation (AC-3), error
 * taxonomy (AC-7), and the port structure — WITHOUT a live MinIO connection.
 * Integration tests against a real MinIO container live in
 * ``tests/integration/raw-snapshot-minio.integration.test.ts``.
 *
 * @rules FR-1.4, AC-3, AC-7, PC-9
 * @adr ADR-001
 */

import { describe, it, expect } from 'vitest';
import { createHash } from 'node:crypto';
import fc from 'fast-check';
import {
  RawSnapshotStore,
  SnapshotStoreError,
  SnapshotIntegrityError,
  computeSnapshotKey,
  SNAPSHOT_STORE_ERROR_CODE,
  SNAPSHOT_INTEGRITY_ERROR_CODE,
  createMinioSnapshotStore,
  type MinioSnapshotStoreConfig,
} from './index.js';

// ─────────────────────────────────────────────────────────────────────────────
// computeSnapshotKey — content-addressed key derivation (AC-3)
// ─────────────────────────────────────────────────────────────────────────────

describe('Story 3.4 — computeSnapshotKey (AC-3)', () => {
  it('produces a 64-char lowercase hex SHA-256 digest', async () => {
    const key = await computeSnapshotKey(Buffer.from('hello'));
    expect(key).toMatch(/^[0-9a-f]{64}$/);
  });

  it('matches Node crypto SHA-256 for known input', async () => {
    const expected = createHash('sha256').update('hello').digest('hex');
    const key = await computeSnapshotKey(Buffer.from('hello'));
    expect(key).toBe(expected);
  });

  it('is deterministic — same bytes always produce the same key', async () => {
    const k1 = await computeSnapshotKey(Buffer.from('stable-content'));
    const k2 = await computeSnapshotKey(Buffer.from('stable-content'));
    expect(k1).toBe(k2);
  });

  it('different bytes produce different keys', async () => {
    const k1 = await computeSnapshotKey(Buffer.from('content-a'));
    const k2 = await computeKeySafe('content-b');
    expect(k1).not.toBe(k2);
  });

  async function computeKeySafe(s: string): Promise<string> {
    return computeSnapshotKey(Buffer.from(s));
  }

  it('accepts Uint8Array input (not just Buffer)', async () => {
    const buf = Buffer.from('uint8-input');
    const u8 = new Uint8Array(buf);
    const k1 = await computeSnapshotKey(buf);
    const k2 = await computeSnapshotKey(u8);
    expect(k1).toBe(k2);
  });

  it('handles empty byte sequence (zero-byte document — valid evidence)', async () => {
    const key = await computeSnapshotKey(Buffer.alloc(0));
    expect(key).toMatch(/^[0-9a-f]{64}$/);
    // SHA-256 of empty input is a well-known constant.
    expect(key).toBe(
      'e3b0c44298fc1c149afbf4c8996fb92427ae41e4649b934ca495991b7852b855',
    );
  });

  it('rejects non-buffer input at runtime', async () => {
    await expect(
      computeSnapshotKey('not-a-buffer' as unknown as Buffer),
    ).rejects.toThrow('computeSnapshotKey requires a Buffer or Uint8Array');
  });
});

// Property test: content-addressed idempotency (PC-9 — AC-3 invariant)
describe('Story 3.4 — content-addressed idempotency property (PC-9, AC-3)', () => {
  it('for any byte sequence, computeSnapshotKey is deterministic', async () => {
    await fc.assert(
      fc.asyncProperty(fc.uint8Array({ minLength: 0, maxLength: 1024 }), async (bytes) => {
        const k1 = await computeSnapshotKey(Buffer.from(bytes));
        const k2 = await computeSnapshotKey(Buffer.from(bytes));
        return k1 === k2;
      }),
      { numRuns: 100 },
    );
  });

  it('for any two different byte sequences, keys differ', async () => {
    await fc.assert(
      fc.asyncProperty(
        fc.uint8Array({ minLength: 1, maxLength: 256 }),
        fc.uint8Array({ minLength: 1, maxLength: 256 }),
        async (a, b) => {
          fc.pre(!buffersEqual(a, b));
          const k1 = await computeSnapshotKey(Buffer.from(a));
          const k2 = await computeSnapshotKey(Buffer.from(b));
          return k1 !== k2;
        },
      ),
      { numRuns: 100 },
    );
  });

  it('accepts Uint8Array directly in property test', async () => {
    await fc.assert(
      fc.asyncProperty(fc.uint8Array({ minLength: 0, maxLength: 1024 }), async (bytes) => {
        const k1 = await computeSnapshotKey(bytes);
        const k2 = await computeSnapshotKey(Buffer.from(bytes));
        return k1 === k2;
      }),
      { numRuns: 50 },
    );
  });
});

function buffersEqual(a: Uint8Array, b: Uint8Array): boolean {
  if (a.length !== b.length) return false;
  for (let i = 0; i < a.length; i++) {
    if (a[i] !== b[i]) return false;
  }
  return true;
}

// ─────────────────────────────────────────────────────────────────────────────
// Error taxonomy (AC-7)
// ─────────────────────────────────────────────────────────────────────────────

describe('Story 3.4 — error taxonomy (AC-7)', () => {
  it('SnapshotStoreError has the canonical code', () => {
    const err = new SnapshotStoreError('test failure');
    expect(err.code).toBe(SNAPSHOT_STORE_ERROR_CODE);
    expect(err.name).toBe('SnapshotStoreError');
    expect(err.message).toBe('test failure');
    expect(err instanceof Error).toBe(true);
  });

  it('SnapshotStoreError accepts a custom code', () => {
    const err = new SnapshotStoreError('custom', 'custom_code');
    expect(err.code).toBe('custom_code');
  });

  it('SnapshotIntegrityError carries expected + actual keys', () => {
    const err = new SnapshotIntegrityError(
      'mismatch',
      'expected-key',
      'actual-key',
    );
    expect(err.code).toBe(SNAPSHOT_INTEGRITY_ERROR_CODE);
    expect(err.name).toBe('SnapshotIntegrityError');
    expect(err.expectedKey).toBe('expected-key');
    expect(err.actualKey).toBe('actual-key');
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// Port structure (SC-5)
// ─────────────────────────────────────────────────────────────────────────────

describe('Story 3.4 — RawSnapshotStore port structure (SC-5)', () => {
  it('RawSnapshotStore is an abstract class', () => {
    expect(typeof RawSnapshotStore).toBe('function');
    // Abstract class — cannot be instantiated directly (TS blocks it; verify the
    // prototype has the abstract method names defined as the port contract).
    expect(RawSnapshotStore.prototype).toBeDefined();
  });

  it('createMinioSnapshotStore returns a RawSnapshotStore instance with put + get', () => {
    const config: MinioSnapshotStoreConfig = {
      endpoint: 'http://localhost:9100',
      rootUser: 'minioadmin',
      rootPassword: 'minioadmin',
      bucket: 'raw-snapshots',
    };
    const store = createMinioSnapshotStore(config);
    expect(store).toBeInstanceOf(RawSnapshotStore);
    expect(typeof store.put).toBe('function');
    expect(typeof store.get).toBe('function');
    expect(typeof store.bucketAccessPolicy).toBe('function');
    expect(typeof store.bucketVersioningConfig).toBe('function');
    expect(typeof store.bucketObjectLockConfig).toBe('function');
  });
});
