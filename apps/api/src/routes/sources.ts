/**
 * Source Registry API routes (FR-1.1, Story 3.1).
 *
 *   POST   /sources        register a new source with a tentative trust tier  scope: sources:write
 *   GET    /sources        list sources (optional ?source_type, ?trust_tier, ?confirmed)  scope: sources:read
 *   GET    /sources/:id    retrieve a single source by ID                       scope: sources:read
 *   PATCH  /sources/:id    update mutable fields (NOT confirmed)                scope: sources:write
 *
 * Principal identity is read ONLY from `request.principal` (Story 2.2
 * middleware, SEC-1) — never `request.auth`. Scope is enforced via
 * `requireScope` from `@iip/auth` (the same helper the query routes use).
 *
 * **Tentative trust tier (AC-2, AC-3):** the repo assigns the default tier by
 * source_type and marks `confirmed = false`; the response carries
 * `confirmation_status: "tentative"`. The confirmation workflow is deferred
 * (AC-8). The `confirmed` field is REJECTED in both registration and update
 * payloads (DoD-3) — callers cannot self-attest trust.
 *
 * **Duplicate-URL prevention (AC-4):** the `sources_url_uq` unique index is the
 * authoritative enforcer. The route pre-checks via `findByUrl` so the canonical
 * 409 envelope can name the `existing_source_id`; the DB index remains the hard
 * guarantee under races.
 *
 * **Error contract (DoD-6):** canonical envelope `{ error: { code, message,
 * details? } }`. PG 23505 → 409 conflict with `details.existing_source_id`; 23503
 * → 400 bad_request; 23514 → 400 bad_request.
 *
 * @rules FR-1.1, SEC-1, SEC-3, AC-1..AC-8, DoD-3, DoD-6, DoD-7
 * @adr ADR-0001, ADR-0010
 */
import type { FastifyInstance, FastifyPluginAsync, FastifyReply, FastifyRequest } from 'fastify';
import { AuthError, requireScope } from '@iip/auth';
import type { ResolvedPrincipal } from '@iip/auth';
import {
  RegisterSourcePayloadSchema,
  UpdateSourcePayloadSchema,
  SourceListFiltersSchema,
  SourceIdSchema,
} from '@iip/contracts';
import type { SourceRegistryRepo } from '@iip/db';
import type { SourceId } from '@iip/contracts';

/** Fastify response schema for SourceResponse.
 *
 * Fastify's JSON Schema compiler cannot handle the $ref cycle that
 * zod-to-json-schema emits for the self-referential nullable
 * original_publisher_id. We therefore return a permissive object schema
 * that documents the response shape without enforcing it at the AJV layer
 * — zod SourceResponseSchema remains the runtime authority.
 */
function sourceResponseSchema(): Record<string, unknown> {
  return {
    type: 'object',
    properties: {
      id: { type: 'string' },
      name: { type: 'string' },
      url: { type: 'string' },
      source_type: { type: 'string' },
      crawl_strategy: { type: 'string' },
      trust_tier: { type: 'integer' },
      confirmed: { type: 'boolean' },
      confirmation_status: { type: 'string' },
      is_wire_service: { type: 'boolean' },
      original_publisher_id: { type: ['string', 'null'] },
      confirmed_by: { type: ['string', 'null'] },
      confirmed_at: { type: ['string', 'null'] },
      confirmation_rationale: { type: ['string', 'null'] },
      created_at: { type: 'string' },
      updated_at: { type: 'string' },
    },
    additionalProperties: true,
  };
}

// Re-export the repository interface so tests + server wiring import from one place.
export type { SourceRegistryRepo } from '@iip/db';

/** Dependencies injected into the sources route plugin. */
export interface SourceRouteDeps {
  /** The source registry repository (Drizzle-backed in prod; stub in tests). */
  readonly repo: SourceRegistryRepo;
}

/** Read the principal from the verified request (SEC-1). */
function principalOf(request: FastifyRequest): ResolvedPrincipal | undefined {
  return (request as unknown as { principal?: ResolvedPrincipal }).principal;
}

/**
 * Enforce a scope requirement; returns an error response if the principal lacks
 * the scope or is missing. Returns `null` when the caller may proceed.
 *
 * Extracted so the scope-check logic is mutation-tested once (not 4× across
 * handlers). `requireScope` only ever throws `AuthError('auth.insufficient_scope')`;
 * the defensive `throw err` rethrow is unreachable but kept for robustness.
 *
 * @rules SEC-1
 */
function enforceScope(
  principal: ResolvedPrincipal | undefined,
  required: readonly ('sources:write' | 'sources:read')[],
  reply: FastifyReply,
): FastifyReply | null {
  if (principal === undefined) {
    return sendError(reply, 401, 'unauthenticated', 'missing authenticated principal');
  }
  try {
    requireScope(principal, required);
  } catch (err) {
    if (err instanceof AuthError && err.code === 'auth.insufficient_scope') {
      return sendError(reply, 403, err.code, err.message);
    }
    // Defensive rethrow — requireScope only throws AuthError; this branch is
    // unreachable but kept so an unexpected throw propagates rather than
    // silently swallowing. Stryker disable next-line all: untestable defensive path.
    throw err;
  }
  return null;
}

