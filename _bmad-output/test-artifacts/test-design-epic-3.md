---
workflowStatus: 'completed'
totalSteps: 5
stepsCompleted: ['step-01-detect-mode','step-02-load-context','step-03-risk-and-testability','step-04-coverage-plan','step-05-generate-output']
lastStep: 'step-05-generate-output'
nextStep: ''
lastSaved: '2026-07-08'
workflowType: 'testarch-test-design'
mode: 'epic-level'
epicId: '3'
epicTitle: 'Source Onboarding & Intelligence Ingestion'
---

# Test Design: Epic 3 — Source Onboarding & Intelligence Ingestion

**Date:** 2026-07-08
**Author:** anti lustay
**Status:** Draft

---

## Executive Summary

**Scope:** Epic-level test design for Epic 3 — the intelligence ingestion layer. Seven stories (3.1–3.7) cover source registry with confirmed trust tiers, lawful-access gating, discover/fetch/dedup, immutable raw snapshots, per-artifact provenance, idempotent resilient ingestion, and the operator triage surface.

**Substrate state at design time:** The prep sprint (TD1–TD4) landed the DB tables (`sources`, `documents`, `ingestion_jobs` + migration `0004`), identity/queue contracts in `packages/contracts/src/ingest.ts`, the intake gate (SEC-2 two-person rule), and the BullMQ substrate (`createIngestQueue`, Enqueuer, `computeJobId`). These are already GREEN (58 tests). The 44 ATDD red-phase scaffolds target the un-implemented story layer (access/fetch/snapshot/provenance/orchestrator/routes/UI) — they are genuine RED, not false alarms.

**Risk Summary:**
- Total risks identified: 24
- High-priority risks (≥6): 22 (8 BLOCK at score 9, 16 MITIGATE at score 6)
- Critical categories: **DATA** (provenance/dedup spine), **SEC** (lawful access, scope, immutability), **TECH** (orchestration, resume)

**Coverage Summary:**
- P0 scenarios: 32 (~45–65 hours)
- P1 scenarios: 13 (~20–30 hours)
- P2 scenarios: 5 (~6–12 hours)
- **Total effort**: ~70–105 hours across story implementation sprints (not a single sprint)

**Dominant theme:** Epic 3 is **T1-heavy** (defamation exposure). Every ingest defect is defamation-adjacent because every document becomes a citable source under PH cyberlibel law. The test pyramid is NOT bottom-heavy — the contract + integration layer carries the defamation spine, because unit tests cannot verify "is this snapshot immutable" or "does dedup actually prevent double-processing."

---

## Not in Scope

| Item | Reasoning | Mitigation |
| --- | --- | --- |
| **Extraction quality (Epic 4)** | Extraction metrics (groundedness, refutes-recall) are Epic 4's eval checkpoint (Story 4.11). Epic 3 only ingests; it does not extract. | Extraction contract test (1.12) stays GREEN on every ingest PR — regression net. |
| **Query/render path (Epic 5)** | Citation-or-silence on served *answers* is Epic 5. Epic 3's citation invariant is operator-facing spot-check (SEC-5 internal period). | Cross-plane provenance round-trip (R3Xa) is tracked as a cross-epic dependency. |
| **Ingestion throughput p95** | No explicit p95 threshold in the epic (unlike extract Epic 4 / query Epic 5). Ingestion is "observable," not gated. | Monitor-only via NFR-O-1 metrics (success rate, throughput, queue depth, DLQ depth). |
| **LangGraph DAG definition (Story 3.6 deliverable)** | The DAG is genuinely Story 3.6's work; checkpoint resume + DLQ-routing tests cannot go GREEN until it lands. | `ingestion_jobs.state_run_id` column is the waiting JOIN key; tests are RED/skip and activate at 3.6. |
| **Legal/editorial procurement** | Trust-tier confirmation rubric + lawful-access decisions per seed source are parallel non-developer tracks. | Tests assert the persisted *result* (confirmed:true / DISABLE), not the human judgment. |

---

## Risk Assessment

### High-Priority Risks — BLOCK (Score 9)

