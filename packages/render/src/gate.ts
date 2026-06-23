/**
 * Render Gate — the mechanical enforcement point for citation-or-silence.
 *
 * @rules AC-2, SEC-5, EI-1
 * @adr ADR-001
 *
 * STUB: This module will be implemented in Epic 2 (Story 2.1).
 * It currently throws to keep the contract test RED.
 */

import type { RenderInputType, RenderDocumentType } from '@iip/contracts';

/**
 * The render gate processes a RenderInput and produces a RenderDocument
 * where every claim-bearing span carries a valid citation. Uncited
 * claim-bearing spans are stripped (fail-closed).
 *
 * CONTRACT:
 * - Every span where is_claim=true MUST have non-null citation.
 * - If backing services degrade, the gate refuses to serve.
 * - The gate fires on EVERY render, internal or external.
 */
export function renderGate(_input: RenderInputType): RenderDocumentType {
  throw new Error(
    'renderGate: NOT IMPLEMENTED — Epic 2 Story 2.1 owns this. ' +
    'Contract test is RED by design until the gate is wired.',
  );
}
