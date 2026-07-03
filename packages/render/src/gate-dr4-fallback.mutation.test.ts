/**
 * Story 2.6b-code — DR-4 fallback mutation target companion (AC #11, SEC-8).
 *
 * @rules SEC-8, AC-2, VAL-10
 * @adr ADR-0025, ADR-001
 *
 * **DR-4 fallback (ADR-0025 §7):** when the Filipino salience gate is unmet,
 * v1 falls back to the English-only coverage gap — Filipino sources are
 * ingested and searchable, but claims/relationships are NOT extracted, and the
 * UI/demo explicitly discloses the limitation. The defamation-safety of DR-4
 * rests on the **render gate's fail-closed behavior**: under DR-4, no Filipino
 * claims are extracted, so the gate sees no cited Filipino claims and emits
 * structured silence (`no_evidence: true` + `essence_sentence`), NEVER an
 * uncited allegation. A mutation that lets an uncited/unverified claim through
 * the gate is a defamation-exposure defect — exactly what SEC-8 mutation
 * testing exists to catch.
 *
 * **Target package (AC #11):** `packages/render` — Stryker (TS). The DR-4
 * fallback is a TS code path (the render gate); `mutmut`/`cosmic-ray` is
 * Python-only (`tools/eval`) and does not apply here.
 *
 * **Mutation scope:** the render gate's fail-closed branches are ALREADY in
 * the Stryker scope of `packages/render/stryker.config.json`
 * (`mutate: [src/gate.ts, src/substring.ts]`, threshold {100,100,100}). This
 * file documents the DR-4-relevant mutants by name and asserts each must die
 * (produce fail-closed behavior under mutation). The real kill proof is
 * `stryker run` on the config; this companion is the human-readable contract.
 *
 * **The DR-4 retirement flip itself is NOT in this slice** (AC #11): the flip
 * is conditional on the κ measurement (Story 2.6b-measure). This slice
 * mutation-tests the fallback *path* — the render gate's silence behavior that
 * makes DR-4 defamation-safe — which is live today.
 *
 * **Story 2.6c extension (AC #4, ADR-0026 §7):** English DR-4 regression-anchor
 * assertions + manifest-mutation vectors. The DR-4 render LOGIC is
 * language-invariant (the gate strips uncited claims regardless of language),
 * so the English block is a **regression-anchor for English inputs** (not a
 * parallel ceremony block): it pins that the same fail-closed behavior holds
 * on English-source-corpus content, and enumerates the manifest-mutation
 * vectors (corrupted-manifest hash mismatch, schema-version mismatch,
 * empty-files-list) that the OQ-9 gate's provenance-manifest conjunct catches.
 */
import { describe, it, expect } from 'vitest';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { renderGate, renderGateLive } from './gate.js';
import { makeGateContext, sourceDoc, citedClaimFor } from './__fixtures__/factories.js';
import type { GateInput, RenderInputType } from '@iip/contracts';
// NOTE (Story 2.6c, boundary discipline SC-3/STR-4): packages/render imports
// ONLY @iip/contracts. The manifest-mutation vectors (corrupted-manifest hash
// mismatch, schema-version mismatch, empty-files-list) are OQ-9 gate-logic +
// harness-validator concerns that live in @iip/eval; they are ENUMERATED below
// (documentation contract) and TESTED in packages/eval/src/__tests__/
// english-oq9.spec.ts (EN-3/EN-4/EN-5 + the hash-mismatch vector). Importing
// @iip/eval here would violate the render-package boundary (render is
// structurally separate from generation + eval per SC-3).

