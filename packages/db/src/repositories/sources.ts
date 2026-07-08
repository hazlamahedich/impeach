/**
 * SourcesRepository — the data-access layer for the `sources` table (FR-1.1).
 *
 * Implements the `SourceRegistryRepo` interface: the injectable contract the
 * API routes consume. The interface lives here (in `@iip/db`) so the route
 * layer depends on the data-access package, not the other way around. Tests
 * inject an in-memory stub implementing the same interface; production wires
 * this Drizzle implementation.
 *
 * **Default trust-tier assignment (AC-2):** the repo assigns the default tier
 * from `DEFAULT_TRUST_TIER_BY_SOURCE_TYPE` when the payload omits `trust_tier`,
 * then applies the operator's override (already validated by the contract
 * schema to be 1 | 2 | 3). The tier is persisted as a structural property
 * (SEC-3).
 *
 * **`confirmed` discipline (AC-2, AC-8):** the repo ALWAYS sets
 * `confirmed = false` on create. The confirmation fields (`confirmed_by`,
 * `confirmed_at`, `confirmation_rationale`) are NEVER touched by `update()` —
 * confirmation is a separate deferred workflow.
 *
 * **Duplicate-URL prevention (AC-4):** enforced at the database level via the
 * `sources_url_uq` unique index (migration 0004). The repo does NOT pre-check;
 * a 23505 unique_violation propagates to the route layer, which maps it to 409.
 * This keeps the duplicate check atomic (no TOCTOU gap between check + insert).
 *
 * @rules FR-1.1, SEC-3, AC-1, AC-2, AC-4, AC-6, AC-7, DoD-2
 * @adr ADR-001
 */
import { eq, and, type SQL } from 'drizzle-orm';
import type { Db } from '../client.js';
import { sources } from '../schema/sources.js';
import {
  DEFAULT_TRUST_TIER_BY_SOURCE_TYPE,
  type SourceId,
  type SourceSourceType,
  type CrawlStrategy,
  type SourceResponse,
  type RegisterSourcePayload,
  type UpdateSourcePayload,
  type SourceListFilters,
} from '@iip/contracts';
import type { ConfirmationStatusLiteral } from '@iip/contracts';

/**
 * The injectable repository contract consumed by `apps/api/src/routes/sources.ts`.
 *
 * Every method returns the row shaped as `SourceResponse` (the API response
 * type) so the route layer is a thin adapter — no mapping between DB and API
 * shapes leaks into the routes. `create`/`update` apply the default tier
 * mapping + confirmed discipline; `list` applies the filters.
 *
 * @rules FR-1.1, DoD-2
 */
export interface SourceRegistryRepo {
  /** Create a source. Applies default tier mapping (AC-2); confirmed=false. */
  create(payload: RegisterSourcePayload): Promise<SourceResponse>;
  /** Find a single source by ID, or null. */
  findById(id: SourceId): Promise<SourceResponse | null>;
  /** Find a single source by URL (case-insensitive, trailing-slash-normalized). */
  findByUrl(url: string): Promise<SourceResponse | null>;
  /** Partial update. NEVER touches confirmed/confirmed_by/confirmed_at. */
  update(id: SourceId, patch: UpdateSourcePayload): Promise<SourceResponse | null>;
  /** List with optional filters. */
  list(filters: SourceListFilters): Promise<SourceResponse[]>;
}

/**
 * Normalize a URL for duplicate comparison (AC-4).
 *
 * Case-insensitive + trailing-slash-stripped. The `sources_url_uq` index stores
 * the raw URL; the route pre-checks via `findByUrl` with this normalization to
 * surface the existing source ID in the 409 body. The DB unique index is the
 * hard guarantee; this normalization makes the user-facing error helpful.
 */
export function normalizeUrl(url: string): string {
  return url.toLowerCase().replace(/\/+$/, '');
}

/**
 * Derive `confirmation_status` from `confirmed` (AC-3).
 */
function confirmationStatus(confirmed: boolean): ConfirmationStatusLiteral {
  return confirmed ? 'confirmed' : 'tentative';
}

/**
 * Map a raw Drizzle `sources` row to the `SourceResponse` API shape.
 *
 * The DB row uses snake_case + Date timestamps; the API response uses the same
 * keys but ISO-8601 strings for timestamps (PC-8) + the derived
 * `confirmation_status`.
 */
