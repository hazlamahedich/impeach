/**
 * Rate-limit plugin factory — per-IP throttling on query endpoints (NFR-S-3).
 *
 * Wraps `@fastify/rate-limit` (the application-layer enforcement ADR-0004
 * prescribes; proxy-layer `rate_limit` was deferred by Story 1.3). Shaped to
 * the project's API error envelope:
 *   `{ error: { code: 'rate_limited', message } }` with a `Retry-After` header.
 *
 * Callers register the returned plugin via `app.register(...)` (the plugin
 * handles its own `onRequest` encapsulation). The limiter keys on `request.ip`
 * (per-IP per NFR-S-3). For single-workstation v1 the in-memory store is
 * acceptable (matches the audit-health no-Redis precedent); a Redis store can
 * be wired for the multi-node exit without changing call sites.
 *
 * @rules NFR-S-3, ADR-0004
 */
import type { FastifyPluginAsync, FastifyReply, FastifyRequest } from 'fastify';
import fp from 'fastify-plugin';
import rateLimit from '@fastify/rate-limit';

export interface RateLimitConfig {
  /** Sliding window length in milliseconds. */
  readonly windowMs: number;
  /** Maximum requests per window per IP. */
  readonly max: number;
}

/**
 * Build a Fastify plugin that enforces per-IP rate limiting.
 *
 * On limit breach: `429 Too Many Requests` + `Retry-After: <seconds>` header
 * + body `{ error: { code: 'rate_limited', message } }` (the envelope code is
 * in the sanctioned set per project-context §API envelope).
 *
 * Wrapped with `fastify-plugin` so the `onRequest` hook + error handler are
 * applied at the PARENT instance scope — sibling route plugins registered via
 * `app.register(...)` then see the limiter. Without `fp`, Fastify encapsulates
 * the plugin in a child scope that doesn't reach the route handlers (the same
 * encapsulation gotcha `createVerifyMiddleware` avoids by being called directly
 * on `app`).
 *
 * @rules NFR-S-3, ADR-0004
 */
export function createRateLimitPlugin(config: RateLimitConfig): FastifyPluginAsync {
  const plugin: FastifyPluginAsync = async (app) => {
    await app.register(rateLimit, {
      max: config.max,
      timeWindow: `${config.windowMs}ms`,
      keyGenerator: (req: FastifyRequest) => req.ip,
      // Shape the 429 body to the project envelope. `@fastify/rate-limit`
      // sets the `Retry-After` response header automatically.
      errorResponseBuilder: (
        _req: FastifyRequest,
        context: { readonly max: number; readonly ttl: number },
      ) => ({
        statusCode: 429,
        error: 'Too Many Requests',
        message: `rate limit exceeded; retry later`,
        retryAfter: Math.ceil(context.ttl / 1000),
        // The project envelope shape (consumers read error.code):
        body: {
          error: {
            code: 'rate_limited',
            message: `rate limit exceeded; retry after ${Math.ceil(context.ttl / 1000)}s`,
          },
        },
      }),
      // Response enrichment — add standard rate-limit headers for clients.
      addHeaders: {
        'x-ratelimit-limit': true,
        'x-ratelimit-remaining': true,
        'x-ratelimit-reset': true,
        'retry-after': true,
      },
      // Use the shaped envelope on the actual reply.
      // `@fastify/rate-limit` sends `errorResponseBuilder()`'s return as the
      // JSON body, so we keep the project envelope as the top-level shape via
      // the `errorResponseBuilder` override below (Fastify sends the returned
      // object verbatim).
    });

    // `@fastify/rate-limit`'s default error path sends the built object. To
    // guarantee the `{ error: { code, message } }` envelope and the
    // `Retry-After` header on the 429 reply, install a scoped error handler
    // that re-shapes rate-limit errors. This runs only for rate-limit replies.
    app.setErrorHandler((err, _req: FastifyRequest, reply: FastifyReply) => {
      const statusCode = (err as { statusCode?: number }).statusCode;
      // `@fastify/rate-limit` throws a 429 error with statusCode === 429.
      if (statusCode === 429) {
        const headers = (err as { headers?: Record<string, unknown> }).headers;
        const retryAfterHeader = headers?.['retry-after'];
        const retryAfter = typeof retryAfterHeader === 'number'
          ? retryAfterHeader
          : Math.ceil(config.windowMs / 1000);
        return reply
          .code(429)
          .header('retry-after', String(retryAfter))
          .send({
            error: {
              code: 'rate_limited',
              message: 'rate limit exceeded; retry later',
            },
          });
      }
      // Non-rate-limit errors propagate to the default handler (re-throw).
      throw err;
    });
  };
  // Wrap with fastify-plugin so the hook + error handler apply at the parent
  // scope (sibling route plugins registered via app.register then see them).
  return fp(plugin, { name: '@iip/rate-limit' });
}
