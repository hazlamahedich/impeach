---
story_id: '2.7'
story_key: '2-7-defamation-threshold-blast-radius-adrs'
epic: 'Epic 2: Provenance & Invariants'
status: done
last_updated: '2026-07-06'
baseline_commit: '76ab519fbbee3449ac3d2b8c540404dabde6a41a'
amendments:
  - 'AM-1: Updated blast-radius matrix to 6 processes (including Next.js web frontend) per ADR-021 process count reconciliation.'
  - 'AM-2: Quantified explicit thresholds for citation classes matching trust tiers (Tiers 1, 2, and 3).'
  - 'AM-3: Target ADR count in adr-lint.test.ts updated to 29.'
  - 'AM-4 (2026-07-06, party-mode adversarial review — 4 agents: Winston/Murat/Amelia/John, unanimous NOT-ready-as-drafted): Re-scoped with 5 new ACs and expanded tasks. Findings: (1) 0.00% threshold is statistically unverifiable without sample-size calculation — Clopper-Pearson 95% LCB is trivially 0.00% for zero failures; the meaningful bound is the UPPER bound (≈3/N), requiring ~30K observations per stratum for 0.01% resolution (Murat); (2) ADR-0029 "prove" language is a formal-verification ask — needs explicit failure model (crash/timeout/corrupt) + evidence standard (Winston/Murat); (3) fail-closed behavioral specification missing — matrix must define what the system DOES in each state, not just classify Acceptable/Chargeable (Winston); (4) threshold provenance undocumented — where do 0.50%/1.50%/3.00% come from? (John); (5) traceability gap to Story 2.9 chaos suite — 2.9 ACs must reference these thresholds (Murat); (6) Task 4 link graph underspecified — dev must reverse-engineer which ADRs link to which (Amelia). Added ACs #5-#9, expanded Tasks 1-2 with sample-size calculation + failure model subtasks, clarified Task 4 link graph, added dev notes on upper-vs-lower confidence bound + performance budget + threshold provenance.'
depends_on:
  - '2-6b-code-filipino-eval-gate-scaffolding'
  - '2-6c-english-extraction-quality-eval-gate'
blocks:
  - '2-8-pd-2-kpi-observation-gate-invocation-contract-test'
  - '2-9-unified-chaos-suite-500-rps-citation-invariant'
---

# Story 2.7: Defamation Threshold & Blast-Radius ADRs (AR-26, AR-28, VAL-2)

Status: review

<!-- Note: Validation is optional. Run validate-create-story for quality check before dev-story. -->

## Story

As a **security and compliance officer**,
I want the numeric defamation threshold defined and the 6-process blast-radius matrix documented in formal ADRs,
so that the safety case reduces to concrete mathematical bounds and partial-failure modes are systematically handled to prevent defamation.

## Acceptance Criteria

### Behavioral (stakeholder-verifiable)

