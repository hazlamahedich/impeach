/**
 * Unit tests for verify.ts — the Stryker mutation-killing suite (SEC-8).
 *
 * These tests exercise every branch of verifyJwt with precise assertions
 * on error codes, logger calls, and edge cases so Stryker achieves 100%
 * mutation score on verify.ts.
 *
 * @rules SEC-1, SEC-8
 * @adr ADR-0001
 */
import { describe, it, expect, beforeEach } from 'vitest';
import { generateKeyPair, SignJWT } from 'jose';
import type { JWTHeaderParameters } from 'jose';
import {
  PrincipalSchema as ContractPrincipalSchema,
  JtiSchema,
  IssuerSchema,
  KidSchema,
} from '@iip/contracts';
import {
  createVerifyJwt,
  PrincipalSchema,
  AuthError,
  requireScope,
  InMemoryReplayDetector,
} from './index.js';
import type {
  KeyRegistry,
  RevocationChecker,
  ResolvedPrincipal,
} from './verify.js';
import type { AuthEventLogger } from './event-logger.js';

const brandPrincipal = (s: string) => ContractPrincipalSchema.parse(s);
const brandIssuer = (s: string) => IssuerSchema.parse(s);
const brandKid = (s: string) => KidSchema.parse(s);
const brandJti = (s: string) => JtiSchema.parse(s);

// ─────────────────────────────────────────────────────────────────────────
// Recording event logger — captures all calls for assertion
// ─────────────────────────────────────────────────────────────────────────

interface LogCall {
  method: string;
  args: unknown[];
}

function makeRecordingLogger(): AuthEventLogger & { calls: LogCall[] } {
  const calls: LogCall[] = [];
  return {
    calls,
    revoked(...args: unknown[]) { calls.push({ method: 'revoked', args }); },
    expired(...args: unknown[]) { calls.push({ method: 'expired', args }); },
    invalidSignature(...args: unknown[]) { calls.push({ method: 'invalidSignature', args }); },
    missingKid(...args: unknown[]) { calls.push({ method: 'missingKid', args }); },
    insufficientScope(...args: unknown[]) { calls.push({ method: 'insufficientScope', args }); },
    replay(...args: unknown[]) { calls.push({ method: 'replay', args }); },
  };
}

// ─────────────────────────────────────────────────────────────────────────
// Test fixtures
// ─────────────────────────────────────────────────────────────────────────

interface TestKey {
  kid: string;
  privateKey: CryptoKey;
  publicKey: CryptoKey;
}

let testKey: TestKey;
let otherKey: TestKey;
let logger: ReturnType<typeof makeRecordingLogger>;

beforeEach(async () => {
  const pair1 = await generateKeyPair('Ed25519', { extractable: true });
  const pair2 = await generateKeyPair('Ed25519', { extractable: true });
  testKey = { kid: 'test-key-1', privateKey: pair1.privateKey, publicKey: pair1.publicKey };
  otherKey = { kid: 'test-key-2', privateKey: pair2.privateKey, publicKey: pair2.publicKey };
  logger = makeRecordingLogger();
});

function makeKeyRegistry(keys: TestKey[]): KeyRegistry {
  const map = new Map<string, CryptoKey>();
  for (const k of keys) {
    map.set(k.kid, k.publicKey);
  }
  return {
    get(kid: string): { kid: string; publicKey: CryptoKey } | undefined {
      const publicKey = map.get(kid);
      if (publicKey === undefined) return undefined;
      return { kid, publicKey };
    },
  };
}

function makeRevocationChecker(revokedJtis: Set<string>): RevocationChecker {
  return {
    isRevoked(jti: string): boolean {
      return revokedJtis.has(jti);
    },
  };
}

async function signTestToken(opts: {
  kid?: string;
  key?: TestKey;
  sub?: string;
  iss?: string;
  scope?: string[];
  expOffsetSec?: number;
  iatOffsetSec?: number;
  jti?: string;
  alg?: string;
  omitIat?: boolean;
  omitExp?: boolean;
  omitJti?: boolean;
}): Promise<string> {
  const key = opts.key ?? testKey;
  const kid = opts.kid ?? key.kid;
  const now = Math.floor(Date.now() / 1000);
  const iat = now + (opts.iatOffsetSec ?? 0);
  const exp = iat + (opts.expOffsetSec ?? 3600);

  const header: JWTHeaderParameters = { alg: opts.alg ?? 'EdDSA', kid };
  const payload: Record<string, unknown> = {
    sub: opts.sub ?? 'operator-001',
    iss: opts.iss ?? 'iip-issuer',
    scope: opts.scope ?? ['read'],
  };

  let token = new SignJWT(payload).setProtectedHeader(header);
  if (!opts.omitIat) token = token.setIssuedAt(iat);
  if (!opts.omitExp) token = token.setExpirationTime(exp);
  token = (opts.omitJti ? token : token.setJti(opts.jti ?? crypto.randomUUID()));

  return token.sign(key.privateKey);
}

