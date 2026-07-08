/**
 * Attestation issuance + external verification (SEC-2, AC-9).
 *
 * An attestation is a signed JSON record proving a document reached a
 * two-person-approved state. It is signed by the system's own Ed25519 key
 * over the CANONICAL JSON (sorted keys, no whitespace) of the payload, so an
 * external auditor can verify it with only the system's published public
 * key — no access to internal systems (AC-9).
 *
 * @rules SEC-2, AC-9
 * @adr ADR-0001
 */
import { webcrypto } from 'node:crypto';
import type { AttestationPayload, SignedAttestation } from './types.js';

/**
 * Canonical JSON: object keys sorted ascending at every depth, no
 * insignificant whitespace. Mirrors the JCS discipline used by the editorial
 * log (project-context: canonical JSON before hashing).
 *
 * @rules SEC-2, AC-9
 */
export function canonicalize(value: unknown): string {
  if (value === null || typeof value !== 'object') {
    return JSON.stringify(value);
  }
  if (Array.isArray(value)) {
    return `[${value.map(canonicalize).join(',')}]`;
  }
  const obj = value as Record<string, unknown>;
  const keys = Object.keys(obj).sort();
  return `{${keys
    .map((k) => `${JSON.stringify(k)}:${canonicalize(obj[k])}`)
    .join(',')}}`;
}

/** Canonical JSON bytes of an attestation payload (the signed material). */
function payloadBytes(payload: AttestationPayload): Uint8Array {
  return new TextEncoder().encode(canonicalize(payload));
}

/**
 * Sign an attestation payload with the system Ed25519 private key.
 *
 * @rules SEC-2, AC-9
 */
export async function signAttestation(
  payload: AttestationPayload,
  systemPrivateKey: CryptoKey,
): Promise<SignedAttestation> {
  const signature = await webcrypto.subtle.sign('Ed25519', systemPrivateKey, payloadBytes(payload));
  return { payload, signature: Buffer.from(signature).toString('base64') };
}

/**
 * Verify an attestation against the system public key (AC-9).
 *
 * Returns `true` only if the signature is cryptographically valid over the
 * canonical JSON of the supplied payload. Tampering ANY payload field
 * invalidates the signature.
 *
 * @rules SEC-2, AC-9
 */
export async function verifyAttestation(
  attestation: SignedAttestation,
  systemPublicKey: CryptoKey,
): Promise<boolean> {
  const signature = Buffer.from(attestation.signature, 'base64');
  return webcrypto.subtle.verify(
    'Ed25519',
    systemPublicKey,
    signature,
    payloadBytes(attestation.payload),
  );
}
