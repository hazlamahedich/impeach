import { pgTable, uuid, timestamp, text, integer } from 'drizzle-orm/pg-core';
import { sql } from 'drizzle-orm';
import type { DocumentStatus, IntakeContentHash } from '@iip/contracts';

/**
 * Intake documents table — the two-person intake state machine record
 * (SEC-2, DoD-7).
 *
 * A document cannot be extracted or indexed until two distinct operators
 * (reviewer + approver) have each signed off with an Ed25519 signature
 * over the content hash payload. The `status` column is the state-machine
 * cursor; transitions are enforced by `@iip/intake` (the gate), not by ad-hoc
 * SQL updates.
 *
 * Nullability discipline (project-context: `.notNull()` by default): the
 * signature/sub/kid/timestamp fields are `.nullable()` because they are
 * populated only at specific lifecycle stages. A `staging` document has no
 * reviewer yet; a `reviewed_once` document has no approver yet. Persisting
 * them as NULL (not empty strings) is load-bearing — a NOT NULL constraint
 * would force fabricated placeholder values, which for defamation-grade
 * attribution is worse than absence (Winston #2/#20). `content_hash`,
 * `status`, and `tier` are NOT NULL at every stage.
 *
 * `status` is branded `.$type<DocumentStatus>()` so a raw string cannot be
 * assigned where a status is required (project-context Winston #1).
 *
 * @rules SEC-2, AC-INTAKE, DoD-1, DoD-7
 * @adr ADR-0001
 */
export const intakeDocuments = pgTable('intake_documents', {
  id: uuid('id').primaryKey().default(sql`gen_random_uuid()`),
  content_hash: text('content_hash').$type<IntakeContentHash>().notNull(),
  status: text('status').$type<DocumentStatus>().notNull(),
  reviewer_sub: text('reviewer_sub'),
  reviewer_signature: text('reviewer_signature'),
  reviewer_key_kid: text('reviewer_key_kid'),
  reviewed_at: timestamp('reviewed_at', { withTimezone: true, mode: 'date' }),
  approver_sub: text('approver_sub'),
  approver_signature: text('approver_signature'),
  approver_key_kid: text('approver_key_kid'),
  approved_at: timestamp('approved_at', { withTimezone: true, mode: 'date' }),
  partner_kid: text('partner_kid'),
  partner_signature: text('partner_signature'),
  tier: integer('tier').notNull(),
  created_at: timestamp('created_at', { withTimezone: true, mode: 'date' })
    .defaultNow()
    .notNull(),
  updated_at: timestamp('updated_at', { withTimezone: true, mode: 'date' })
    .defaultNow()
    .notNull(),
});
