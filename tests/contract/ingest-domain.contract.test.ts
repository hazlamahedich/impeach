/**
 * Contract test — Epic 3 ingest domain schemas + queue-name constants.
 *
 * Locks the zod invariants for the source-registry / document / ingestion-job
 * contracts exported from `@iip/contracts` (packages/contracts/src/ingest.ts).
 * A drift in the branded-UUID regex, the closed enumerations, the hex-digest
 * shapes, the required payload fields, or the queue-name strings turns this
 * test RED in CI — protecting every downstream worker + Enqueuer consumer.
 *
 * Branded nominal types are validated as opaque at runtime (the brand is a
 * TS-only symbol, but `safeParse` still enforces the underlying shape), and the
 * closed `z.enum` vocabularies are checked for both accept + reject behaviour.
 *
 * @rules FR-1.1, FR-1.3, FR-1.4, FR-1.5, FR-1.6, SEC-3, PC-4
 * @adr ADR-001
 */
import { describe, it, expect } from 'vitest';
import {
  SourceIdSchema,
  SourceSourceType,
  CrawlStrategy,
  DocumentIdSchema,
  ContentChecksumSchema,
  JobIdSchema,
  JobStateLiteral,
  IngestJobPayloadSchema,
  INGEST_QUEUE_NAME,
  INGEST_DLQ_NAME,
  STAGE_COMPLETED_SUFFIX,
} from '@iip/contracts';

// Deterministic known-good fixtures (avoid cross-test coupling with the
// random-seed helpers in tests/support/helpers/ingest.ts — these are the
// contract's own canonical exemplars).
const VALID_UUID_V4 = '00000000-0000-4000-8000-000000000000';
const UUID_V1 = '00000000-0000-1000-8000-000000000000';
const HEX_64 = 'a'.repeat(64);