function makeVerifyJwt(overrides?: {
  replayDetector?: InMemoryReplayDetector;
  revocationChecker?: RevocationChecker;
  clockSkewSeconds?: number;
  eventLogger?: AuthEventLogger;
}): (token: string) => Promise<ResolvedPrincipal> {
  if (overrides?.clockSkewSeconds !== undefined) {
    return createVerifyJwt({
      keyRegistry: makeKeyRegistry([testKey, otherKey]),
      replayDetector: overrides.replayDetector ?? new InMemoryReplayDetector(),
      eventLogger: overrides.eventLogger ?? logger,
      revocationChecker: overrides.revocationChecker ?? makeRevocationChecker(new Set()),
      clockSkewSeconds: overrides.clockSkewSeconds,
    });
  }
  return createVerifyJwt({
    keyRegistry: makeKeyRegistry([testKey, otherKey]),
    replayDetector: overrides?.replayDetector ?? new InMemoryReplayDetector(),
    eventLogger: overrides?.eventLogger ?? logger,
    revocationChecker: overrides?.revocationChecker ?? makeRevocationChecker(new Set()),
  });
}

async function expectAuthError(promise: Promise<unknown>, code: string): Promise<AuthError> {
  try {
    await promise;
    throw new Error('expected promise to reject');
  } catch (err) {
    if (err instanceof AuthError) {
      expect(err.code).toBe(code);
      return err;
    }
    // jose errors propagate directly for some edge cases
    throw err;
  }
}

// ─────────────────────────────────────────────────────────────────────────
// Tests
// ─────────────────────────────────────────────────────────────────────────

