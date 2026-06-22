---
stepsCompleted: ['step-01-preflight-and-context','step-02-generation-mode','step-03-test-strategy','step-04-generate-tests']
lastStep: 'step-04-generate-tests'
lastSaved: '2026-06-22'
workflowType: 'testarch-atdd'
storyId: '1.12'
storyKey: '1-12-citation-or-silence-contract-test-red'
generatedTestFiles:
  - 'packages/eval/citation-or-silence.contract.test.ts'
activationState: 'SKIPPED-IN-EPIC-1'
activatesIn: 'Epic 2, Story 2.1 (render gate live)'
---

# ATDD Checklist — Epic 1, Story 1.12: Citation-or-Silence Contract Test (RED — THE INVARIANT SPINE)

**Date:** 2026-06-22 · **Primary Test Level:** contract (property + bidirectional) · **Severity:** **T1 — KEYSTONE**

> This is the defamation-defensive spine of the entire platform. It is the bidirectional, property-tested proof of the citation-or-silence invariant. **Shipped RED (skipped) in Epic 1. ACTIVATES in Epic 2 when Story 2.1 wires the render gate as a live call site.**

## Story Summary
As a developer, I want a contract test for the citation-or-silence invariant with both positive AND negative assertions, so that the invariant is documented, visible, bidirectionally tested, and ready to activate when the render gate is wired in Epic 2.

## Acceptance Criteria
1. **POSITIVE:** given any rendered assertion, when citation is present and valid, then the assertion is served (EI-1)
2. **NEGATIVE:** given any rendered assertion, when citation is absent or invalid, then render output is suppressed — fail-closed, silence is a HARD REQUIREMENT, not a fallback (AC-2, EI-1 bidirectional)
3. **PROPERTY:** fuzzes every `render.*` export and asserts every emitted span has non-null `citation.source_id` (positive) AND that no span without `citation.source_id` is emitted (negative) (PC-9 "no uncited path")
4. The test is marked as skipped/todo in Epic 1 (documenting the invariant, not blocking)
5. **CI treats `skipped` != `passing`** — ship-blocking if 1.12 contract is still skipped at Epic 2 merge
6. The test will be ACTIVATED (un-skipped) in Epic 2 when the render gate is wired as a live call site
7. From Epic 2 onward, the test must stay GREEN or CI blocks
8. Any PR touching `packages/render/` or `packages/ingest/extract/` must re-run the contract as a merge gate (regression net)

## Red-Phase Scaffolds
**File:** `packages/eval/citation-or-silence.contract.test.ts` (5 tests, all INTENTIONALLY `.skip`)

### POSITIVE (1 test)
- ⏭️ **cited assertion is served** — RED (skip) — activates Epic 2

### NEGATIVE (2 tests)
- ⏭️ **uncited assertion suppressed (fail-closed)** — RED — AC-2 hard requirement
- ⏭️ **invalid-citation assertion suppressed** — RED — AC-4 invalid = no citation

### PROPERTY (1 test, PC-9 "no uncited path")
- ⏭️ **fuzz every render.* export — every span has citation.source_id** — RED — fast-check 3.x, 100 runs

### ACTIVATION CONTRACT (1 test)
- ⏭️ **this file ships skipped in Epic 1, un-skipped in Epic 2 (Story 2.1)** — RED — placeholder asserting the file exists
- ⏭️ **CI re-runs contract on PRs touching render/extract** — RED — ci.yml paths filter

## Implementation Checklist (Epic 1 scope — DOCUMENT the invariant only)

- [ ] Create `packages/eval/citation-or-silence.contract.test.ts` with `describe.skip(...)` — all tests RED by skip
- [ ] Each `test.skip` carries the activation contract as a comment block (when it activates, why)
- [ ] Add CI guard: `if (epic-1-merged && file has test.skip) then fail` — encoded in `ci.yml` post-Epic-2 step
- [ ] Add `.github/workflows/ci.yml` paths filter: `packages/render/**`, `packages/ingest/extract/**` → re-run contract
- [ ] Wire `fast-check@3.x` as devDependency (PC-9 property test)
- [ ] Hash-chain-aware arbitrary (`fc.chain` for prefix-aware sequences) deferred to Story 2.5/2.9

**Epic 1 estimated effort:** 0.5 day (scaffold + CI guard)

## Activation Checklist (Epic 2, Story 2.1 — separate dev-story)

- [ ] Un-skip all 5 tests
- [ ] Render gate wired as LIVE CALL SITE (`gate(input)` invoked on every render — internal AND external per SEC-5)
- [ ] POSITIVE test goes GREEN (cited assertions served)
- [ ] NEGATIVE test goes GREEN (uncited assertions suppressed — fail-closed verified)
- [ ] PROPERTY test goes GREEN (100 fast-check runs, no uncited path)
- [ ] 100% Stryker on `packages/render/gate.ts` (SEC-8)
- [ ] CI assertion: this file has ZERO `test.skip` calls post-Epic-2

## Notes — Why This Story Exists

> "Citation-or-silence" is not a feature. It is the **personal-criminal-exposure defense**. If the platform serves a defamatory allegation without a verifiable source citation, every team member is individually liable under PH cyberlibel. This test is the mechanical proof that the platform does not do that.

- **AC-2 (hard gates non-relaxable)**: a gate that fails is fixed by fixing the system, NEVER by relaxing the gate. PRs that bump thresholds to pass are REJECTED, not merged.
- **Bidirectional testing is non-negotiable**: POSITIVE alone lets hallucinated citations through; NEGATIVE alone lets valid claims be silently dropped. Both must hold.
- **Property test (PC-9)**: "every emitted span has a citation" is a property, not an example. `fast-check` fuzzes the render API surface; a single counter-example is a defamation event.
- **CI asymmetry**: AC-1/SC-6/SEC-8 metric regressions are BINARY FAIL with NO justification path. Performance regressions may be tolerated with a written exception. This asymmetry must be explicit or PMs will trade accuracy for speed at 2am before launch.
- **From Epic 2 onward**: this test MUST stay GREEN. Any PR turning it RED blocks merge unconditionally.

**Generated by BMad TEA Agent** — 2026-06-22