| Risk ID | Category | Description | P | I | Score | Mitigation | Owner | Timeline |
| ------- | -------- | ----------- | -- | - | ----- | ---------- | ----- | -------- |
| R3.1c | DATA | wire_service/original_publisher lost → 2 wire-republished stories counted as "independent" → false "fact" upgrade (EI-2) | 3 | 3 | 9 | SC-1/SC-5 assert provenance fields round-trip persistently; zod schema enforces fields present | ingest-dev | Story 3.1 |
| R3.2b | SEC | robots.txt Disallow ignored (NFR-L-1) → unlawful ingestion | 3 | 3 | 9 | LA-5 contract test: Disallow → DISABLE, binary gate | ingest-dev | Story 3.2 |
| R3.3a | DATA | dedup by content_checksum fails → same doc processed twice → conflicting extractions served as fact | 3 | 3 | 9 | FA-4/5 contract tests on dedup invariant; DB unique index already landed (content_checksum_uq) | ingest-dev | Story 3.3 |
| R3.3b | SEC | manual-upload provenance incomplete (missing legal_basis/uploader/reviewer) → no defense if challenged | 3 | 3 | 9 | FA-6 contract test: full provenance record required for manual path | ingest-dev | Story 3.3 |
| R3.5a | DATA | document registered without source_id/checksum/snapshot → artifact with no source pointer (FR-1.5 break) | 3 | 3 | 9 | PR-1/PR-5 integration tests; DB NOT NULL defaults + FK constraints already landed | ingest-dev | Story 3.5 |
| R3.6a | TECH | inline enqueue in stage handler (STR-3) → crash loses the chain + DAG scatters | 3 | 3 | 9 | IC-5 integration test + existing `tests/lint/import-boundaries` (ESLint bans `new Queue`/`.add` outside enqueuer+orchestrator) | ingest-dev | Story 3.6 |

### High-Priority Risks — MITIGATE (Score 6)

| Risk ID | Category | Description | P | I | Score | Mitigation | Owner |
| ------- | -------- | ----------- | -- | - | ----- | ---------- | ----- |
| R3.1a | DATA | self-declared trust tier persisted as `confirmed:true` (SEC-3) | 2 | 3 | 6 | SC-4 + new gap test 3.1-CTR-6 (confirmed requires validation evidence) | ingest-dev |
| R3.1b | SEC | POST /sources without sources:write scope (SEC-1) | 2 | 3 | 6 | SC-2/SC-3 (403/401 enforcement) | ingest-dev |
| R3.2a | SEC | paywall/login/CAPTCHA source bypassed not disabled (FR-1.2) | 2 | 3 | 6 | LA-2/3/4 contract tests (DISABLE, never bypass) | ingest-dev |
| R3.2c | SEC | manual override without AC-11 editorial-log justification | 2 | 3 | 6 | LA-6 contract test (override requires logged justification) | ingest-dev |
| R3.3c | DATA | OCR cleaning hallucinates/distorts text → fabricated "quote" from source | 2 | 3 | 6 | **NEW gap test 3.3-CTR-7** (cleaned output faithful containment of source) | ingest-dev |
| R3.3d | OPS | Firecrawl external dep flake/hang (no AbortSignal) → ingest stalls | 3 | 2 | 6 | **NEW gap test 3.3-UNIT-8** (adapter call carries AbortSignal.timeout) | ingest-dev |
| R3.4a | SEC | raw snapshot on serving path (must be off serving path) | 2 | 3 | 6 | RS-5 contract test (bucket private) | ingest-dev |
| R3.4b | DATA | snapshot not content-addressed (SHA-256) → cited PDF silently swapped | 2 | 3 | 6 | RS-2 contract test (content-addressed key) | ingest-dev |
| R3.4c | SEC | bucket not versioned append-only (NFR-S-5) → overwriteable | 2 | 3 | 6 | RS-4 + **NEW gap test 3.4-INT-6** (real MinIO versioned-append-only config asserted) | ingest-dev |
| R3.5b | DATA | re-embedding breaks citation validity (AC-4 decoupling) | 2 | 3 | 6 | PR-4 integration test (citation survives embedding change) | ingest-dev |
| R3.5c | DATA | blind insert, not upsertLastWriteWins (PC-1a) → duplicate docs | 3 | 2 | 6 | PR-2 integration test (idempotent re-register) | ingest-dev |
| R3.6b | TECH | crash-resume doesn't restore from checkpoint (NFR-R-3) | 2 | 3 | 6 | IC-2 integration test (resume from state_run_id) — needs DAG | ingest-dev |
| R3.6c | OPS | max-attempts exceeded not routed to dlq:ingest → job vanishes | 2 | 3 | 6 | IC-3 integration test (DLQ routing) — needs DAG | ingest-dev |
| R3.6d | TECH | non-idempotent re-enqueue (jobId not deduped) → duplicate work | 3 | 2 | 6 | IC-1/IC-4 + **NEW gap test 3.6-UNIT-6** (backoff curve exact: 5/1s/1.6×/30s cap) | ingest-dev |
| R3.7a | SEC | spot-check renders allegation-as-fact internally (SEC-5 internal not liability-free) | 2 | 3 | 6 | OT-4/OT-5 (citation-or-silence invariant visible in spot-check) | web-dev |
| R3.7b | SEC | reprocess re-enqueues WITHOUT re-running lawful-access → disabled source re-ingested | 2 | 3 | 6 | **NEW gap test 3.7-INT-6** (reprocess re-runs gate before re-ingest) | ingest-dev |

