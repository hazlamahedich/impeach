/**
 * Fastify middleware — verifyMiddleware plugin (SEC-1).
 *
 * Extracts the `Bearer` token from the `Authorization` header, verifies
 * it via `verifyJwt`, and decorates the request with `req.principal`.
 *
 * Handlers read ONLY `req.principal` (never `req.auth`) — enforced by
 * ESLint `no-restricted-syntax` (DoD-1) and branded types.
 *
 * @rules SEC-1, DoD-1
 * @adr ADR-0001
 */
import type { FastifyInstance, FastifyRequest, FastifyReply } from 'fastify';
import { AuthError } from './verify.js';
import type { ResolvedPrincipal } from './verify.js';

declare module 'fastify' {
  interface FastifyRequest {
    principal?: ResolvedPrincipal;
  }
}

export interface MiddlewareConfig {
  readonly verifyJwt: (token: string) => Promise<ResolvedPrincipal>;
}

/**
 * Fastify plugin that adds JWT verification to the request lifecycle.
 *
 * On success: `req.principal` is populated.
 * On failure: 401 response with `{ error: { code, message } }` (no stack traces).
 *
 * @rules SEC-1, DoD-1
 * @adr ADR-0001
 */
export function createVerifyMiddleware(config: MiddlewareConfig) {
  return async function verifyMiddleware(
    app: FastifyInstance,
  ): Promise<void> {
    app.addHook('onRequest', async (req: FastifyRequest, reply: FastifyReply) => {
      const authHeader = req.headers.authorization;

      if (authHeader === undefined || authHeader === '') {
        return reply.code(401).send({
          error: { code: 'unauthorized', message: 'missing Authorization header' },
        });
      }

      const parts = authHeader.trim().split(/\s+/);
      if (parts.length !== 2 || (parts[0] ?? '').toLowerCase() !== 'bearer') {
        return reply.code(401).send({
          error: {
            code: 'unauthorized',
            message: 'malformed Authorization header — expected Bearer scheme',
          },
        });
      }

      const token = parts[1] ?? '';
      if (token === '') {
        return reply.code(401).send({
          error: { code: 'unauthorized', message: 'empty bearer token' },
        });
      }

      try {
        req.principal = await config.verifyJwt(token);
      } catch (err) {
        if (err instanceof AuthError) {
          return reply.code(401).send({
            error: { code: 'unauthorized', message: 'token verification failed' },
          });
        }
        throw err;
      }
    });
  };
}
