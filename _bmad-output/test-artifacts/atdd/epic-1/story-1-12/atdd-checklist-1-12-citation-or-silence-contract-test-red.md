---
stepsCompleted: ['step-01-preflight-and-context','step-02-generation-mode','step-03-test-strategy','step-04-generate-tests']
lastStep: 'step-04-generate-tests'
lastSaved: '2026-06-26'
workflowType: 'testarch-atdd'
storyId: '1.12'
storyKey: '1-12-citation-or-silence-contract-test-red'
generatedTestFiles:
  - 'tests/contract/citation-or-silence.test.ts'
activationState: 'GREEN-IN-EPIC-1'
activatesIn: 'Epic 2, Story 2.1 (full validation: substring, trust-tier, source-accessibility)'
---

# ATDD Checklist — Epic 1, Story 1.12: Citation-or-Silence Contract Test — The Invariant Spine

**Date:** 2026-06-26 · **Primary Test Level:** contract (property + bidirectional) · **Severity:** **T1 — KEYSTONE**

> This is the defamation-defensive spine of the entire platform. It is the bidirectional, property-tested proof of the citation-or-silence invariant. **The basic invariant is GREEN in Epic 1** (render gate stub enforces null-check). **Full validation activates in Epic 2** when Story 2.1 adds substring verification, trust-tier gating, and source-document accessibility.

## Story Summary
As a developer, I want the citation-or-silence contract test verified, its property test generators fixed, and the CI integration validated, so that the invariant is mechanically enforced, the property test produces valid inputs, and the CI pipeline correctly gates the contract.

## Acceptance Criteria
1. **POSITIVE:** given any rendered assertion, when citation is present and valid, then the assertion is served (EI-1) — GREEN
2. **NEGATIVE:** given any rendered assertion, when citation is absent or invalid, then render output is suppressed — fail-closed, silence is a HARD REQUIREMENT, not a fallback (AC-2, EI-1 bidirectional) — GREEN
3. **PROPERTY:** fuzzes 1000 random inputs and asserts every emitted claim span has non-null `citation.source_id` (positive) AND that no span without `citation.source_id` is emitted (negative) (PC-9 "no uncited path") — GREEN, with valid generators
4. CI pipeline runs `pnpm test:red` as a contract gate and treats exit 0 as success
5. CI pipeline forbids `.only` in all test files and requires `@activates-in` contracts on any `.skip`/`.todo` tests
6. Any PR touching `packages/render/` or `packages/ingest/extract/` re-runs the contract as a merge gate (regression net) — already satisfied by unconditional `test` job
7. Invariant ledger INV-001 reflects actual state: `status: yellow`, with explicit deferred items for Epic 2
8. From Epic 2 onward, when full validation is added, the test must stay GREEN or CI blocks

## Contract Tests
**File:** `tests/contract/citation-or-silence.test.ts` (6 tests, all GREEN against render gate stub)

### POSITIVE (1 test)
- ✅ **cited assertion is served** — GREEN — EI-1

### NEGATIVE (2 tests)
- ✅ **uncited assertion suppressed (fail-closed)** — GREEN — AC-2 hard requirement
- ✅ **no_evidence state when ALL claims lack citation** — GREEN

### INVARIANT (2 tests, PC-9 "no uncited path")
- ✅ **every emitted claim-bearing span has non-null citation.source_id** — GREEN
- ✅ **no span without citation.source_id is emitted as a claim** — GREEN

### TRUST TIER (1 test)
- ✅ **tier-1 cited claim served without corroboration marker** — GREEN — EI-8

### PROPERTY (2 tests, fast-check 1000 runs)
- ✅ **every emitted claim-bearing span has non-null citation.source_id (fuzz)** — GREEN
- ✅ **no span without citation is emitted as a claim (fuzz)** — GREEN

## Implementation Checklist (Epic 1 scope)

- [x] Fix `content_hash` in `citationRefArb` to use `fc.hexaString({ minLength: 64, maxLength: 64 })` (was `fc.string()`)
- [x] Constrain `span_start <= span_end` in generated tuples via `.map()`
- [x] Verify `pnpm test:red` passes all 6 tests with zero `ZodError` on property test
- [x] Verify CI `Forbid .only` step allows the contract test
- [x] Verify CI `Validate .skip/.todo have activation contracts` step passes
- [x] Verify CI `Contract test — citation-or-silence` step runs `pnpm test:red` and expects exit 0
- [x] Update `docs/invariant-ledger.yaml` INV-001 to `status: yellow` with deferred items

**Epic 1 estimated effort:** 0.5 day (generator fix + CI validation + ledger update)

## Activation Checklist (Epic 2, Story 2.1 — separate dev-story)

- [ ] Add substring verification to render gate (validate cited quotes against source chunks)
- [ ] Add trust-tier gating (tier-3 allegations about named persons require corroboration)
- [ ] Add source-document accessibility check (citation must resolve to stored snapshot)
- [ ] Add expired/retracted citation detection
- [ ] Add new RED tests for each Epic 2 validation concern (marked `.skip` with `@activates-in Epic 2 (Story 2.1)`)
- [ ] Un-skip and make GREEN each new test as its validation is implemented
- [ ] 100% Stryker on `packages/render/gate.ts` (SEC-8)
- [ ] CI assertion: all contract tests GREEN, zero skipped

## Notes — Why This Story Exists

> "Citation-or-silence" is not a feature. It is the **personal-criminal-exposure defense**. If the platform serves a defamatory allegation without a verifiable source citation, every team member is individually liable under PH cyberlibel. This test is the mechanical proof that the platform does not do that.

- **The basic invariant is already enforced.** The render gate stub from Story 1.4 strips null-citation claims and sets `no_evidence`. The contract test verifies this and is GREEN.
- **The property test generator was broken.** `content_hash: fc.string()` produced non-hex strings that failed `CorpusHash` Zod validation. `span_start`/`span_end` were unconstrained. This story fixes those generators.
- **Full validation is Epic 2.** Substring verification, trust-tier gating, source-document accessibility, and corroboration requirements are deferred. The invariant ledger tracks these as explicit deferred items.
- **AC-2 (hard gates non-relaxable):** a gate that fails is fixed by fixing the system, NEVER by relaxing the gate. PRs that bump thresholds to pass are REJECTED, not merged.
- **Bidirectional testing is non-negotiable:** POSITIVE alone lets hallucinated citations through; NEGATIVE alone lets valid claims be silently dropped. Both must hold.
- **Property test (PC-9):** "every emitted span has a citation" is a property, not an example. `fast-check` fuzzes the render API surface; a single counter-example is a defamation event.

**Updated by Party Mode adversarial review** — 2026-06-26
