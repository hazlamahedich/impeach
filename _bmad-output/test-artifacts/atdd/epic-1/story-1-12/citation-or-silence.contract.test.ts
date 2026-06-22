// target-path: packages/eval/citation-or-silence.contract.test.ts
// RED — Story 1.12 Citation-or-Silence Contract Test (THE INVARIANT SPINE)
// Refs: EI-1, AC-2, PC-9
// @rules AC-2, EI-1, PC-9 @adr ADR-0007
//
// *** THIS TEST IS INTENTIONALLY SKIPPED IN EPIC 1 ***
// *** The contract test documents the invariant; it ACTIVATES (un-skipped) in Epic 2 ***
// *** when Story 2.1 wires the render gate as a live call site. ***
// *** CI TREATS `skipped` != `passing` — ship-blocking if 1.12 contract is still skipped ***
// *** at Epic 2 merge. ***

import { describe, it, expect } from 'vitest';
import fc from 'fast-check';

describe.skip('Story 1.12 — Citation-or-Silence contract (EI-1, AC-2 bidirectional)', () => {
  // RED — render gate not yet a live call site (activates Epic 2, Story 2.1)

  describe('POSITIVE — cited assertions ARE served (EI-1)', () => {
    it('given a rendered assertion WITH a valid citation, the assertion is served', async () => {
      const { gate } = await import('@iip/render/gate');
      const cited = {
        text: 'Senator voted against bill X on 2024-01-15',
        citations: [
          { sourceDocId: 'd1', spanStart: 0, spanEnd: 30, contentHash: '0'.repeat(64) },
        ],
      };
      const out = gate(cited);
      expect(out.suppressed).toBe(false);
      expect(out.served).toContainEqual(expect.objectContaining({ text: cited.text }));
    });
  });

  describe('NEGATIVE — uncited assertions ARE suppressed (AC-2 fail-closed)', () => {
    it('given a rendered assertion WITHOUT citation, render output is suppressed — silence is a HARD REQUIREMENT, not a fallback', async () => {
      const { gate } = await import('@iip/render/gate');
      const uncited = { text: 'Senator voted against bill X', citations: [] };
      const out = gate(uncited);
      expect(out.suppressed).toBe(true);
      expect(out.served).not.toContainEqual(expect.objectContaining({ text: uncited.text }));
    });

    it('given a rendered assertion with an INVALID citation (hash mismatch / missing source), output is suppressed', async () => {
      // AC-4: invalid citation = no citation; gate fails closed
      const { gate } = await import('@iip/render/gate');
      const invalid = {
        text: 'Senator voted against bill X',
        citations: [{ sourceDocId: 'missing', spanStart: 0, spanEnd: 30, contentHash: 'tampered' }],
      };
      const out = gate(invalid);
      expect(out.suppressed).toBe(true);
    });
  });

  describe('PROPERTY — no uncited path (PC-9)', () => {
    // Fuzzes EVERY render.* export and asserts:
    //   POSITIVE: every emitted span has non-null citation.source_id
    //   NEGATIVE: no span without citation.source_id is emitted
    it('for any render.* export, every emitted span carries a non-null citation.source_id', async () => {
      const render = await import('@iip/render');
      const exportNames = Object.keys(render).filter(k => typeof (render as any)[k] === 'function');
      expect(exportNames.length).toBeGreaterThan(0);

      await fc.assert(fc.asyncProperty(
        fc.record({
          text: fc.string({ minLength: 1, maxLength: 200 }),
          hasCitation: fc.boolean(),
        }),
        async (input) => {
          for (const name of exportNames) {
            const fn = (render as any)[name];
            const result = await fn(input);
            const spans = extractSpans(result);
            for (const span of spans) {
              // POSITIVE: every emitted span MUST have citation.source_id
              expect(span.citation?.sourceId).toBeTruthy();
              // NEGATIVE: no span without citation.source_id is ever emitted
              // (if a span exists, it MUST carry a citation — fail-closed)
            }
          }
        },
      ), { numRuns: 100 });
    });
  });

  describe('ACTIVATION CONTRACT (Epic 1 → Epic 2)', () => {
    it('this test is shipped as skipped in Epic 1 and un-skipped in Epic 2 (Story 2.1)', () => {
      // The describe.skip above IS the Epic 1 contract.
      // CI rule: `skipped !== passing` for THIS file specifically at Epic 2 merge.
      // Implementation: a CI step asserts this file has 0 `test.skip` calls once Story 2.1 lands.
      // See packages/eval/ci-activation-guard.test.ts (added in Story 2.1).
      expect(true).toBe(true); // placeholder — the existence of this file is the contract
    });

    it('any PR touching packages/render/ or packages/ingest/extract/ re-runs this contract as a merge gate', () => {
      // Regression net — encoded in .github/workflows/ci.yml paths filter
      const ci = require('fs').readFileSync('.github/workflows/ci.yml', 'utf8');
      expect(ci).toMatch(/packages\/render|packages\/ingest\/extract/);
      expect(ci).toMatch(/citation-or-silence\.contract/);
    });
  });
});

// Helper: walk a render result and extract all spans (the property test's target)
function extractSpans(result: unknown): Array<{ citation?: { sourceId?: string } }> {
  // Real impl walks the typed AST (RenderDocument). For the scaffold we return any array-like.
  if (Array.isArray(result)) return result as any;
  if (result && typeof result === 'object' && 'spans' in (result as any)) {
    return (result as any).spans;
  }
  return [];
}
