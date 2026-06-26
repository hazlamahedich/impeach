---
story_id: '1.12'
story_key: '1-12-citation-or-silence-contract-test-red'
epic: 'Epic 1: Foundation'
status: done
last_updated: '2026-06-26'
baseline_commit: 1db658bfd19b91e39305452493d1c613ca04fb79
---

# Story 1.12: Citation-or-Silence Contract Test — The Invariant Spine

Status: done

<!-- Note: Validation is optional. Run validate-create-story for quality check before dev-story. -->

## Story

As a developer,
I want the citation-or-silence contract test verified, its property test generators fixed, and the CI integration validated,
so that the invariant is mechanically enforced, the property test produces valid inputs, and the CI pipeline correctly gates the contract.

## Context

The render gate stub (`packages/render/src/gate.ts`) from Story 1.4 already enforces the basic citation-or-silence invariant: claim spans with null `citation_ref` are stripped, non-claim spans pass through, and `no_evidence` is set when zero cited claims remain. The contract test at `tests/contract/citation-or-silence.test.ts` runs GREEN against this stub — the basic invariant holds.

The "RED" in this story refers to the property test generator bug: `content_hash` in the fast-check arbitrary produces strings that fail `CorpusHash` Zod validation (`/^[a-f0-9]{64}$/`), and `span_start`/`span_end` are unconstrained (can produce `start > end`). These cause `RenderInput.parse()` to throw `ZodError` — the property test fails on schema validation, not on invariant violation.

Full validation (substring verification, trust-tier gating, source-document accessibility, corroboration requirements) is deferred to Epic 2 Story 2.1. The invariant ledger reflects this as `status: yellow` with explicit deferred items.

## Acceptance Criteria

1. **Given** the contract test exists at `tests/contract/citation-or-silence.test.ts`
   **When** the test is run
   **Then** POSITIVE assertion: given any rendered assertion, when citation is present and valid, then the assertion is served (EI-1) — GREEN
2. **And** NEGATIVE assertion: given any rendered assertion, when citation is absent or invalid, then render output is suppressed — fail-closed, silence is a hard requirement, not a fallback (AC-2, EI-1 bidirectional) — GREEN
3. **And** the property test (PC-9) fuzzes 1000 random inputs and asserts every emitted claim span has non-null `citation.source_id` AND no span without `citation.source_id` is emitted — GREEN, with valid generators that satisfy `CorpusHash` and `span_start <= span_end`
4. **And** the CI pipeline runs `pnpm test:red` as a contract gate and treats exit code 0 as success (AC-F1-07)
5. **And** the CI pipeline forbids `.only` in all test files and requires `@activates-in` contracts on any `.skip`/`.todo` tests
6. **And** any PR touching `packages/render/` or `packages/ingest/extract/` re-runs the contract as a merge gate (regression net) — already satisfied by the unconditional `test` job in CI
7. **And** the invariant ledger (`docs/invariant-ledger.yaml`) INV-001 reflects the actual state: `status: yellow`, with explicit deferred items for Epic 2
8. **And** from Epic 2 onward, when full validation is added, the test must stay GREEN or CI blocks

## Tasks / Subtasks

- [x] **Task 1: Fix fast-check property test generators (AC: 3)**
  - [x] Change `content_hash` in `citationRefArb` from `fc.string({ minLength: 1 })` to `fc.hexaString({ minLength: 64, maxLength: 64 })` so generated values satisfy the `CorpusHash` regex `/^[a-f0-9]{64}$/`.
  - [x] Constrain `span_start <= span_end` in the generated tuple using `.map()` to swap when `start > end`.
  - [x] Verify that `pnpm test:red` runs the property test without `ZodError` on `RenderInput.parse()` and all assertions pass.

- [x] **Task 2: Validate CI pipeline contract test integration (AC: 4, 5, 6)**
  - [x] Verify the CI step `Contract test — citation-or-silence` in `.github/workflows/ci.yml` runs `pnpm test:red` and treats exit 0 as success.
  - [x] Verify the CI step `Forbid .only in tests` allows the contract test (which does not use `.only`/`.skip`/`.todo`).
  - [x] Verify the CI step `Validate .skip/.todo have activation contracts` passes (no skipped tests exist in the contract suite).
  - [x] Confirm the `test` job runs unconditionally on all PRs, satisfying the regression net requirement for `packages/render/` and `packages/ingest/extract/`.

- [x] **Task 3: Update invariant ledger INV-001 (AC: 7)**
  - [x] Verify `docs/invariant-ledger.yaml` INV-001 has `status: yellow` with `yellow_reason` documenting the gate stub's current enforcement and `deferred_items` listing what Epic 2 adds.
  - [x] Confirm `deferred_to: "Epic 2 Story 2.1"` is present.

- [x] **Task 4: Verify full test suite and typecheck (AC: 1, 2, 3)**
  - [x] Run `pnpm test:red` — all 8 contract tests pass GREEN.
  - [x] Run `pnpm typecheck` — zero errors (19 packages).
  - [x] Run `pnpm lint` — zero errors.

## Dev Notes