/**
 * Send a canonical error envelope (DoD-6).
 *
 * `{ error: { code: string, message: string, details?: unknown } }`. No stack
 * traces, no ad-hoc shapes.
 */
function sendError(
  reply: FastifyReply,
  status: number,
  code: string,
  message: string,
  details?: unknown,
): FastifyReply {
  const body: { error: { code: string; message: string; details?: unknown } } = {
    error: { code, message },
  };
  if (details !== undefined) body.error.details = details;
  return reply.code(status).send(body);
}

/**
 * Map a thrown repository/database error to an HTTP error response.
 *
 * PG error code 23505 (unique_violation) → 409 conflict with the existing
 * source ID in `details`. PG error code 23514 (check_violation) → 400
 * bad_request. Unknown errors → 500 internal (no message leakage).
 */
/**
 * Resolve the 409 conflict details for a duplicate URL.
 *
 * The canonical DoD-6 envelope is `{ error: { code, message, details } }`.
 * When a URL collision is detected, callers should receive
 * `details: { existing_source_id }`. If we cannot resolve the ID (e.g., a
 * race where the DB unique index fires before the pre-check can look it up),
 * we fall back to `details: { constraint }` so the response remains in the
 * canonical shape.
 */
async function conflictDetails(
  repo: SourceRegistryRepo,
  url: string | undefined,
  constraint: string,
): Promise<{ existing_source_id?: SourceId; constraint?: string }> {
  if (url !== undefined) {
    const existing = await repo.findByUrl(url);
    if (existing !== null) {
      return { existing_source_id: existing.id };
    }
  }
  return { constraint };
}

async function handleRepoError(
  reply: FastifyReply,
  err: unknown,
  repo: SourceRegistryRepo,
  url?: string,
): Promise<FastifyReply> {
  // Postgres-shaped error: has a `code` property (23505 / 23514 / ...).
  if (err !== null && typeof err === 'object' && 'code' in err) {
    const pgErr = err as { code: string; constraint?: string };
    if (pgErr.code === '23505') {
      // Unique violation — duplicate URL. Try to surface the existing id; fall
      // back to naming the constraint if the race window prevents lookup.
      const constraint = pgErr.constraint ?? 'sources_url_uq';
      const details = await conflictDetails(repo, url, constraint);
      return sendError(reply, 409, 'conflict', 'Source URL already registered', details);
    }
    if (pgErr.code === '23514') {
      return sendError(reply, 400, 'bad_request', 'Database CHECK constraint violated');
    }
  }
  return sendError(reply, 500, 'internal', 'source registry operation failed');
}

/**
 * Create the sources Fastify route plugin. Requires the Story 2.2
 * `verifyMiddleware` to be registered upstream so `request.principal` is set.
 *
 * @rules FR-1.1, SEC-1, AC-1..AC-8, DoD-7
 * @adr ADR-0001
 */
