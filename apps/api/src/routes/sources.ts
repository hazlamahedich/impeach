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
  ConfirmLawfulAccessPayloadSchema,
  OverrideLawfulAccessPayloadSchema,
  SourceIdSchema,
} from '@iip/contracts';
import type {
  LawfulAccessCheckResult,
  LawfulAccessInput,
  CorpusHash,
  Signature,
} from '@iip/contracts';
import type { SourceRegistryRepo } from '@iip/db';
import type { SourceId } from '@iip/contracts';
import type { EditorialLogRepo } from '@iip/editorial';
import { assessLawfulAccess, overrideDisable } from '@iip/ingest/access/lawful-access-gate';

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
      // Story 3.2 — lawful-access gate fields (FR-1.2).
      lawful_access_status: { type: 'string', enum: ['pending', 'allowed', 'blocked'] },
      lawful_access_checked_at: { type: ['string', 'null'] },
      robots_status: { type: ['string', 'null'], enum: ['allowed', 'disallowed', 'unreachable', null] },
      paywall_detected: { type: ['boolean', 'null'] },
      login_required: { type: ['boolean', 'null'] },
      captcha_detected: { type: ['boolean', 'null'] },
      terms_forbid_scraping: { type: 'boolean' },
      robots_txt_content: { type: ['string', 'null'] },
      lawful_access_confirmed: { type: 'boolean' },
      lawful_access_confirmed_by: { type: ['string', 'null'] },
      lawful_access_confirmed_at: { type: ['string', 'null'] },
      lawful_access_override: { type: 'boolean' },
      lawful_access_override_by: { type: ['string', 'null'] },
      lawful_access_override_at: { type: ['string', 'null'] },
      lawful_access_override_rationale: { type: ['string', 'null'] },
      crawling_disabled: { type: 'boolean' },
      created_at: { type: 'string' },
      updated_at: { type: 'string' },
    },
    additionalProperties: true,
  };
}

// Re-export the repository interface so tests + server wiring import from one place.
export type { SourceRegistryRepo } from '@iip/db';

/**
 * The result of fetching + scanning a source's robots.txt + landing page for
 * lawful-access signals (FR-1.2, Story 3.2 check endpoint).
 *
 * `robotsStatus` is the three-valued robots.txt outcome; `robotsAllowed` is the
 * boolean the pure gate consumes (false for both disallowed + unreachable —
 * AC-7 fail-closed). The HTML-scan booleans are null when the page could not be
 * fetched. `robotsTxtContent` is the raw robots.txt body for provenance (null on
 * unreachable).
 */
export interface LawfulAccessSignals {
  readonly robotsStatus: 'allowed' | 'disallowed' | 'unreachable';
  readonly robotsAllowed: boolean;
  readonly robotsCrawlDelayMs: number | null;
  readonly robotsTxtContent: string | null;
  readonly paywallDetected: boolean;
  readonly loginRequired: boolean;
  readonly captchaRequired: boolean;
}

/**
 * Injectable fetcher that produces the lawful-access detection signals by
 * fetching the source's robots.txt + landing page (Story 3.2 route contract).
 *
 * Story 3.3's fetch adapter is the production implementation; this story
 * provides `createDefaultSignalFetcher` (a simple fetch + heuristic scan) so the
 * endpoint is functional without Story 3.3. Tests inject a stub.
 *
 * @param url - the normalized source URL to check
 * @param timeoutMs - the fetch timeout (AC-1 standard 10s)
 */
export type LawfulAccessSignalFetcher = (url: string, timeoutMs: number) => Promise<LawfulAccessSignals>;

/** Dependencies injected into the sources route plugin. */
export interface SourceRouteDeps {
  /** The source registry repository (Drizzle-backed in prod; stub in tests). */
  readonly repo: SourceRegistryRepo;
  /** Lawful-access signal fetcher (Story 3.2 check endpoint). Defaults to a simple fetch+scan. */
  readonly fetchSignals?: LawfulAccessSignalFetcher;
  /** Editorial-log repo (Story 3.2 override endpoint, AC-11). Required for override. */
  readonly editorialLog?: EditorialLogRepo;
  /** System signer for AC-11 editorial-log entries (source.access_override). */
  readonly systemSigner?: (currHash: CorpusHash) => Promise<Signature>;
}

