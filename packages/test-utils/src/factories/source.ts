/**
 * Test factory for `sources` rows (Story 3.1, FR-1.1, SEC-3, EI-8).
 *
 * Produces valid `TestSource` records with sensible defaults that the source
 * registry repository (and integration tests) can consume directly. The
 * branded types (`SourceId`, `SourceSourceType`, `CrawlStrategy`) are
 * constructed via `asSourceId` / `asSourceSourceType` / `asCrawlStrategy`
 * cast helpers because the brand is a phantom — the runtime value is the
 * plain string. Tests do not need to exercise the zod `.parse` gate on every
 * field to obtain a typed value.
 *
 * @rules FR-1.1, SEC-3, EI-8
 */
import {
  SourceIdSchema,
  SourceSourceType as SourceSourceTypeSchema,
  CrawlStrategy as CrawlStrategySchema,
} from '@iip/contracts';
import type {
  SourceId,
  SourceSourceType,
  CrawlStrategy,
} from '@iip/contracts';

/** Branded-bypass for tests: parse a plain UUID v4 into a branded SourceId. */
export function asSourceId(uuid: string): SourceId {
  return SourceIdSchema.parse(uuid);
}

/** Branded-bypass for tests: parse a sanctioned value into a branded SourceSourceType. */
export function asSourceSourceType(
  value: 'government' | 'court' | 'media' | 'press_release' | 'transcript',
): SourceSourceType {
  return SourceSourceTypeSchema.parse(value);
}

/** Branded-bypass for tests: parse a sanctioned value into a branded CrawlStrategy. */
export function asCrawlStrategy(
  value: 'rss' | 'sitemap' | 'list_page' | 'api' | 'manual',
): CrawlStrategy {
  return CrawlStrategySchema.parse(value);
}

/**
 * TestSource — a single `sources` row.
 *
 * Mirrors the `sources` Drizzle schema
 * (`packages/db/src/schema/sources.ts`, migration `0004_epic3_ingest_tables.sql`).
 * The branded types prevent transposition with other string IDs (SEC-6).
 *
 * `wire_service` and `original_publisher` are nullable text columns: `null`
 * is the honest "not a wire-service syndication / no distinct original
 * publisher".
 *
 * @rules FR-1.1, SEC-3, EI-8
 */
export interface TestSource {
  readonly id: SourceId;
  readonly name: string;
  readonly url: string;
  readonly source_type: SourceSourceType;
  readonly crawl_strategy: CrawlStrategy;
  readonly trust_tier: number;
  readonly confirmed: boolean;
  readonly wire_service: string | null;
  readonly original_publisher: string | null;
  readonly created_at: Date;
  readonly updated_at: Date;
}

const DEFAULT_NOW = () => new Date('2026-07-08T00:00:00.000Z');

/**
 * Build a `sources` row with sensible defaults (FR-1.1, SEC-3).
 *
 * Every field can be overridden. The defaults are:
 *  - `id`: a fixed UUID v4 `00000000-0000-4000-8000-000000000001` (deterministic)
 *  - `name`: `U.S. Department of Example`
 *  - `url`: `https://example.gov/news`
 *  - `source_type`: `government` (Tier-1 default — SEC-3)
 *  - `crawl_strategy`: `rss`
 *  - `trust_tier`: `1` (highest trust — SEC-3)
 *  - `confirmed`: `false` (NOT NULL DEFAULT false — unconfirmed until operator sign-off)
 *  - `wire_service`: `null`
 *  - `original_publisher`: `null`
 *  - `created_at` / `updated_at`: `2026-07-08T00:00:00.000Z` (deterministic)
 *
 * Deterministic timestamps + IDs (rather than `new Date()` / `crypto.randomUUID()`)
 * keep test assertions stable; tests that need fresh values pass them explicitly.
 *
 * @rules FR-1.1, SEC-3, EI-8
 */
export function makeSource(overrides: Partial<TestSource> = {}): TestSource {
  const now = overrides.updated_at ?? DEFAULT_NOW();
  return {
    id: overrides.id ?? asSourceId('00000000-0000-4000-8000-000000000001'),
    name: overrides.name ?? 'U.S. Department of Example',
    url: overrides.url ?? 'https://example.gov/news',
    source_type: overrides.source_type ?? asSourceSourceType('government'),
    crawl_strategy: overrides.crawl_strategy ?? asCrawlStrategy('rss'),
    trust_tier: overrides.trust_tier ?? 1,
    confirmed: overrides.confirmed ?? false,
    wire_service: overrides.wire_service ?? null,
    original_publisher: overrides.original_publisher ?? null,
    created_at: overrides.created_at ?? DEFAULT_NOW(),
    updated_at: now,
  };
}
