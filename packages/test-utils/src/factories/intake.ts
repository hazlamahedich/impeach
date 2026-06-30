/**
 * Test factories for the two-person intake state machine (SEC-2, Task 1.3).
 *
 * Produce document records, principal identities, Ed25519 keypairs, and
 * signatures that the intake gate (and worker) can verify. Signatures are
 * generated over the SAME payload encoding as production code
 * (`signaturePayloadFromHash` from `@iip/contracts`, DoD-6) so a factory
 * signature verifies against the real `crypto.subtle.verify` path.
 *
 * @rules SEC-2, DoD-5, DoD-6
 */
import { webcrypto } from 'node:crypto';
import {
  signaturePayloadFromHash,
  computeContentHash,
} from '@iip/contracts';

/** Branded sub-bypass for tests: cast a plain string to a branded Principal. */
export function asPrincipalSub(sub: string) {
  return sub as unknown as import('@iip/contracts').Principal;
}

/** A generated Ed25519 keypair plus its kid and base64 public key. */
export interface TestKeyPair {
  readonly kid: string;
  readonly privateKey: webcrypto.CryptoKey;
  readonly publicKey: webcrypto.CryptoKey;
  readonly publicKeyBase64: string;
}

/** Generate an Ed25519 keypair for tests (extractable so base64 export works). */
export async function createKeyPair(kid: string): Promise<TestKeyPair> {
  const pair = (await webcrypto.subtle.generateKey(
    'Ed25519',
    true,
    ['sign', 'verify'],
  )) as webcrypto.CryptoKeyPair;
  const spki = await webcrypto.subtle.exportKey('spki', pair.publicKey);
  const publicKeyBase64 = Buffer.from(spki).toString('base64');
  return { kid, privateKey: pair.privateKey, publicKey: pair.publicKey, publicKeyBase64 };
}

/**
 * Sign the content hash payload with a private key (DoD-6 payload encoding).
 * Returns a base64 signature string.
 */
export async function createSignature(params: {
  privateKey: webcrypto.CryptoKey;
  contentHash: string;
}): Promise<string> {
  const payload = signaturePayloadFromHash(params.contentHash);
  const sig = await webcrypto.subtle.sign('Ed25519', params.privateKey, payload);
  return Buffer.from(sig).toString('base64');
}

/** Compute the canonical content hash for raw document bytes (DoD-6). */
export function createContentHash(rawBytes: Uint8Array, isText = true): string {
  return computeContentHash(rawBytes, isText);
}

/** Principal identity fields consumed by the intake gate (compared on `sub`). */
export interface TestPrincipal {
  readonly sub: string;
  readonly kid: string;
  readonly scope: readonly string[];
}

/** Build a test principal with sensible defaults. */
export function createPrincipal(overrides: Partial<TestPrincipal> = {}): TestPrincipal {
  return {
    sub: overrides.sub ?? 'operator-001',
    kid: overrides.kid ?? 'op-key-1',
    scope: overrides.scope ?? ['intake:review', 'intake:approve'],
  };
}

/** Intake document record shape (mirrors `intakeDocuments` table). */
export interface TestIntakeDocument {
  readonly id: string;
  readonly content_hash: string;
  readonly status: string;
  readonly reviewer_sub: string | null;
  readonly reviewer_signature: string | null;
  readonly reviewer_key_kid: string | null;
  readonly reviewed_at: Date | null;
  readonly approver_sub: string | null;
  readonly approver_signature: string | null;
  readonly approver_key_kid: string | null;
  readonly approved_at: Date | null;
  readonly partner_kid: string | null;
  readonly partner_signature: string | null;
  readonly tier: number;
  readonly created_at: Date;
  readonly updated_at: Date;
}

/** Build a test intake document in `staging` with sensible defaults. */
export function createDocument(
  overrides: Partial<TestIntakeDocument> = {},
): TestIntakeDocument {
  const now = new Date();
  return {
    id: overrides.id ?? crypto.randomUUID(),
    content_hash: overrides.content_hash ?? 'a'.repeat(64),
    status: overrides.status ?? 'staging',
    reviewer_sub: overrides.reviewer_sub ?? null,
    reviewer_signature: overrides.reviewer_signature ?? null,
    reviewer_key_kid: overrides.reviewer_key_kid ?? null,
    reviewed_at: overrides.reviewed_at ?? null,
    approver_sub: overrides.approver_sub ?? null,
    approver_signature: overrides.approver_signature ?? null,
    approver_key_kid: overrides.approver_key_kid ?? null,
    approved_at: overrides.approved_at ?? null,
    partner_kid: overrides.partner_kid ?? null,
    partner_signature: overrides.partner_signature ?? null,
    tier: overrides.tier ?? 1,
    created_at: overrides.created_at ?? now,
    updated_at: overrides.updated_at ?? now,
  };
}
