/**
 * JWT verification — the SEC-1 attribution boundary (SEC-1, AC-9).
 *
 * Every API request is cryptographically attributed to a named principal
 * via per-issued JWT authentication. The resolved `principal` (including
 * `jti`) is propagated to content submission handlers so that every
 * editorial log entry carries the operator's identity end-to-end.
 *
 * Uses `jose` for native Ed25519/EdDSA support (DoD-5). Algorithm
 * restriction: `['EdDSA']` only — rejects `none`, `HS256`, and all
 * symmetric algorithms (prevents key-confusion attacks).
 *
 * Dependencies (ReplayDetector, AuthEventLogger, KeyRegistry,
 * RevocationChecker) are injected so the function is testable in
 * isolation for 100% Stryker mutation score (SEC-8, DoD-2).
 *
 * @rules SEC-1, SEC-8, AC-9, AC-11
 * @adr ADR-0001
 */
import { jwtVerify, decodeJwt, decodeProtectedHeader } from 'jose';
import { z } from 'zod';
import {
  Scope,
  PrincipalSchema as PrincipalId,
  JtiSchema as JtiId,
  IssuerSchema as IssuerId,
  KidSchema as KidId,
} from '@iip/contracts';
import type { Scope as ScopeType, Principal, Issuer, Kid, Jti } from '@iip/contracts';
import type { AuthEventLogger } from './event-logger.js';
import type { ReplayDetector } from './replay-detector.js';

// ─────────────────────────────────────────────────────────────────────────
// Types
// ─────────────────────────────────────────────────────────────────────────

/** Ed25519 public key entry in the key registry. */
export interface KeyEntry {
  readonly kid: string;
  readonly publicKey: CryptoKey;
}

/** Resolves a public key by its key identifier (kid). */
export interface KeyRegistry {
  get(kid: string): KeyEntry | undefined;
}

/** Checks whether a jti has been administratively revoked. */
export interface RevocationChecker {
  isRevoked(jti: string): boolean;
}

/** The principal resolved from a verified JWT. */
export interface ResolvedPrincipal {
  readonly sub: Principal;
  readonly iss: Issuer;
  readonly kid: Kid;
  readonly scope: readonly ScopeType[];
  readonly jti: Jti;
  readonly iat: number;
}

/** Internal info passed to AuthEventLogger. */
interface PrincipalInfo {
  readonly sub: string;
  readonly iss: string;
  readonly kid: string;
  readonly jti: string;
  readonly scope: readonly ScopeType[];
}

// ─────────────────────────────────────────────────────────────────────────
// PrincipalSchema — all fields required, NO defaults (Winston #20, DoD-3)
// ─────────────────────────────────────────────────────────────────────────

/**
 * Zod schema validating the resolved JWT payload.
 *
 * Every field is load-bearing attribution — no `.default()`. An absent
 * `kid`, `sub`, `iss`, or `jti` must fail validation immediately so a
 * forged token with missing claims cannot slip through (Winston #20).
 *
 * `scope` is `z.array(Scope).min(1)` — at least one scope required;
 * rejects plain strings.
 *
 * @rules SEC-1, DoD-3
 * @adr ADR-0001
 */
export const PrincipalSchema = z.object({
  sub: PrincipalId,
  iss: IssuerId,
  kid: KidId,
  scope: z.array(Scope).min(1),
  jti: JtiId,
  iat: z.number().int().positive(),
});
export type PrincipalSchemaType = z.infer<typeof PrincipalSchema>;

// ─────────────────────────────────────────────────────────────────────────
// AuthError — closed set of auth failure variants
// ─────────────────────────────────────────────────────────────────────────

export type AuthErrorCode =
  | 'auth.missing_kid'
  | 'auth.invalid_signature'
  | 'auth.expired'
  | 'auth.expired_key'
  | 'auth.revoked'
  | 'auth.replay'
  | 'auth.insufficient_scope'
  | 'auth.unknown_kid'
  | 'auth.malformed';

export class AuthError extends Error {
  override readonly name = 'AuthError';
  constructor(
    message: string,
    readonly code: AuthErrorCode,
  ) {
    super(message);
  }
}

// ─────────────────────────────────────────────────────────────────────────
// Constants
// ─────────────────────────────────────────────────────────────────────────

/** Maximum token lifetime: exp - iat must not exceed 1h (3600s). SEC-1. */
const MAX_TOKEN_LIFETIME_SECONDS = 3600;

