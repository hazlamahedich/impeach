/**
 * EditorialAuthEventLogger — adapter bridging AuthEventLogger to the editorial
 * log (AC-12, DoD-16).
 *
 * Implements the `AuthEventLogger` interface from Story 2.2 and delegates each
 * call to `EditorialLog.append(...)`. This is the drop-in replacement for
 * `NoopAuthEventLogger` when `packages/editorial` is available.
 *
 * All methods return `Promise<void>` so failures propagate instead of being
 * swallowed. The internal `_append` helper is used by every named method to
 * keep delegation in one place (per the consensus on the generic `log(event)`
 * entry point: named methods stay public, funnel is private).
 *
 * @rules AC-12, SEC-1, SEC-6, DoD-16
 * @adr ADR-0001
 * @term T-006
 */
import type { AuthEventLogger } from '@iip/auth';
import type { Scope } from '@iip/contracts';

/**
 * PrincipalInfo — mirrors the shape passed by `verify.ts` to AuthEventLogger.
 *
 * @rules SEC-1
 */
interface PrincipalInfo {
  readonly sub: string;
  readonly iss: string;
  readonly kid: string;
  readonly jti: string;
  readonly scope: readonly Scope[];
}

/**
 * Append function delegate — the editorial log's append entry point.
 *
 * The adapter calls this to persist an editorial log entry. The actual
 * implementation handles CAS, genesis bootstrap, and signing.
 *
 * @rules SEC-6, AC-12
 */
export interface AppendDelegate {
  append(params: {
    readonly partitionKey: string;
    readonly principalSub: string;
    readonly event: string;
    readonly jti: string;
    readonly payload: unknown;
    readonly time: string;
  }): Promise<void>;
}

/**
 * EditorialAuthEventLogger — adapts auth events to editorial log entries.
 *
 * Maps each AuthEventLogger method to the corresponding editorial log event
 * type (AC-12). Auth events are written to the `__system__` partition. Each
 * event receives a unique `jti` built from the session `jti` plus the event
 * name, ensuring multiple auth events from the same session do not collide on
 * the `(partition_key, jti)` unique index (AC-3).
 *
 * @rules AC-12, SEC-1, SEC-6, DoD-16
 */
export class EditorialAuthEventLogger implements AuthEventLogger {
  private readonly delegate: AppendDelegate;
  private readonly now: () => string;
  private counter = 0;

  constructor(delegate: AppendDelegate, now: () => string = () => new Date().toISOString()) {
    this.delegate = delegate;
    this.now = now;
  }

  private makeJti(baseJti: string, eventName: string): string {
    this.counter += 1;
    return `${baseJti}:${eventName}:${this.now()}:${this.counter}`;
  }

  private async _append(
    eventName: string,
    principalSub: string,
    baseJti: string,
    payload: unknown,
  ): Promise<void> {
    const jti = this.makeJti(baseJti, eventName);
    await this.delegate.append({
      partitionKey: '__system__',
      principalSub,
      event: eventName,
      jti,
      payload,
      time: this.now(),
    });
  }

  async revoked(principal: PrincipalInfo, reason: string): Promise<void> {
    await this._append('auth.revoked', principal.sub, principal.jti, { reason });
  }

  async expired(principal: PrincipalInfo): Promise<void> {
    await this._append('auth.expired', principal.sub, principal.jti, {});
  }

  async invalidSignature(kid: string | undefined): Promise<void> {
    await this._append(
      'auth.invalid_signature',
      '__auth_verify__',
      '__auth_verify__',
      { kid: kid ?? '__unknown__' },
    );
  }

  async missingKid(): Promise<void> {
    await this._append('auth.missing_kid', '__auth_verify__', '__auth_verify__', {});
  }

  async insufficientScope(principal: PrincipalInfo, required: readonly Scope[]): Promise<void> {
    await this._append('auth.insufficient_scope', principal.sub, principal.jti, {
      required: [...required],
      actual: [...principal.scope],
    });
  }

  async replay(principal: PrincipalInfo): Promise<void> {
    await this._append('auth.replay', principal.sub, principal.jti, { jti: principal.jti });
  }

  async expiredKey(kid: string): Promise<void> {
    await this._append('auth.expired_key', '__auth_verify__', '__auth_verify__', { kid });
  }
}
