---
story_id: '2.9b'
story_key: '2-9b-citation-invariant-chaos-verification'
epic: 'Epic 4: Extraction & Knowledge Graph Construction'
status: backlog
last_updated: '2026-07-07'
baseline_commit: 'a7a8f90b8d0a3a03da1846903dc78890b1d06ce9'
depends_on:
  - '2-9a-chaos-infrastructure-baseline'
  - '2-11-serving-path-audit-health-gate'
  - 'epic-4-golden-corpus'
adversarial_review:
  date: '2026-07-07'
  method: 'party-mode (round 2 — adversarial review + validate)'
  agents: ['Murat (Test Architect)', 'Amelia (Senior Engineer)', 'Winston (System Architect)', 'John (Product Manager)']
  outcome: 'SPLIT FROM 2.9 — deferred to Epic 4+'
  consensus:
    - 'Full citation-invariant verification at 500 RPS on the frozen golden corpus'
    - 'Full ADR-0029 matrix coverage (all 64 crash-stop combos via equivalence classes + timeout/corrupt-output extensions)'
    - 'SEC-8 red-team mapping to G1-G5 gate artifacts'
    - 'Hard gate (blocks merge) — justified once the suite has 4+ weeks of stable CI runs'
    - 'Depends on Story 2.9a (infrastructure), Story 2.11 (audit-death fail-closed), and golden corpus (Epic 4)'
---

# Story 2.9b: Citation-Invariant Chaos Verification (SC-6, AC-2, SEC-8)

> **SPLIT FROM STORY 2.9 (2026-07-07).** The original Story 2.9 was found NOT-READY
> by unanimous 4-agent consensus. This story is the deferred verification half:
> full citation-invariant proof at 500 RPS on the frozen golden corpus, full
> ADR-0029 matrix coverage, and SEC-8 red-team mapping. It depends on Story 2.9a
> (chaos infrastructure), Story 2.11 (audit-death fail-closed mechanism), and the
> golden corpus with real extraction content (Epic 4).

Status: backlog

## Story

As a **platform integrity officer**,
I want the chaos suite to prove the citation-or-silence invariant holds at 500 RPS sustained load with full failure injection on the frozen golden corpus,
so that the PD-3 pre-external presentation gate has a machine-checkable chaos gate and silent citation-drop under load is caught before any user sees it.

## Acceptance Criteria

### Behavioral (stakeholder-verifiable)

1. **500 RPS Citation Invariant — Positive (SC-6, AC-2):**
   - **Given** the query serving pipeline is loaded with mixed traffic on the frozen golden corpus (real extraction content from Epic 4),
   - **When** throughput reaches 500 RPS sustained,
   - **Then** **zero** claim-responses return without source attribution (AC-2, SC-6 — negative invariant),
   - **And** **zero** ground-truth-cited responses return without citations (SC-6 — positive invariant).
   - **And** citation verification uses the ADR-0028 measurement protocol: per-class CP 95% upper bound on hallucination rate ≤ class threshold (0.50%/1.50%/3.00%), per language, AND-joined.

2. **Full ADR-0029 Matrix Coverage (ADR-0029, VAL-3.5):**
   - **Given** the chaos suite runs against the 6-process topology,
   - **When** all 64 crash-stop equivalence classes from ADR-0029 §4 are exercised,
   - **Then** the citation invariant (INV-001) holds for every combination:
     - **Group A (48 combos — serving path DOWN):** All ✅ Acceptable (unavailable). Verify no uncited response leaks.
     - **Group B (8 combos — W ↓, A ↑):** B.1 (4) ✅ Acceptable. B.2 (4) 🟡 Conditional — verify fail-closed on audit-death (Story 2.11 mechanism).
     - **Group C (8 combos — fully UP):** C.1 (4) ✅ Acceptable. C.2 (4) 🟡 Conditional — verify fail-closed on audit-death.
   - **And** the timeout failure class (§6) is exercised: audit-worker timeout → fail-closed within 100ms budget.
   - **And** the corrupt-output failure class (§6) is exercised: serve-worker citation-stripping caught by render gate; hallucinated citations caught by NLI entailment gate; forged audit entries caught by hash-chain integrity.

3. **SEC-8 Red-Team Evals Under Chaos (SEC-8):**
   - **Given** the SEC-8 red-team battery,
   - **When** evaluated under 500 RPS chaos conditions,
   - **Then** each threat vector maps to a G1-G5 gate verification artifact with explicit traceability:
     - **Libel-injection** (<0.01% with human spot-check) — mapped to G3 (hard CI gates).
     - **Slow-poisoning** (<7-day time-to-detection on 90-day corpus) — mapped to G2 (adversarial pass).
     - **Republication-framing** (Disini trap / allegation-as-fact detection) — mapped to G3.
     - **Adversarial-query** (0% jailbreak success on canonical entities) — mapped to G3.
     - **Source-attribution** (tamper protection for anonymous contributors) — mapped to G4 (recall split).
     - **Tamper** (modification caught by audit log / blocked by render gate) — mapped to G5 (independent spot-verification).
   - **And** red-team injection attempts are blocked by the render gate (`packages/render/src/gate.ts`) under load and recorded in the cryptographic audit log (AC-11).