/** Read the principal from the verified request (SEC-1). */
function principalOf(request: FastifyRequest): ResolvedPrincipal | undefined {
  return (request as unknown as { principal?: ResolvedPrincipal }).principal;
}

/** Require a principal sub after scope enforcement; reject with 401 if missing. */
function requirePrincipalSub(request: FastifyRequest, reply: FastifyReply): string | null {
  const principal = principalOf(request);
  if (principal?.sub === undefined || principal.sub === '') {
    sendError(reply, 401, 'unauthorized', 'Principal identity is missing');
    return null;
  }
  return principal.sub;
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

// ─────────────────────────────────────────────────────────────────────────────
// Default lawful-access signal fetcher (Story 3.2)
// ─────────────────────────────────────────────────────────────────────────────

/**
 * AC-1 standard fetch timeout (10s).
 */
const LAWFUL_ACCESS_TIMEOUT_MS = 10_000;

/**
 * Paywall/login/CAPTCHA detection heuristics (AC-1). These are conservative
 * substring/regex scans of the raw HTML + script tags. Story 3.3's fetch
 * adapter may replace this with a richer detection layer; this default makes
 * the endpoint functional without Story 3.3.
 *
 * The patterns are deliberately broad (case-insensitive) to fail toward
 * "detected" — a false positive disables crawling (safe); a false negative
 * crawls an unlawful source (unsafe). Fail-closed per SEC-5.
 */
const PAYWALL_PATTERNS = [/piano/i, /paywall/i, /subscription[-_ ]?block/i, /metered[-_ ]?content/i, /ncmeter/i];
const LOGIN_FORM_PATTERN = /<input[^>]+type=["']password["']/i;
const CAPTCHA_PATTERNS = [
  /cloudflare\.com\/turnstile/i,
  /challenges\.cloudflare\.com/i,
  /recaptcha/i,
  /www\.google\.com\/recaptcha/i,
  /datadome\.co/i,
  /js\.datadome\.co/i,
];

/**
 * Exported for direct unit testing (the detection heuristics are behavioral
 * logic, not documentation — their mutants must be killed).
 */
export function detectPaywall(html: string): boolean {
  return PAYWALL_PATTERNS.some((re) => re.test(html));
}

export function detectLoginForm(html: string): boolean {
  return LOGIN_FORM_PATTERN.test(html);
}

export function detectCaptcha(html: string): boolean {
  return CAPTCHA_PATTERNS.some((re) => re.test(html));
}

/**
 * Derive the robots.txt URL for a source URL. The robots.txt lives at the
 * origin root: `https://example.com/path/feed → https://example.com/robots.txt`.
 */
/**
 * Exported for direct unit testing (behavioral logic).
 */
export function robotsTxtUrlFor(sourceUrl: string): string | null {
  try {
    const u = new URL(sourceUrl);
    return `${u.origin}/robots.txt`;
  } catch {
    return null;
  }
}

/**
 * Parse a robots.txt body to determine whether `User-Agent: *` is allowed to
 * crawl. A conservative parser: scans the last-matching `User-agent: *` group
 * and checks for a `Disallow: /` (or `Disallow:` with the source path).
 *
 * Returns `{ allowed, crawlDelayMs }`. When the body is empty or has no
 * `User-agent: *` group, crawlers are allowed by default (empty robots.txt =
 * allow all). `crawlDelayMs` is the parsed `Crawl-delay` for `*` (null if
 * absent or non-numeric).
 *
 * Exported for direct unit testing (the robots parser is behavioral logic, not
 * documentation — its mutants must be killed).
 */
export function parseRobotsTxt(body: string, sourcePath: string): { allowed: boolean; crawlDelayMs: number | null } {
  const lines = body.split('\n');
  let inStarGroup = false;
  let starDisallowRoot = false; // explicit `Disallow: /`
  let starDisallowPath = false; // explicit `Disallow: <sourcePath>`
  let crawlDelay: number | null = null;
  for (const rawLine of lines) {
    const line = rawLine.split('#')[0]?.trim() ?? '';
    if (line === '') continue;
    const colonIdx = line.indexOf(':');
    if (colonIdx === -1) continue;
    const field = line.slice(0, colonIdx).trim().toLowerCase();
    const value = line.slice(colonIdx + 1).trim();
    if (field === 'user-agent') {
      inStarGroup = value === '*';
    } else if (inStarGroup) {
      if (field === 'disallow') {
        if (value === '/') starDisallowRoot = true;
        else if (value !== '' && sourcePath.startsWith(value)) starDisallowPath = true;
      } else if (field === 'allow') {
        if (value === '/' || (value !== '' && sourcePath.startsWith(value))) {
          starDisallowRoot = false;
          starDisallowPath = false;
        }
      } else if (field === 'crawl-delay') {
        const n = Number(value);
        if (Number.isFinite(n) && n >= 0) crawlDelay = n * 1000;
      }
    }
  }
  const allowed = !starDisallowRoot && !starDisallowPath;
  return { allowed, crawlDelayMs: crawlDelay };
}

/**
 * Create the default lawful-access signal fetcher (Story 3.2). Fetches the
 * source's `/robots.txt` + landing page, applies heuristic detection, and
 * returns the signals the pure gate consumes.
 *
 * An unreachable robots.txt (timeout/DNS/connection-refused) yields
 * `robotsStatus: 'unreachable'` + `robotsAllowed: false` (AC-7 fail-closed).
 * A landing-page fetch failure yields false-negative-free defaults (all scan
 * booleans false) — the robots.txt outcome remains the authoritative signal.
 *
 * @rules FR-1.2, AC-1, AC-7
 */
export function createDefaultSignalFetcher(
  fetchImpl: typeof fetch = fetch,
): LawfulAccessSignalFetcher {
  return async (url: string, timeoutMs: number): Promise<LawfulAccessSignals> => {
    const robotsUrl = robotsTxtUrlFor(url);
    let robotsStatus: 'allowed' | 'disallowed' | 'unreachable' = 'unreachable';
    let robotsAllowed = false;
    let robotsCrawlDelayMs: number | null = null;
    let robotsTxtContent: string | null = null;

    if (robotsUrl !== null) {
      try {
        const resp = await fetchImpl(robotsUrl, {
          signal: AbortSignal.timeout(timeoutMs),
          redirect: 'follow',
        });
        if (resp.ok) {
          robotsTxtContent = await resp.text();
          let sourcePath = '/';
          try {
            sourcePath = new URL(url).pathname;
          } catch {
            // keep default '/'
          }
          const parsed = parseRobotsTxt(robotsTxtContent, sourcePath);
          robotsAllowed = parsed.allowed;
          robotsCrawlDelayMs = parsed.crawlDelayMs;
          robotsStatus = parsed.allowed ? 'allowed' : 'disallowed';
        } else {
          // Non-2xx robots.txt — treat as unreachable (fail-closed, AC-7).
          robotsStatus = 'unreachable';
          robotsAllowed = false;
        }
      } catch {
        // Timeout / DNS / connection refused → unreachable (AC-7 fail-closed).
        robotsStatus = 'unreachable';
        robotsAllowed = false;
      }
    }

    // Fetch the landing page for paywall/login/CAPTCHA heuristics. A fetch
    // failure here does NOT change the robots outcome; the scan booleans
    // default to false (robots remains the authoritative signal).
    let paywallDetected = false;
    let loginRequired = false;
    let captchaRequired = false;
    try {
      const pageResp = await fetchImpl(url, {
        signal: AbortSignal.timeout(timeoutMs),
        redirect: 'follow',
      });
      if (pageResp.ok) {
        const html = await pageResp.text();
        paywallDetected = detectPaywall(html);
        loginRequired = detectLoginForm(html);
        captchaRequired = detectCaptcha(html);
      }
    } catch {
      // Landing-page fetch failed — scan signals stay false. The robots outcome
      // (likely unreachable → blocked) governs the decision.
    }

    return {
      robotsStatus,
      robotsAllowed,
      robotsCrawlDelayMs,
      robotsTxtContent,
      paywallDetected,
      loginRequired,
      captchaRequired,
    };
  };
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
              lawful_access_status: { type: 'string', enum: ['pending', 'allowed', 'blocked'] },
              crawling_disabled: { type: 'boolean' },
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
              terms_forbid_scraping: { type: 'boolean' },
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

    // ── Story 3.2 — Lawful-access gate endpoints (FR-1.2) ────────────────
    //
    // The fetcher is resolved once: an injected fetcher (tests) or the default
    // fetch+scan implementation (prod without Story 3.3). The pure gate
    // (`assessLawfulAccess`) decides from the fetched signals; the repo persists.
    const fetchSignals: LawfulAccessSignalFetcher =
      deps.fetchSignals ?? createDefaultSignalFetcher();

    // ── POST /sources/:id/lawful-access/check — automated check (AC-1, AC-5, AC-6, AC-7) ──
    app.post(
      '/sources/:id/lawful-access/check',
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
        const denied = enforceScope(principalOf(request), ['sources:write'], reply);
        if (denied !== null) return denied;

        const params = request.params as { id: string };
        const idParse = SourceIdSchema.safeParse(params.id);
        if (!idParse.success) {
          return sendError(reply, 404, 'not_found', 'Source not found');
        }

        const source = await deps.repo.findById(idParse.data);
        if (source === null) {
          return sendError(reply, 404, 'not_found', 'Source not found');
        }

        // AC-6 — manual crawl strategy: the check is not applicable.
        if (source.crawl_strategy === 'manual') {
          return sendError(
            reply,
            400,
            'bad_request',
            'Lawful-access check not applicable for manual crawl strategy',
          );
        }

        // Fetch the detection signals (AC-1). Story 3.3 owns the rich fetch
        // adapter; the default makes the endpoint functional without it.
        const signals = await fetchSignals(source.url, LAWFUL_ACCESS_TIMEOUT_MS);

        // Build the pure-gate input from the fetched signals + the persisted
        // ToS flag (AC-1 — manual operator flag, NOT auto-detected).
        const gateInput: LawfulAccessInput = {
          robotsCheck: { allowed: signals.robotsAllowed, crawlDelayMs: signals.robotsCrawlDelayMs },
          paywallDetected: signals.paywallDetected,
          loginRequired: signals.loginRequired,
          captchaRequired: signals.captchaRequired,
          tosForbidden: source.terms_forbid_scraping,
        };
        const decision = assessLawfulAccess(gateInput);

        // Build the persisted check result (AC-1).
        const result: LawfulAccessCheckResult = {
          robots_status: signals.robotsStatus,
          paywall_detected: signals.paywallDetected,
          login_required: signals.loginRequired,
          captcha_detected: signals.captchaRequired,
          terms_forbid_scraping: source.terms_forbid_scraping,
          robots_txt_content: signals.robotsTxtContent,
          recorded_at: decision.recordedAt.toISOString(),
        };
        const status = decision.decision === 'allowed' ? 'allowed' : 'blocked';

        try {
          const saved = await deps.repo.saveLawfulAccessCheckResult(
            idParse.data,
            result,
            status,
          );
          if (saved === null) {
            return sendError(reply, 404, 'not_found', 'Source not found');
          }
          return reply.send(saved);
        } catch (err) {
          return handleRepoError(reply, err, deps.repo, source.url);
        }
      },
    );

    // ── POST /sources/:id/lawful-access/confirm — operator confirmation (AC-3, AC-5) ──
    app.post(
      '/sources/:id/lawful-access/confirm',
      {
        schema: {
          params: {
            type: 'object',
            required: ['id'],
            properties: { id: { type: 'string' } },
          },
          body: {
            type: 'object',
            required: ['confirmed'],
            properties: {
              confirmed: { type: 'boolean' },
              rationale: { type: 'string' },
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

        const parsed = ConfirmLawfulAccessPayloadSchema.safeParse(request.body);
        if (!parsed.success) {
          return sendError(reply, 400, 'bad_request', 'Invalid lawful-access confirmation payload', {
            issues: parsed.error.issues,
          });
        }

        const source = await deps.repo.findById(idParse.data);
        if (source === null) {
          return sendError(reply, 404, 'not_found', 'Source not found');
        }

        // AC-3 — confirming a blocked source is rejected with 409. Confirmation
        // is not a backdoor; blocked sources must go through the override (AC-4).
        if (parsed.data.confirmed && source.lawful_access_status === 'blocked') {
          return sendError(
            reply,
            409,
            'conflict',
            'Cannot confirm a blocked source; use the override endpoint to bypass the block',
          );
        }

        const operatorSub = requirePrincipalSub(request, reply);
        if (operatorSub === null) return reply;
        try {
          const saved = await deps.repo.confirmLawfulAccess(
            idParse.data,
            parsed.data.confirmed,
            parsed.data.rationale ?? null,
            operatorSub,
          );
          if (saved === null) {
            return sendError(reply, 404, 'not_found', 'Source not found');
          }
          return reply.send(saved);
        } catch (err) {
          return handleRepoError(reply, err, deps.repo, source.url);
        }
      },
    );

    // ── POST /sources/:id/lawful-access/override — manual override (AC-4, AC-5, AC-8, AC-11) ──
    app.post(
      '/sources/:id/lawful-access/override',
      {
        schema: {
          params: {
            type: 'object',
            required: ['id'],
            properties: { id: { type: 'string' } },
          },
          body: {
            type: 'object',
            required: ['rationale'],
            properties: {
              rationale: { type: 'string' },
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

        const parsed = OverrideLawfulAccessPayloadSchema.safeParse(request.body);
        if (!parsed.success) {
          return sendError(reply, 400, 'bad_request', 'Invalid lawful-access override payload', {
            issues: parsed.error.issues,
          });
        }

        const source = await deps.repo.findById(idParse.data);
        if (source === null) {
          return sendError(reply, 404, 'not_found', 'Source not found');
        }

        // AC-4 — override requires the source has been checked.
        if (source.lawful_access_checked_at === null) {
          return sendError(
            reply,
            400,
            'bad_request',
            'Override requires a completed lawful-access check',
          );
        }

        // AC-8 — override is only applicable to blocked (disabled) sources.
        if (source.lawful_access_status === 'allowed' && !source.crawling_disabled) {
          return sendError(
            reply,
            400,
            'bad_request',
            'Override is only applicable to blocked sources',
          );
        }

        // Pure gate: validate the justification + build the editorial-log entry.
        const override = overrideDisable(idParse.data, {
          justification: parsed.data.rationale,
          url: source.url,
        });
        if (!override.ok) {
          // Empty/whitespace rationale — already caught by the zod schema
          // (.min(1)), but the pure gate is the second line of defense.
          return sendError(reply, 400, 'bad_request', 'Override rationale must be non-empty');
        }

        const operatorSub = requirePrincipalSub(request, reply);
        if (operatorSub === null) return reply;
        try {
          const saved = await deps.repo.overrideLawfulAccess(
            idParse.data,
            parsed.data.rationale,
            operatorSub,
          );
          if (saved === null) {
            return sendError(reply, 404, 'not_found', 'Source not found');
          }

          // AC-11 — append the Ed25519-signed editorial-log entry under
          // __system__. Fire-and-forget would lose the audit trail on crash;
          // await so a signing/append failure surfaces (the override still
          // persisted, but the audit gap is logged).
          if (deps.editorialLog !== undefined && deps.systemSigner !== undefined) {
            try {
              await deps.editorialLog.appendToPartition({
                partitionKey: '__system__',
                principalSub: operatorSub,
                event: 'source.access_override',
                jti: crypto.randomUUID(),
                payload: override.editorialLogEntry.payload,
                getSignature: deps.systemSigner,
              });
            } catch (logErr) {
              // The override persisted; a broken editorial log must not undo it.
              // Log via pino (Fastify logger) for structured observability.
              request.log.error(
                {
                  source_id: idParse.data,
                  error: logErr instanceof Error ? logErr.message : String(logErr),
                },
                'editorial log append failed for source.access_override',
              );
            }
          }

          return reply.send(saved);
        } catch (err) {
          return handleRepoError(reply, err, deps.repo, source.url);
        }
      },
    );
  };
}
