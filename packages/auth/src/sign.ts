/**
 * JWT token issuance — signJwt using jose with Ed25519/EdDSA (SEC-1).
 *
 * Issues per-issued JWTs with claims `{sub, iss, kid, exp, jti, scope, iat}`
 * where `exp - iat <= 3600s` and `jti` is cryptographically random.
 *
 * @rules SEC-1, DoD-5
 * @adr ADR-0001
 */
import { SignJWT } from 'jose';
import type { Scope } from '@iip/contracts';

export interface SignKeyEntry {
  readonly kid: string;
  readonly privateKey: CryptoKey;
}

export interface SignOptions {
  readonly sub: string;
  readonly iss: string;
  readonly scope: readonly Scope[];
  readonly expSeconds?: number;
}

/**
 * Sign a JWT with Ed25519/EdDSA.
 *
 * @param keyEntry  Signing key (kid + Ed25519 private key).
 * @param options   Principal claims + optional lifetime (default 3600s).
 * @returns         Signed JWT compact serialization.
 *
 * @rules SEC-1, DoD-5
 * @adr ADR-0001
 */
export async function signJwt(
  keyEntry: SignKeyEntry,
  options: SignOptions,
): Promise<string> {
  const now = Math.floor(Date.now() / 1000);
  const expSeconds = options.expSeconds ?? 3600;

  if (expSeconds <= 0 || expSeconds > 3600) {
    throw new Error('token lifetime must be in (0, 3600s] (SEC-1)');
  }

  const jti = crypto.randomUUID();

  return new SignJWT({
    sub: options.sub,
    iss: options.iss,
    scope: [...options.scope],
  })
    .setProtectedHeader({ alg: 'EdDSA', kid: keyEntry.kid })
    .setIssuedAt(now)
    .setExpirationTime(now + expSeconds)
    .setJti(jti)
    .sign(keyEntry.privateKey);
}