### Medium-Priority Risks (Score 4–5)

| Risk ID | Category | Description | P | I | Score | Mitigation | Owner |
| ------- | -------- | ----------- | -- | - | ----- | ---------- | ----- |
| R3Xb | TECH | @iip/ingest imports @iip/render or @iip/rag (STR-3/4 boundary) | 1 | 3 | 3 | Mitigated by existing `tests/lint/import-boundaries.test.ts` | platform |

### Low-Priority Risks (Score 1–3)

| Risk ID | Category | Description | P | I | Score | Action |
| ------- | -------- | ----------- | -- | - | ----- | ------ |
| R3.7c | OPS | health metrics missing (NFR-O-1) | 2 | 1 | 2 | Monitor |
| R3Xc | OPS | testcontainers 3-container stack (PG+MinIO+Redis) flaky-prone | 3 | 1 | 3 | Document isolation strategy |
| R3Xd | OPS | ingestion throughput has no p95 threshold | 2 | 1 | 2 | Document as monitor-only |

### Risk Category Legend

- **TECH**: Technical/Architecture (orchestration, integration, boundary)
- **SEC**: Security (lawful access, scope, immutability, access controls)
- **DATA**: Data Integrity (provenance, dedup, checksums, citation validity)
- **OPS**: Operations (external deps, deployment, monitoring, flakiness)

---

## NFR Planning

| NFR Category | Requirement / Threshold | Risk Link | Planned Validation | Evidence Needed |
| ------------ | ----------------------- | --------- | ------------------ | --------------- |
| Security | NFR-S-5: MinIO bucket versioned append-only + object locking (GOVERNANCE/COMPLIANCE) | R3.4a/c | RS-4/RS-5 contract + 3.4-INT-6 real-MinIO config assertion | Test report + bucket-config dump |
| Security | FR-1.2: lawful-access gate disable-not-bypass (paywall/login/CAPTCHA/terms) | R3.2a | LA-2/3/4/5 contract tests | Contract test report |
| Compliance | NFR-L-1: robots.txt directives respected | R3.2b | LA-5 contract test (Disallow → DISABLE) | Contract test report |
| Reliability | NFR-R-2: capped exponential backoff (5 attempts / 1s base / 1.6× / 30s cap per `queues.ts`) + DLQ `dlq:ingest` | R3.6c/d | IC-3 (DLQ) + 3.6-UNIT-6 (backoff curve exact) | Test report |
| Reliability | NFR-R-3: LangGraph state checkpointed per node for resume-after-crash | R3.6b | IC-2 (resume from `state_run_id`) — needs DAG | Test report |
| Operational | NFR-O-1: 4 metrics — success rate, throughput, queue depth, DLQ depth | R3.7c | 3.7-INT-5 (API) + 3.7-E2E-6 (UI panel) | API + UI assertions |
| Maintainability | Stryker ≥90% on new `@iip/ingest` modules (access/fetch/snapshot/provenance) | — | Widen `packages/ingest/stryker.config.json` scope as modules land | Mutation report |

