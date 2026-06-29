/**
 * Integration tests — Story 2.2 Per-Issued JWT Authentication (SEC-1).
 *
 * 12 test cases covering: valid JWT, expired, missing kid, replayed jti,
 * revoked jti, insufficient scope, unsigned/alg=none, no-defaults schema,
 * signature mismatch, algorithm confusion, concurrent replay, clock skew.
 *
 * @rules SEC-1, AC-11, SEC-8
 * @adr ADR-0001
 */
import { describe, it, expect, beforeEach } from 'vitest';
import { generateKeyPair, SignJWT } from 'jose';
import {
  createVerifyJwt,
  PrincipalSchema,
  AuthError,
  requireScope,
  InMemoryReplayDetector,
  NoopAuthEventLogger,
} from '@iip/auth';
import type {
  KeyRegistry,
  RevocationChecker,
  ResolvedPrincipal,
} from '@iip/auth';

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

async function setupKeys(): Promise<void> {
  const pair1 = await generateKeyPair('Ed25519', { extractable: true });
  const pair2 = await generateKeyPair('Ed25519', { extractable: true });
  testKey = { kid: 'test-key-1', privateKey: pair1.privateKey, publicKey: pair1.publicKey };
  otherKey = { kid: 'test-key-2', privateKey: pair2.privateKey, publicKey: pair2.publicKey };
}

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
}): Promise<string> {
  const key = opts.key ?? testKey;
  const kid = opts.kid ?? key.kid;
  const now = Math.floor(Date.now() / 1000);
  const iat = now + (opts.iatOffsetSec ?? 0);
  const exp = iat + (opts.expOffsetSec ?? 3600);

  const header: Record<string, string> = { alg: opts.alg ?? 'EdDSA', kid };
  const payload: Record<string, unknown> = {
    sub: opts.sub ?? 'operator-001',
    iss: opts.iss ?? 'iip-issuer',
    scope: opts.scope ?? ['read'],
  };

  let token = new SignJWT(payload)
    .setProtectedHeader(header)
    .setIssuedAt(iat)
    .setExpirationTime(exp);

  if (opts.jti !== undefined) {
    token = token.setJti(opts.jti);
  } else {
    token = token.setJti(crypto.randomUUID());
  }

  return token.sign(key.privateKey);
}

function makeVerifyJwt(overrides?: {
  replayDetector?: InMemoryReplayDetector;
  revocationChecker?: RevocationChecker;
  clockSkewSeconds?: number;
}): (token: string) => Promise<ResolvedPrincipal> {
  return createVerifyJwt({
    keyRegistry: makeKeyRegistry([testKey]),
    replayDetector: overrides?.replayDetector ?? new InMemoryReplayDetector(),
    eventLogger: NoopAuthEventLogger,
    revocationChecker: overrides?.revocationChecker ?? makeRevocationChecker(new Set()),
    clockSkewSeconds: overrides?.clockSkewSeconds,
  });
}

// ─────────────────────────────────────────────────────────────────────────
// Tests
// ─────────────────────────────────────────────────────────────────────────