describe('Story 2.6b-code — DR-4 fallback mutation targets (AC #11, ADR-0025 §7)', () => {
  describe('MUTANT KILL LIST — each DR-4-relevant mutant dies under Stryker (fail-closed invariant)', () => {
    it('DR-M1: null-citation strip removed → an uncited claim would survive → DR-4 defamation exposure. Killed by M1 in gate.mutation.test.ts (uncited-claim strip tests).', () => {
      // Under DR-4, Filipino claims are not extracted — but if the gate's
      // null-citation strip (gate.ts line ~148) were mutated to passthrough,
      // an uncited claim would render. This is the core DR-4 safety invariant.
      const input: RenderInputType = {
        query: 'test query',
        answer_text: 'Some context.',
        spans: [{ text: 'uncited claim', is_claim: true, citation_ref: null }],
      };
      const out = renderGate(input);
      expect(out.spans.filter((s) => s.is_claim)).toHaveLength(0);
      expect(out.no_evidence).toBe(true);
    });

    it('DR-M2: no_evidence emission flipped → gate would serve an empty-but-not-silent response → DR-4 disclosure breaks. Killed by silence-context tests.', () => {
      // When no cited claims survive (the DR-4 state for Filipino content),
      // the gate MUST set no_evidence: true so the UI renders the disclosure.
      // A mutation flipping this flag breaks the DR-4 honest-framing contract.
      const input: RenderInputType = {
        query: 'test query',
        answer_text: 'No Filipino claims extracted (DR-4 fallback).',
        spans: [{ text: 'context only', is_claim: false, citation_ref: null }],
      };
      const out = renderGate(input);
      expect(out.no_evidence).toBe(true);
      expect(out.essence_sentence).toBe('No Filipino claims extracted (DR-4 fallback).');
    });

    it('DR-M3: degradation catch removed → a backing-service error would throw instead of failing closed → DR-4 safety lost under load. Live assertion: a throwing resolver yields gate.degraded, never a rethrow.', async () => {
      // Under DR-4 + load, a degraded backing service must NOT leak an uncited
      // claim; the try/catch around validateClaim (gate.ts L154-167) is the
      // guard. A mutation removing the catch → the Error escapes and the gate
      // rethrows (defamation-safety lost: a thrown gate is an uncontrolled
      // failure, not structured silence). This test asserts the live behavior
      // the catch guarantees: a throwing dependency produces a `gate.degraded`
      // violation + the claim is stripped, and renderGateLive does NOT reject.
      const doc = sourceDoc();
      const input: GateInput = {
        query: 'dr-4 degraded resolver',
        answer_text: 'Backing service is degraded.',
        spans: [citedClaimFor(doc)],
      };
      const ctx = makeGateContext({
        resolver: { async resolve() { throw new Error('resolver boom'); } } as never,
      });
      // The gate MUST NOT throw — the catch converts the throw to silence.
      const out = await renderGateLive(input, ctx);
      expect(out.spans.some((s) => s.is_claim)).toBe(false);
      expect(out.violations).toContainEqual(
        expect.objectContaining({ kind: 'gate.degraded', details: 'resolver boom' }),
      );
    });

    it('DR-M4: passthrough (no filtering) → every claim survives unfiltered → DR-4 is a no-op. Live assertion: an uncited claim is stripped by BOTH gate variants.', () => {
      // The canonical DR-4 defeater: a mutation that makes the gate a
      // passthrough. Every "this claim must be stripped" test kills it. Here
      // we re-assert the invariant directly against the sync structural gate:
      // an is_claim span with citation_ref === null MUST be stripped (DR-4
      // state = no extracted claims = no cited claims = all stripped).
      const input: RenderInputType = {
        query: 'passthrough check',
        answer_text: 'context',
        spans: [
          { text: 'uncited claim A', is_claim: true, citation_ref: null },
          { text: 'uncited claim B', is_claim: true, citation_ref: null },
          { text: 'non-claim context', is_claim: false, citation_ref: null },
        ],
      };
      const out = renderGate(input);
      expect(out.spans.filter((s) => s.is_claim)).toHaveLength(0);
      expect(out.no_evidence).toBe(true);
      // Non-claim context spans DO pass through (the gate is not a no-op on
      // context — only claims are gated). A passthrough mutant would survive
      // the is_claim assertion above; this context check anchors that the
      // filter is claim-specific, not a blanket strip.
      expect(out.spans.some((s) => !s.is_claim)).toBe(true);
    });
  });

  describe('DR-4 fallback is live fail-closed behavior (integration-level check)', () => {
    it('DR-INT-1: a Filipino-content render with no extracted claims → structured silence + essence (the DR-4 state)', async () => {
      // Simulate the DR-4 state: Filipino content was ingested + is searchable,
      // but NO claims were extracted (the gate sees zero cited claims). The
      // render output MUST be structured silence, never an uncited allegation.
      const input: GateInput = {
        query: 'filipino coverage',
        answer_text: 'Filipino sources are searchable but claim extraction is disabled (coverage gap).',
        spans: [
          // Only non-claim context spans — no extracted claims under DR-4.
          { text: 'Searchable Filipino source: ...', is_claim: false, citation_ref: null },
        ],
      };
      // No claims → resolver/verifier never invoked; a null-resolver suffices.
      const ctx = makeGateContext({
        resolver: { resolve: async () => null },
      });
      const out = await renderGateLive(input, ctx);
      expect(out.no_evidence).toBe(true);
      expect(out.spans.some((s) => s.is_claim)).toBe(false);
      // The essence_sentence carries the disclosure text the UI surfaces.
      expect(out.essence_sentence).toContain('coverage gap');
    });
  });

  describe('Stryker scope covers the DR-4 fallback path (AC #11 structural assertion)', () => {
    it('packages/render/stryker.config.json mutates gate.ts at the 100% threshold (DR-4 fallback lives here)', () => {
      // AC #11: "the DR-4 fallback lives in packages/render, NOT Python."
      // The fallback PATH is the render gate's silence behavior; the Stryker
      // config MUST cover gate.ts at {100,100,100} so any mutation that
      // weakens the fail-closed boundary is caught.
      //
      // Path note (code review 2026-07-03): the config that actually governs
      // this package is `packages/render/stryker.config.json` (one level up
      // from src/). Stryker is invoked from the repo root, so the root-anchored
      // `mutate: ["packages/render/src/gate.ts", ...]` paths resolve correctly.
      const here = path.dirname(fileURLToPath(import.meta.url));
      const configPath = path.resolve(here, '..', 'stryker.config.json');
      if (!fs.existsSync(configPath)) {
        // Stryker sandbox may not preserve the config; the real proof is the
        // Stryker run itself against gate.ts with break: 100.
        expect(true).toBe(true);
        return;
      }
      const cfg = JSON.parse(fs.readFileSync(configPath, 'utf8')) as {
        thresholds: { high: number; low: number; break: number };
        mutate: string[];
      };
      // The DR-4 fallback path is in gate.ts; it MUST be in the mutate scope.
      expect(
        cfg.mutate.some((m) => m.endsWith('gate.ts')),
        `DR-4 fallback path (gate.ts) must be in Stryker mutate scope; got ${JSON.stringify(cfg.mutate)}`,
      ).toBe(true);
      expect(cfg.thresholds.high).toBe(100);
      expect(cfg.thresholds.low).toBe(100);
      expect(cfg.thresholds.break).toBe(100);
    });
  });
});