4. **Load Profile SLOs — Hard Gate (ADR-0028, ADR-0029):**
   - **Given** the 500 RPS load profile on the golden corpus,
   - **When** latency and throughput are measured,
   - **Then** the following SLOs are enforced as hard gates:
     - **p99 Query Latency:** ≤ 10s (ADR-0005).
     - **p99 Health Check Latency:** ≤ 100ms for serving-path dependency checks (ADR-0029 §7).
     - **Citation-Drop Rate:** EXACTLY 0 — no citations dropped on valid responses (ADR-0028 detection target).
     - **Error Budget:** ≤ 1.00% rate of 5xx errors under non-fault conditions.
   - **And** SLO breach blocks the PD-3 gate (G3 hard gates must pass under chaos conditions).

5. **CI/CD Integration — Hard Gate (D14):**
   - **Given** a pull request triggers the CI pipeline,
   - **When** the `chaos` workflow runs,
   - **Then** a failure of the chaos suite or SLO breach **blocks the merge** (hard gate).
   - **And** the Turborepo task runner executes `turbo run chaos` with `cache: false`.
   - **Rationale:** Hard gate is justified once the suite has 4+ weeks of stable CI runs (from 2.9a) and the golden corpus provides deterministic citation targets. Unlike 2.9a's soft gate, the citation invariant is deterministic — either the render gate fires or it doesn't.

6. **k6 Technical Constraints (inherited from 2.9a):**
   - **Given** k6 runs on the Goja JavaScript runtime,
   - **When** citation verification is implemented,
   - **Then** all assertions use k6 `check()` with manual JSON path traversal. No external schema libraries.
   - **And** citation semantic verification (citations match golden corpus source spans) uses a post-processing step outside k6 (Python script consuming k6 JSON output + golden corpus manifest).

## Tasks / Subtasks

- [ ] **Task 1: Upgrade Baseline to 500 RPS**
  - [ ] Extend `tools/chaos/chaos-suite.js` from 2.9a's 100 RPS ramp to 500 RPS sustained.
  - [ ] Define constant-arrival-rate executor at 500 RPS, 120s duration.
  - [ ] Configure request endpoints representing real-world mixed traffic:
    - `/query` (claim-serving with citation rendering) — 70% of traffic.
    - `/search` (non-claim endpoints) — 20% of traffic.
    - `/healthz` — 10% of traffic.
  - [ ] Implement k6 Custom Metrics:
    - `citation_dropped` (Counter) — incremented when a 200 response has empty/missing citations array.
    - `citation_mismatch` (Counter) — incremented when a citation doesn't match golden corpus (post-processing).
    - `gate_bypassed` (Counter) — incremented when a response is served without GateContext.onInvocation firing.

- [ ] **Task 2: Implement Full ADR-0029 Matrix Coverage**
  - [ ] **Subtask 2a (Group A — 48 combos):** Verify serving-path-DOWN states return 503 (no 200 with empty body). Automate via shell script iterating docker compose stop/start combinations.
  - [ ] **Subtask 2b (Group B — 8 combos):** Verify B.1 (W ↓, U ↑) — frontend down, API invariant holds. Verify B.2 (W ↓, U ↓) — fail-closed on audit-death via Story 2.11 mechanism.
  - [ ] **Subtask 2c (Group C — 8 combos):** Verify C.1 (fully UP) — normal operation. Verify C.2 (U ↓) — fail-closed on audit-death via Story 2.11 mechanism.
  - [ ] **Subtask 2d (Timeout class):** Inject audit-worker timeout (network delay via toxiproxy). Assert fail-closed within 100ms budget (ADR-0029 §7).
  - [ ] **Subtask 2e (Corrupt-output class):** Inject serve-worker citation-stripping (modify response in proxy). Assert render gate catches it (WITHHOLD, not served). Inject hallucinated citations. Assert NLI entailment gate catches them. Inject forged audit entry. Assert hash-chain verifyChain detects HASH_MISMATCH.

- [ ] **Task 3: Implement Citation Semantic Verification**
  - [ ] Create `tools/chaos/verify-citations.py` — Python script that consumes k6 JSON output + golden corpus manifest.
  - [ ] For each served response with citations, verify: citation source_id exists in golden corpus, citation span_start/span_end are within source document bounds, citation content_hash matches golden corpus hash.
  - [ ] Compute per-class hallucination rate (ADR-0028 §4): CP 95% upper bound ≤ class threshold.
  - [ ] Output pass/fail per (language, citation-class) pair.