describe('Epic 3 — ingest domain contract schemas + constants', () => {
  // ─────────────────────────────────────────────────────────────────────────
  // SourceIdSchema (FR-1.1, SEC-6 — branded UUID v4)
  // ─────────────────────────────────────────────────────────────────────────
  describe('SourceIdSchema', () => {
    it('accepts a valid UUID v4', () => {
      const r = SourceIdSchema.safeParse(VALID_UUID_V4);
      expect(r.success).toBe(true);
    });

    it('rejects a non-UUID string', () => {
      expect(SourceIdSchema.safeParse('not-a-uuid').success).toBe(false);
    });

    it('rejects a UUID v1 (wrong version char)', () => {
      // The v4 regex pins the version nibble to `4`; a v1 UUID fails.
      expect(SourceIdSchema.safeParse(UUID_V1).success).toBe(false);
    });

    it('brand is opaque — parsed value is the original string at runtime', () => {
      // The brand is a TS-only symbol; runtime value is the plain UUID string,
      // so a SourceId cannot be distinguished from a raw string by `typeof`.
      // The brand's enforcement is compile-time (transposition guard), not
      // runtime. This asserts the opacity contract: no extra fields leaked.
      const r = SourceIdSchema.safeParse(VALID_UUID_V4);
      expect(r.success).toBe(true);
      if (r.success) {
        expect(typeof r.data).toBe('string');
        expect(r.data).toBe(VALID_UUID_V4);
      }
    });
  });

  // ─────────────────────────────────────────────────────────────────────────
  // SourceSourceType (FR-1.1, SEC-3 — closed enumeration of source classes)
  // ─────────────────────────────────────────────────────────────────────────
  describe('SourceSourceType', () => {
    it.each(['government', 'court', 'media', 'press_release', 'transcript'] as const)(
      'accepts the valid value %s',
      (value) => {
        expect(SourceSourceType.safeParse(value).success).toBe(true);
      },
    );

    it('rejects an unknown source type', () => {
      expect(SourceSourceType.safeParse('blog').success).toBe(false);
    });
  });

  // ─────────────────────────────────────────────────────────────────────────
  // CrawlStrategy (FR-1.3, ADR-007 — closed enumeration of discovery strategies)
  // ─────────────────────────────────────────────────────────────────────────
  describe('CrawlStrategy', () => {
    it.each(['rss', 'sitemap', 'list_page', 'api', 'manual'] as const)(
      'accepts the valid value %s',
      (value) => {
        expect(CrawlStrategy.safeParse(value).success).toBe(true);
      },
    );

    it('rejects an unknown crawl strategy', () => {
      expect(CrawlStrategy.safeParse('scrape').success).toBe(false);
    });
  });

  // ─────────────────────────────────────────────────────────────────────────
  // DocumentIdSchema (FR-1.5, SEC-6 — branded UUID v4)
  // ─────────────────────────────────────────────────────────────────────────
  describe('DocumentIdSchema', () => {
    it('accepts a valid UUID v4', () => {
      expect(DocumentIdSchema.safeParse(VALID_UUID_V4).success).toBe(true);
    });

    it('rejects a non-UUID string', () => {
      expect(DocumentIdSchema.safeParse('00000000-0000-0000-0000-000000000000').success).toBe(false);
    });
  });

  // ─────────────────────────────────────────────────────────────────────────
  // ContentChecksumSchema (FR-1.3, PC-1a — 64-char lowercase hex SHA-256)
  // ─────────────────────────────────────────────────────────────────────────
  describe('ContentChecksumSchema', () => {
    it('accepts a 64-char lowercase hex digest', () => {
      expect(ContentChecksumSchema.safeParse(HEX_64).success).toBe(true);
    });

    it('rejects uppercase hex', () => {
      expect(ContentChecksumSchema.safeParse('A'.repeat(64)).success).toBe(false);
    });

    it('rejects non-hex characters', () => {
      expect(ContentChecksumSchema.safeParse('z'.repeat(64)).success).toBe(false);
    });

    it('rejects wrong length (63 chars)', () => {
      expect(ContentChecksumSchema.safeParse('a'.repeat(63)).success).toBe(false);
    });

    it('rejects wrong length (65 chars)', () => {
      expect(ContentChecksumSchema.safeParse('a'.repeat(65)).success).toBe(false);
    });
  });

  // ─────────────────────────────────────────────────────────────────────────
  // JobIdSchema (FR-1.6, PC-2.4 — 64-char lowercase hex SHA-256 of dedupe anchor)
  // ─────────────────────────────────────────────────────────────────────────
  describe('JobIdSchema', () => {
    it('accepts a 64-char lowercase hex digest', () => {
      expect(JobIdSchema.safeParse(HEX_64).success).toBe(true);
    });

    it('rejects wrong length (63 chars)', () => {
      expect(JobIdSchema.safeParse('a'.repeat(63)).success).toBe(false);
    });

    it('rejects wrong length (65 chars)', () => {
      expect(JobIdSchema.safeParse('a'.repeat(65)).success).toBe(false);
    });
  });

  // ─────────────────────────────────────────────────────────────────────────
  // JobStateLiteral (FR-1.6, NFR-R-1..3 — closed enumeration of job states)
  // ─────────────────────────────────────────────────────────────────────────
  describe('JobStateLiteral', () => {
    it.each(
      ['pending', 'running', 'completed', 'failed', 'dead_lettered', 'cancelled'] as const,
    )('accepts the valid state %s', (state) => {
      expect(JobStateLiteral.safeParse(state).success).toBe(true);
    });

    it('rejects an unknown state', () => {
      expect(JobStateLiteral.safeParse('paused').success).toBe(false);
    });
  });

  // ─────────────────────────────────────────────────────────────────────────
  // IngestJobPayloadSchema (FR-1.6, PC-2.4, STR-3 — BullMQ job payload)
  // ─────────────────────────────────────────────────────────────────────────
  describe('IngestJobPayloadSchema', () => {
    const validPayload = {
      jobId: HEX_64,
      sourceId: VALID_UUID_V4,
      dedupeAnchor: 'doc-42',
      stage: 'fetch',
    };

    it('accepts a valid payload', () => {
      expect(IngestJobPayloadSchema.safeParse(validPayload).success).toBe(true);
    });

    it('accepts a valid payload with optional documentId', () => {
      expect(
        IngestJobPayloadSchema.safeParse({ ...validPayload, documentId: VALID_UUID_V4 }).success,
      ).toBe(true);
    });

    it('rejects when sourceId is missing', () => {
      const { sourceId: _omit, ...rest } = validPayload;
      void _omit;
      expect(IngestJobPayloadSchema.safeParse(rest).success).toBe(false);
    });

    it('rejects when dedupeAnchor is missing', () => {
      const { dedupeAnchor: _omit, ...rest } = validPayload;
      void _omit;
      expect(IngestJobPayloadSchema.safeParse(rest).success).toBe(false);
    });

    it('rejects when stage is missing', () => {
      const { stage: _omit, ...rest } = validPayload;
      void _omit;
      expect(IngestJobPayloadSchema.safeParse(rest).success).toBe(false);
    });

    it('rejects a bad jobId type (non-hex)', () => {
      expect(
        IngestJobPayloadSchema.safeParse({ ...validPayload, jobId: 'not-hex' }).success,
      ).toBe(false);
    });

    it('rejects a bad sourceId type (non-UUID)', () => {
      expect(
        IngestJobPayloadSchema.safeParse({ ...validPayload, sourceId: 'nope' }).success,
      ).toBe(false);
    });

    it('rejects an empty dedupeAnchor', () => {
      expect(
        IngestJobPayloadSchema.safeParse({ ...validPayload, dedupeAnchor: '' }).success,
      ).toBe(false);
    });

    it('rejects an empty stage', () => {
      expect(IngestJobPayloadSchema.safeParse({ ...validPayload, stage: '' }).success).toBe(false);
    });
  });

  // ─────────────────────────────────────────────────────────────────────────
  // Queue-name + stage-event constants (STR-3, PC-2.4 — BullMQ wiring single source of truth)
  // ─────────────────────────────────────────────────────────────────────────
  describe('queue + stage constants', () => {
    it('INGEST_QUEUE_NAME === "ingest:queue"', () => {
      expect(INGEST_QUEUE_NAME).toBe('ingest:queue');
    });

    it('INGEST_DLQ_NAME === "dlq:ingest"', () => {
      expect(INGEST_DLQ_NAME).toBe('dlq:ingest');
    });

    it('STAGE_COMPLETED_SUFFIX === ".completed"', () => {
      expect(STAGE_COMPLETED_SUFFIX).toBe('.completed');
    });
  });
});
