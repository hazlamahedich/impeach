import { z } from 'zod';

/**
 * Two-person intake state machine contract types (SEC-2, AC-INTAKE).
 *
 * Branded nominal types prevent accidental transposition of status and
 * signature fields (project-context Winston #1, DoD-1). A `DocumentStatus`
 * cannot be assigned where an `Ed25519Signature` belongs — compile-time
 * enforcement beyond runtime validation.
 *
 * The state graph (happy path): `staging -> reviewed_once -> approved ->
 * extracting -> indexed`. Terminal/remediation branches: `staging ->
 * rejected`, `reviewed_once -> rejected`, `reviewed_once -> needs_revision
 * -> staging`.
 *
 * @rules SEC-2, AC-INTAKE, DoD-1, DoD-3
 * @adr ADR-0001
 */

/**
 * DocumentStatus — the closed enumeration of intake lifecycle states.
 *
 * `z.enum` (not TS `enum`) per PC-4 #14: the inferred union is the only
 * sanctioned form. The enumeration is closed so exhaustive `switch` works
 * (Amelia TS pattern). Branded so a raw string cannot be assigned where a
 * status is required.
 *
 * @rules SEC-2, DoD-1
 */
export const DocumentStatusLiteral = z.enum([
  'staging',
  'reviewed_once',
  'approved',
  'extracting',
  'indexed',
  'rejected',
  'needs_revision',
]);
export type DocumentStatusLiteral = z.infer<typeof DocumentStatusLiteral>;

/**
 * Branded DocumentStatus — prevents transposition with other strings.
 *
 * @rules SEC-2, DoD-1
 */
export const DocumentStatus = DocumentStatusLiteral.brand('DocumentStatus');
export type DocumentStatus = z.infer<typeof DocumentStatus>;

/**
 * Ed25519Signature — branded base64 signature string.
 *
 * Brands the signature so it cannot be confused with a content hash or
 * principal id. The brand is load-bearing for SEC-6/STR-5 (Winston #1).
 *
 * @rules SEC-2, DoD-1, DoD-5
 */
export const Ed25519Signature = z
  .string()
  .min(1)
  .brand('Ed25519Signature');
export type Ed25519Signature = z.infer<typeof Ed25519Signature>;

/**
 * KeyId — branded key identifier (kid) for operator/partner keys.
 *
 * Re-exported shape consistent with {@link import('@iip/contracts').Kid} but
 * branded under the intake domain to keep the registry lookups typed.
 *
 * @rules SEC-2, DoD-4
 */
export const KeyId = z.string().min(1).brand('KeyId');
export type KeyId = z.infer<typeof KeyId>;

/**
 * IntakeContentHash — branded 64-char lowercase SHA-256 hex string.
 *
 * Prevents accidental transposition of a content hash with a signature,
 * principal id, or other string-shaped values (DoD-1, Winston #1). Reuses the
 * same regex discipline as {@link import('@iip/contracts').CorpusHash} but is
 * branded under the intake domain so a corpus hash cannot be assigned where
 * an intake content hash is required.
 *
 * @rules SEC-2, DoD-1, DoD-6
 */
export const IntakeContentHash = z
  .string()
  .regex(/^[a-f0-9]{64}$/, 'must be a 64-char hex SHA-256 hash')
  .brand('IntakeContentHash');
export type IntakeContentHash = z.infer<typeof IntakeContentHash>;
