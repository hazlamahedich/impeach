/**
 * AuthEventLogger — interface for structured auth-failure logging (SEC-1, AC-11).
 *
 * Every JWT verification failure emits a structured log entry so the
 * compliance officer can trace rejection events end-to-end. The real
 * implementation (AC-11 editorial log) lands in Story 2.4; the no-op
 * default keeps the auth module functional in isolation.
 *
 * Event names use dotted-lowercase: `auth.revoked`, `auth.expired`, etc.
 *
 * @rules SEC-1, AC-11
 * @adr ADR-0001
 */
import type { Scope } from '@iip/contracts';

/** Branded shapes re-declared locally to avoid circular imports with verify.ts. */
interface PrincipalInfo {
  readonly sub: string;
  readonly iss: string;
  readonly kid: string;
  readonly jti: string;
  readonly scope: readonly Scope[];
}

/**
 * Interface implemented by the real editorial-log-backed logger (Story 2.4)
 * and the no-op default.
 *
 * @rules SEC-1, AC-11
 */
export interface AuthEventLogger {
  revoked(principal: PrincipalInfo, reason: string): void;
  expired(principal: PrincipalInfo): void;
  invalidSignature(kid: string | undefined): void;
  missingKid(): void;
  insufficientScope(principal: PrincipalInfo, required: readonly Scope[]): void;
  replay(principal: PrincipalInfo): void;
}

/**
 * No-op default — auth module is fully functional without Story 2.4.
 *
 * @rules SEC-1
 */
export const NoopAuthEventLogger: AuthEventLogger = {
  revoked(): void {},
  expired(): void {},
  invalidSignature(): void {},
  missingKid(): void {},
  insufficientScope(): void {},
  replay(): void {},
};