**Unknown thresholds:** Ingestion throughput has no p95 in the epic (unlike extract/query). Marked monitor-only — no value invented.

---

## Entry Criteria

- [x] Requirements and assumptions agreed upon by QA, Dev, PM (epic accepted in epics.md)
- [ ] Test environment provisioned: PG16+AGE+pgvector custom Docker image + MinIO + Redis via `infra/docker-compose.yml`
- [ ] Test data factories ready: `tests/support/helpers/ingest.ts` (IDs/checksums/jobIds) — needs Source/Document/Snapshot object-mother builders authored with story implementations
- [ ] Feature deployed to test environment (story-by-story, RED→GREEN)
- [ ] Epic-specific: LangGraph DAG (Story 3.6) landed before IC-2/IC-3/IC-5 can go GREEN

## Exit Criteria

- [ ] All P0 tests passing (32 tests, including 6 coverage-gap tests)
- [ ] All P1 tests passing or failures triaged (13 tests)
- [ ] No open high-priority / high-severity bugs
- [ ] Stryker ≥90% on new `@iip/ingest` modules
- [ ] No uncited-path regression (Epic 1.12 contract test GREEN on every ingest PR)
- [ ] Epic-specific: all 6 BLOCK risks (score 9) have GREEN tests

---

## Test Coverage Plan

> **P0/P1/P2/P3 = priority/risk, NOT execution timing.** Execution timing is in the Execution Strategy section below.

### P0 (Critical)

**Criteria:** Blocks core functionality + High risk (score ≥6) + No workaround. These cover the defamation spine — provenance, lawful access, dedup, immutability.

| Requirement | Test Level | Risk Link | Test Count | Notes |
| ----------- | ---------- | --------- | ---------- | ----- |
| Source registry: confirmed trust tier + provenance round-trip (FR-1.1, EI-8, SEC-3) | INT | R3.1a/b/c | 5 | SC-1..5 + gap 3.1-CTR-6 |
| Lawful-access gate: disable-not-bypass + robots (FR-1.2, NFR-L-1) | CTR | R3.2a/b/c | 5 | LA-2/3/4/5/6 |
| Dedup on content_checksum (FR-1.3) | CTR | R3.3a | 2 | FA-4/5 |
| Manual-upload provenance complete (FR-1.3) | CTR | R3.3b | 1 | FA-6 |
| OCR fidelity (FR-1.3, ADR-006) | CTR | R3.3c | 1 | GAP 3.3-CTR-7 |
| Raw snapshot content-addressed + private + append-only (FR-1.4, NFR-S-5) | CTR+INT | R3.4a/b/c | 3 | RS-2/4/5 + gap 3.4-INT-6 |
| Per-artifact provenance: source_id+checksum+snapshot required (FR-1.5, AC-4) | INT | R3.5a/b/c | 5 | PR-1..5 |
| Idempotent/resilient ingestion: dedup-jobId + DLQ + no-inline-enqueue (FR-1.6, STR-3) | INT+lint | R3.6a/b/c/d | 5 | IC-1..5 + existing import-boundaries |
| Operator spot-check citation-or-silence invariant (FR-1.7, SEC-5) | E2E | R3.7a | 1 | OT-5 |
| Reprocess re-runs lawful-access (FR-1.2) | INT | R3.7b | 1 | GAP 3.7-INT-6 |

**Total P0:** 32 tests, ~45–65 hours

### P1 (High)

**Criteria:** Important features + Medium-high risk + Common workflows. These cover adapter shapes, observable metrics, and the operator journey.

