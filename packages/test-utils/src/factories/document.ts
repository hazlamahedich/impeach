/**
 * Test factory for `documents` rows (Story 3.3, FR-1.3, FR-1.5, PC-1a, AC-4).
 *
 * Produces valid `TestDocument` records with sensible defaults that the
 * document repository (and integration tests) can consume directly. The
 * branded types (`DocumentId`, `SourceId`, `ContentChecksum`, `RawSnapshotKey`)
 * are constructed via `asDocumentId` / `asSourceId` / `asContentChecksum` /
 * `asRawSnapshotKey` cast helpers because the brand is a phantom — the runtime
 * value is the plain string. Tests do not need to exercise the zod `.parse`
 * gate on every field to obtain a typed value.
 *
 * @rules FR-1.3, FR-1.5, PC-1a, AC-4
 */
import {
  DocumentIdSchema,
  ContentChecksumSchema,
  RawSnapshotKeySchema,
} from '@iip/contracts';
import type {
  DocumentId,
  SourceId,
  ContentChecksum,
  RawSnapshotKey,
} from '@iip/contracts';
import { asSourceId } from './source.js';

/** Branded-bypass for tests: parse a plain UUID v4 into a branded DocumentId. */
export function asDocumentId(uuid: string): DocumentId {
  return DocumentIdSchema.parse(uuid);
}

/** Branded-bypass for tests: parse a 64-char hex digest into a branded ContentChecksum. */
export function asContentChecksum(hex64: string): ContentChecksum {
  return ContentChecksumSchema.parse(hex64);
}

/** Branded-bypass for tests: parse a plain key into a branded RawSnapshotKey. */
export function asRawSnapshotKey(key: string): RawSnapshotKey {
  return RawSnapshotKeySchema.parse(key);
}

/**
 * TestFetchMetadata — the `documents.fetch_metadata` jsonb sub-document.
 *
 * Captures per-artifact fetch provenance (FR-1.3): where the bytes came from,
 * when they were retrieved, what HTTP headers accompanied them, and the
 * intake-gate principals / legal basis when the document entered via the
 * two-person intake (SEC-2). `uploader_id`, `reviewer_id`, and `legal_basis`
 * are optional — present only when the document entered via intake rather
 * than crawl.
 *
 * @rules FR-1.3, FR-1.5, PC-1a, AC-4
 */
export interface TestFetchMetadata {
  readonly url: string;
  readonly retrieved_at: Date;
  readonly headers: Record<string, string>;
  readonly obtained_via: string;
  readonly uploader_id?: string;
  readonly reviewer_id?: string;
  readonly legal_basis?: string;
}

/**
 * TestDocument — a single `documents` row.
 *
 * Mirrors the `documents` Drizzle schema
 * (`packages/db/src/schema/documents.ts`, migration `0004_epic3_ingest_tables.sql`).
 * The branded types prevent transposition with other string IDs (SEC-6).
 *
 * `content_checksum` is the dedupe anchor (PC-1a, FR-1.3): the same document
 * ingested twice produces the same checksum and is processed once. `intake_document_id`
 * is nullable — present only when the document entered via the SEC-2 intake gate.
 *
 * @rules FR-1.3, FR-1.5, PC-1a, AC-4
 */
export interface TestDocument {
  readonly id: DocumentId;
  readonly source_id: SourceId;
  readonly content_checksum: ContentChecksum;
  readonly raw_snapshot_key: RawSnapshotKey;
  readonly fetch_metadata: TestFetchMetadata;
  readonly intake_document_id: string | null;
  readonly created_at: Date;
  readonly updated_at: Date;
}

const DEFAULT_NOW = () => new Date('2026-07-08T00:00:00.000Z');

/**
 * Build a `documents` row with sensible defaults (FR-1.3, FR-1.5, PC-1a).
 *
 * Every field can be overridden. The defaults are:
 *  - `id`: a fixed UUID v4 `00000000-0000-4000-8000-000000000002` (deterministic)
 *  - `source_id`: a fixed UUID v4 `00000000-0000-4000-8000-000000000001` (the default `makeSource` id)
 *  - `content_checksum`: `'a'.repeat(64)` (a valid 64-char lowercase hex SHA-256 digest)
 *  - `raw_snapshot_key`: `raw-snapshots/sha256/aaaa` (content-addressed MinIO key — FR-1.4)
 *  - `fetch_metadata`: a sensible crawl provenance sub-document (see default below)
 *  - `intake_document_id`: `null` (crawled document, not intake-gated)
 *  - `created_at` / `updated_at`: `2026-07-08T00:00:00.000Z` (deterministic)
 *
 * Deterministic timestamps + IDs (rather than `new Date()` / `crypto.randomUUID()`)
 * keep test assertions stable; tests that need fresh values pass them explicitly.
 *
 * @rules FR-1.3, FR-1.5, PC-1a, AC-4
 */
export function makeDocument(overrides: Partial<TestDocument> = {}): TestDocument {
  const now = overrides.updated_at ?? DEFAULT_NOW();
  return {
    id: overrides.id ?? asDocumentId('00000000-0000-4000-8000-000000000002'),
    source_id: overrides.source_id ?? asSourceId('00000000-0000-4000-8000-000000000001'),
    content_checksum: overrides.content_checksum ?? asContentChecksum('a'.repeat(64)),
    raw_snapshot_key: overrides.raw_snapshot_key ?? asRawSnapshotKey('raw-snapshots/sha256/aaaa'),
    fetch_metadata: overrides.fetch_metadata ?? {
      url: 'https://example.gov/news/2026/07/release.html',
      retrieved_at: DEFAULT_NOW(),
      headers: { 'content-type': 'text/html' },
      obtained_via: 'firecrawl',
    },
    intake_document_id: overrides.intake_document_id ?? null,
    created_at: overrides.created_at ?? DEFAULT_NOW(),
    updated_at: now,
  };
}
