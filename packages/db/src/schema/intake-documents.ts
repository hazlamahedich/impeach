import { pgTable, uuid, timestamp, text, integer, boolean } from 'drizzle-orm/pg-core';
import { sql } from 'drizzle-orm';
import type { DocumentStatus, IntakeContentHash, RetentionPolicy } from '@iip/contracts';

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

  // ─────────────────────────────────────────────────────────────────────
  // Retention / takedown metadata (Story 2.6a — AR-23, VAL-2 G-2).
  // Three ORTHOGONAL concepts; see packages/contracts/src/intake/retention.ts:
  //   - retention_class : the governance HOLD CLASS (branded RetentionPolicy)
  //   - takedown_trigger: the removal RATIONALE (free text — court_order, dmca,
  //                       editor_retraction). Distinct from the class and the
  //                       freeze flag.
  //   - legal_hold      : the litigation-FREEZE flag (boolean).
  //   - retention_set_at: when the non-default class/hold was set.
  //
  // Nullability rationale (Option A — nullable-conditional, per Amelia):
  // `retention_class`, `takedown_trigger`, and `retention_set_at` are
  // `.nullable()` because they are populated ONLY when a takedown/hold event
  // triggers. At defamation grade, NULL `retention_class` = "no decision yet"
  // (honest); a fabricated `'standard'` default would read as "actively
  // classified" when no decision was made — a lie that looks like compliance
  // (Winston #2/#20). `legal_hold` is the SOLE exception: boolean-NULL is an
  // anti-pattern (three-valued logic on a freeze flag is incoherent), so it is
  // NOT NULL DEFAULT false — false is the honest "not held." A vocabulary
  // CHECK on `retention_class` lives in the hand-authored SQL migration only
  // (near-zero-cost belt-and-suspenders; the Drizzle def stays nullable).
  //
  // `superseded_at` is NOT in this story — moved to ADR-0017
  // (supersession-orchestration) scope; a lone timestamp under-models what
  // ADR-0017 must orchestrate (successor FK, reason, audit).
  //
  // ⚠️ FORGEABILITY GUARD — retention_set_at (review open item):
  // Unlike `created_at`/`updated_at` (which use `.defaultNow()`), this column
  // has NO DB default and NO `.$defaultFn`. Project rule (PC-8): "app NEVER
  // sends timestamps." When the retention WRITE path lands, `retention_set_at`
  // MUST be stamped server-side via an injected `now()` clock (mirroring
  // packages/editorial/src/editorial-log-repo.ts), NEVER accepted from request
  // input — a client-supplied value could back-date or forward-date a
  // litigation hold, undermining audit defensibility in a defamation-grade
  // system. No write path exists in this story; tracked as a review open item
  // for the retention-write story.
  // ─────────────────────────────────────────────────────────────────────
  retention_class: text('retention_class').$type<RetentionPolicy>(),
  takedown_trigger: text('takedown_trigger'),
  legal_hold: boolean('legal_hold').notNull().default(false),
  retention_set_at: timestamp('retention_set_at', { withTimezone: true, mode: 'date' }),
});