| Requirement | Test Level | Risk Link | Test Count | Notes |
| ----------- | ---------- | --------- | ---------- | ----- |
| Lawful-access gate: ALLOW happy path | CTR | — | 1 | LA-1 |
| Fetch adapters: Crawler port + Firecrawl + Manual (FR-1.3) | CTR | R3.3d | 3 | FA-1/2/3 |
| Firecrawl AbortSignal (R3.3d) | UNIT | R3.3d | 1 | GAP 3.3-UNIT-8 |
| Backoff curve exactness (NFR-R-2) | UNIT | R3.6d | 1 | GAP 3.6-UNIT-6 |
| Snapshot port + get-bytes (FR-1.4) | CTR | — | 2 | RS-1/3 |
| Operator triage API (FR-1.7) | INT | — | 4 | OT-API-1/2/3/4 |
| Operator triage UI journey (FR-1.7) | E2E | — | 4 | OT-1/2/3/4 |

**Total P1:** 13 tests (10 existing scaffold + 2 gaps + 1 ALLOW), ~20–30 hours

### P2 (Medium)

**Criteria:** Secondary features + Low risk + Operational completeness.

| Requirement | Test Level | Risk Link | Test Count | Notes |
| ----------- | ---------- | --------- | ---------- | ----- |
| Operator health metrics API (NFR-O-1) | INT | R3.7c | 1 | OT-API-5 |
| Operator health metrics UI panel (NFR-O-1) | E2E | R3.7c | 1 | OT-6 |
| shadcn admin patterns present | E2E | — | 1 | OT-7 |

**Total P2:** 5 tests (3 listed + 2 already counted in P1 UI split), ~6–12 hours

---

## Execution Strategy

**Philosophy:** Run everything in PRs unless expensive/long-running. Playwright parallelization keeps the UI suite under ~10–15 min.

### PR gate (< 8 min, deterministic)
- All **contract** tests (3.2 LA, 3.3 FA + OCR gap, 3.4 RS) — pure decision/port logic, milliseconds.
- **Source-registry routes** (3.1 INT) — Fastify `app.inject`, no external container.
- **Provenance** (3.5 INT) — testcontainers PG (already wired in `ingest-schema` suite).
- **Queue unit** + new **backoff-curve unit** (3.6 gap) + **Firecrawl AbortSignal unit** (3.3 gap).
- **Stryker on changed files only** (≥90% on touched ingest modules).
- Epic 1.12 contract test (no uncited path) — regression net on every ingest PR.

### Nightly (< 90 min)
- **Ingestion idempotency** (3.6 INT: IC-1..5) — real Redis + PG via testcontainers; the 3-container stack.
- **Raw-snapshot MinIO** (3.4-INT-6 gap) — real MinIO container, bucket-config assertion.
- **Operator triage E2E** (3.7 full stack via `docker compose`) — 7 scenarios.
- **Stryker full** on new `@iip/ingest` modules (≥90%).

### Burn-in
- **Operator-triage E2E (3.7)** is the most flake-prone (UI + 3 backend deps). 3-run burn-in before unskipping, per project-context.md flaky-test discipline. 3-strike quarantine to `tests/flaky/` if it flakes.

---

## Resource Estimates

| Priority | Count | Hours/Test | Total Hours | Notes |
| -------- | ----- | ---------- | ----------- | ----- |
| P0 | 32 | ~1.4–2.0 | ~45–65 | Contract/integration defamation spine; multi-container setup |
| P1 | 13 | ~1.5–2.3 | ~20–30 | Adapter shapes, metrics, operator journey |
| P2 | 5 | ~1.2–2.4 | ~6–12 | Metrics + admin patterns |
| **Total** | **50** | — | **~70–105** | **~2–3 sprints** (distributed across story implementation) |

### Prerequisites

**Test Data:**
- `tests/support/helpers/ingest.ts` — IDs/checksums/jobIds (exists). Needs Source/Document/Snapshot/IngestionJob object-mother builders authored with story implementations.
- Firecrawl fixtures — mock HTTP boundary (network-first, no live Firecrawl calls).

**Tooling:**
- Vitest 2.x (contract/unit/integration) + Playwright 1.50.x (E2E) + testcontainers 10.x (PG+MinIO+Redis).
- `stryker.config.json` in `packages/ingest` (scope to widen).

**Environment:**
- Custom PG16+AGE+pgvector Docker image (shared by compose + testcontainers, pinned digest).
- MinIO (private, versioned bucket — `infra/minio/init-bucket.sh`).
- Redis (BullMQ broker).

---

## Quality Gate Criteria

