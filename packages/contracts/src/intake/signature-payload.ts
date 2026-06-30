/**
 * Signature payload encoding contract (SEC-2, DoD-6).
 *
 * All operator/approver/partner signatures are generated AND verified over
 * the SAME payload: the UTF-8 bytes of the lowercase 64-character SHA-256
 * hex string of the raw document bytes.
 *
 * Pipeline (DoD-6, binding):
 *   raw_document_bytes
 *     -> [NFC normalize if text]
 *     -> SHA-256
 *     -> lowercase hex string (64 chars)
 *     -> UTF-8 encode
 *     -> sign/verify
 *
 * This module is the SHARED fixture consumed by the API (signature
 * submission), the worker (gate verification), and tests. Every component
 * MUST reproduce the pipeline through these helpers so a divergent
 * re-implementation is a compile-time, not runtime, defect.
 *
 * NFC normalization is applied to the raw document bytes BEFORE hashing if
 * the document is text (not binary). For binary documents the raw bytes are
 * hashed directly.
 *
 * @rules SEC-2, DoD-6
 * @adr ADR-0001
 */
import { createHash } from 'node:crypto';

import { IntakeContentHash } from './state.js';

/** Regex matching a lowercase 64-char SHA-256 hex string. */
export const CONTENT_HASH_REGEX = /^[a-f0-9]{64}$/;

/**
 * Compute the lowercase SHA-256 hex content hash for raw document bytes.
 *
 * Text documents are NFC-normalized BEFORE hashing so precomposed and
 * decomposed forms of the same glyph hash identically. Binary documents are
 * hashed as-is.
 *
 * @returns the 64-char lowercase hex string (the canonical content hash)
 *
 * @rules SEC-2, DoD-6
 */
export function computeContentHash(
  rawBytes: Uint8Array,
  isText: boolean,
): import('./state.js').IntakeContentHash {
  let bytes: Uint8Array = rawBytes;
  if (isText) {
    bytes = nfcNormalize(rawBytes);
  }
  const digest = createHash('sha256').update(bytes).digest('hex');
  return IntakeContentHash.parse(digest);
}

/**
 * Produce the UTF-8 byte payload that signatures are generated/verified over.
 *
 * The payload is the UTF-8 encoding of the lowercase 64-char hex content
 * hash. Both signer and verifier call this with the SAME content hash
 * string, guaranteeing byte-identical payloads.
 *
 * @rules SEC-2, DoD-6
 */
export function signaturePayloadFromHash(
  contentHash: import('./state.js').IntakeContentHash | string,
): Uint8Array {
  return new TextEncoder().encode(contentHash);
}

/**
 * NFC-normalize raw text bytes. Decodes as UTF-8, applies Unicode NFC
 * normalization, re-encodes to UTF-8. Non-text (binary) inputs bypass this.
 *
 * @rules SEC-2, DoD-6
 */
function nfcNormalize(rawBytes: Uint8Array): Uint8Array {
  const decoded = new TextDecoder('utf-8', { fatal: false }).decode(rawBytes);
  const normalized = decoded.normalize('NFC');
  return new TextEncoder().encode(normalized);
}
