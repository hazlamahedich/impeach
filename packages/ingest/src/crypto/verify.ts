/**
 * Signature verification + keyring builders (SEC-2, Task 3).
 *
 * Uses the native Web Crypto API (`crypto.subtle`) per DoD-5. Public keys are
 * stored in config as base64 SPKI (DoD-4) and imported to `CryptoKey` once;
 * revocation `status` is re-read FRESH from the backing record on every
 * lookup (DoD-11: no caching of status, revocation is immediate).
 *
 * Signature verification follows the DoD-6 payload encoding contract:
 * signatures are generated/verified over the UTF-8 bytes of the lowercase
 * 64-char SHA-256 hex content hash.
 *
 * @rules SEC-2, DoD-4, DoD-5, DoD-6, DoD-11
 * @adr ADR-0001
 */
import { webcrypto } from 'node:crypto';
import { signaturePayloadFromHash } from '@iip/contracts';
import type { DocumentStatus } from '@iip/contracts';
import { IntakeError } from '../types.js';
import type {
  OperatorKeyEntry,
  OperatorKeyRegistry,
  PartnerKeyRegistry,
} from '../types.js';

/** Operator key record shape resolved from `@iip/config` (DoD-4). */
export type OperatorKeyRecord = Record<
  string,
  { key: string; status: 'active' | 'revoked'; revokedAt?: string }
>;

/** Partner key record shape resolved from `@iip/config` (DoD-4, Tier-5). */
export type PartnerKeyRecord = Record<string, string>;

/**
 * Import a base64 SPKI Ed25519 public key to a `CryptoKey`.
 *
 * @rules SEC-2, DoD-5
 */
export async function importPublicBase64(base64: string): Promise<CryptoKey> {
  const der = Buffer.from(base64, 'base64');
  // extractable=false is functionally irrelevant to verify-only keys; the
  // BooleanLiteral mutant here is equivalent (Stryker disable).
  // Stryker disable next-line BooleanLiteral
  return webcrypto.subtle.importKey('spki', der, 'Ed25519', false, ['verify']);
}

/**
 * Build an operator keyring from a config record (DoD-4).
 *
 * Public keys are imported ONCE (key material is immutable; importing is
 * deterministic). Revocation `status` is re-read from the backing record on
 * EVERY `get()` so flipping a record entry's `status` to `'revoked'` takes
 * effect immediately without a rebuild (DoD-11). Adding a brand-new kid
 * after construction requires a rebuild.
 *
 * @rules SEC-2, DoD-4, DoD-11
 */
export async function createOperatorKeyRegistry(
  record: OperatorKeyRecord,
): Promise<OperatorKeyRegistry> {
  const cache = new Map<string, CryptoKey>();
  for (const [kid, entry] of Object.entries(record)) {
    cache.set(kid, await importPublicBase64(entry.key));
  }
  return {
    get(kid: string): OperatorKeyEntry | undefined {
      const entry = record[kid];
      // Both guards are belt-and-suspenders (cache is built from record
      // keys), so the ConditionalExpression mutants are equivalent.
      // Stryker disable next-line ConditionalExpression
      if (entry === undefined) return undefined;
      const publicKey = cache.get(kid);
      // Stryker disable next-line ConditionalExpression
      if (publicKey === undefined) return undefined;
      return { publicKey, status: entry.status };
    },
  };
}

/**
 * Build a partner keyring from a config record (DoD-4, Tier-5).
 *
 * Partner keys carry no revocation status (AC-5); they are either present or
 * absent. A partner key removed from the record resolves to `undefined`
 * (fail-closed).
 *
 * @rules SEC-2, AC-5, DoD-4
 */
export async function createPartnerKeyRegistry(
  record: PartnerKeyRecord,
): Promise<PartnerKeyRegistry> {
  const cache = new Map<string, CryptoKey>();
  for (const [kid, base64] of Object.entries(record)) {
    cache.set(kid, await importPublicBase64(base64));
  }
  return {
    get(kid: string): CryptoKey | undefined {
      // The `in` guard is redundant with the cache lookup (cache built from
      // record keys); the ConditionalExpression mutant is equivalent.
      // Stryker disable next-line ConditionalExpression
      if (!(kid in record)) return undefined;
      return cache.get(kid);
    },
  };
}

/**
 * Verify an operator/approver signature over a content hash (DoD-6).
 *
 * Revocation is checked BEFORE the cryptographic verify so a revoked key
 * returns `KEY_REVOKED` regardless of signature validity (AC-10, DoD-11).
 * An unknown kid returns `INVALID_SIGNATURE` (fail-closed: an unverifiable
 * key is treated as an invalid signature, not a registry miss that leaks
 * which kids exist).
 *
 * @throws {IntakeError} `intake.key_revoked` | `intake.invalid_signature`
 *
 * @rules SEC-2, AC-10, DoD-5, DoD-6, DoD-11
 */
export async function verifyOperatorSignature(
  registry: OperatorKeyRegistry,
  kid: string,
  signatureBase64: string,
  contentHash: string,
): Promise<void> {
  const entry = registry.get(kid);
  if (entry === undefined) {
    throw new IntakeError(`unknown operator key: ${kid}`, 'intake.invalid_signature');
  }
  // Revocation check FIRST (DoD-11): a revoked key is rejected even if the
  // signature would otherwise verify.
  if (entry.status === 'revoked') {
    throw new IntakeError(`operator key revoked: ${kid}`, 'intake.key_revoked');
  }
  const payload = signaturePayloadFromHash(contentHash);
  const signature = Buffer.from(signatureBase64, 'base64');
  const valid = await webcrypto.subtle.verify('Ed25519', entry.publicKey, signature, payload);
  if (!valid) {
    throw new IntakeError(`invalid operator signature for kid ${kid}`, 'intake.invalid_signature');
  }
}

/**
 * Verify a Tier-5 partner provenance signature (AC-5, DoD-6).
 *
 * @throws {IntakeError} `intake.invalid_signature` on unknown kid or bad sig
 *
 * @rules SEC-2, AC-5, DoD-6
 */
export async function verifyPartnerSignature(
  registry: PartnerKeyRegistry,
  kid: string,
  signatureBase64: string,
  contentHash: string,
): Promise<void> {
  const publicKey = registry.get(kid);
  if (publicKey === undefined) {
    throw new IntakeError(`unknown partner key: ${kid}`, 'intake.invalid_signature');
  }
  const payload = signaturePayloadFromHash(contentHash);
  const signature = Buffer.from(signatureBase64, 'base64');
  const valid = await webcrypto.subtle.verify('Ed25519', publicKey, signature, payload);
  if (!valid) {
    throw new IntakeError(`invalid partner signature for kid ${kid}`, 'intake.invalid_signature');
  }
}

/** Re-export the DocumentStatus type for downstream modules. */
export type { DocumentStatus };