1. **Numeric Defamation Threshold ADR (ADR-0028) Accepted (AR-26, VAL-3.8):**
   - **Given** the defamation threshold ADR exists,
   - **When** the CI gates evaluate served content,
   - **Then** the ADR defines the exact maximum acceptable hallucination rate per language (English, Filipino) per citation class / Trust Tier:
     - **Allegation-as-Fact (INV-002 / NFR-EI-2):** Exactly 0.00% (zero tolerance — detection target, not a statistical claim; see AC #5).
     - **Tier-1 Primary Citations:** ≤0.50% (extreme fidelity).
     - **Tier-2 Secondary Citations:** ≤1.50% (reputable media).
     - **Tier-3 Aggregator Citations:** ≤3.00% (where trust tier is displayed and corroboration required).
   - **And** the ADR details how these hallucination rates are measured using the polyglot eval harness (ADR-0014) and Clopper-Pearson 95% LCB.
   - **And** the ADR documents the provenance of each threshold: legal precedent, empirical benchmark, or stakeholder risk-appetite decision — no threshold is stated without a source.

2. **6-Process Blast-Radius Matrix ADR (ADR-0029) Accepted (AR-28, VAL-3.5):**
   - **Given** the blast-radius matrix ADR exists,
   - **When** any subset of the 6 canonical processes fails,
   - **Then** the ADR documents the full matrix of 2^6 = 64 combinations (reduced by structural dependencies), specifying which failure combinations are acceptable vs chargeable:
     - **Acceptable (Fail-Closed/Graceful):** Service unavailability, write path paused, enqueuer restart, queue backpressure (where no invariants are breached).
     - **Chargeable (Catastrophic):** Unaudited claims served (audit-worker offline without api failing closed), citation-or-silence bypassed, data forgery, or bypass of render gate.
   - **And** for each Chargeable state, the matrix specifies the concrete system behavior: which process returns what (503, queue drain-stop, circuit-breaker open), not just the classification label.
   - **And** the matrix provides evidence (exhaustive enumeration, not formal proof) that the "no uncited path" invariant (INV-001 / AC-2) holds under all partial-failure combinations (when `api`, `serve-worker`, or `audit-worker` dies), using a defined failure model (crash-stop, timeout, corrupt-output — see AC #6).
   - **And** the 6 processes are defined per ADR-021: `api`, `ingest-worker`, `serve-worker`, `audit-worker`, `enqueuer`, and `web`.

3. **adr-lint Compliant & Count Assertion Updated:**
   - **Given** both new ADRs (0028 and 0029) are added,
   - **When** `adr-lint` runs in CI,
   - **Then** `tests/lint/adr-lint.test.ts` is updated to expect exactly 29 files/ADRs (updated in 3 locations: the test description string, the count assertion, and the loop bounds),
   - **And** both new ADRs pass `adr-lint` (validating frontmatter, 5 required sections, real evidence, and symmetric related links).

4. **Bidirectional Links Seeded in Reference ADRs (PC-3):**
   - **Given** the new ADRs reference existing decisions,
   - **When** the lint check runs,
   - **Then** bidirectional related links are symmetric in:
     - ADR-0028 <-> {ADR-0001, ADR-0025, ADR-0026}
     - ADR-0029 <-> {ADR-0001, ADR-0021, ADR-0024}

5. **Sample-Size Calculation for Statistical Validity (NEW — Murat/Winston):**
   - **Given** the thresholds in AC #1,
   - **When** the ADR-0028 measurement protocol is specified,
   - **Then** the ADR includes a sample-size table: for each (language, citation-class) pair, the minimum N required to achieve 95% confidence that the true rate is below the threshold, using the Clopper-Pearson 95% **upper** bound (not lower — the lower bound for zero failures is trivially 0.00% and provides no discrimination).
   - **And** the ADR explicitly distinguishes the 0.00% allegation-as-fact target as a **detection target** (any single occurrence triggers an incident response) rather than a statistical claim (zero defects cannot be proven through measurement).
   - **And** the ADR defines the operational response to a threshold breach: automated circuit-breaker, manual review queue, or both.

6. **Failure Model Definition for Blast-Radius Matrix (NEW — Murat/Winston):**
   - **Given** the blast-radius matrix in AC #2,
   - **When** the matrix enumerates failure states,
   - **Then** the ADR defines the failure model: crash-stop (process dead), timeout (process unresponsive), and corrupt-output (process returns invalid data) — each is a distinct failure class.
   - **And** the ADR specifies the evidence standard: exhaustive enumeration of the 64 states (reduced by structural dependencies) with manual reasoning per state, not formal verification.
   - **And** the ADR includes a performance budget: blast-radius dependency checks must complete within a defined latency bound (e.g., 100ms timeout) to avoid cascading citation suppression.

7. **Traceability to Story 2.9 Chaos Suite (NEW — Murat):**
   - **Given** the thresholds and matrix are defined,
   - **When** Story 2.9 implements the unified chaos suite,
   - **Then** ADR-0028 includes a traceability section listing which Story 2.9 chaos test ACs exercise each threshold.
   - **And** ADR-0029 includes a traceability section listing which Story 2.9 failure-injection scenarios correspond to which matrix rows.

8. **Threshold Provenance Documented (NEW — John):**
   - **Given** the numeric thresholds in AC #1,
   - **When** ADR-0028 is authored,
   - **Then** each threshold (0.00%, 0.50%, 1.50%, 3.00%) carries a provenance statement: derived from legal precedent (cite the case/statute), empirical benchmark (cite the model evaluation), or stakeholder risk-appetite decision (cite the decision record).
   - **And** if any threshold lacks provenance at authoring time, it is marked with an Open Question and a named owner for resolution.

9. **Eval Harness Dependency Verified (NEW — Murat/Amelia):**
   - **Given** ADR-0028 references the polyglot eval harness (ADR-0014),
   - **When** the ADR is authored,
   - **Then** the eval harness measurement path is verified to exist (packages/eval/ is built and testable) — if not, the ADR documents the gap as an Open Question with a blocking dependency.

## Tasks / Subtasks

- [x] **Task 1: Author ADR-0028 (Numeric Defamation Threshold)** (AC #1, #5, #7, #8, #9)
  - [x] 1a. Create `docs/adr/0028-numeric-defamation-threshold.md` using the canonical template (Context, Decision, Consequences, Alternatives, Open questions).
  - [x] 1b. Define maximum acceptable hallucination rates per language (English, Filipino) per citation class (Tier-1, Tier-2, Tier-3) and zero-tolerance floor for allegation-as-fact.
  - [x] 1c. Document threshold provenance for each number: legal precedent (cite case/statute), empirical benchmark (cite model eval), or stakeholder risk-appetite decision (cite decision record). Mark any unprovenanced threshold as an Open Question with named owner.
  - [x] 1d. Specify statistical measurement protocol (eval metrics, NLI entailment gate, RAGAS, Clopper-Pearson 95% LCB).
  - [x] 1e. **Calculate required sample sizes** per (language, citation-class) pair to achieve 95% confidence that the true rate is below each threshold, using the Clopper-Pearson 95% **upper** bound (≈3/N for zero failures). Include a sample-size table in the ADR.
  - [x] 1f. Distinguish the 0.00% allegation-as-fact target as a **detection target** (any single occurrence = incident response), not a statistical claim. Define the operational response to a threshold breach (circuit-breaker, manual review queue, or both).
  - [x] 1g. Verify the eval harness measurement path exists (packages/eval/ is built and testable). If not, document the gap as an Open Question with a blocking dependency.
  - [x] 1h. Add a traceability section listing which Story 2.9 chaos test ACs exercise each threshold.
  - [x] 1i. Add bidirectional related links to `ADR-0001`, `ADR-0025`, `ADR-0026`.

- [x] **Task 2: Author ADR-0029 (6-Process Blast-Radius Matrix)** (AC #2, #6, #7)
  - [x] 2a. Create `docs/adr/0029-6-process-blast-radius-matrix.md` using the canonical template.
  - [x] 2b. Map the 6 processes per `ADR-021`: `api`, `ingest-worker`, `serve-worker`, `audit-worker`, `enqueuer`, and `web`.
  - [x] 2c. Define the failure model: crash-stop (process dead), timeout (process unresponsive), and corrupt-output (process returns invalid data) — each is a distinct failure class.
  - [x] 2d. Formulate the 64-combination matrix (2^6), reducing it via structural dependencies, and classify each outcome as Acceptable or Chargeable.
  - [x] 2e. For each Chargeable state, specify the concrete system behavior: which process returns what (503, queue drain-stop, circuit-breaker open) — not just the classification label.
  - [x] 2f. Provide evidence via exhaustive enumeration (not formal proof) that the "no uncited path" invariant (INV-001 / AC-2) holds under all partial-failure states, using the failure model from 2c.
  - [x] 2g. Define a performance budget for blast-radius dependency checks (e.g., 100ms timeout) to prevent cascading citation suppression.
  - [x] 2h. Add a traceability section listing which Story 2.9 failure-injection scenarios correspond to which matrix rows.
  - [x] 2i. Add bidirectional related links to `ADR-0001`, `ADR-0021`, `ADR-0024`.

- [x] **Task 3: Update `adr-lint` Test and Run Linter** (AC #3)
  - [x] 3a. Modify `tests/lint/adr-lint.test.ts` to assert 29 ADR files (lines 40, 41, 43 — test description string, count assertion, and loop bound).
  - [x] 3b. Run `pnpm test tests/lint/adr-lint.test.ts` and verify it passes GREEN.
  - [ ] **Note:** This task must run AFTER Tasks 1 and 2 produce the ADR files on disk, or `adr-lint` will fail on missing files.

- [x] **Task 4: Add Symmetric Links in Existing ADRs** (AC #4)
  - [x] 4a. Edit `docs/adr/0001-defamation-grade-operational-definition.md` — add `ADR-0028` and `ADR-0029` to `related:` list.
  - [x] 4b. Edit `docs/adr/0021-process-count-reconciliation.md` — add `ADR-0029` to `related:` list.
  - [x] 4c. Edit `docs/adr/0024-hash-chain-concurrency-model.md` — add `ADR-0029` to `related:` list.
  - [x] 4d. Edit `docs/adr/0025-filipino-eval-set-spec.md` — add `ADR-0028` to `related:` list.
  - [x] 4e. Edit `docs/adr/0026-english-eval-set-spec.md` — add `ADR-0028` to `related:` list.
  - [x] 4f. Run `pnpm test tests/lint/adr-lint.test.ts` to verify all bidirectional links are symmetric.

## Dev Notes

- **6-Process Split (ADR-021):** Do not follow the legacy 5-process split in `architecture.md`. `web` (Next.js 15) is process #6 with server-side components (RSC) fetching from `/api/v1` and constitutes its own failure domain.
- **Fail-Closed under Audit Failure:** If `audit-worker` is offline or its queue is saturated, the `api` and `web` layers must not continue serving unaudited claims. The blast-radius matrix must specify this as a fail-closed requirement to prevent defamation risk. For each Chargeable state, specify the concrete behavior (e.g., "api returns 503", "enqueuer drain-stops"), not just the classification label.
- **Symmetric ADR Links:** `adr-lint` enforces that if ADR-A related list contains ADR-B, then ADR-B related list MUST contain ADR-A. Be meticulous with editing existing files.
- **Zero-Tolerance Floor:** The numeric threshold for allegation-as-fact (INV-002) is absolute: 0.00%. This is a **detection target** (any single occurrence triggers an incident response), not a statistical claim — zero defects cannot be proven through measurement. The ADR must define the operational response to a breach.
- **Clopper-Pearson Upper vs Lower Bound (CRITICAL):** The Clopper-Pearson 95% **lower** confidence bound for zero observed failures is trivially 0.00% and provides no discrimination. The meaningful bound is the **upper** bound: for zero failures in N trials, the 95% upper bound ≈ 3/N. To claim "below 0.01%" you need ~30,000 observations per stratum with zero failures. The ADR must use the upper bound and include a sample-size table.
- **Threshold Provenance:** Every numeric threshold (0.00%, 0.50%, 1.50%, 3.00%) must carry a provenance statement. If a threshold lacks provenance at authoring time, mark it as an Open Question with a named owner. Arbitrary thresholds create the illusion of rigor and are worse than no thresholds.
- **Failure Model:** The blast-radius matrix must define its failure model explicitly: crash-stop (process dead), timeout (process unresponsive), and corrupt-output (process returns invalid data). Each is a distinct failure class that multiplies the state space.
- **Evidence Standard for ADR-0029:** Use exhaustive enumeration of the 64 states (reduced by structural dependencies) with manual reasoning per state. This is NOT formal verification — do not claim "proof." The ADR should state the evidence standard explicitly.
- **Performance Budget:** Blast-radius dependency checks must complete within a defined latency bound (e.g., 100ms timeout) to avoid cascading citation suppression. A slow or dead dependency check that causes citation suppression is a correctness risk, not just a performance risk.
- **Traceability to Story 2.9:** Both ADRs must include a traceability section linking their thresholds/matrix rows to specific Story 2.9 chaos test ACs. Without this, 2.9 cannot verify what 2.7 defines.

### Project Structure Notes

- **ADR Templates:** All new ADRs must strictly follow the template defined in `tests/lint/adr-helpers.ts` (Context, Decision, Consequences, Alternatives, Open questions).
- **Evidence Fields:** In both ADRs, the `evidence` field in the frontmatter must carry real paths or URLs (since they will be `Accepted` status), otherwise `adr-lint` will fail.
- **Count Consistency:** Ensure the loop bound in `adr-lint.test.ts` is exactly matching the length of expected files to avoid off-by-one errors.

### References

- [ADR-0001: Defamation-Grade Operational Definition](file:///Users/sherwingorechomante/impeach/docs/adr/0001-defamation-grade-operational-definition.md)
- [ADR-0021: Process Count Reconciliation](file:///Users/sherwingorechomante/impeach/docs/adr/0021-process-count-reconciliation.md)
- [ADR-0025: Filipino Eval Set Spec](file:///Users/sherwingorechomante/impeach/docs/adr/0025-filipino-eval-set-spec.md)
- [ADR-0026: English Eval Set Spec](file:///Users/sherwingorechomante/impeach/docs/adr/0026-english-eval-set-spec.md)
- [Architecture: VAL-2 Critical Gaps](file:///Users/sherwingorechomante/impeach/_bmad-output/planning-artifacts/architecture.md#L564)
- [Architecture: VAL-3 F1-Gate Additions](file:///Users/sherwingorechomante/impeach/_bmad-output/planning-artifacts/architecture.md#L565)
- [Epics: Story 2.7](file:///Users/sherwingorechomante/impeach/_bmad-output/planning-artifacts/epics.md#L684)

## Dev Agent Record

### Agent Model Used

Gemini 3.5 Flash (High) - Ultimate Story Context created 2026-07-06.

### Debug Log References

### Completion Notes List

- Ultimate context engine analysis completed - comprehensive developer guide created
- **Story 2.7 implementation COMPLETE (2026-07-06).** All 4 tasks done, all 9 ACs satisfied:
  - **Task 1 — ADR-0028 (Numeric Defamation Threshold) Authored:** `docs/adr/0028-numeric-defamation-threshold.md` (Accepted). Defines per-class max acceptable hallucination rates: 0.00% allegation-as-fact (INV-002, detection target, exhaustive enforcement via render gate) + ≤0.50% Tier-1 / ≤1.50% Tier-2 / ≤3.00% Tier-3 (statistical thresholds, sample-based). Includes: (a) threshold provenance table (AC #8) — every number sourced (NFR-EI-2 PRD, architecture.md aggregate floors, stakeholder risk-appetite), unprovenanced items marked OQ-28.1; (b) sample-size calculation (AC #5) using CP 95% **upper** bound (N=598/199/99 for Tier-1/2/3, exact values computed via scipy) — explicitly corrects the lower-vs-upper-bound category error from the original draft; (c) measurement protocol inheriting ADR-0025 §4 metrics + polyglot eval harness; (d) operational breach response (circuit-breaker + manual review queue, AC #2); (e) eval harness path verified live (AC #9 — packages/eval built + 17 tests GREEN); (f) Story 2.9 traceability (AC #7); (g) bidirectional links to ADR-001/025/026.
  - **Task 2 — ADR-0029 (6-Process Blast-Radius Matrix) Authored:** `docs/adr/0029-6-process-blast-radius-matrix.md` (Accepted). Enumerates all 64 crash-stop combinations (2^6 per ADR-021) via equivalence classes: Group A (40 combos, serving path DOWN → ✅ Acceptable), Group B (8 combos, W down → ✅/🟡), Group C (8 combos, fully up → ✅/🟡). Single load-bearing design requirement: **fail-closed on audit-worker death** (§5) converts all 8 🟡 conditional rows to ✅. Failure model: crash-stop + timeout + corrupt-output (3 distinct classes, AC #6). Corrupt-output is the defamation-grade class — render gate (SC-3) is the last mechanical defense. Evidence standard = exhaustive enumeration with manual reasoning per class, NOT formal verification (AC #6). Performance budget: 100ms p99 for blast-radius dependency checks, fail-closed on exceed (AC #6). Story 2.9 traceability (AC #7). Bidirectional links to ADR-001/021/024.
  - **Task 3 — adr-lint count updated 27→29:** `tests/lint/adr-lint.test.ts` updated in 3 locations (test description string, count assertion `toBe(29)`, loop bound `n <= 29`). adr-lint GREEN: 119/119 tests pass (was 111; +8 for 2 new ADRs).
  - **Task 4 — Symmetric bidirectional links added in 5 existing ADRs:** ADR-0001 (+ADR-028, +ADR-029), ADR-0021 (+ADR-029), ADR-0024 (+ADR-029), ADR-0025 (+ADR-028), ADR-0026 (+ADR-028). Bidirectional-link test GREEN.
  - **Verification gates:** adr-lint 119/119 GREEN, full lint project 143/143 GREEN, smoke+contract+lint regression 230 passed/5 skipped GREEN. ESLint clean on edited test file. Pre-existing tsc errors (tests/perf, tests/support/fixtures.ts) verified at baseline `76ab519` — not caused by this story. VAL-2 Critical gaps AR-26 + AR-28 CLOSED.

### File List

- `docs/adr/0028-numeric-defamation-threshold.md` (NEW — ADR-0028, Accepted)
- `docs/adr/0029-6-process-blast-radius-matrix.md` (NEW — ADR-0029, Accepted)
- `docs/adr/0001-defamation-grade-operational-definition.md` (MODIFIED — +ADR-028, +ADR-029 to related:)
- `docs/adr/0021-process-count-reconciliation.md` (MODIFIED — +ADR-029 to related:)
- `docs/adr/0024-hash-chain-concurrency-model.md` (MODIFIED — +ADR-029 to related:)
- `docs/adr/0025-filipino-eval-set-spec.md` (MODIFIED — +ADR-028 to related:)
- `docs/adr/0026-english-eval-set-spec.md` (MODIFIED — +ADR-028 to related:)
- `tests/lint/adr-lint.test.ts` (MODIFIED — count assertion 27→29 in 3 locations: description string, toBe() assert, loop bound)
- `_bmad-output/implementation-artifacts/sprint-status.yaml` (MODIFIED — 2-7 status: ready-for-dev → in-progress → review)
- `_bmad-output/implementation-artifacts/2-7-defamation-threshold-blast-radius-adrs.md` (MODIFIED — Status, Tasks, Completion Notes, File List, Change Log)

## Change Log

- 2026-07-06: Story 2.7 context created and sprint status updated.
- 2026-07-06: Story 2.7 implementation complete — ADR-0028 (numeric defamation threshold) + ADR-0029 (6-process blast-radius matrix) authored and Accepted; adr-lint count updated 27→29; symmetric bidirectional links added in 5 existing ADRs (0001/0021/0024/0025/0026). All verification gates GREEN (adr-lint 119/119, lint project 143/143, regression 230 passed/5 skipped). VAL-2 Critical gaps AR-26 + AR-28 closed. Status → review.

## QA Results

*(Pending code review — story ready for `code-review` workflow per the dev workflow §10 recommendation.)*

### Review Findings (2026-07-06)

- [x] [Review][Patch] ADR-0029 Group A combination count arithmetic is wrong [docs/adr/0029-6-process-blast-radius-matrix.md §4] — A.2 "S ↑, A ↓ (I, U, E, W any)" should cover 2^4 = 16 combinations, not 8. Group A total should be 48 (32 + 16), not 40. Fixed: A.2 now reads 16 combos; summary table updated to Group A 48, total Acceptable 56; matrix sums to 64.
- [x] [Review][Patch] ADR-0028 Tier-1 provenance cites wrong source and overstates the arithmetic [docs/adr/0028-numeric-defamation-threshold.md §2] — The "Citation Recall ≥ 0.97 raw / ≥ 0.99 served" thresholds lived in `_bmad-output/project-context.md`, not `architecture.md`, and the "≥ 0.995 served-recall" inference was wrong. Fixed: provenance now cites `project-context.md` correctly and explains the 0.50% ceiling as stricter than the ≤1% served-precision floor.
- [x] [Review][Patch] ADR-0029 stale circuit-breaker cache window can serve unaudited claims [docs/adr/0029-6-process-blast-radius-matrix.md §5/§7] — Panel consensus (Winston/Murat/John/Amelia): strengthen ADR-0029 to require a fresh health poll per claim-serving `/query`; classify the transient state as Conditional Acceptable bounded by ≤100ms; reject the 5s window; add OQ-29.6 for follow-up engineering story. Fixed.
- [x] [Review][Patch] ADR-0028 sample-size table omits >0 failure guidance [docs/adr/0028-numeric-defamation-threshold.md §3] — For Tier-1 at n=598, k=1 gives CP 95% UCB ≈ 0.79% > 0.50% threshold; passing with k=1 needs n≈948. Fixed: added explicit note explaining that ADR-0025's LCB tolerance schedule does not apply to fail-rate UCB, with a worked example.
- [x] [Review][Patch] `architecture.md` still uses 5-process language that contradicts ADR-021/ADR-0029 [_bmad-output/planning-artifacts/architecture.md §VAL-2] — VAL-2 text said "5-process blast-radius matrix" and "5 processes arbitrate via OS scheduler." Fixed: updated to 6-process language (api, ingest-worker, serve-worker, audit-worker, enqueuer, web) and added ADR-021 reference.
- [x] [Review][Patch] Typo in ADR-0028 prose path `packages/render/gate.ts` [docs/adr/0028-numeric-defamation-threshold.md §4] — Should be `packages/render/src/gate.ts`. Fixed via bulk replace (2 occurrences).
- [x] [Review][Patch] Magic number `29` repeated in `tests/lint/adr-lint.test.ts` [tests/lint/adr-lint.test.ts lines 40-43] — Introduced `ADR_COUNT` constant; description, assertion, and loop bound now derive from it.
- [x] [Review][Defer] Render gate does not yet mechanically enforce 0.00% allegation-as-fact detection target [packages/render/src/gate.ts] — The current gate strips uncited claims and marks lone Tier-3 claims; it does not block a misclassified `claim_type='fact'` with a syntactically valid citation. This is a pre-existing implementation gap; Story 2.8/2.9 and the SEC-8 red-team battery are the enforcement path. deferred, pre-existing.
- [x] [Review][Defer] Fail-closed-on-audit-death requirement has no serving-path implementation yet [apps/api, apps/serve-worker] — Expected for this ADR-only story; implementation is tracked by Story 2.8 / dedicated health/circuit-breaker story. deferred, pre-existing.
- [x] [Review][Defer] Failure classes are not exhaustive (omission, byzantine/colluding, partial partition) [docs/adr/0029-6-process-blast-radius-matrix.md §3] — The three declared classes are sufficient for the stated evidence standard; further classes can be added when concrete failure modes are discovered. deferred, out of scope.
- [x] [Review][Defer] Timeout/corrupt-output analysis does not address Next.js ISR/CDN caching [docs/adr/0029-6-process-blast-radius-matrix.md §6] — Caching layers are not yet part of the serving path; defer to a web-gate/caching story. deferred, out of scope.
- [x] [Review][Dismiss] Non-uniform tier scaling (0.50%/1.50%/3.00%) is arbitrary — The thresholds are stakeholder risk-appetite decisions, not derived ratios; the provenance table documents this. dismissed as noise.
- [x] [Review][Dismiss] Singular filename for plural thresholds — The kebab-case ADR filename convention uses singular titles; no change needed. dismissed as noise.
- [x] [Review][Dismiss] ADR lint test only bumps count constants — The test is intentionally a count + frontmatter linter; adding new structural coverage is not required by the story. dismissed as noise.
- [x] [Review][Dismiss] ADR-0029 `related:` includes `AR-28` instead of `ADR-028` — This follows the ADR-021 convention of mixing requirement IDs with ADR IDs; `adr-lint` only enforces ADR↔ADR symmetry and passes. dismissed as noise.
- [x] [Review][Dismiss] Other languages (Taglish/mixed) not covered by thresholds — The ADR explicitly scopes thresholds to English and Filipino for v1, matching ADR-0025/0026. dismissed as noise.
- [x] [Review][Dismiss] Bidirectional `related:` links are narrower than actual dependency graph — `adr-lint` validates declared symmetry; expanding the graph is optional and not required by AC #4. dismissed as noise.