function toResponse(row: typeof sources.$inferSelect): SourceResponse {
  return {
    id: row.id,
    name: row.name,
    url: row.url,
    source_type: row.source_type,
    crawl_strategy: row.crawl_strategy,
    trust_tier: row.trust_tier,
    confirmed: row.confirmed,
    confirmation_status: confirmationStatus(row.confirmed),
    is_wire_service: row.is_wire_service,
    original_publisher_id: row.original_publisher_id,
    confirmed_by: row.confirmed_by,
    confirmed_at: row.confirmed_at === null ? null : row.confirmed_at.toISOString(),
    confirmation_rationale: row.confirmation_rationale,
    created_at: row.created_at.toISOString(),
    updated_at: row.updated_at.toISOString(),
  };
}

/**
 * Create the Drizzle-backed `SourceRegistryRepo`.
 *
 * @param db - the Db handle (pool or transaction). Injected so tests can pass a
 *             transaction-scoped handle for isolation.
 *
 * @rules FR-1.1, SEC-3, AC-2
 */
export function createSourcesRepository(db: Db): SourceRegistryRepo {
  return {
    async create(payload: RegisterSourcePayload): Promise<SourceResponse> {
      const tier =
        payload.trust_tier ?? DEFAULT_TRUST_TIER_BY_SOURCE_TYPE[payload.source_type];
      const [row] = await db
        .insert(sources)
        .values({
          name: payload.name,
          // Normalize the URL so the unique index catches case/trailing-slash
          // variants (AC-4). The stored form is always normalized.
          url: normalizeUrl(payload.url),
          // Phantom-brand cast: the DB column is typed as branded SourceSourceType/
          // CrawlStrategy; the payload carries the unbranded literal. The brand is
          // a phantom (runtime-identical), so the cast is zero-cost + sound.
          source_type: payload.source_type as SourceSourceType,
          crawl_strategy: payload.crawl_strategy as CrawlStrategy,
          trust_tier: tier,
          confirmed: false,
          is_wire_service: payload.is_wire_service,
          original_publisher_id: payload.original_publisher_id ?? null,
        })
        .returning();
      if (row === undefined) {
        // Drizzle `.returning()` yields [] only on a no-op conflict; a plain
        // insert that reaches here without throwing should always return a row.
        throw new Error('sources insert returned no row');
      }
      return toResponse(row);
    },

    async findById(id: SourceId): Promise<SourceResponse | null> {
      const [row] = await db.select().from(sources).where(eq(sources.id, id)).limit(1);
      return row === undefined ? null : toResponse(row);
    },

    async findByUrl(url: string): Promise<SourceResponse | null> {
      // Normalize before lookup (AC-4): the stored URL is normalized on write,
      // so a normalized lookup matches case/trailing-slash variants.
      const [row] = await db
        .select()
        .from(sources)
        .where(eq(sources.url, normalizeUrl(url)))
        .limit(1);
      return row === undefined ? null : toResponse(row);
    },

    async update(id: SourceId, patch: UpdateSourcePayload): Promise<SourceResponse | null> {
      // Build the SET clause from only the provided fields. confirmed fields
      // are NEVER included (they are deferred-workflow-only, AC-8).
      const setClause: Partial<typeof sources.$inferInsert> = {
        updated_at: new Date(),
      };
      if (patch.name !== undefined) setClause.name = patch.name;
      if (patch.url !== undefined) setClause.url = normalizeUrl(patch.url);
      if (patch.source_type !== undefined) {
        setClause.source_type = patch.source_type as SourceSourceType;
      }
      if (patch.crawl_strategy !== undefined) {
        setClause.crawl_strategy = patch.crawl_strategy as CrawlStrategy;
      }
      if (patch.trust_tier !== undefined) setClause.trust_tier = patch.trust_tier;
      if (patch.is_wire_service !== undefined) setClause.is_wire_service = patch.is_wire_service;
      if (patch.original_publisher_id !== undefined) {
        setClause.original_publisher_id = patch.original_publisher_id;
      }
      const [row] = await db
        .update(sources)
        .set(setClause)
        .where(eq(sources.id, id))
        .returning();
      return row === undefined ? null : toResponse(row);
    },

    async list(filters: SourceListFilters): Promise<SourceResponse[]> {
      const conditions: SQL[] = [];
      if (filters.source_type !== undefined) {
        conditions.push(eq(sources.source_type, filters.source_type as SourceSourceType));
      }
      if (filters.trust_tier !== undefined) {
        conditions.push(eq(sources.trust_tier, filters.trust_tier));
      }
      if (filters.confirmed !== undefined) {
        conditions.push(eq(sources.confirmed, filters.confirmed));
      }
      const where = conditions.length > 0 ? and(...conditions) : undefined;
      const query = where === undefined ? db.select().from(sources) : db.select().from(sources).where(where);
      const rows = await query;
      return rows.map(toResponse);
    },
  };
}