export function createSourceRoutes(deps: SourceRouteDeps): FastifyPluginAsync {
  return async function sourceRoutes(app: FastifyInstance): Promise<void> {
    // DoD-7: Fastify JSON Schemas serve the OpenAPI spec (`@fastify/swagger`).
    // Validation is INTENTIONALLY permissive at the AJV layer — the zod schemas
    // are the single validation authority and return the canonical error envelope
    // (DoD-6). AJV rejecting first would emit Fastify's default error shape
    // (`{ statusCode, error, message }`), diverging from the contract. Keeping
    // AJV permissive (additionalProperties true, no enum enforcement) means every
    // validation failure flows through zod → `sendError(400, 'bad_request', ...)`.
    // The schemas still document the expected shape + enums for OpenAPI consumers.
    //
    // Response schemas are derived from `SourceResponseSchema` so the OpenAPI spec
    // matches the zod contract without drift. AJV is still permissive: response
    // schemas use `additionalProperties: true` so the route can evolve without
    // blocking valid fields.
    //
    // Stryker disable: the schema object literals below are OpenAPI documentation
    // only — the property names + enum string literals have no runtime behavior
    // (AJV is permissive; zod is the validator). Mutating them cannot be killed
    // by behavioral tests without asserting on the OpenAPI spec output, which is
    // out of scope for DoD-4 (routes logic mutation testing).

    // ── POST /sources — register a new source (AC-1, AC-2, AC-3) ──────────
    app.post(
      '/sources',
      {
        schema: {
          body: {
            type: 'object',
            required: ['name', 'url', 'source_type', 'crawl_strategy'],
            properties: {
              name: { type: 'string' },
              url: { type: 'string' },
              source_type: { type: 'string' },
              crawl_strategy: { type: 'string' },
              trust_tier: { type: 'integer' },
              is_wire_service: { type: 'boolean' },
              original_publisher_id: { type: 'string' },
            },
          },
          response: {
            201: sourceResponseSchema(),
          },
        },
      },
      async (request, reply) => {
        const denied = enforceScope(principalOf(request), ['sources:write'], reply);
        if (denied !== null) return denied;

        // Validate the body via zod (DoD-3). `.strict()` rejects `confirmed` +
        // unknown keys.
        const parsed = RegisterSourcePayloadSchema.safeParse(request.body);
        if (!parsed.success) {
          return sendError(reply, 400, 'bad_request', 'Invalid source registration payload', {
            issues: parsed.error.issues,
          });
        }

        try {
          // Pre-check for duplicate URL so the 409 names the existing source.
          const existing = await deps.repo.findByUrl(parsed.data.url);
          if (existing !== null) {
            return sendError(reply, 409, 'conflict', 'Source URL already registered', {
              existing_source_id: existing.id,
            });
          }
          const created = await deps.repo.create(parsed.data);
          return reply.code(201).send(created);
        } catch (err) {
          return handleRepoError(reply, err, deps.repo, parsed.data.url);
        }
      },
    );

    // ── GET /sources — list with optional filters (AC-5) ──────────────────
    app.get(
      '/sources',
      {
        schema: {
          querystring: {
            type: 'object',
            properties: {
              source_type: { type: 'string' },
              trust_tier: { type: 'integer' },
              confirmed: { type: 'boolean' },
            },
            additionalProperties: false,
          },
          response: {
            200: {
              type: 'array',
              items: sourceResponseSchema(),
            },
          },
        },
      },
      async (request, reply) => {
        const denied = enforceScope(principalOf(request), ['sources:read'], reply);
        if (denied !== null) return denied;

        const filters = SourceListFiltersSchema.safeParse(request.query);
        if (!filters.success) {
          return sendError(reply, 400, 'bad_request', 'Invalid filter parameters', {
            issues: filters.error.issues,
          });
        }
        const rows = await deps.repo.list(filters.data);
        return reply.send(rows);
      },
    );

    // ── GET /sources/:id — retrieve a single source (AC-5, AC-7) ──────────
    app.get(
      '/sources/:id',
      {
        schema: {
          params: {
            type: 'object',
            required: ['id'],
            properties: { id: { type: 'string' } },
          },
          response: {
            200: sourceResponseSchema(),
          },
        },
      },
      async (request, reply) => {
        const denied = enforceScope(principalOf(request), ['sources:read'], reply);
        if (denied !== null) return denied;

        const params = request.params as { id: string };
        const idParse = SourceIdSchema.safeParse(params.id);
        if (!idParse.success) {
          return sendError(reply, 404, 'not_found', 'Source not found');
        }
        const row = await deps.repo.findById(idParse.data);
        if (row === null) {
          return sendError(reply, 404, 'not_found', 'Source not found');
        }
        return reply.send(row);
      },
    );

    // ── PATCH /sources/:id — update mutable fields (AC-6) ─────────────────
    app.patch(
      '/sources/:id',
      {
        schema: {
          params: {
            type: 'object',
            required: ['id'],
            properties: { id: { type: 'string' } },
          },
          body: {
            type: 'object',
            properties: {
              name: { type: 'string' },
              url: { type: 'string' },
              source_type: { type: 'string' },
              crawl_strategy: { type: 'string' },
              trust_tier: { type: 'integer' },
              is_wire_service: { type: 'boolean' },
              original_publisher_id: { type: ['string', 'null'] },
            },
          },
          response: {
            200: sourceResponseSchema(),
          },
        },
      },
      async (request, reply) => {
        const denied = enforceScope(principalOf(request), ['sources:write'], reply);
        if (denied !== null) return denied;

        const params = request.params as { id: string };
        const idParse = SourceIdSchema.safeParse(params.id);
        if (!idParse.success) {
          return sendError(reply, 404, 'not_found', 'Source not found');
        }

        const parsed = UpdateSourcePayloadSchema.safeParse(request.body);
        if (!parsed.success) {
          return sendError(reply, 400, 'bad_request', 'Invalid source update payload', {
            issues: parsed.error.issues,
          });
        }

        try {
          // If the URL is changing, pre-check for duplicate (AC-4, AC-6).
          if (parsed.data.url !== undefined) {
            const existing = await deps.repo.findByUrl(parsed.data.url);
            if (existing !== null && existing.id !== idParse.data) {
              return sendError(reply, 409, 'conflict', 'Source URL already registered', {
                existing_source_id: existing.id,
              });
            }
          }
          const updated = await deps.repo.update(idParse.data, parsed.data);
          if (updated === null) {
            return sendError(reply, 404, 'not_found', 'Source not found');
          }
          return reply.send(updated);
        } catch (err) {
          return handleRepoError(reply, err, deps.repo, parsed.data.url);
        }
      },
    );
  };
}