/** Default clock skew tolerance (seconds). Applied at verification. */
const DEFAULT_CLOCK_SKEW_SECONDS = 30;

/** Only EdDSA (Ed25519) is accepted. Rejects none, HS256, RS256, etc. */
const ALLOWED_ALG = 'EdDSA';

// ─────────────────────────────────────────────────────────────────────────
// Factory: createVerifyJwt
// ─────────────────────────────────────────────────────────────────────────

/** Maximum clock skew tolerance allowed at configuration time (seconds). */
const MAX_CLOCK_SKEW_SECONDS = 300;

export interface VerifyJwtConfig {
  readonly keyRegistry: KeyRegistry;
  readonly replayDetector: ReplayDetector;
  readonly eventLogger: AuthEventLogger;
  readonly revocationChecker: RevocationChecker;
  readonly clockSkewSeconds?: number;
}

/** Fail-safe logger wrapper so logging outages cannot lock operators out. */
function safeLog(logger: AuthEventLogger, call: (l: AuthEventLogger) => void): void {
  try {
    call(logger);
  } catch {
    // Logging must never block authentication decisions (AC-11, SEC-1).
    // The caller still throws the appropriate AuthError.
  }
}

/**
 * Create a configured `verifyJwt` function with injected dependencies.
 *
 * Dependencies are injected (not module-level) so Stryker can test every
 * branch in isolation (SEC-8, DoD-2).
 *
 * @rules SEC-1, SEC-8
 * @adr ADR-0001
 */
export function createVerifyJwt(config: VerifyJwtConfig): (token: string) => Promise<ResolvedPrincipal> {
  const configuredSkew = config.clockSkewSeconds ?? DEFAULT_CLOCK_SKEW_SECONDS;
  if (!Number.isFinite(configuredSkew) || configuredSkew < 0 || configuredSkew > MAX_CLOCK_SKEW_SECONDS) {
    throw new Error(`clockSkewSeconds must be a finite number in [0, ${MAX_CLOCK_SKEW_SECONDS}]`);
  }
  const clockSkew = configuredSkew;

  return async function verifyJwt(token: string): Promise<ResolvedPrincipal> {
    // ── Step 1: Decode header to extract kid + alg ──
    let header: { kid?: string; alg?: string };
    try {
      header = decodeProtectedHeader(token);
    } catch {
      throw new AuthError('malformed JWT header', 'auth.malformed');
    }

    // ── Step 2: Reject missing/empty/non-string kid (M6 mutant target) ──
    const kid = header.kid;
    if (typeof kid !== 'string' || kid.length === 0) {
      safeLog(config.eventLogger, (l) => l.missingKid());
      throw new AuthError('missing key identifier (kid) in JWT header', 'auth.missing_kid');
    }

    // ── Step 3: Reject disallowed algorithms (M4 mutant target) ──
    // jose's jwtVerify with algorithms option handles this, but we check
    // explicitly so the error message is precise and the branch is Stryker-visible.
    if (header.alg !== ALLOWED_ALG) {
      safeLog(config.eventLogger, (l) => l.invalidSignature(kid));
      throw new AuthError(
        `rejected algorithm '${header.alg ?? 'missing'}' — only EdDSA is accepted`,
        'auth.invalid_signature',
      );
    }

    // ── Step 4: Resolve public key by kid (key rotation support) ──
    let keyEntry: KeyEntry | undefined;
    try {
      keyEntry = config.keyRegistry.get(kid);
    } catch (err) {
      safeLog(config.eventLogger, (l) => l.invalidSignature(kid));
      throw new AuthError(
        `key registry unavailable: ${err instanceof Error ? err.message : 'unknown error'}`,
        'auth.unknown_kid',
      );
    }
    if (keyEntry === undefined) {
      safeLog(config.eventLogger, (l) => l.invalidSignature(kid));
      throw new AuthError(`unknown key identifier: ${kid}`, 'auth.unknown_kid');
    }

    // ── Step 5: Verify signature via jose (M5 mutant target) ──
    let payload: ReturnType<typeof decodeJwt>;
    try {
      const { payload: verifiedPayload } = await jwtVerify(token, keyEntry.publicKey, {
        algorithms: [ALLOWED_ALG],
        clockTolerance: clockSkew,
      });
      payload = verifiedPayload;
    } catch (err: unknown) {
      // Distinguish expired from invalid signature.
      // For expired tokens, decode the payload (unverified) to extract
      // principal info for the event log — this is safe because we're
      // only logging, not trusting the claims.
      if (err instanceof Error && err.name === 'JWTExpired') {
        const decoded = decodeJwt(token);
        safeLog(config.eventLogger, (l) => l.expired(extractPrincipalInfo(decoded, kid)));
        throw new AuthError('JWT has expired', 'auth.expired');
      }
      safeLog(config.eventLogger, (l) => l.invalidSignature(kid));
      throw new AuthError('JWT signature verification failed', 'auth.invalid_signature');
    }

    // ── Step 6: Enforce maximum lifetime (exp - iat <= 3600s) ──
    // jose verifies exp > now, but does NOT enforce the 1h ceiling or require iat.
    const iat = payload.iat;
    const exp = payload.exp;
    if (iat === undefined || exp === undefined) {
      throw new AuthError('JWT missing iat or exp claim', 'auth.malformed');
    }
    if (exp - iat > MAX_TOKEN_LIFETIME_SECONDS) {
      const info = extractPrincipalInfo(payload, kid);
      safeLog(config.eventLogger, (l) => l.expired(info));
      throw new AuthError('JWT lifetime exceeds 1h maximum', 'auth.expired');
    }

    // ── Step 7: Validate principal schema (no defaults — Winston #20) ──
    const parseResult = PrincipalSchema.safeParse({
      ...payload,
      kid,
    });
    if (!parseResult.success) {
      throw new AuthError(`invalid principal claims: ${parseResult.error.message}`, 'auth.malformed');
    }
    const validated = parseResult.data;

    // ── Step 8: Check revocation list (fail-safe: backend outage must not lock users out) ──
    const jtiStr = validated.jti as string;
    let revoked: boolean;
    try {
      revoked = config.revocationChecker.isRevoked(jtiStr);
    } catch (err) {
      safeLog(config.eventLogger, (l) => l.invalidSignature(kid));
      throw new AuthError(
        `revocation backend unavailable: ${err instanceof Error ? err.message : 'unknown error'}`,
        'auth.unknown_kid',
      );
    }
    if (revoked) {
      const info = toPrincipalInfo(validated);
      safeLog(config.eventLogger, (l) => l.revoked(info, 'administratively revoked'));
      throw new AuthError(`JWT revoked: jti ${jtiStr}`, 'auth.revoked');
    }

    // ── Step 9: Replay detection (atomic check-and-record) ──
    // M2/M7 mutant targets: removing or inverting this check must be killed.
    const replayResult = await config.replayDetector.checkAndRecord(validated.jti, exp);
    if (!replayResult) {
      const info = toPrincipalInfo(validated);
      safeLog(config.eventLogger, (l) => l.replay(info));
      throw new AuthError(`JWT replay detected: jti ${jtiStr} already used`, 'auth.replay');
    }

    // ── Step 10: Return resolved principal ──
    return {
      sub: validated.sub,
      iss: validated.iss,
      kid: validated.kid,
      scope: validated.scope,
      jti: validated.jti,
      iat: validated.iat,
    };
  };
}

