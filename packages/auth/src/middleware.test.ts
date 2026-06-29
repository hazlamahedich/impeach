/**
 * Unit tests for middleware.ts — Fastify verifyMiddleware (SEC-1, DoD-1).
 *
 * @rules SEC-1, DoD-1
 * @adr ADR-0001
 */
import { describe, it, expect } from 'vitest';
import Fastify from 'fastify';
import { createVerifyMiddleware, AuthError } from './index.js';

describe('verifyMiddleware — Fastify JWT verification', () => {
  it('returns 401 for missing Authorization header', async () => {
    const app = Fastify();
    await createVerifyMiddleware({
      verifyJwt: async () => { throw new AuthError('no', 'auth.expired'); },
    })(app);
    app.get('/p', async () => 'ok');
    const res = await app.inject({ method: 'GET', url: '/p' });
    expect(res.statusCode).toBe(401);
  });

  it('returns 401 for malformed Authorization header', async () => {
    const app = Fastify();
    await createVerifyMiddleware({
      verifyJwt: async () => ({ sub: 's', iss: 'i', kid: 'k', scope: ['read'], jti: 'j', iat: 1 } as unknown as import('@iip/auth').ResolvedPrincipal),
    })(app);
    app.get('/p', async () => 'ok');
    const res = await app.inject({ method: 'GET', url: '/p', headers: { authorization: 'Basic dXNlcjpwYXNz' } });
    expect(res.statusCode).toBe(401);
  });

  it('accepts lowercase bearer scheme and tab-separated token', async () => {
    const app = Fastify();
    const principal = { sub: 's', iss: 'i', kid: 'k', scope: ['read' as const], jti: 'j', iat: 1 } as unknown as import('@iip/auth').ResolvedPrincipal;
    await createVerifyMiddleware({ verifyJwt: async () => principal })(app);
    app.get('/p', async (req) => req.principal?.sub ?? 'none');
    const res = await app.inject({ method: 'GET', url: '/p', headers: { authorization: 'bearer\ttoken' } });
    expect(res.statusCode).toBe(200);
    expect(res.body).toBe('s');
  });

  it('returns 401 for AuthError from verifyJwt', async () => {
    const app = Fastify();
    await createVerifyMiddleware({
      verifyJwt: async () => { throw new AuthError('no', 'auth.expired'); },
    })(app);
    app.get('/p', async () => 'ok');
    const res = await app.inject({ method: 'GET', url: '/p', headers: { authorization: 'Bearer t' } });
    expect(res.statusCode).toBe(401);
  });

  it('propagates non-AuthError throws from verifyJwt', async () => {
    const app = Fastify();
    await createVerifyMiddleware({
      verifyJwt: async () => { throw new Error('boom'); },
    })(app);
    app.get('/p', async () => 'ok');
    app.setErrorHandler(async (err: Error, request, reply) => {
      await reply.code(500).send({ error: err.message });
    });
    const res = await app.inject({ method: 'GET', url: '/p', headers: { authorization: 'Bearer t' } });
    expect(res.statusCode).toBe(500);
    expect(res.json().error).toContain('boom');
  });
});
