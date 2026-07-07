import { pgTable, uuid, timestamp, text, integer, boolean, uniqueIndex, index } from 'drizzle-orm/pg-core';
import { sql } from 'drizzle-orm';
import type { SourceId, SourceSourceType, CrawlStrategy } from '@iip/contracts';

/**
 * `sources` — the source registry with confirmed trust tiers (FR-1.1, SEC-3).
 *
 * A source is a publishable origin of documents (a government site, a court,
 * a media outlet, a press-release feed, a transcript archive). Each source
 * carries a **confirmed** trust tier (1 primary → 3 aggregator) — "confirmed"
 * means source-authenticity validated, not self-declared. The tier is assigned
 * AT INGEST and persisted as a structural graph property (SEC-3); it feeds
 * evidence reliability + citation-quality floor (EI-8) and is displayed on
 * every citation (T-007).
 *
 * Upstream feed provenance (`wire_service`, `original_publisher`) is tracked
 * for EI-2 independence: a wire-service story syndicated across multiple
 * outlets is NOT independent corroboration.
 *
 * Nullability discipline (project-context: `.notNull()` by default): only
 * `wire_service` and `original_publisher` are nullable — a source may be a
 * primary origin (no upstream feed) or a syndicated republisher. `confirmed`
 * defaults `false` (the honest "not yet validated"); a source cannot feed the
 * graph until `confirmed = true` (SEC-3 provenance check at ingest).
 *
 * @rules FR-1.1, SEC-3, EI-2, EI-8
 * @adr ADR-001
 */
export const sources = pgTable(
  'sources',
  {
    id: uuid('id').$type<SourceId>().primaryKey().default(sql`gen_random_uuid()`),
    name: text('name').notNull(),
    url: text('url').notNull(),
    source_type: text('source_type').$type<SourceSourceType>().notNull(),
    crawl_strategy: text('crawl_strategy').$type<CrawlStrategy>().notNull(),
    trust_tier: integer('trust_tier').notNull(),
    confirmed: boolean('confirmed').notNull().default(false),
    wire_service: text('wire_service'),
    original_publisher: text('original_publisher'),
    created_at: timestamp('created_at', { withTimezone: true, mode: 'date' })
      .defaultNow()
      .notNull(),
    updated_at: timestamp('updated_at', { withTimezone: true, mode: 'date' })
      .defaultNow()
      .notNull(),
  },
  (table) => ({
    // Unique URL prevents duplicate source registrations (two rows for the same
    // outlet would fragment the trust-tier lineage). A URL change is an UPDATE
    // to the existing row, not a new row.
    urlUq: uniqueIndex('sources_url_uq').on(table.url),
    // Index on confirmed for the "which sources are ready to feed the graph?" scan.
    confirmedIdx: index('sources_confirmed_idx').on(table.confirmed),
    // Index on trust_tier for the tier-filtered citation queries (EI-8).
    trustTierIdx: index('sources_trust_tier_idx').on(table.trust_tier),
  }),
);