### Fast-Check Property Generator Fix
- The `CorpusHash` type in `packages/contracts/src/citation.ts:12` is branded and enforces `/^[a-f0-9]{64}$/`.
- The `citationRefArb` in `tests/contract/citation-or-silence.test.ts:194-212` previously used `fc.string({ minLength: 1 })` for `content_hash`, producing non-hex characters and wrong lengths → `RenderInput.parse()` throws `ZodError`.
- **Fix applied**: `fc.hexaString({ minLength: 64, maxLength: 64 })` + `.map()` to enforce `span_start <= span_end`.

### Why the Test Is GREEN (Not RED)
- The render gate stub at `packages/render/src/gate.ts` already enforces the basic invariant: `mapSpan()` returns `null` for claim spans with `citation_ref === null`, and `renderGate()` filters nulls.
- The contract test asserts this behavior and passes. The "RED" phase was based on an earlier assumption that the gate threw `NOT IMPLEMENTED` — it does not.
- Full validation (substring, trust-tier, source accessibility, corroboration) is deferred to Epic 2 Story 2.1. At that point, new RED tests will be added for those concerns.

### CI Integration
- The `test` job in `.github/workflows/ci.yml` runs unconditionally on all PRs — no path filter needed for the regression net (AC 8).
- The `Forbid .only` step allows the contract test (no `.only`/`.skip`/`.todo` used).
- The `Validate .skip/.todo have activation contracts` step passes (no skipped tests exist).
- The `Contract test — citation-or-silence` step runs `pnpm test:red` and expects exit 0.

### Project Structure
- Contract test: `tests/contract/citation-or-silence.test.ts`
- Schemas: `packages/contracts/src/citation.ts`, `packages/contracts/src/render.ts`
- Render gate stub: `packages/render/src/gate.ts`
- Invariant ledger: `docs/invariant-ledger.yaml`
- CI workflow: `.github/workflows/ci.yml`

### References
- Defamation operational definition: `docs/adr/0001-defamation-grade-operational-definition.md`
- Invariant Ledger: `docs/invariant-ledger.yaml`
- Project context: `_bmad-output/project-context.md`

## Dev Agent Record

### Agent Model Used
glm-5.2 (zai-coding-plan/glm-5.2)

### Debug Log References
- `pnpm test:red` → 8 tests GREEN (property test runs 1000 iterations, zero `ZodError`)
- `pnpm typecheck` → 19 packages, zero errors
- `pnpm lint` → zero errors
- `pnpm test` (full regression) → 135 root tests + 15 package tasks, all GREEN

### Completion Notes List
- **Task 1 (generators fixed):** `content_hash` changed from `fc.string({ minLength: 1 })` to `fc.hexaString({ minLength: 64, maxLength: 64 })` so generated values satisfy `CorpusHash` (`/^[a-f0-9]{64}$/`). Span ordering enforced via `.map()` swapping `span_start`/`span_end` with `Math.min`/`Math.max`. Property test now parses through `RenderInput.parse()` without `ZodError` across 1000 runs.
- **Task 2 (CI validated):** `.github/workflows/ci.yml` `test` job runs unconditionally on all PRs (regression net). The `Contract test — citation-or-silence` step runs `pnpm test:red` and treats exit 0 as success. The `Forbid .only` step (no `.only` in contract suite) and `Validate .skip/.todo have activation contracts` step (no skipped tests) both pass. The original single "Forbid .only/.skip/.todo" step was split into two distinct steps to satisfy AC-5 (`.only` forbidden outright; `.skip`/`.todo` allowed only with `@activates-in` contract).
- **Task 3 (ledger updated):** `docs/invariant-ledger.yaml` INV-001 promoted from `status: red` to `status: yellow` with `yellow_reason` documenting the render-gate stub's null-check enforcement, `deferred_to: "Epic 2 Story 2.1"`, and `deferred_items` enumerating substring verification, trust-tier gating, source-document accessibility, corroboration, expired/retracted detection, and runtime enforcement.
- **Task 4 (full suite GREEN):** 8 contract tests, 19 typecheck packages, lint clean, full regression (135 + 15 package tasks) GREEN.
- No new dependencies required. No code beyond the story scope was touched.

### File List
- `tests/contract/citation-or-silence.test.ts` — fixed fast-check generators (`fc.hexaString` + span `.map()` swap)
- `.github/workflows/ci.yml` — split `.only/.skip/.todo` forbid step into two distinct CI steps (AC-5)
- `docs/invariant-ledger.yaml` — INV-001 `red` → `yellow` with deferred items
- `_bmad-output/implementation-artifacts/sprint-status.yaml` — story status tracking
- `_bmad-output/implementation-artifacts/1-12-citation-or-silence-contract-test-red.md` — this story file
- `_bmad-output/test-artifacts/atdd/epic-1/story-1-12/atdd-checklist-1-12-citation-or-silence-contract-test-red.md` — ATDD checklist

## Change Log

- 2026-06-26: Story implementation complete. Fixed fast-check property test generators (`content_hash` → `fc.hexaString`, span ordering enforced). Validated CI pipeline contract gate (`.only` forbid + `.skip/.todo` activation contracts). Updated invariant ledger INV-001 to `yellow`. All 8 contract tests GREEN, full regression GREEN.
