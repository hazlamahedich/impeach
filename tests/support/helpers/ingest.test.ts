/**
 * Co-located unit test — Epic 3 ingest-domain test helpers.
 *
 * Guards the helper contracts: each positive factory must produce a value that
 * passes the corresponding zod schema's `safeParse`, and each negative factory
 * must produce one that fails. A regression in a helper (e.g. switching to an
 * uppercase digest, or a v1 UUID) turns this test RED before the
 * contract/integration suites that depend on it silently weaken.
 *
 * @rules PC-9
 */
import { describe, it, expect } from 'vitest';
import { SourceIdSchema, ContentChecksumSchema, JobIdSchema } from '@iip/contracts';
import {
  makeValidSourceId,
  makeValidContentChecksum,
  makeValidJobId,
  makeInvalidUuid,
  makeInvalidHex,
} from './ingest';

describe('Epic 3 ingest helpers', () => {
  it('makeValidSourceId() passes SourceIdSchema.safeParse()', () => {
    const r = SourceIdSchema.safeParse(makeValidSourceId());
    expect(r.success).toBe(true);
  });

  it('makeValidContentChecksum() passes ContentChecksumSchema.safeParse()', () => {
    const r = ContentChecksumSchema.safeParse(makeValidContentChecksum());
    expect(r.success).toBe(true);
  });

  it('makeValidContentChecksum(seed) is deterministic and valid', () => {
    const a = makeValidContentChecksum('anchor-1');
    const b = makeValidContentChecksum('anchor-1');
    expect(a).toBe(b);
    expect(ContentChecksumSchema.safeParse(a).success).toBe(true);
  });

  it('makeValidJobId() passes JobIdSchema.safeParse()', () => {
    const r = JobIdSchema.safeParse(makeValidJobId());
    expect(r.success).toBe(true);
  });

  it('makeValidJobId(seed) is deterministic and valid', () => {
    const a = makeValidJobId('dedupe-anchor-1');
    const b = makeValidJobId('dedupe-anchor-1');
    expect(a).toBe(b);
    expect(JobIdSchema.safeParse(a).success).toBe(true);
  });

  it('makeInvalidUuid() fails SourceIdSchema.safeParse()', () => {
    expect(SourceIdSchema.safeParse(makeInvalidUuid()).success).toBe(false);
  });

  it('makeInvalidHex() fails ContentChecksumSchema.safeParse()', () => {
    expect(ContentChecksumSchema.safeParse(makeInvalidHex()).success).toBe(false);
  });
});