describe('Story 2.2 — Per-Issued JWT Authentication (SEC-1)', () => {
  beforeEach(async () => {
    await setupKeys();
  });

  // TC-1.1: Valid JWT resolves to principal
  it('TC-1.1: valid signed JWT resolves to principal {sub, iss, kid, scope, jti, iat}', async () => {
    const verifyJwt = makeVerifyJwt();
    const token = await signTestToken({ scope: ['read', 'write'] });
    const principal = await verifyJwt(token);

    expect(principal.sub).toBe('operator-001');
    expect(principal.iss).toBe('iip-issuer');
    expect(principal.kid).toBe('test-key-1');
    expect(principal.scope).toContain('read');
    expect(principal.scope).toContain('write');
    expect(principal.jti).toBeTruthy();
    expect(typeof principal.iat).toBe('number');
    expect(principal.iat).toBeGreaterThan(0);
  });

  // TC-1.2: Expired JWT throws
  it('TC-1.2: expired JWT → throws auth.expired', async () => {
    const verifyJwt = makeVerifyJwt();
    // Use -60s to exceed the 30s clock skew tolerance
    const token = await signTestToken({ expOffsetSec: -60 });
    await expect(verifyJwt(token)).rejects.toThrow(/expired/i);
  });

  // TC-1.2b: Lifetime exceeds 1h ceiling
  it('TC-1.2b: JWT with exp-iat > 3600s → throws (lifetime ceiling)', async () => {
    const verifyJwt = makeVerifyJwt();
    const token = await signTestToken({ expOffsetSec: 7200 });
    await expect(verifyJwt(token)).rejects.toThrow(/exceed|expired/i);
  });

  // TC-1.3: Missing kid throws
  it('TC-1.3: missing kid → throws auth.missing_kid', async () => {
    const verifyJwt = makeVerifyJwt();
    // Build a token without kid in the header
    const now = Math.floor(Date.now() / 1000);
    const token = await new SignJWT({ sub: 'op1', iss: 'iip', scope: ['read'] })
      .setProtectedHeader({ alg: 'EdDSA' })
      .setIssuedAt(now)
      .setExpirationTime(now + 3600)
      .setJti(crypto.randomUUID())
      .sign(testKey.privateKey);
    await expect(verifyJwt(token)).rejects.toThrow(/kid/i);
  });

  // TC-1.4: Replayed jti throws
  it('TC-1.4: replayed jti → second request throws auth.replay', async () => {
    const replayDetector = new InMemoryReplayDetector();
    const verifyJwt = makeVerifyJwt({ replayDetector });
    const jti = crypto.randomUUID();
    const token = await signTestToken({ jti });

    await verifyJwt(token); // first use OK
    await expect(verifyJwt(token)).rejects.toThrow(/replay/i);
  });

  // TC-1.4b: Replayed jti with async detector
  it('TC-1.4b: replayed jti → async detector returns false on replay', async () => {
    const detector = new InMemoryReplayDetector();
    const jti = 'async-replay-jti' as never;
    const exp = Math.floor(Date.now() / 1000) + 3600;
    expect(await detector.checkAndRecord(jti, exp)).toBe(true);
    expect(await detector.checkAndRecord(jti, exp)).toBe(false);
  });

  // TC-1.5: Revoked jti throws
  it('TC-1.5: revoked jti → throws auth.revoked', async () => {
    const jti = crypto.randomUUID();
    const revoked = new Set<string>([jti]);
    const verifyJwt = makeVerifyJwt({
      revocationChecker: makeRevocationChecker(revoked),
    });
    const token = await signTestToken({ jti });
    await expect(verifyJwt(token)).rejects.toThrow(/revoked/i);
  });

  // TC-1.6: Insufficient scope
  it('TC-1.6: insufficient scope → requireScope throws auth.insufficient_scope', async () => {
    const verifyJwt = makeVerifyJwt();
    const token = await signTestToken({ scope: ['read'] });
    const principal = await verifyJwt(token);

    expect(() => requireScope(principal, ['admin'])).toThrow(AuthError);
    expect(() => requireScope(principal, ['admin'])).toThrow(/insufficient scope/i);
  });

  // TC-1.7: Unsigned / alg=none JWT throws
  it('TC-1.7: unsigned / alg=none JWT → throws (signature forgery)', async () => {
    const verifyJwt = makeVerifyJwt();
    // Craft an unsigned JWT (alg: none)
    const header = Buffer.from(JSON.stringify({ alg: 'none', kid: 'test-key-1' })).toString('base64url');
    const now = Math.floor(Date.now() / 1000);
    const payload = Buffer.from(JSON.stringify({
      sub: 'op1', iss: 'iip', scope: ['read'],
      iat: now, exp: now + 3600, jti: crypto.randomUUID(),
    })).toString('base64url');
    const unsignedToken = `${header}.${payload}.`;

    await expect(verifyJwt(unsignedToken)).rejects.toThrow(/signature|alg|EdDSA/i);
  });

  // TC-1.8: Principal schema has NO defaults
  it('TC-1.8: PrincipalSchema has NO defaults — empty object fails parse', () => {
    const result = PrincipalSchema.safeParse({});
    expect(result.success).toBe(false);
  });

  // TC-1.9: Signature mismatch (valid alg, wrong signature)
  it('TC-1.9: signature mismatch (valid EdDSA, wrong key) → throws auth.invalid_signature', async () => {
    const verifyJwt = makeVerifyJwt();
    // Sign with otherKey but use testKey's kid — the registry resolves testKey's public key
    const token = await signTestToken({ key: otherKey, kid: 'test-key-1' });
    await expect(verifyJwt(token)).rejects.toThrow(/signature/i);
  });

  // TC-1.10: Algorithm confusion (alg:HS256 with Ed25519 key)
  it('TC-1.10: algorithm confusion (alg:HS256) → throws (key confusion prevented)', async () => {
    const verifyJwt = makeVerifyJwt();
    // Craft a token with HS256 in the header — the algorithm check must reject it
    // before jose tries key verification (classic key-confusion attack vector).
    const now = Math.floor(Date.now() / 1000);
    const header = Buffer.from(JSON.stringify({ alg: 'HS256', kid: 'test-key-1' })).toString('base64url');
    const payloadObj = {
      sub: 'op1', iss: 'iip', scope: ['read'],
      iat: now, exp: now + 3600, jti: crypto.randomUUID(),
    };
    const payload = Buffer.from(JSON.stringify(payloadObj)).toString('base64url');
    const hs256Token = `${header}.${payload}.fake-signature`;

    await expect(verifyJwt(hs256Token)).rejects.toThrow(/signature|EdDSA|alg/i);
  });

  // TC-1.11: Concurrent jti replay (race condition)
  it('TC-1.11: concurrent jti replay → exactly one succeeds', async () => {
    const replayDetector = new InMemoryReplayDetector();
    const verifyJwt = makeVerifyJwt({ replayDetector });
    const jti = crypto.randomUUID();
    const token = await signTestToken({ jti });

    const results = await Promise.allSettled([
      verifyJwt(token),
      verifyJwt(token),
    ]);

    const fulfilled = results.filter((r) => r.status === 'fulfilled');
    const rejected = results.filter((r) => r.status === 'rejected');

    // Exactly one should succeed, one should fail with replay
    expect(fulfilled).toHaveLength(1);
    expect(rejected).toHaveLength(1);
    expect((rejected[0] as PromiseRejectedResult).reason).toBeInstanceOf(AuthError);
  });

  // TC-1.12: Clock skew tolerance
  it('TC-1.12: near-expiry JWT within clock skew window → resolves successfully', async () => {
    const verifyJwt = makeVerifyJwt({ clockSkewSeconds: 30 });
    // Token expires in 1 second, but clock skew is 30s, so it should still be valid
    const token = await signTestToken({ expOffsetSec: 1 });
    const principal = await verifyJwt(token);
    expect(principal.sub).toBe('operator-001');
  });
});