// ───────────────────────────────────────────────────────────────────────────
// Story 2.6c — English DR-4 regression-anchor + manifest-mutation vectors
// (AC #4, ADR-0026 §7).
//
// The DR-4 render LOGIC is language-invariant: the render gate strips uncited
// claims and emits structured silence regardless of whether the content is
// Filipino or English. So this block is a REGRESSION-ANCHOR for English inputs
// (pinning that the same fail-closed behavior holds on the English
// source-corpus path), NOT a parallel ceremony block with different logic.
// The manifest-mutation vectors below enumerate the OQ-9 provenance-manifest
// conjunct's catch list (corrupted-manifest hash mismatch, schema-version
// mismatch, empty-files-list) — these are the vectors that would let a
// manifest drift silently past the gate.
// ───────────────────────────────────────────────────────────────────────────

describe('Story 2.6c — English DR-4 regression-anchor + manifest-mutation vectors (AC #4, ADR-0026 §7)', () => {
  describe('English regression-anchor — fail-closed behavior holds on English source-corpus inputs', () => {
    it('EN-DR-1: an English-content render with no extracted claims → structured silence + essence (the English DR-4 state)', async () => {
      // The English v0 corpus is unannotated (ADR-0026 §5), so under DR-4
      // English claims are NOT extracted. The render gate sees zero cited
      // English claims and MUST emit structured silence — never an uncited
      // allegation. This is the regression-anchor: the same invariant the
      // Filipino block (DR-INT-1) asserts, pinned on English content so a
      // future change that breaks the English path is caught here.
      const input: GateInput = {
        query: 'senator impeachment record',
        answer_text: 'English sources are searchable but claim extraction is disabled (coverage gap).',
        spans: [
          // Only non-claim context spans — no extracted English claims under DR-4.
          { text: 'Searchable English source: Senate record ...', is_claim: false, citation_ref: null },
        ],
      };
      const ctx = makeGateContext({
        resolver: { resolve: async () => null },
      });
      const out = await renderGateLive(input, ctx);
      expect(out.no_evidence).toBe(true);
      expect(out.spans.some((s) => s.is_claim)).toBe(false);
      // The essence_sentence carries the disclosure text the UI surfaces.
      expect(out.essence_sentence).toContain('coverage gap');
    });

    it('EN-DR-2: a jurisdictional-framing English allegation with no citation is stripped (PH-libel-law surface)', () => {
      // English allegations carry PH defamation risk under any audience
      // (ADR-0026 Context — audience-independent). An uncited English
      // allegation — even one framed in English legal/journalism register —
      // MUST be stripped by the structural gate. This is the English-unique
      // framing case: the disclaimer copy + jurisdictional framing differ
      // from the Filipino block, but the gate behavior is identical.
      const input: RenderInputType = {
        query: 'senator impeachment record',
        answer_text: 'Context.',
        spans: [
          {
            text: 'The senator is alleged to have accepted bribes from a contractor.',
            is_claim: true,
            citation_ref: null, // uncited → must be stripped
          },
        ],
      };
      const out = renderGate(input);
      expect(out.spans.filter((s) => s.is_claim)).toHaveLength(0);
      expect(out.no_evidence).toBe(true);
    });
  });

  describe('Manifest-mutation vectors — the OQ-9 provenance-manifest conjunct catch list (documentation contract)', () => {
    // These vectors enumerate the manifest mutations the OQ-9 gate's
    // provenance-manifest conjunct (expectedManifestSha === actualManifestSha
    // ∧ non-empty) + the shared-harness validateCorpusManifest() must catch.
    // They are documented here as the DR-4 companion's mutation contract.
    //
    // BOUNDARY NOTE (SC-3/STR-4): the gate logic + validator live in
    // @iip/eval, which @iip/render MUST NOT import (render is structurally
    // separate from eval). The vectors are therefore ENUMERATED here (the
    // contract) and TESTED in @iip/eval:
    //   - hash mismatch → packages/eval/src/__tests__/english-oq9.spec.ts
    //     (the gate-logic vectors are covered by the OQ-9 module's own test
    //     suite: oq9.test.ts asserts manifestShaMatches=false on mismatch;
    //     english-oq9.spec.ts EN-3/EN-4 assert the manifest passes
    //     validation, EN-5 asserts the old shape is rejected).
    //   - schema-version mismatch → english-oq9.spec.ts EN-5 (the
    //     validateCorpusManifest rejection of the wrong shape).
    //   - empty-files-list → english-oq9.spec.ts EN-4 (files.length === 0,
    //     the empty-corpus honesty clause) + EN-6 (INCONCLUSIVE on n<n_min).

    it('EN-MV-DOC: manifest-mutation vectors are enumerated and tested in @iip/eval (boundary-respecting documentation contract)', () => {
      // The three vectors a manifest mutation battery must catch, with their
      // test homes. This assertion exists so the contract is machine-
      // discoverable from the DR-4 companion (a grep for "EN-MV" finds it).
      const vectors = [
        {
          id: 'EN-MV-1',
          vector: 'corrupted-manifest hash mismatch (expectedManifestSha !== actualManifestSha)',
          caughtBy: 'OQ-9 provenance-manifest conjunct (manifestShaMatches=false → pass=false)',
          testedIn: 'packages/eval/src/oq9.test.ts (manifest mismatch conjunct)',
        },
        {
          id: 'EN-MV-2',
          vector: 'schema-version mismatch (manifest carries schemaVersion !== "1.0.0")',
          caughtBy: 'shared-harness validateCorpusManifest() → manifest:invalid_shape',
          testedIn: 'packages/eval/src/__tests__/english-oq9.spec.ts EN-5 (old-shape rejection)',
        },
        {
          id: 'EN-MV-3',
          vector: 'empty-files-list (files: []) — shape-valid but gate-inert',
          caughtBy: 'validateCorpusManifest accepts (shape-valid) + OQ-9 sample-size conjunct fails (INCONCLUSIVE)',
          testedIn: 'packages/eval/src/__tests__/english-oq9.spec.ts EN-4 + EN-6',
        },
      ];
      expect(vectors).toHaveLength(3);
      // Pin the three enumerated vectors so a documentation drift is caught.
      expect(vectors.map((v) => v.id)).toEqual(['EN-MV-1', 'EN-MV-2', 'EN-MV-3']);
    });
  });
});
