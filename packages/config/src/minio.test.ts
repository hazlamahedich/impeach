// Story 3.4 — MinIO non-secret config (FR-1.4, PC-2.6)
// @rules FR-1.4, PC-2.6, NFR-S-5 @adr ADR-001

import { describe, it, expect } from 'vitest';
import {
  getMinioConfig,
  DEFAULT_RAW_SNAPSHOTS_BUCKET,
  type MinioConfig,
} from './minio.js';

describe('Story 3.4 — Task 1: getMinioConfig() (FR-1.4, PC-2.6)', () => {
  const VALID_ENV: Record<string, string | undefined> = {
    ['MINIO_ENDPOINT']: 'http://localhost:9100',
    ['MINIO_ROOT_USER']: 'minioadmin',
    ['RAW_SNAPSHOTS_BUCKET']: 'raw-snapshots',
  };

  it('returns MinioConfig when all required env vars present', () => {
    const cfg = getMinioConfig(VALID_ENV);
    expect(cfg.endpoint).toBe('http://localhost:9100');
    expect(cfg.rootUser).toBe('minioadmin');
    expect(cfg.bucket).toBe('raw-snapshots');
  });

  it('defaults bucket to raw-snapshots when RAW_SNAPSHOTS_BUCKET absent', () => {
    const cfg = getMinioConfig({
      MINIO_ENDPOINT: 'http://minio:9000',
      MINIO_ROOT_USER: 'minioadmin',
    });
    expect(cfg.bucket).toBe(DEFAULT_RAW_SNAPSHOTS_BUCKET);
  });

  it('defaults bucket when RAW_SNAPSHOTS_BUCKET is empty/whitespace', () => {
    const cfg = getMinioConfig({
      MINIO_ENDPOINT: 'http://minio:9000',
      MINIO_ROOT_USER: 'minioadmin',
      RAW_SNAPSHOTS_BUCKET: '   ',
    });
    expect(cfg.bucket).toBe(DEFAULT_RAW_SNAPSHOTS_BUCKET);
  });

  it('throws when MINIO_ENDPOINT is missing', () => {
    expect(() =>
      getMinioConfig({ MINIO_ROOT_USER: 'minioadmin' }),
    ).toThrow('MINIO_ENDPOINT');
  });

  it('throws when MINIO_ENDPOINT is empty/whitespace', () => {
    expect(() =>
      getMinioConfig({ MINIO_ENDPOINT: '  ', MINIO_ROOT_USER: 'minioadmin' }),
    ).toThrow('MINIO_ENDPOINT');
  });

  it('throws when MINIO_ROOT_USER is missing', () => {
    expect(() =>
      getMinioConfig({ MINIO_ENDPOINT: 'http://minio:9000' }),
    ).toThrow('MINIO_ROOT_USER');
  });

  it('throws when MINIO_ROOT_USER is empty/whitespace', () => {
    expect(() =>
      getMinioConfig({ MINIO_ENDPOINT: 'http://minio:9000', MINIO_ROOT_USER: '' }),
    ).toThrow('MINIO_ROOT_USER');
  });

  it('returns a readonly MinioConfig object', () => {
    const cfg = getMinioConfig(VALID_ENV);
    // Structural check — the type is readonly at compile time.
    expect(cfg).toEqual({
      endpoint: 'http://localhost:9100',
      rootUser: 'minioadmin',
      bucket: 'raw-snapshots',
    } satisfies MinioConfig);
  });

  it('rejects non-http(s) endpoint schemes', () => {
    expect(() =>
      getMinioConfig({
        MINIO_ENDPOINT: 'ftp://minio:9000',
        MINIO_ROOT_USER: 'minioadmin',
      }),
    ).toThrow('http:// or https://');
  });

  it('rejects endpoint with embedded credentials', () => {
    expect(() =>
      getMinioConfig({
        MINIO_ENDPOINT: 'http://user:pass@minio:9000',
        MINIO_ROOT_USER: 'minioadmin',
      }),
    ).toThrow('must not embed credentials');
  });

  it('rejects invalid bucket names', () => {
    expect(() =>
      getMinioConfig({
        MINIO_ENDPOINT: 'http://minio:9000',
        MINIO_ROOT_USER: 'minioadmin',
        RAW_SNAPSHOTS_BUCKET: 'BadBucket_Name',
      }),
    ).toThrow('valid S3 bucket name');
  });

  it('rejects bucket names that look like IP addresses', () => {
    expect(() =>
      getMinioConfig({
        MINIO_ENDPOINT: 'http://minio:9000',
        MINIO_ROOT_USER: 'minioadmin',
        RAW_SNAPSHOTS_BUCKET: '192.168.1.1',
      }),
    ).toThrow('valid S3 bucket name');
  });

  it('normalizes endpoint by stripping trailing slash', () => {
    const cfg = getMinioConfig({
      MINIO_ENDPOINT: 'http://minio:9000/',
      MINIO_ROOT_USER: 'minioadmin',
    });
    expect(cfg.endpoint).toBe('http://minio:9000');
  });
});
