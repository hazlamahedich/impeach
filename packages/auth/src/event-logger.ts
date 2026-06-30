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
 * All methods return `Promise<void>` because the real implementation writes
 * to persistent storage (SEC-6). Callers must await or handle rejections
 * explicitly; failures must not be swallowed.
 *
 * @rules SEC-1, AC-11, SEC-6
 */
export interface AuthEventLogger {
  revoked(principal: PrincipalInfo, reason: string): Promise<void>;
  expired(principal: PrincipalInfo): Promise<void>;
  invalidSignature(kid: string | undefined): Promise<void>;
  missingKid(): Promise<void>;
  insufficientScope(principal: PrincipalInfo, required: readonly Scope[]): Promise<void>;
  replay(principal: PrincipalInfo): Promise<void>;
  expiredKey(kid: string): Promise<void>;
}

/**
 * No-op default — auth module is fully functional without Story 2.4.
 *
 * @rules SEC-1
 */
export const NoopAuthEventLogger: AuthEventLogger = {
  revoked(): Promise<void> { return Promise.resolve(); },
  expired(): Promise<void> { return Promise.resolve(); },
  invalidSignature(): Promise<void> { return Promise.resolve(); },
  missingKid(): Promise<void> { return Promise.resolve(); },
  insufficientScope(): Promise<void> { return Promise.resolve(); },
  replay(): Promise<void> { return Promise.resolve(); },
  expiredKey(): Promise<void> { return Promise.resolve(); },
};
