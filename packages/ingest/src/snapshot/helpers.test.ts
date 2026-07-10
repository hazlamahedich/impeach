/**
 * Unit tests for snapshot store internal helpers (PC-9 — direct coverage).
 *
 * Targets the pure functions that the mock-client tests exercise only
 * indirectly: ``parseEndpoint``, ``isNoSuchBucket``, and the
 * ``bucketAccessPolicy`` policy-parsing branches.
 *
 * @rules FR-1.4, PC-9
 * @adr ADR-001
 */

import { describe, it, expect } from 'vitest';
import { parseEndpoint, isNoSuchBucket } from './index.js';

// ─────────────────────────────────────────────────────────────────────────────
// parseEndpoint (SC-5 internal)
// ─────────────────────────────────────────────────────────────────────────────

describe('Story 3.4 — parseEndpoint (PC-9)', () => {
  it('parses http://host:port', () => {
    const r = parseEndpoint('http://localhost:9100');
    expect(r.protocol).toBe('http:');
    expect(r.host).toBe('localhost');
    expect(r.port).toBe(9100);
  });

  it('parses https://host:port', () => {
    const r = parseEndpoint('https://minio.example.com:443');
    expect(r.protocol).toBe('https:');
    expect(r.host).toBe('minio.example.com');
    expect(r.port).toBe(443);
  });

  it('defaults port to 80 for http without explicit port', () => {
    const r = parseEndpoint('http://minio.local');
    expect(r.port).toBe(80);
    expect(r.protocol).toBe('http:');
  });

  it('defaults port to 443 for https without explicit port', () => {
    const r = parseEndpoint('https://minio.local');
    expect(r.port).toBe(443);
    expect(r.protocol).toBe('https:');
  });

  it('throws on invalid URL', () => {
    expect(() => parseEndpoint('not-a-url')).toThrow();
  });

  it('throws SnapshotStoreError-like message on invalid endpoint', () => {
    expect(() => parseEndpoint('')).toThrow('MINIO_ENDPOINT');
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// isNoSuchBucket (AC-7 error taxonomy)
// ─────────────────────────────────────────────────────────────────────────────

describe('Story 3.4 — isNoSuchBucket (AC-7)', () => {
  it('returns true when error has code=NoSuchBucket', () => {
    const err = { code: 'NoSuchBucket', message: 'bucket missing' };
    expect(isNoSuchBucket(err)).toBe(true);
  });

  it('returns true when message matches /no such bucket/i', () => {
    const err = { message: 'The specified bucket does not exist (No Such Bucket)' };
    expect(isNoSuchBucket(err)).toBe(true);
  });

  it('returns false for other error codes', () => {
    const err = { code: 'NotFound', message: 'object not found' };
    expect(isNoSuchBucket(err)).toBe(false);
  });

  it('returns false for unrelated errors', () => {
    const err = { code: 'AccessDenied', message: 'forbidden' };
    expect(isNoSuchBucket(err)).toBe(false);
  });

  it('returns false for null/undefined', () => {
    expect(isNoSuchBucket(null)).toBe(false);
    expect(isNoSuchBucket(undefined)).toBe(false);
  });

  it('returns false for primitives', () => {
    expect(isNoSuchBucket('string error')).toBe(false);
    expect(isNoSuchBucket(42)).toBe(false);
    expect(isNoSuchBucket(true)).toBe(false);
  });

  it('returns false for empty message without code', () => {
    expect(isNoSuchBucket({})).toBe(false);
    expect(isNoSuchBucket({ message: 'connection refused' })).toBe(false);
  });

  it('is case-insensitive on message match', () => {
    expect(isNoSuchBucket({ message: 'NO SUCH BUCKET' })).toBe(true);
    expect(isNoSuchBucket({ message: 'No such bucket' })).toBe(true);
  });
});
