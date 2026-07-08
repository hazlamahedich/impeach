---
stepsCompleted: ['step-01-preflight-and-context','step-02-generation-mode','step-03-test-strategy','step-04-generate-tests','step-04c-aggregate','step-05-validate-and-complete']
lastStep: 'step-05-validate-and-complete'
lastSaved: '2026-07-08'
workflowType: 'testarch-atdd'
storyId: 'epic-3-coverage-gaps'
storyKey: 'epic3-coverage-gaps'
storyFile: '_bmad-output/test-artifacts/test-design-epic-3.md (Coverage Gap Tests section)'
atddChecklistPath: '_bmad-output/test-artifacts/atdd/epic-3/coverage-gaps/atdd-checklist-epic3-coverage-gaps.md'
generatedTestFiles:
  - 'tests/contract/source-confirmation.contract.test.ts'
  - 'tests/contract/fetch-adapter.contract.test.ts (FA-7, FA-8 appended)'
  - 'tests/integration/raw-snapshot-minio.integration.test.ts'
  - 'packages/config/src/queues.test.ts'
  - 'tests/integration/operator-triage-routes.integration.test.ts (OT-API-6, OT-API-7 appended)'
inputDocuments:
  - '_bmad-output/test-artifacts/test-design-epic-3.md'
  - '_bmad-output/project-context.md'
  - 'packages/contracts/src/ingest.ts'
  - 'packages/contracts/src/trust-tier.ts'
  - 'packages/config/src/queues.ts'
  - 'packages/db/src/schema/sources.ts'
  - 'tests/support/helpers/ingest.ts'
  - 'tests/contract/fetch-adapter.contract.test.ts (existing pattern)'
  - 'tests/integration/source-registry-routes.integration.test.ts (existing pattern)'
activationState: 'MIXED — 5 files RED/skip, 1 file GREEN'
activatesIn: 'Story 3.1/3.3/3.4/3.7 implementation (RED tests); queues.test.ts already GREEN'
---

# ATDD Checklist — Epic 3 Coverage Gap Tests

**Date:** 2026-07-08 · **Source:** Epic 3 test-design (test-design-epic-3.md, §Coverage Gaps) · **Span:** Stories 3.1, 3.3, 3.4, 3.6, 3.7

> These 6 tests close the coverage gaps the test-design risk assessment identified beyond the 44 per-story ATDD scaffolds. Each targets a defamation-adjacent risk the existing scaffolds do not cover.

## Risk → Test Mapping

| Gap ID | Risk | Story | Level | File | Status |
|---|---|---|---|---|---|
| 3.1-CTR-6 | R3.1a — self-declared trust tier as `confirmed:true` (SEC-3) | 3.1 | contract | `tests/contract/source-confirmation.contract.test.ts` (NEW) | RED (5 skipped) |
| 3.3-CTR-7 | R3.3c — OCR cleaning hallucinates text → fabricated quote | 3.3 | contract | `tests/contract/fetch-adapter.contract.test.ts` FA-7 (appended) | RED (skip) |
| 3.3-UNIT-8 | R3.3d — Firecrawl adapter hangs (no AbortSignal) | 3.3 | contract* | `tests/contract/fetch-adapter.contract.test.ts` FA-8 (appended) | RED (skip) |
| 3.4-INT-6 | R3.4c — MinIO bucket not versioned append-only (NFR-S-5) | 3.4 | integration | `tests/integration/raw-snapshot-minio.integration.test.ts` (NEW) | RED (3 skipped) |
| 3.6-UNIT-6 | R3.6d — backoff curve not asserted (NFR-R-2) | 3.6 | unit | `packages/config/src/queues.test.ts` (NEW) | **GREEN (7 passing)** |
| 3.7-INT-6 | R3.7b — reprocess re-enqueues without lawful-access re-check | 3.7 | integration | `tests/integration/operator-triage-routes.integration.test.ts` OT-API-6/7 (appended) | RED (skip) |

*3.3-UNIT-8 is labeled UNIT but lives in the contract file alongside its sibling FA tests because the fetch module (`packages/ingest/src/fetch/`) does not exist yet — co-location in the package is impossible until Story 3.3 ships the module. All 3.3 fetch-module tests stay quarantined together in one `describe.skip` block.

## Test Scenarios

### 3.1-CTR-6: Source trust-tier confirmation contract (5 tests, RED)
- ⏭️ **[P0] SCF-1:** confirmed=true WITH validation evidence parses — RED
- ⏭️ **[P0] SCF-2:** confirmed=true WITHOUT confirmation_evidence REJECTED (SEC-3) — RED
- ⏭️ **[P0] SCF-3:** confirmed=false WITHOUT evidence ACCEPTED (pending) — RED
- ⏭️ **[P1] SCF-4:** confirmation_evidence requires validated_by principal (SEC-6) — RED
- ⏭️ **[P1] SCF-5:** trust_tier must be in {1,2,3} (SEC-3 structural) — RED

