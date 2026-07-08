import { z } from 'zod';

/**
 * Authentication contract types (SEC-1).
 *
 * Branded nominal types prevent transposition of principal identity fields
 * (project-context Winston #1). A `Principal` cannot be assigned where a
 * `Jti` belongs — compile-time enforcement beyond runtime validation.
 *
 * `scope` is `string[]` (e.g. `['read', 'write']`), never a plain string.
 * The enumeration is closed so exhaustive `switch` works (Amelia TS pattern).
 *
 * @rules SEC-1, PC-4, PC-8
 * @adr ADR-0001
 */

/**
 * Scope — the closed enumeration of operator access scopes.
 *
 * `z.enum` (not TS `enum`) per PC-4 #14: the inferred union is the only
 * sanctioned form. Adding a scope is a one-line edit here.
 *
 * Story 2.3 adds the two-person intake scopes (`intake:review`,
 * `intake:approve`) — the two cryptographic roles in the SEC-2 state machine.
 *
 * Story 3.1 adds the source-registry scopes (`sources:write`, `sources:read`)
 * — the resource-specific scopes for the FR-1.1 source registry CRUD surface.
 *
 * @rules SEC-1, SEC-2, FR-1.1
 */
export const Scope = z.enum([
  'read',
  'write',
  'admin',
  'audit',
  'intake:review',
  'intake:approve',
  'sources:write',
  'sources:read',
]);
export type Scope = z.infer<typeof Scope>;

/**
 * Principal — branded UUID identifying a named operator.
 *
 * Prevents accidental transposition with other string IDs (CorpusHash,
 * EntityId, etc.). This is load-bearing for SEC-6/STR-5 (Winston #1).
 *
 * @rules SEC-1, SEC-6, STR-5
 * @adr ADR-0001
 */
export const PrincipalSchema = z.string().min(1).brand('Principal');
export type Principal = z.infer<typeof PrincipalSchema>;

/**
 * Jti — branded JWT ID (unique per issued token).
 *
 * Used for replay detection and revocation. Branding prevents it from
 * being confused with other UUID-shaped strings.
 *
 * @rules SEC-1
 * @adr ADR-0001
 */
export const JtiSchema = z.string().min(1).brand('Jti');
export type Jti = z.infer<typeof JtiSchema>;

/**
 * Issuer — branded JWT issuer string.
 *
 * @rules SEC-1
 */
export const IssuerSchema = z.string().min(1).brand('Issuer');
export type Issuer = z.infer<typeof IssuerSchema>;

/**
 * Kid — branded key identifier for JWT signing key resolution.
 *
 * @rules SEC-1
 */
export const KidSchema = z.string().min(1).brand('Kid');
export type Kid = z.infer<typeof KidSchema>;