describe('verifyJwt — SEC-1 JWT verification', () => {

  it('valid JWT resolves to principal with all fields', async () => {
    const verifyJwt = makeVerifyJwt();
    const principal = await verifyJwt(await signTestToken({ scope: ['read', 'write'] }));
    expect(principal.sub).toBe('operator-001');
    expect(principal.iss).toBe('iip-issuer');
    expect(principal.kid).toBe('test-key-1');
    expect(principal.scope).toEqual(['read', 'write']);
    expect(principal.jti).toBeTruthy();
    expect(principal.iat).toBeGreaterThan(0);
  });

  it('expired JWT throws auth.expired + logs expired event', async () => {
    const verifyJwt = makeVerifyJwt();
    await expectAuthError(verifyJwt(await signTestToken({ expOffsetSec: -60 })), 'auth.expired');
    expect(logger.calls.some((c: LogCall) => c.method === 'expired')).toBe(true);
  });

  it('lifetime exceeds 1h ceiling throws auth.expired', async () => {
    const verifyJwt = makeVerifyJwt();
    const err = await expectAuthError(verifyJwt(await signTestToken({ expOffsetSec: 7200 })), 'auth.expired');
    expect(err.message).toContain('exceeds');
  });

  it('missing kid throws auth.missing_kid + logs missingKid', async () => {
    const verifyJwt = makeVerifyJwt();
    const now = Math.floor(Date.now() / 1000);
    const token = await new SignJWT({ sub: 'op1', iss: 'iip', scope: ['read'] })
      .setProtectedHeader({ alg: 'EdDSA' })
      .setIssuedAt(now)
      .setExpirationTime(now + 3600)
      .setJti(crypto.randomUUID())
      .sign(testKey.privateKey);
    await expectAuthError(verifyJwt(token), 'auth.missing_kid');
    expect(logger.calls.some((c: LogCall) => c.method === 'missingKid')).toBe(true);
  });

  it('replayed jti throws auth.replay + logs replay', async () => {
    const replayDetector = new InMemoryReplayDetector();
    const verifyJwt = makeVerifyJwt({ replayDetector });
    const jti = crypto.randomUUID();
    const token = await signTestToken({ jti, sub: 'replay-sub', iss: 'replay-iss', scope: ['read', 'write'] });
    await verifyJwt(token);
    await expectAuthError(verifyJwt(token), 'auth.replay');
    const replayCall = logger.calls.find((c: LogCall) => c.method === 'replay');
    expect(replayCall).toBeDefined();
    const info = replayCall!.args[0] as { sub: string; iss: string; kid: string; jti: string; scope: string[] };
    expect(info.sub).toBe('replay-sub');
    expect(info.iss).toBe('replay-iss');
    expect(info.kid).toBe('test-key-1');
    expect(info.jti).toBe(jti);
    expect(info.scope).toEqual(['read', 'write']);
  });

  it('revoked jti throws auth.revoked + logs revoked with full info', async () => {
    const jti = crypto.randomUUID();
    const verifyJwt = makeVerifyJwt({ revocationChecker: makeRevocationChecker(new Set([jti])) });
    const err = await expectAuthError(verifyJwt(await signTestToken({ jti, sub: 'rev-sub', iss: 'rev-iss' })), 'auth.revoked');
    expect(err.message).toContain('revoked');
    const revokedCall = logger.calls.find((c: LogCall) => c.method === 'revoked');
    expect(revokedCall).toBeDefined();
    const info = revokedCall!.args[0] as { sub: string; iss: string; kid: string; jti: string };
    expect(info.sub).toBe('rev-sub');
    expect(info.iss).toBe('rev-iss');
    expect(info.kid).toBe('test-key-1');
    expect(info.jti).toBe(jti);
    expect(revokedCall!.args[1]).toBe('administratively revoked');
  });

  it('insufficient scope throws auth.insufficient_scope', () => {
    const principal: ResolvedPrincipal = {
      sub: brandPrincipal('op1'),
      iss: brandIssuer('iip'),
      kid: brandKid('k1'),
      scope: ['read'],
      jti: brandJti('j1'),
      iat: 1234567890,
    };
    expect(() => requireScope(principal, ['admin'])).toThrow(AuthError);
    const err = (() => {
      try { requireScope(principal, ['admin']); throw new Error('no throw'); }
      catch (e) { return e as AuthError; }
    })();
    expect(err.code).toBe('auth.insufficient_scope');
    expect(err.message).toContain('admin');
    expect(err.message).toContain('read');
  });

  it('requireScope: multi-scope message has comma separator', () => {
    const principal: ResolvedPrincipal = {
      sub: brandPrincipal('op1'),
      iss: brandIssuer('iip'),
      kid: brandKid('k1'),
      scope: ['read'],
      jti: brandJti('j1'),
      iat: 1234567890,
    };
    const err = (() => {
      try { requireScope(principal, ['write', 'admin']); throw new Error('no throw'); }
      catch (e) { return e as AuthError; }
    })();
    // Kill the join(', ') separator mutant — check exact comma-separated format in required-clause
    expect(err.message).toContain('[write, admin]');
    expect(err.message).toContain('[read]');
  });

  it('requireScope: principal with multiple scopes shows comma in got-clause', () => {
    const principal: ResolvedPrincipal = {
      sub: brandPrincipal('op1'),
      iss: brandIssuer('iip'),
      kid: brandKid('k1'),
      scope: ['read', 'write'],
      jti: brandJti('j1'),
      iat: 1234567890,
    };
    const err = (() => {
      try { requireScope(principal, ['admin']); throw new Error('no throw'); }
      catch (e) { return e as AuthError; }
    })();
    // Kill the second join(', ') mutant — got-clause must have comma between scopes
    expect(err.message).toContain('read, write');
  });

  it('requireScope: every→some mutant killed (partial scope fails)', () => {
    const principal: ResolvedPrincipal = {
      sub: brandPrincipal('op1'),
      iss: brandIssuer('iip'),
      kid: brandKid('k1'),
      scope: ['read'],
      jti: brandJti('j1'),
      iat: 1234567890,
    };
    // Has 'read' but not 'write' — every() returns false, some() would return true
    expect(() => requireScope(principal, ['read', 'write'])).toThrow(AuthError);
  });

  it('requireScope passes when all required scopes present', () => {
    const principal: ResolvedPrincipal = {
      sub: brandPrincipal('op1'),
      iss: brandIssuer('iip'),
      kid: brandKid('k1'),
      scope: ['read', 'admin'],
      jti: brandJti('j1'),
      iat: 1234567890,
    };
    expect(() => requireScope(principal, ['admin'])).not.toThrow();
    expect(() => requireScope(principal, ['read', 'admin'])).not.toThrow();
  });

  it('unsigned/alg=none throws auth.invalid_signature + logs invalidSignature', async () => {
    const verifyJwt = makeVerifyJwt();
    const header = Buffer.from(JSON.stringify({ alg: 'none', kid: 'test-key-1' })).toString('base64url');
    const now = Math.floor(Date.now() / 1000);
    const payload = Buffer.from(JSON.stringify({
      sub: 'op1', iss: 'iip', scope: ['read'],
      iat: now, exp: now + 3600, jti: crypto.randomUUID(),
    })).toString('base64url');
    await expectAuthError(verifyJwt(`${header}.${payload}.`), 'auth.invalid_signature');
    expect(logger.calls.some((c: LogCall) => c.method === 'invalidSignature')).toBe(true);
  });

  it('PrincipalSchema has no defaults — empty fails', () => {
    expect(PrincipalSchema.safeParse({}).success).toBe(false);
  });

  it('PrincipalSchema fails on missing fields individually', () => {
    const base = {
      sub: brandPrincipal('p1'),
      iss: brandIssuer('i1'),
      kid: brandKid('k1'),
      scope: ['read' as const],
      jti: brandJti('j1'),
      iat: 1234567890,
    };
    expect(PrincipalSchema.safeParse({ ...base, sub: undefined }).success).toBe(false);
    expect(PrincipalSchema.safeParse({ ...base, iss: undefined }).success).toBe(false);
    expect(PrincipalSchema.safeParse({ ...base, kid: undefined }).success).toBe(false);
    expect(PrincipalSchema.safeParse({ ...base, jti: undefined }).success).toBe(false);
    expect(PrincipalSchema.safeParse({ ...base, iat: undefined }).success).toBe(false);
    expect(PrincipalSchema.safeParse({ ...base, scope: undefined }).success).toBe(false);
    expect(PrincipalSchema.safeParse(base).success).toBe(true);
  });

  it('signature mismatch throws auth.invalid_signature + logs', async () => {
    const verifyJwt = makeVerifyJwt();
    const token = await signTestToken({ key: otherKey, kid: 'test-key-1' });
    await expectAuthError(verifyJwt(token), 'auth.invalid_signature');
    expect(logger.calls.some((c: LogCall) => c.method === 'invalidSignature')).toBe(true);
  });

  it('algorithm confusion HS256 throws auth.invalid_signature', async () => {
    const verifyJwt = makeVerifyJwt();
    const now = Math.floor(Date.now() / 1000);
    const header = Buffer.from(JSON.stringify({ alg: 'HS256', kid: 'test-key-1' })).toString('base64url');
    const payload = Buffer.from(JSON.stringify({
      sub: 'op1', iss: 'iip', scope: ['read'],
      iat: now, exp: now + 3600, jti: crypto.randomUUID(),
    })).toString('base64url');
    await expectAuthError(verifyJwt(`${header}.${payload}.fake`), 'auth.invalid_signature');
  });

  it('concurrent jti replay — exactly one succeeds', async () => {
    const replayDetector = new InMemoryReplayDetector();
    const verifyJwt = makeVerifyJwt({ replayDetector });
    const jti = crypto.randomUUID();
    const token = await signTestToken({ jti });
    const results = await Promise.allSettled([verifyJwt(token), verifyJwt(token)]);
    expect(results.filter((r) => r.status === 'fulfilled')).toHaveLength(1);
    expect(results.filter((r) => r.status === 'rejected')).toHaveLength(1);
  });

  it('clock skew tolerance — near-expiry resolves', async () => {
    const verifyJwt = makeVerifyJwt({ clockSkewSeconds: 30 });
    const principal = await verifyJwt(await signTestToken({ expOffsetSec: 1 }));
    expect(principal.sub).toBe('operator-001');
  });

  it('clockSkewSeconds default is 30 when not provided', async () => {
    // Create without clockSkewSeconds — default should be 30
    const verifyJwt = makeVerifyJwt();
    // Token expires in 5s — within 30s default skew, should pass
    const principal = await verifyJwt(await signTestToken({ expOffsetSec: 5 }));
    expect(principal).toBeTruthy();
  });

  it('clockSkewSeconds=0 — near-expiry within 0s skew but exp>now resolves', async () => {
    const verifyJwt = makeVerifyJwt({ clockSkewSeconds: 0 });
    // Token expires in 60s — with 0 skew, exp > now so still valid
    const principal = await verifyJwt(await signTestToken({ expOffsetSec: 60 }));
    expect(principal).toBeTruthy();
  });

  it('malformed JWT header throws auth.malformed', async () => {
    const verifyJwt = makeVerifyJwt();
    await expectAuthError(verifyJwt('not-a-jwt'), 'auth.malformed');
  });

  it('unknown kid throws auth.unknown_kid + logs invalidSignature', async () => {
    const verifyJwt = makeVerifyJwt();
    const token = await signTestToken({ kid: 'nonexistent-key' });
    await expectAuthError(verifyJwt(token), 'auth.unknown_kid');
    expect(logger.calls.some((c: LogCall) => c.method === 'invalidSignature')).toBe(true);
  });

  it('missing iat throws auth.malformed', async () => {
    const verifyJwt = makeVerifyJwt();
    const token = await signTestToken({ omitIat: true });
    await expectAuthError(verifyJwt(token), 'auth.malformed');
  });

  it('missing exp throws auth.malformed', async () => {
    const verifyJwt = makeVerifyJwt();
    const token = await signTestToken({ omitExp: true });
    await expectAuthError(verifyJwt(token), 'auth.malformed');
  });

  it('expired token logs expired with principal info from decoded payload', async () => {
    const verifyJwt = makeVerifyJwt();
    const sub = 'operator-xyz';
    const token = await signTestToken({ sub, expOffsetSec: -60, scope: ['read', 'admin'] });
    await expectAuthError(verifyJwt(token), 'auth.expired');
    const expiredCall = logger.calls.find((c: LogCall) => c.method === 'expired');
    expect(expiredCall).toBeDefined();
    const info = expiredCall!.args[0] as { sub: string; iss: string; kid: string; jti: string; scope: string[] };
    expect(info.sub).toBe(sub);
    expect(info.iss).toBe('iip-issuer');
    expect(info.kid).toBe('test-key-1');
    expect(info.scope).toEqual(['read', 'admin']);
  });

  it('AuthError name is AuthError', () => {
    const err = new AuthError('test', 'auth.malformed');
    expect(err.name).toBe('AuthError');
  });

  // ── Edge cases for Stryker 100% coverage ──

  it('missing alg header throws auth.invalid_signature with "missing" in message', async () => {
    const verifyJwt = makeVerifyJwt();
    // Token with no alg in header
    const header = Buffer.from(JSON.stringify({ kid: 'test-key-1' })).toString('base64url');
    const now = Math.floor(Date.now() / 1000);
    const payload = Buffer.from(JSON.stringify({
      sub: 'op1', iss: 'iip', scope: ['read'],
      iat: now, exp: now + 3600, jti: crypto.randomUUID(),
    })).toString('base64url');
    const err = await expectAuthError(verifyJwt(`${header}.${payload}.sig`), 'auth.invalid_signature');
    expect(err.message).toContain('missing');
  });

  it('empty kid string throws auth.missing_kid', async () => {
    const verifyJwt = makeVerifyJwt();
    const header = Buffer.from(JSON.stringify({ alg: 'EdDSA', kid: '' })).toString('base64url');
    const now = Math.floor(Date.now() / 1000);
    const payload = Buffer.from(JSON.stringify({
      sub: 'op1', iss: 'iip', scope: ['read'],
      iat: now, exp: now + 3600, jti: crypto.randomUUID(),
    })).toString('base64url');
    await expectAuthError(verifyJwt(`${header}.${payload}.sig`), 'auth.missing_kid');
  });

  it('schema parse failure (empty scope) throws auth.malformed', async () => {
    const verifyJwt = makeVerifyJwt();
    // Sign a valid token with an invalid scope (empty array — fails .min(1))
    const now = Math.floor(Date.now() / 1000);
    const token = await new SignJWT({ sub: 'op1', iss: 'iip', scope: [] })
      .setProtectedHeader({ alg: 'EdDSA', kid: 'test-key-1' })
      .setIssuedAt(now)
      .setExpirationTime(now + 3600)
      .setJti(crypto.randomUUID())
      .sign(testKey.privateKey);
    const err = await expectAuthError(verifyJwt(token), 'auth.malformed');
    expect(err.message).toContain('invalid principal claims');
  });

  it('default clockSkew (30s) accepts token expired by 5s', async () => {
    // This kills the ?? → && mutant and the jwtVerify options object mutant
    const verifyJwt = makeVerifyJwt(); // no clockSkewSeconds → defaults to 30
    // Token expired by 5s — within 30s default skew
    const principal = await verifyJwt(await signTestToken({ expOffsetSec: -5 }));
    expect(principal.sub).toBe('operator-001');
  });

  it('expired token with no claims logs unknown defaults', async () => {
    const verifyJwt = makeVerifyJwt();
    // Sign a minimal expired token with no sub/iss/jti/scope
    const now = Math.floor(Date.now() / 1000);
    const token = await new SignJWT({})
      .setProtectedHeader({ alg: 'EdDSA', kid: 'test-key-1' })
      .setIssuedAt(now)
      .setExpirationTime(now - 60) // expired
      .sign(testKey.privateKey);
    await expectAuthError(verifyJwt(token), 'auth.expired');
    const expiredCall = logger.calls.find((c: LogCall) => c.method === 'expired');
    expect(expiredCall).toBeDefined();
    const info = expiredCall!.args[0] as { sub: string; iss: string; jti: string; scope: unknown[] };
    expect(info.sub).toBe('<unknown>');
    expect(info.iss).toBe('<unknown>');
    expect(info.jti).toBe('<unknown>');
    expect(info.scope).toEqual([]);
  });

  it('malformed header error message contains "malformed"', async () => {
    const verifyJwt = makeVerifyJwt();
    const err = await expectAuthError(verifyJwt('garbage'), 'auth.malformed');
    expect(err.message).toContain('malformed');
  });

  it('missing kid error message contains "kid"', async () => {
    const verifyJwt = makeVerifyJwt();
    const now = Math.floor(Date.now() / 1000);
    const token = await new SignJWT({ sub: 'op1', iss: 'iip', scope: ['read'] })
      .setProtectedHeader({ alg: 'EdDSA' })
      .setIssuedAt(now)
      .setExpirationTime(now + 3600)
      .setJti(crypto.randomUUID())
      .sign(testKey.privateKey);
    const err = await expectAuthError(verifyJwt(token), 'auth.missing_kid');
    expect(err.message).toContain('kid');
  });

  it('unknown kid error message contains kid value', async () => {
    const verifyJwt = makeVerifyJwt();
    const token = await signTestToken({ kid: 'nonexistent-key' });
    const err = await expectAuthError(verifyJwt(token), 'auth.unknown_kid');
    expect(err.message).toContain('nonexistent-key');
  });

  it('expired error message contains "expired"', async () => {
    const verifyJwt = makeVerifyJwt();
    const err = await expectAuthError(
      verifyJwt(await signTestToken({ expOffsetSec: -60 })),
      'auth.expired',
    );
    expect(err.message).toContain('expired');
  });

  it('signature failure error message contains "signature"', async () => {
    const verifyJwt = makeVerifyJwt();
    const token = await signTestToken({ key: otherKey, kid: 'test-key-1' });
    const err = await expectAuthError(verifyJwt(token), 'auth.invalid_signature');
    expect(err.message).toContain('signature');
  });

  it('lifetime exceeded error message contains "exceeds"', async () => {
    const verifyJwt = makeVerifyJwt();
    const err = await expectAuthError(
      verifyJwt(await signTestToken({ expOffsetSec: 7200 })),
      'auth.expired',
    );
    expect(err.message).toContain('exceeds');
  });

  it('revoked error message contains jti', async () => {
    const jti = 'revoke-test-jti';
    const verifyJwt = makeVerifyJwt({ revocationChecker: makeRevocationChecker(new Set([jti])) });
    const err = await expectAuthError(verifyJwt(await signTestToken({ jti })), 'auth.revoked');
    expect(err.message).toContain(jti);
  });

  it('replay error message contains jti', async () => {
    const replayDetector = new InMemoryReplayDetector();
    const verifyJwt = makeVerifyJwt({ replayDetector });
    const jti = 'replay-test-jti';
    const token = await signTestToken({ jti });
    await verifyJwt(token);
    const err = await expectAuthError(verifyJwt(token), 'auth.replay');
    expect(err.message).toContain(jti);
  });

  it('missing iat error message contains "missing"', async () => {
    const verifyJwt = makeVerifyJwt();
    const token = await signTestToken({ omitIat: true });
    const err = await expectAuthError(verifyJwt(token), 'auth.malformed');
    // Distinguish from schema-parse-failure path: manual check says "missing"
    expect(err.message).toContain('missing');
  });
});