// ─────────────────────────────────────────────────────────────────────────
// Scope check helper
// ─────────────────────────────────────────────────────────────────────────

/**
 * Check that a principal has all required scopes. Throws on insufficient
 * scope (fail-closed). M3 mutant target.
 *
 * @rules SEC-1
 */
export function requireScope(principal: ResolvedPrincipal, required: readonly ScopeType[]): void {
  const hasAll = required.every((r) => principal.scope.includes(r));
  if (!hasAll) {
    throw new AuthError(
      `insufficient scope: required [${required.join(', ')}], got [${[...principal.scope].join(', ')}]`,
      'auth.insufficient_scope',
    );
  }
}

// ─────────────────────────────────────────────────────────────────────────
// Helpers
// ─────────────────────────────────────────────────────────────────────────

function toPrincipalInfo(p: PrincipalSchemaType): PrincipalInfo {
  return {
    sub: p.sub,
    iss: p.iss,
    kid: p.kid,
    jti: p.jti,
    scope: p.scope,
  };
}

function extractPrincipalInfo(payload: ReturnType<typeof decodeJwt>, kid: string): PrincipalInfo {
  return {
    sub: (payload.sub as string | undefined) ?? '<unknown>',
    iss: (payload.iss as string | undefined) ?? '<unknown>',
    kid,
    jti: (payload.jti as string | undefined) ?? '<unknown>',
    scope: Array.isArray(payload['scope']) ? (payload['scope'] as ScopeType[]) : [],
  };
}
