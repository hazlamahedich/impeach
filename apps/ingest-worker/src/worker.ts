/**
 * Intake state guard — extraction worker entry (SEC-2, AC-6, Task 6).
 *
 * The extraction worker is the ONLY automated actor allowed to advance a
 * document past `approved`. Before ANY extraction work it MUST assert the
 * document is in an extractable state (`approved` or `extracting`); otherwise
 * it throws, aborts, and logs `intake.bypass_attempt` (AC-6). A crashed-and-
 * retried worker resumes from `extracting` (idempotent).
 *
 * NOTE: the architecture spec (canonical for naming, STR-2) names this app
 * `apps/ingest-worker` (sole AGE writer / write-path). The story body's
 * `apps/intake-worker` references are a rename inconsistency; this file
 * implements the guard in the canonical app per the story's own "architecture
 * spec is canonical" directive.
 *
 * @rules SEC-2, AC-6, DoD-2
 * @adr ADR-0001
 */
import type { IntakeDocument, IntakeGate } from '@iip/ingest';

/** Principal identity the worker acts under (system/service account). */
export interface WorkerPrincipal {
  readonly sub: string;
  readonly kid: string;
}

/**
 * Process a single intake document through the extraction gate.
 *
 * 1. Fail-closed assertion (AC-6) — throws `intake.bypass_attempt` for any
 *    non-extractable state. This is the load-bearing guard; a mutant that
 *    removes or inverts it is killed by the worker tests.
 * 2. Approved documents are advanced to `extracting`, then to `indexed` on
 *    completion (the one automated transition).
 * 3. Documents already `extracting` (crashed-worker retry) resume directly to
 *    `indexed` (idempotent).
 *
 * @returns the final (`indexed`) document
 * @throws {import('@iip/ingest').IntakeError} on bypass attempt or invalid state
 *
 * @rules SEC-2, AC-6, DoD-2
 */
export async function processIntakeDocument(
  gate: IntakeGate,
  doc: IntakeDocument,
  principal: WorkerPrincipal,
): Promise<IntakeDocument> {
  // AC-6: assert BEFORE any work. Removing/inverting this is a TC-3.1 mutant.
  await gate.assertExtractable(doc, principal);

  // Approved -> extracting -> indexed (happy path).
  if (doc.status === 'approved') {
    const extracting = await gate.beginExtraction(doc, principal);
    return gate.completeIndexing(extracting);
  }

  // Extracting (idempotent resume) -> indexed. TC-3.7 mutant target: a mutant
  // that rejects the `extracting` branch must be killed by the resume test.
  return gate.completeIndexing(doc);
}
