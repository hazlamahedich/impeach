/**
 * Epic 3 ingest-domain test helpers — pure fixtures for contract/integration tests.
 *
 * Implements the "pure function first" fixture-architecture pattern: each
 * helper is a side-effect-free factory returning a value known to satisfy
 * (or, for the negative factories, known to violate) an ingest-domain zod
 * schema. No framework dependency — importable from any vitest suite.
 *
 * Used by tests/contract/ingest-domain.contract.test.ts and by Epic 3
 * integration tests (Story 3.1–3.7 source onboarding & ingestion). Keeps the
 * canonical exemplar factories out of the contract test itself so the test
 * asserts the schema, not its own fixture generator.
 *
 * @rules PC-9
 * @adr ADR-001
 *
 * Usage:
 *   import { makeValidSourceId, makeValidContentChecksum } from '../support/helpers/ingest';
 */

import { randomUUID, createHash } from 'node:crypto';

/**
 * Return a valid UUID v4 string (satisfies `SourceIdSchema` / `DocumentIdSchema`).
 *
 * Uses `crypto.randomUUID()` — Node's RFC 4122 v4 generator. The returned
 * string is the canonical 8-4-4-4-12 lowercase-hex form the ingest regex pins.
 */
export function makeValidSourceId(): string {
  return randomUUID();
}

/**
 * Return a valid 64-char lowercase hex SHA-256 digest (satisfies `ContentChecksumSchema`).
 *
 * Deterministic when `seed` is provided (same seed → same digest); otherwise
 * hashes a fresh `randomUUID()` so each call yields a distinct valid checksum.
 * The digest is always lowercase hex (sha256 hex output is lowercase by spec).
 */
export function makeValidContentChecksum(seed?: string): string {
  return createHash('sha256').update(seed ?? randomUUID()).digest('hex');
}

/**
 * Return a valid 64-char lowercase hex SHA-256 digest (satisfies `JobIdSchema`).
 *
 * `jobId = sha256(dedupeAnchor)` per PC-2.4 — pass the dedupe anchor as `seed`
 * to mirror production idempotency-key derivation. Omit `seed` for a random
 * valid job id.
 */
export function makeValidJobId(seed?: string): string {
  return createHash('sha256').update(seed ?? randomUUID()).digest('hex');
}

/**
 * Return a clearly-invalid UUID string for negative tests.
 *
 * Structured to fail every UUID-version regex (wrong length, non-hex, no
 * dashes) so it is unambiguous as a negative fixture across schemas.
 */
export function makeInvalidUuid(): string {
  return 'not-a-valid-uuid';
}

/**
 * Return a non-hex string for negative tests (fails `ContentChecksumSchema` / `JobIdSchema`).
 *
 * 64 chars of `z` — correct length but every character is outside the hex
 * alphabet, isolating the hex-class assertion from the length assertion.
 */
export function makeInvalidHex(): string {
  return 'z'.repeat(64);
}