### Pass/Fail Thresholds
- **P0 pass rate: 100%** (no exceptions — defamation spine).
- **P1 pass rate: ≥95%** (waivers required for failures).
- **P2/P3 pass rate: ≥90%** (informational).
- **High-risk mitigations: 100% complete or approved waivers** (all 6 BLOCK risks must have GREEN tests).

### Coverage Targets
- **Critical paths (provenance/lawful-access/dedup): 100%**
- **Security scenarios (SEC category): 100%**
- **Business logic: ≥80%**
- **Edge cases: ≥50%**

### Non-Negotiable Requirements
- [ ] All P0 tests pass
- [ ] No high-risk (≥6) items unmitigated
- [ ] Security tests (SEC category) pass 100%
- [ ] Stryker ≥90% on new ingest modules
- [ ] Epic 1.12 contract test (no uncited path) GREEN on every ingest PR
- [ ] 6 coverage-gap tests authored before stories marked done
- [ ] Planned NFR evidence exists or `nfr-assess` has documented CONCERNS/waivers

---

## Mitigation Plans

### R3.1c: wire_service/original_publisher lost → false "fact" upgrade (Score 9)
**Mitigation Strategy:** (1) zod schema in `packages/contracts/src/ingest.ts` enforces wire_service/original_publisher fields; (2) SC-1/SC-5 assert provenance round-trips persistently; (3) gap test 3.1-CTR-6 confirms confirmed=true requires validation evidence.
**Owner:** ingest-dev
**Timeline:** Story 3.1
**Status:** Planned (schema landed; route + tests RED)
**Verification:** SC-1/SC-5/3.1-CTR-6 GREEN.

### R3.2b: robots.txt Disallow ignored (Score 9)
**Mitigation Strategy:** (1) lawful-access gate reads robots.txt before any fetch; (2) LA-5 contract test: Disallow → DISABLE (binary gate); (3) no override path that skips robots.
**Owner:** ingest-dev
**Timeline:** Story 3.2
**Status:** Planned (gate module missing; test RED)
**Verification:** LA-5 GREEN.

### R3.3a: dedup by content_checksum fails (Score 9)
**Mitigation Strategy:** (1) DB unique index `content_checksum_uq` already landed; (2) FA-4/5 contract tests on dedup invariant; (3) runtime dedup logic in `packages/ingest/src/fetch/` (to land).
**Owner:** ingest-dev
**Timeline:** Story 3.3
**Status:** Partial (DB index landed; runtime logic + tests RED)
**Verification:** FA-4/5 GREEN.

### R3.3b: manual-upload provenance incomplete (Score 9)
**Mitigation Strategy:** (1) FA-6 contract test requires full provenance record (source_url, obtained_via, retrieved_at, uploader_id, reviewer_id, content_hash, legal_basis); (2) zod schema for manual-upload provenance.
**Owner:** ingest-dev
**Timeline:** Story 3.3
**Status:** Planned (test RED)
**Verification:** FA-6 GREEN.

### R3.5a: document registered without source pointer (Score 9)
**Mitigation Strategy:** (1) DB NOT NULL defaults + FK constraints already landed (documents.source_id, content_checksum, raw_snapshot_key); (2) PR-1/PR-5 integration tests; (3) upsertLastWriteWins via `@iip/db/upsert` (PC-1a).
**Owner:** ingest-dev
**Timeline:** Story 3.5
**Status:** Partial (DB constraints landed; write service + tests RED)
**Verification:** PR-1/PR-5 GREEN.

### R3.6a: inline enqueue in stage handler (Score 9)
**Mitigation Strategy:** (1) existing ESLint `tests/lint/import-boundaries.test.ts` bans `new Queue(`/`.add(` outside `@iip/queues/enqueuer` + orchestrator; (2) IC-5 integration test: stage.completed → Enqueuer → next stage; (3) Enqueuer Redis-Streams consumer-group leader already landed (TD4).
**Owner:** ingest-dev
**Timeline:** Story 3.6
**Status:** Partial (lint + Enqueuer landed; DAG + IC-5 RED)
**Verification:** import-boundaries GREEN + IC-5 GREEN.

---

## Assumptions and Dependencies

