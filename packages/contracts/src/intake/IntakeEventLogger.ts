/**
 * IntakeEvent + IntakeEventLogger contract (SEC-2, AC-7, AC-11, DoD-9).
 *
 * Every state transition (successful or failed) MUST emit a structured
 * audit event to the AC-11 event log. This interface is the intake-domain
 * analogue of {@link import('@iip/auth').AuthEventLogger} from Story 2.2 —
 * the real editorial-log-backed implementation lands in Story 2.4; the
 * no-op default keeps the intake module functional in isolation.
 *
 * Event names use dotted-lowercase (see {@link IntakeEventName}).
 *
 * @rules SEC-2, AC-7, AC-11, DoD-9
 * @adr ADR-0001
 */
import { z } from 'zod';
import { DocumentStatus } from './state.js';
import type { DocumentStatus as DocumentStatusType } from './state.js';

/**
 * Closed catalogue of intake event names (AC-7, Dev Notes).
 *
 * Successful transitions: `intake.reviewed_once`, `intake.approved`,
 * `intake.extracting`, `intake.indexed`, `intake.rejected`,
 * `intake.needs_revision`.
 *
 * Failed transitions: `intake.signature_failed`, `intake.bypass_attempt`,
 * `intake.same_principal_rejected`, `intake.invalid_transition`,
 * `intake.approval_window_expired`, `intake.inter_signature_delay_violation`,
 * `intake.key_revoked`.
 *
 * @rules SEC-2, AC-7
 */
export const IntakeEventName = z.enum([
  'intake.reviewed_once',
  'intake.approved',
  'intake.extracting',
  'intake.indexed',
  'intake.rejected',
  'intake.needs_revision',
  'intake.signature_failed',
  'intake.bypass_attempt',
  'intake.same_principal_rejected',
  'intake.invalid_transition',
  'intake.approval_window_expired',
  'intake.inter_signature_delay_violation',
  'intake.key_revoked',
  'intake.insufficient_scope',
]);
export type IntakeEventName = z.infer<typeof IntakeEventName>;

/**
 * IntakeEvent — the structured audit record emitted on every transition.
 *
 * Shape per DoD-9. `reason` is optional (present for rejection/remediation
 * and failure events). NO defaults on any field (DoD-3, Winston #20).
 *
 * @rules SEC-2, AC-7, AC-11, DoD-9
 */
export const IntakeEvent = z.object({
  event: IntakeEventName,
  principal_sub: z.string().min(1),
  key_kid: z.string(),
  document_id: z.string().min(1),
  content_hash: z.string().min(1),
  timestamp: z.string().min(1),
  previous_state: DocumentStatus,
  new_state: DocumentStatus,
  reason: z.string().min(1).optional(),
});
export type IntakeEvent = z.infer<typeof IntakeEvent>;

/**
 * IntakeEventLogger — interface for structured intake audit logging.
 *
 * Implemented by the real editorial-log-backed logger (Story 2.4) and the
 * no-op default. Mirrors the AuthEventLogger pattern (Story 2.2).
 *
 * @rules SEC-2, AC-7, AC-11, DoD-9
 */
export interface IntakeEventLogger {
  log(event: IntakeEvent): Promise<void>;
}

/**
 * No-op default — intake module is fully functional without Story 2.4.
 *
 * @rules SEC-2
 */
export const NoopIntakeEventLogger: IntakeEventLogger = {
  async log(_event: IntakeEvent): Promise<void> {},
};

/**
 * Re-export the DocumentStatus type so consumers of the intake event
 * module can reference the branded status without a second import.
 *
 * @rules SEC-2, DoD-1
 */
export type { DocumentStatusType };