### 3.3-CTR-7 + 3.3-UNIT-8: OCR fidelity + Firecrawl AbortSignal (2 tests, RED)
- ⏭️ **[P0] FA-7:** cleaned text is faithful containment of source (no OCR hallucination, EI-3 verb preserved) — RED
- ⏭️ **[P1] FA-8:** FirecrawlAdapter.fetch() propagates AbortSignal to the HTTP call — RED

### 3.4-INT-6: MinIO bucket versioning + append-only (3 tests, RED)
- ⏭️ **[P0] RSM-1:** raw-snapshots bucket has versioning ENABLED — RED
- ⏭️ **[P0] RSM-2:** re-putting different content creates a NEW version (original never mutated) — RED
- ⏭️ **[P0] RSM-3:** bucket has object locking ENABLED (GOVERNANCE/COMPLIANCE) — RED

### 3.6-UNIT-6: Backoff curve exactness (7 tests, GREEN)
- ✅ **[P0] BF-1:** default curve = 5 attempts / 1s base / 1.6× / 30s cap — GREEN
- ✅ **[P0] BF-2:** backoffDelayMs exact exponential sequence — GREEN
- ✅ **[P0] BF-3:** delay capped at maxDelayMs (no unbounded growth) — GREEN
- ✅ **[P1] BF-4:** rejects non-positive maxAttempts — GREEN
- ✅ **[P1] BF-5:** rejects growthFactor < 1 — GREEN
- ✅ **[P1] BF-6:** rejects maxDelayMs < baseDelayMs — GREEN
- ✅ **[P1] BF-7:** valid setBackoff applies new curve — GREEN

> **Note:** BF-2 initially caught a real IEEE-754 drift (`1.6^2 = 2.5600000000000002`). The curve is correct; the assertion was adjusted to `toBeCloseTo` (6 sig figs) with a documenting comment. This is exactly the regression net the gap test provides.

### 3.7-INT-6: Reprocess re-runs lawful-access (2 tests, RED)
- ⏭️ **[P0] OT-API-6:** reprocess a DISABLED source → 409, no re-ingest (FR-1.2) — RED
- ⏭️ **[P1] OT-API-7:** reprocess an ALLOWED source → 202, gate re-ran + passed (auditable) — RED

## Verification Results

| File | Collects? | Tests | Status |
|---|---|---|---|
| `tests/contract/source-confirmation.contract.test.ts` | ✅ | 5 skipped | RED |
| `tests/contract/fetch-adapter.contract.test.ts` | ✅ | 8 skipped (was 6) | RED |
| `tests/integration/raw-snapshot-minio.integration.test.ts` | ✅ | 3 skipped | RED |
| `packages/config/src/queues.test.ts` | ✅ | **7 passed** | **GREEN** |
| `tests/integration/operator-triage-routes.integration.test.ts` | ✅ | 7 skipped (was 5) | RED |
| `packages/config` typecheck | ✅ clean | — | — |

**Totals: 19 gap tests generated** — 12 RED/skip (activate at story implementation) + 7 GREEN (backoff regression net, live now).

## Implementation Notes

- **3.1-CTR-6** requires a new `SourceRegistrationSchema` in `packages/contracts/src/` (or `source-registration.ts`) with a `.refine()` enforcing `confirmed === true ⟹ confirmation_evidence present`. The schema does not exist yet — this is Story 3.1's contract-layer deliverable.
- **3.3-CTR-7 (FA-7)** needs a `cleanDocument()` export from `packages/ingest/src/fetch/`. The fidelity check uses token-set containment + load-bearing-verb preservation (EI-3). At green phase, consider a property test (fast-check) generating random source text + asserting cleaned ⊆ source.
- **3.3-UNIT-8 (FA-8)** uses a `fetchImpl` injection on the adapter constructor — the adapter must forward the signal rather than swallow it. The test injects a fake fetch that captures the signal.
- **3.4-INT-6** needs a Testcontainers MinIO harness (`tests/support/helpers/test-minio.ts`) + bucket-config introspection methods (`bucketVersioningConfig`, `bucketObjectLockConfig`) on the snapshot store. The bucket must be created with object-locking enabled at provision time (MinIO requires this at bucket creation, not after).
- **3.6-UNIT-6** is GREEN now — no implementation needed. It guards the already-shipped `getBackoff`/`backoffDelayMs`/`setBackoff` in `packages/config/src/queues.ts`.
- **3.7-INT-6** requires the `createTriageRoutes` reprocess handler to invoke the lawful-access gate before re-enqueueing. The injected deps must seed a DISABLED-vs-ALLOWED source state. Response shape: 409 `{error:{code:'conflict', message}}` when blocked; 202 `{status:'requeued', lawfulAccessChecked:true}` when passed.

**Generated by BMad TEA Agent** — 2026-07-08
