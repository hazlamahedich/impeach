/**
 * Intake document repository — DB row <-> IntakeDocument mapping (SEC-2, DoD-8).
 *
 * The API routes load a document, run the gate transition, then persist the
 * resulting state + signatures atomically inside `withTx` (DoD-8). Only the
 * lifecycle columns touched by the gate are written; immutable provenance
 * (e.g. `id`, `content_hash`, `tier`) is never overwritten.
 *
 * All repository functions accept an explicit `Db` handle so callers can pass
 * either the pool or a transaction-bound query builder. This makes the
 * load/save operations transactional when used inside `withTx`.
 *
 * @rules SEC-2, DoD-7, DoD-8
 * @adr ADR-0001
 */
import { eq } from 'drizzle-orm';
import type { Db } from '@iip/db';
import { intakeDocuments } from '@iip/db';
import type { DocumentStatus, IntakeContentHash } from '@iip/contracts';
import type { IntakeDocument } from '@iip/intake';

/** A raw intake_documents row (Drizzle inferred type). */
type IntakeRow = typeof intakeDocuments.$inferSelect;

/** Map a Drizzle row to the gate's IntakeDocument. */
export function rowToDocument(row: IntakeRow): IntakeDocument {
  return {
    id: row.id,
    content_hash: row.content_hash as IntakeContentHash,
    status: row.status as DocumentStatus,
    tier: row.tier,
    reviewer_sub: row.reviewer_sub,
    reviewer_signature: row.reviewer_signature,
    reviewer_key_kid: row.reviewer_key_kid,
    reviewed_at: row.reviewed_at,
    approver_sub: row.approver_sub,
    approver_signature: row.approver_signature,
    approver_key_kid: row.approver_key_kid,
    approved_at: row.approved_at,
    partner_kid: row.partner_kid,
    partner_signature: row.partner_signature,
  } as IntakeDocument;
}

/** Load a single intake document by id, or `undefined` if absent. */
export async function loadDocument(
  db: Db,
  documentId: string,
): Promise<IntakeDocument | undefined> {
  const rows = await db
    .select()
    .from(intakeDocuments)
    .where(eq(intakeDocuments.id, documentId))
    .limit(1);
  const row = rows[0];
  return row !== undefined ? rowToDocument(row) : undefined;
}

/** Persist the lifecycle columns mutated by a gate transition. */
export async function saveDocument(
  db: Db,
  doc: IntakeDocument,
): Promise<void> {
  await db
    .update(intakeDocuments)
    .set({
      status: doc.status,
      reviewer_sub: doc.reviewer_sub,
      reviewer_signature: doc.reviewer_signature,
      reviewer_key_kid: doc.reviewer_key_kid,
      reviewed_at: doc.reviewed_at,
      approver_sub: doc.approver_sub,
      approver_signature: doc.approver_signature,
      approver_key_kid: doc.approver_key_kid,
      approved_at: doc.approved_at,
      partner_kid: doc.partner_kid,
      partner_signature: doc.partner_signature,
      updated_at: new Date(),
    })
    .where(eq(intakeDocuments.id, doc.id));
}

/** Factory returning transaction-aware load/save functions for route wiring. */
export function createRepositoryForTx(db: Db) {
  return {
    loadDoc: (documentId: string) => loadDocument(db, documentId),
    saveDoc: (doc: IntakeDocument) => saveDocument(db, doc),
  };
}
