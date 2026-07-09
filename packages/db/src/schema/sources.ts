import { pgTable, uuid, timestamp, text, integer, boolean, uniqueIndex, index, check } from 'drizzle-orm/pg-core';
import { sql } from 'drizzle-orm';
import type { SourceId, SourceSourceType, CrawlStrategy, Principal } from '@iip/contracts';

/**
 * `sources` — the source registry with confirmed trust tiers (FR-1.1, SEC-3).
 *
 * A source is a publishable origin of documents (a government site, a court,
 * a media outlet, a press-release feed, a transcript archive). Each source
 * carries a **tentative** trust tier (1 primary → 3 aggregator) — "confirmed"
 * means source-authenticity validated by the deferred legal/editorial workflow,
 * not self-declared. The tier is assigned AT INGEST and persisted as a
 * structural graph property (SEC-3); it feeds evidence reliability +
 * citation-quality floor (EI-8) and is displayed on every citation (T-007).
 *
 * Upstream feed provenance (`is_wire_service`, `original_publisher_id`) is
 * tracked for EI-2 independence: a wire-service story syndicated across
 * multiple outlets is NOT independent corroboration. `original_publisher_id`
 * is a self-referential FK to `sources(id)` (a republisher points at its
 * primary origin).
 *
 * Nullability discipline (project-context: `.notNull()` by default): only the
 * confirmation provenance fields (`confirmed_by`, `confirmed_at`,
 * `confirmation_rationale`) and `original_publisher_id` are nullable — a source
 * may be a primary origin (no upstream feed), and the confirmation fields are
 * populated by the deferred workflow. `confirmed` defaults `false` (the honest
 * "not yet validated"); a source cannot feed the graph until `confirmed = true`
 * (SEC-3 provenance check at ingest). `is_wire_service` is NOT NULL with a
 * `false` default so existing rows + new registrations are honest by default.
 *
 * **Story 3.1 (AC-7):** the confirmation fields + `is_wire_service` +
 * `original_publisher_id` are present in the schema from day one but are NOT
 * writable through the 3.1 API surface — confirmation is a deferred workflow
 * (AC-8).
 *
 * @rules FR-1.1, SEC-3, EI-2, EI-8, AC-7
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
    // AC-7 deferred + EI-2 provenance fields (Story 3.1 adds these; the API
    // surface makes is_wire_service + original_publisher_id writable but the
    // confirmation fields are deferred to the confirmation workflow story).
    is_wire_service: boolean('is_wire_service').notNull().default(false),
    original_publisher_id: uuid('original_publisher_id').$type<SourceId>(),
    confirmed_by: text('confirmed_by').$type<Principal>(),
    confirmed_at: timestamp('confirmed_at', { withTimezone: true, mode: 'date' }),
    confirmation_rationale: text('confirmation_rationale'),
    // Story 3.2 — lawful-access gate fields (FR-1.2). `crawling_disabled`
    // defaults true (fail-closed: a source cannot be crawled until cleared by
    // the automated check + operator confirmation/override). The check-signal
    // fields are nullable until the first check runs; the confirmation +
    // override provenance fields mirror the SEC-6 discipline.
    lawful_access_status: text('lawful_access_status').$type<'pending' | 'allowed' | 'blocked'>().notNull().default('pending'),
    lawful_access_checked_at: timestamp('lawful_access_checked_at', { withTimezone: true, mode: 'date' }),
    robots_status: text('robots_status').$type<'allowed' | 'disallowed' | 'unreachable' | null>(),
    paywall_detected: boolean('paywall_detected'),
    login_required: boolean('login_required'),
    captcha_detected: boolean('captcha_detected'),
    // terms_forbid_scraping is NOT NULL DEFAULT false: it is a manual operator
    // flag, honest-by-default (a source is ToS-forbidden only when explicitly
    // marked). AC-1 — NOT auto-detected from HTML.
    terms_forbid_scraping: boolean('terms_forbid_scraping').notNull().default(false),
    robots_txt_content: text('robots_txt_content'),
    lawful_access_confirmed: boolean('lawful_access_confirmed').notNull().default(false),
    lawful_access_confirmed_by: text('lawful_access_confirmed_by').$type<Principal>(),
    lawful_access_confirmed_at: timestamp('lawful_access_confirmed_at', { withTimezone: true, mode: 'date' }),
    lawful_access_override: boolean('lawful_access_override').notNull().default(false),
    lawful_access_override_by: text('lawful_access_override_by').$type<Principal>(),
    lawful_access_override_at: timestamp('lawful_access_override_at', { withTimezone: true, mode: 'date' }),
    lawful_access_override_rationale: text('lawful_access_override_rationale'),
    crawling_disabled: boolean('crawling_disabled').notNull().default(true),
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
    // Story 3.2 — lawful-access gate indexes (FR-1.2). The status index serves
    // the operator triage "show me all blocked sources"; the crawling_disabled
    // index serves the crawler's pre-flight "which sources are crawlable?".
    lawfulAccessStatusIdx: index('sources_lawful_access_status_idx').on(table.lawful_access_status),
    crawlingDisabledIdx: index('sources_crawling_disabled_idx').on(table.crawling_disabled),
    // CHECK constraints mirror the zod enums so DB-level drift is caught.
    lawfulAccessStatusCheck: check(
      'sources_lawful_access_status_check',
      sql`${table.lawful_access_status} IN ('pending', 'allowed', 'blocked')`,
    ),
    robotsStatusCheck: check(
      'sources_robots_status_check',
      sql`${table.robots_status} IS NULL OR ${table.robots_status} IN ('allowed', 'disallowed', 'unreachable')`,
    ),
  }),
);