- [ ] **Task 4: Integrate SEC-8 Red-Team Mapping**
  - [ ] Map each SEC-8 threat vector to a specific G1-G5 gate artifact file in `eval/gates/`.
  - [ ] Verify that red-team injection attempts are blocked by the render gate under 500 RPS load.
  - [ ] Verify that blocked attempts are recorded in the cryptographic audit log (AC-11) with `redteam.blocked` event type.
  - [ ] Create traceability matrix: `docs/chaos/sec-8-traceability.md` mapping threat → gate artifact → chaos test.

- [ ] **Task 5: Upgrade CI Gate to Hard Gate**
  - [ ] Modify `.github/workflows/chaos.yml` to fail the build (block merge) on chaos suite failure or SLO breach.
  - [ ] Add `chaos` to branch protection rules as a required status check.
  - [ ] Document the hard-gate rationale: the citation invariant is deterministic; 4+ weeks of stable soft-gate runs from 2.9a establish reliability.

## Dev Notes

- **GOLDEN CORPUS REQUIRED:** This story cannot be implemented until Epic 4 delivers real extraction content in `eval/corpus/golden/`. The positive citation invariant (citations match source spans) requires known ground-truth citation targets.
- **STORY 2.11 REQUIRED:** The audit-death fail-closed mechanism (fresh health poll per claim-serving `/query`, ADR-0029 §5, OQ-29.6) must be implemented before the Group B.2/C.2 matrix rows can be verified.
- **STORY 2.9a REQUIRED:** The chaos infrastructure (k6, CI wiring, failure-injection harness, toxiproxy) from 2.9a is the foundation this story extends.
- **HARD GATE JUSTIFICATION:** Unlike 2.9a's soft gate (non-deterministic baseline characterization), the citation invariant is deterministic — either the render gate fires or it doesn't. The hard gate is on the invariant, not on the chaos suite's statistical properties. The 4+ week soft-gate runway from 2.9a establishes CI reliability before the hard gate is activated.
- **k6 + PYTHON SPLIT:** k6 handles load generation and structural validation. Python (`tools/chaos/verify-citations.py`) handles semantic citation verification against the golden corpus. k6 JSON output is the interface between them.
- **PD-3 GATE:** This story's chaos tests are a G3 hard gate for PD-3 (Epic 8). The forward dependency is fine for traceability; the actual blocking mechanism is wired in Epic 8.

### Project Structure Notes

- Modified: `tools/chaos/chaos-suite.js` (extend to 500 RPS).
- New: `tools/chaos/verify-citations.py` (semantic citation verification).
- New: `tools/chaos/matrix-coverage.sh` (ADR-0029 full matrix automation).
- New: `docs/chaos/sec-8-traceability.md` (SEC-8 mapping).
- Modified: `.github/workflows/chaos.yml` (soft → hard gate).

### References

- [ADR-0028: Numeric Defamation Threshold](file:///Users/sherwingorechomante/impeach/docs/adr/0028-numeric-defamation-threshold.md)
- [ADR-0029: 6-Process Blast-Radius Matrix](file:///Users/sherwingorechomante/impeach/docs/adr/0029-6-process-blast-radius-matrix.md)
- [Architecture: SC-6 Chaos at F1](file:///Users/sherwingorechomante/impeach/_bmad-output/planning-artifacts/architecture.md#L139)
- [Architecture: SEC-8 Red-team & Mutation Suite](file:///Users/sherwingorechomante/impeach/_bmad-output/planning-artifacts/architecture.md#L286)
- [Story 2.9a: Chaos Infrastructure & Baseline](file:///Users/sherwingorechomante/impeach/_bmad-output/implementation-artifacts/2-9-unified-chaos-suite-500-rps-citation-invariant.md)
- [Story 2.11: Serving-Path Audit Health Gate](file:///Users/sherwingorechomante/impeach/_bmad-output/implementation-artifacts/2-11-serving-path-audit-health-gate.md)

## Dev Agent Record

### Agent Model Used

*(Pending — story is backlog)*

### Debug Log References

- None.

### Completion Notes List

- * (Pending development)

### File List

- `tools/chaos/chaos-suite.js` (MODIFY — extend to 500 RPS)
- `tools/chaos/verify-citations.py` (NEW)
- `tools/chaos/matrix-coverage.sh` (NEW)
- `docs/chaos/sec-8-traceability.md` (NEW)
- `.github/workflows/chaos.yml` (MODIFY — soft → hard gate)

## QA Results

*(Pending development & code review)*