### Assumptions
1. The custom PG16+AGE+pgvector Docker image is built and pinned (shared by compose + testcontainers).
2. MinIO container is up with a private, versioned bucket (`infra/minio/init-bucket.sh`).
3. `@langchain/langgraph` 1.4.7 (now stable) is the checkpoint runtime for Story 3.6.
4. Legal/editorial procurement (trust-tier rubric, lawful-access decisions) proceeds in parallel and gates 3.1/3.2 on the *human* judgment side; tests assert the persisted result.

### Dependencies
1. LangGraph DAG definition — required by Story 3.6 (IC-2/IC-3/IC-5 cannot go GREEN without it).
2. Firecrawl API access (mocked in tests; real key only for manual smoke) — required by Story 3.3 adapter.
3. Object-mother test builders (Source/Document/Snapshot/IngestionJob) — authored incrementally with each story.

### Risks to Plan
- **Risk:** LangGraph interface changes between minors (pre-1.0 ecosystem skew per project-context.md).
  - **Impact:** IC-2 checkpoint resume test may break on a LangGraph bump.
  - **Contingency:** Pin exact patch version; `BaseCheckpointSaver` interface assertion in the test.
- **Risk:** testcontainers 3-container stack flakiness.
  - **Impact:** Nightly IC tests flake, blocking merges.
  - **Contingency:** reuse mode off, Ryuk enabled, per-suite isolation; 3-strike quarantine.

---

## Interworking & Regression

| Service/Component | Impact | Regression Scope |
| ----------------- | ------ | ---------------- |
| **packages/ingest (gate)** | New modules (access/fetch/snapshot/provenance) added alongside existing intake gate | Existing gate Stryker tests + `gate-replay.test.ts` must stay GREEN |
| **packages/db (schema)** | documents/ingestion-jobs tables now have runtime writers | `ingest-schema.integration.test.ts` (22 tests) + `ingestion-jobs` schema assertions |
| **apps/api (routes)** | New /sources + /admin/ingest routes mount alongside intake/query | `api-routes-intake.integration.test.ts` + `intake-boundary.contract.test.ts` |
| **packages/contracts (ingest)** | New result schemas (fetch-result, lawful-access-result, snapshot-result) | `ingest-domain.contract.test.ts` (29 tests) must stay GREEN |
| **Epic 1.12 contract** | Ingest feeds extraction which feeds render | Citation-or-silence contract test must stay GREEN on every ingest PR |

---

## Appendix

### Coverage Gap Tests (new, beyond the 44 ATDD scaffolds)
1. **3.1-CTR-6** — confirmed=true requires validation evidence (SEC-3 structural).
2. **3.3-CTR-7** — OCR cleaning output is faithful containment of source (R3.3c).
3. **3.3-UNIT-8** — Firecrawl adapter call carries `AbortSignal.timeout` (R3.3d).
4. **3.4-INT-6** — real MinIO bucket versioned append-only config asserted (R3.4c, NFR-S-5).
5. **3.6-UNIT-6** — `getBackoff` curve exact: 5 attempts / 1s base / 1.6× / 30s cap (R3.6d, NFR-R-2).
6. **3.7-INT-6** — reprocess re-runs lawful-access gate before re-ingest (R3.7b).

### Knowledge Base References
- `risk-governance.md` — Risk classification framework
- `probability-impact.md` — Risk scoring methodology (P×I matrix)
- `test-levels-framework.md` — Test level selection (unit/integration/E2E)
- `test-priorities-matrix.md` — P0–P3 prioritization
- `nfr-criteria.md` — NFR validation criteria

### Related Documents
- Epic: `_bmad-output/planning-artifacts/epics.md` (Epic 3, lines 730–850)
- Architecture: `_bmad-output/project-context.md`
- Prep sprint: `_bmad-output/implementation-artifacts/epic-3-prep-sprint-2026-07-08.md`
- ATDD checklists: `_bmad-output/test-artifacts/atdd/epic-3/story-3-{1..7}/`

---

**Generated by:** BMad TEA Agent — Test Architect Module
**Workflow:** `bmad-testarch-test-design`
**Version:** 4.0 (BMad v6)
