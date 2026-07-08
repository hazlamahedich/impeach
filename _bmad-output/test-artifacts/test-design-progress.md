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
author: 'anti lustay'
detectedStack: 'fullstack'
inputDocuments:
  - '_bmad-output/planning-artifacts/epics.md (Epic 3, lines 730-850)'
  - '_bmad-output/project-context.md'
  - '_bmad-output/implementation-artifacts/epic-3-prep-sprint-2026-07-08.md'
  - '_bmad-output/test-artifacts/atdd/epic-3/story-3-1..3-7/*.md (7 ATDD checklists)'
  - 'packages/contracts/src/ingest.ts'
  - 'packages/ingest/src/ (gate implemented; access/fetch/snapshot/provenance/orchestrator missing)'
  - 'packages/db/src/schema/{sources,documents,ingestion-jobs}.ts'
  - 'tests/support/helpers/ingest.ts'
  - 'knowledge fragments: risk-governance, probability-impact, test-levels-framework, test-priorities-matrix, nfr-criteria'
---

# Test Design Progress — Epic 3

## Step 1: Detect Mode & Prerequisites

**Mode selected:** Epic-Level (Epic 3 — Source Onboarding & Intelligence Ingestion)

**Rationale:**
- User intent ("testarch test-design epic 3") explicitly scopes to a single epic.
- Prerequisites present: Epic 3 stories (3.1–3.7) with ACs in `_bmad-output/planning-artifacts/epics.md`; architecture context in `_bmad-output/project-context.md`.
- Existing ATDD red-phase scaffolds exist for all 7 stories under `_bmad-output/test-artifacts/atdd/epic-3/story-3-N/` — these feed the epic-level test plan (the ATDD output is per-story scaffolds; the test-design output is the epic-level risk/coverage/strategy document).

**Run type:** Create (no prior test-design-progress.md).

**Inputs confirmed:**
- Epic + story requirements with ACs ✅
- Architecture context ✅
- Prior epic ATDD plans (Epic 1) as pattern reference ✅
- TEA config ✅

## Step 2: Load Context & Knowledge Base

### 2.1 Configuration Resolved
| Flag | Value | Effect |
|---|---|---|
| `test_stack_type` | `auto → fullstack` | Frontend (Next.js 15) + Backend (Fastify 5) + Python (`tools/eval`) |
| `tea_use_playwright_utils` | `true` | Full UI+API Playwright profile (E2E tests use `page.goto`/`page.locator` — detected in `tests/e2e/`) |
| `tea_use_pactjs_utils` | `false` | Contract-testing fragment loads; Epic 3 uses zod contract + integration, not Pact |
| `tea_pact_mcp` | `none` | — |
| `tea_browser_automation` | `auto` | AI-generation (RED scaffolds, no live UI to record against) |
| `test_artifacts` | `_bmad-output/test-artifacts` | Output root |

### 2.2 Knowledge Fragments Loaded
- **Core tier:** `risk-governance.md`, `probability-impact.md`, `test-levels-framework.md`, `test-priorities-matrix.md`
- **Extended (NFR-relevant):** `nfr-criteria.md` (Epic 3 carries security FR-1.2, reliability NFR-R-2/3, security NFR-S-5, operational NFR-O-1)

### 2.3 Substrate State Assessment (critical for risk scoring)

**Substrate LANDGED (GREEN, already covered):**
- `sources` + `documents` + `ingestion_jobs` Drizzle tables + migration `0004_epic3_ingest_tables.sql` (22 GREEN schema tests)
- Identity/queue contracts in `packages/contracts/src/ingest.ts`: `SourceId`, `DocumentId`, `ContentChecksum`, `JobId`, `SourceSourceType`, `CrawlStrategy`, `JobState`, queue constants (29 GREEN contract tests)
- Intake gate (SEC-2 two-person rule) at `packages/ingest/src/gate/` — Stryker-tested (out of Epic 3 scope, but the gate ingest depends on)
- BullMQ substrate: `createIngestQueue`, `enqueueIngestJob`, `computeJobId=sha256(dedupeAnchor)`, Enqueuer Redis-Streams consumer-group leader (7 GREEN unit tests)
- Factories in `tests/support/helpers/ingest.ts`: `makeValidSourceId`, `makeValidContentChecksum`, `makeValidJobId`, negative fixtures

**STILL RED / MISSING (the 44 ATDD scaffolds, all `describe.skip`):**
| Story | File | Tests | Capability missing |
|---|---|---|---|
| 3.1 | `source-registry-routes.integration.test.ts` | 5 | `POST/GET /sources` routes |
| 3.2 | `lawful-access-gate.contract.test.ts` | 6 | `assessLawfulAccess` gate |
| 3.3 | `fetch-adapter.contract.test.ts` | 6 | Crawler port + Firecrawl/Manual adapters + dedup |
| 3.4 | `raw-snapshot.contract.test.ts` | 5 | `RawSnapshotStore` (MinIO client) |
| 3.5 | `document-provenance.integration.test.ts` | 5 | provenance-wiring service |
| 3.6 | `ingestion-idempotency.integration.test.ts` | 5 | orchestrator.ts + LangGraph DAG + checkpoint |
| 3.7 | `operator-triage-routes.integration.test.ts` | 5 | `/admin/ingest/*` routes |
| 3.7 | `operator-triage-surface.spec.ts` (E2E) | 7 | `/admin/ingest` UI |

### 2.4 Testability Concerns
- **LangGraph DAG (Story 3.6):** `@langchain/langgraph` 1.4.7 is now stable; DAG definition is genuinely Story 3.6's deliverable (IC-2/IC-3/IC-5 cannot go GREEN until it lands). Risk: checkpoint resume testing needs the real DAG.
- **MinIO (Story 3.4):** infra is up (`infra/docker-compose.yml` + `infra/minio/init-bucket.sh`) but no TS client consumes it — RS tests need a real MinIO container in the integration stack.
- **Legal/editorial procurement (3.1/3.2):** trust-tier confirmation rubric + lawful-access decisions are parallel non-developer tracks; tests assert the persisted *result*, not the human judgment.
- **Firecrawl (3.3):** external dependency; tests must mock the Firecrawl HTTP boundary (network-first), not hit it live.

## Step 3: Risk Assessment & NFR Planning

### 3.1 Risk Register (P×I matrix, T1/T2/T3 severity spine)

> Severity spine (from `docs/invariant-ledger.yaml` convention): **T1** = defamation/legal exposure (blocks build, fail-fast); **T2** = credibility degradation; **T3** = operational. Score ≥6 requires mitigation; score 9 blocks the gate. Epic 3 is **T1-heavy** because every ingest defect is defamation-adjacent — this is evidence ingestion, not data ingestion.

#### 🚨 BLOCK risks (score 9 — automatic FAIL until covered)
| ID | Story | Risk | P | I | Cat | Existing test? |
|---|---|---|---|---|---|---|
| R3.1c | 3.1 | wire_service/original_publisher lost → 2 wire-republished stories counted as "independent" → false "fact" upgrade (EI-2) | 3 | 3 | DATA | SC-1/SC-5 (assert provenance round-trip) |
| R3.2b | 3.2 | robots.txt Disallow ignored (NFR-L-1) → unlawful ingestion | 3 | 3 | SEC | LA-5 |
| R3.3a | 3.3 | dedup by content_checksum fails → same doc processed twice → conflicting extractions served as fact | 3 | 3 | DATA | FA-4/5 |
| R3.3b | 3.3 | manual-upload provenance incomplete (missing legal_basis/uploader/reviewer) → no defense if challenged | 3 | 3 | SEC | FA-6 |
| R3.5a | 3.5 | document registered without source_id/checksum/snapshot → artifact with no source pointer (FR-1.5 break) | 3 | 3 | DATA | PR-1/PR-5 |
| R3.6a | 3.6 | inline enqueue in stage handler (STR-3) → crash loses the chain + DAG scatters | 3 | 3 | TECH | IC-5 + existing `tests/lint/import-boundaries` |

#### ⚠️ MITIGATE risks (score 6 — CONCERNS at gate)
| ID | Story | Risk | P | I | Cat | Existing test? |
|---|---|---|---|---|---|---|
| R3.1a | 3.1 | self-declared trust tier persisted as `confirmed:true` (SEC-3) | 2 | 3 | DATA | SC-4 |
| R3.1b | 3.1 | POST /sources without sources:write scope (SEC-1) | 2 | 3 | SEC | SC-2/SC-3 |
| R3.2a | 3.2 | paywall/login/CAPTCHA source bypassed not disabled (FR-1.2) | 2 | 3 | SEC | LA-2/3/4 |
| R3.2c | 3.2 | manual override without AC-11 editorial-log justification | 2 | 3 | SEC | LA-6 |
| R3.3c | 3.3 | OCR cleaning hallucinates/distorts text → fabricated "quote" | 2 | 3 | DATA | **GAP — no scaffold** |
| R3.3d | 3.3 | Firecrawl external dep flake/hang (no AbortSignal) → ingest stalls | 3 | 2 | OPS | implicit (adapter contract) |
| R3.4a | 3.4 | raw snapshot on serving path (must be off serving path) | 2 | 3 | SEC | RS-5 |
| R3.4b | 3.4 | snapshot not content-addressed (SHA-256) → cited PDF silently swapped | 2 | 3 | DATA | RS-2 |
| R3.4c | 3.4 | bucket not versioned append-only (NFR-S-5) → overwriteable | 2 | 3 | SEC | RS-4 (partial) |
| R3.5b | 3.5 | re-embedding breaks citation validity (AC-4 decoupling) | 2 | 3 | DATA | PR-4 |
| R3.5c | 3.5 | blind insert, not upsertLastWriteWins (PC-1a) → duplicate docs | 3 | 2 | DATA | PR-2 |
| R3.6b | 3.6 | crash-resume doesn't restore from checkpoint (NFR-R-3) | 2 | 3 | TECH | IC-2 (needs DAG) |
| R3.6c | 3.6 | max-attempts exceeded not routed to dlq:ingest → job vanishes | 2 | 3 | OPS | IC-3 (needs DAG) |
| R3.6d | 3.6 | non-idempotent re-enqueue (jobId not deduped) → duplicate work | 3 | 2 | TECH | IC-1/IC-4 |
| R3.7a | 3.7 | spot-check renders allegation-as-fact internally (SEC-5 internal not liability-free) | 2 | 3 | SEC | OT-4/OT-5 |
| R3.7b | 3.7 | reprocess re-enqueues WITHOUT re-running lawful-access → disabled source re-ingested | 2 | 3 | SEC | **GAP — OT-3 doesn't assert re-check** |

#### 📋 MONITOR risks (score 4–5)
| ID | Story | Risk | P | I | Cat |
|---|---|---|---|---|---|
| R3Xb | epic | @iip/ingest imports @iip/render or @iip/rag (STR-3/4) | 1 | 3 | TECH (mitigated by `tests/lint/import-boundaries`) |
| R3.7c | 3.7 | health metrics missing (NFR-O-1) | 2 | 1 | OPS |

#### DOCUMENT risks (score 1–3)
| ID | Risk | P | I |
|---|---|---|---|
| R3Xc | testcontainers 3-container stack (PG+MinIO+Redis) flaky-prone | 3 | 1 |
| R3Xd | ingestion throughput has no p95 threshold (unlike extract/query) | 2 | 1 |

### 3.2 Coverage Gaps Discovered (new tests beyond the 44 ATDD scaffolds)
1. **OCR fidelity (3.3, R3.3c)** — cleaned text must be a faithful containment of source; no RED scaffold exists. → Recommend a contract test on the cleaning step asserting output ⊆ input (no hallucinated characters).
2. **Reprocess re-checks lawful-access (3.7, R3.7b)** — OT-3 must assert the gate re-runs before re-ingest. Amend scaffold or add a test.
3. **Backoff curve exactness (3.6, R3.6d)** — assert `getBackoff` returns configured 5/1s/1.6×/30s cap. `queue.test.ts` covers jobId but not the backoff curve. → Add a unit test.
4. **Stryker scope for new @iip/ingest modules (3.2/3.3/3.4)** — ≥90% on access/fetch/snapshot once implemented; `stryker.config.json` exists, scope must be widened as modules land.
5. **Cross-epic: provenance reverse-index (R3Xa)** — every source → its live claims. NOT an Epic 3 gap (reverse index lands Epic 4/5); flagged as cross-epic dependency.

### 3.3 NFR Planning Assessment
| NFR | Threshold (source) | Evidence plan | Status |
|---|---|---|---|
| NFR-S-5 (append-only versioned MinIO) | binary: bucket private + versioned + object-locked | RS-4/RS-5 + bucket-config assertion | testable |
| FR-1.2 (lawful-access disable-not-bypass) | binary: paywall/login/CAPTCHA/terms → DISABLE | LA-2/3/4/5 | testable |
| NFR-L-1 (robots.txt) | binary: Disallow → DISABLE | LA-5 | testable |
| NFR-R-2 (retry + DLQ) | backoff 5/1s/1.6×/30s cap; dlq:ingest on max-attempts | IC-3 + new backoff unit test | backoff GREEN; DLQ needs DAG (3.6) |
| NFR-R-3 (checkpoint resume) | state restored from job_runs.state_run_id | IC-2 | needs DAG (3.6) |
| NFR-O-1 (4 metrics) | success rate, throughput, queue depth, DLQ depth all present | OT-API-5/OT-6 | testable |
| Performance (ingest throughput) | **UNKNOWN — no p95 in epic** | monitor-only | non-blocking |
| Maintainability (Stryker) | ≥90% on new ingest modules | stryker.config.json (scope TBD) | planned |

### 3.4 Risk Summary
**8 BLOCK risks (score 9), 16 MITIGATE risks (score 6),** all concentrated in the provenance/lawful-access/dedup spine (Stories 3.1–3.6). The test pyramid for Epic 3 is **NOT bottom-heavy**: the contract + integration layer carries the defamation spine because unit tests cannot verify "is this snapshot immutable" or "does dedup actually prevent double-processing." The E2E layer (Story 3.7) is T2 operational — operator credibility, not direct defamation exposure. **Gate decision at Epic 3 completion = FAIL until all 6 BLOCK risks have GREEN tests + the 4 coverage gaps are addressed.**

## Step 4: Coverage Plan & Execution Strategy

### 4.1 Coverage Matrix — AC → Scenario → Level → Priority

> Test ID format: `{epic}.{story}-{LEVEL}-{SEQ}` (per test-levels-framework.md). Levels: CTR=contract, INT=integration, E2E=end-to-end, UNIT=unit. Priority maps from risk score: P0=score 9 (BLOCK), P1=score 6 (MITIGATE), P2=score 4–5 (MONITOR), P3=score 1–3 (DOCUMENT). "Scaffold?" = exists in the 44 RED ATDD tests (Y) or is a new coverage-gap test (GAP).

#### Story 3.1 — Source Registry + Confirmed Trust Tier (FR-1.1, EI-8, SEC-3)
| Test ID | Scenario | Level | Pri | Scaffold? | Maps to risk |
|---|---|---|---|---|---|
| 3.1-INT-1 | POST /sources with sources:write → 201, persisted w/ confirmed tier + provenance | INT | P0 | Y (SC-1) | R3.1c |
| 3.1-INT-2 | POST /sources without sources:write → 403 | INT | P0 | Y (SC-2) | R3.1b |
| 3.1-INT-3 | POST /sources no Authorization → 401 | INT | P1 | Y (SC-3) | R3.1b |
| 3.1-INT-4 | POST /sources trust_tier∉{1,2,3} → 400 | INT | P0 | Y (SC-4) | R3.1a |
| 3.1-INT-5 | GET /sources/:id returns confirmed tier + wire/original_publisher (EI-8) | INT | P0 | Y (SC-5) | R3.1c |
| 3.1-CTR-6 | zod: confirmed=true requires validation evidence, not self-declared | CTR | P0 | **GAP** | R3.1a (SEC-3 structural) |

#### Story 3.2 — Lawful-Access Gate (FR-1.2, NFR-L-1)
| Test ID | Scenario | Level | Pri | Scaffold? | Maps to risk |
|---|---|---|---|---|---|
| 3.2-CTR-1 | ALLOW when public + robots-allow | CTR | P1 | Y (LA-1) | — |
| 3.2-CTR-2 | DISABLE on paywall | CTR | P0 | Y (LA-2) | R3.2a |
| 3.2-CTR-3 | DISABLE on login wall | CTR | P0 | Y (LA-3) | R3.2a |
| 3.2-CTR-4 | DISABLE on CAPTCHA | CTR | P0 | Y (LA-4) | R3.2a |
| 3.2-CTR-5 | DISABLE on robots Disallow (NFR-L-1) | CTR | P0 | Y (LA-5) | R3.2b |
| 3.2-CTR-6 | override requires AC-11 editorial-log justification | CTR | P0 | Y (LA-6) | R3.2c |

#### Story 3.3 — Discover/Fetch/Dedup (FR-1.3, ADR-006/007)
| Test ID | Scenario | Level | Pri | Scaffold? | Maps to risk |
|---|---|---|---|---|---|
| 3.3-CTR-1 | Crawler port shape: discover/fetch/clean | CTR | P1 | Y (FA-1) | — |
| 3.3-CTR-2 | FirecrawlAdapter (Tier-1) returns fetch result | CTR | P1 | Y (FA-2) | R3.3d |
| 3.3-CTR-3 | ManualUploadAdapter (Tier-4) returns fetch result | CTR | P1 | Y (FA-3) | — |
| 3.3-CTR-4 | dedup: identical content_checksum → one document | CTR | P0 | Y (FA-4) | R3.3a |
| 3.3-CTR-5 | dedup: two distinct sources, identical content → distinct jobs | CTR | P0 | Y (FA-5) | R3.3a |
| 3.3-CTR-6 | manual-upload provenance record complete (legal_basis etc.) | CTR | P0 | Y (FA-6) | R3.3b |
| 3.3-CTR-7 | OCR cleaning output is faithful containment of source (no hallucination) | CTR | P0 | **GAP** | R3.3c |
| 3.3-UNIT-8 | Firecrawl adapter call carries AbortSignal.timeout | UNIT | P1 | **GAP** | R3.3d |

#### Story 3.4 — Immutable Raw Snapshots (FR-1.4, NFR-S-5)
| Test ID | Scenario | Level | Pri | Scaffold? | Maps to risk |
|---|---|---|---|---|---|
| 3.4-CTR-1 | RawSnapshotStore port: put/get contract | CTR | P1 | Y (RS-1) | — |
| 3.4-CTR-2 | put returns SHA-256 content-addressed key | CTR | P0 | Y (RS-2) | R3.4b |
| 3.4-CTR-3 | get returns original bytes + fetch metadata | CTR | P1 | Y (RS-3) | — |
| 3.4-CTR-4 | idempotent re-put (same key, no error) | CTR | P0 | Y (RS-4) | R3.4c |
| 3.4-CTR-5 | bucket is private (off serving path) | CTR | P0 | Y (RS-5) | R3.4a |
| 3.4-INT-6 | real MinIO: bucket versioned append-only config asserted | INT | P0 | **GAP** | R3.4c (NFR-S-5) |

#### Story 3.5 — Per-Artifact Provenance (FR-1.5, AC-4, PC-1a)
| Test ID | Scenario | Level | Pri | Scaffold? | Maps to risk |
|---|---|---|---|---|---|
| 3.5-INT-1 | register doc records source_id+checksum+snapshot+fetch_metadata | INT | P0 | Y (PR-1) | R3.5a |
| 3.5-INT-2 | idempotent re-register (upsertLastWriteWins, no dup) | INT | P0 | Y (PR-2) | R3.5c |
| 3.5-INT-3 | citation tuple resolvable from registered doc | INT | P0 | Y (PR-3) | R3.5a |
| 3.5-INT-4 | embedding change preserves citation validity (AC-4) | INT | P0 | Y (PR-4) | R3.5b |
| 3.5-INT-5 | FK violation on bad source_id rejected | INT | P0 | Y (PR-5) | R3.5a |

#### Story 3.6 — Idempotent/Observable/Resilient Ingestion (FR-1.6, NFR-R-2/3, STR-3)
| Test ID | Scenario | Level | Pri | Scaffold? | Maps to risk |
|---|---|---|---|---|---|
| 3.6-INT-1 | re-enqueue same dedupe-anchor → one job (idempotent) | INT | P0 | Y (IC-1) | R3.6d |
| 3.6-INT-2 | crash-resume from LangGraph checkpoint (NFR-R-3) | INT | P0 | Y (IC-2) | R3.6b |
| 3.6-INT-3 | max_attempts → routed to dlq:ingest | INT | P0 | Y (IC-3) | R3.6c |
| 3.6-INT-4 | identical content / two sources → distinct jobs | INT | P0 | Y (IC-4) | R3.6d |
| 3.6-INT-5 | stage.completed → Enqueuer → next stage (no inline enqueue) | INT | P0 | Y (IC-5) | R3.6a |
| 3.6-UNIT-6 | getBackoff curve: 5 attempts / 1s base / 1.6× / 30s cap exact | UNIT | P1 | **GAP** | R3.6d (NFR-R-2) |
| 3.6-UNIT-7 | ESLint: no `new Queue(`/`.add(` outside @iip/queues/enqueuer + orchestrator | UNIT(lint) | P0 | existing | R3.6a (STR-3) |

#### Story 3.7 — Operator Triage Surface (FR-1.7, NFR-O-1, SEC-5)
| Test ID | Scenario | Level | Pri | Scaffold? | Maps to risk |
|---|---|---|---|---|---|
| 3.7-INT-1 | GET /admin/ingest/jobs returns failed+DLQ w/ typed error categories | INT | P1 | Y (OT-API-1) | — |
| 3.7-INT-2 | 403 without admin:ingest:read | INT | P1 | Y (OT-API-2) | — |
| 3.7-INT-3 | POST .../reprocess re-enqueues | INT | P1 | Y (OT-API-3) | R3.7b |
| 3.7-INT-4 | spot-check view returns source text + extracted artifacts | INT | P1 | Y (OT-API-4) | R3.7a |
| 3.7-INT-5 | GET /admin/ingest/metrics returns 4 metrics (NFR-O-1) | INT | P2 | Y (OT-API-5) | R3.7c |
| 3.7-INT-6 | reprocess re-runs lawful-access gate before re-ingest | INT | P0 | **GAP** | R3.7b |
| 3.7-E2E-1 | triage queue renders failed + DLQ jobs | E2E | P1 | Y (OT-1) | — |
| 3.7-E2E-2 | typed error category displayed | E2E | P1 | Y (OT-2) | — |
| 3.7-E2E-3 | reprocess button → job re-enqueued | E2E | P1 | Y (OT-3) | R3.7b |
| 3.7-E2E-4 | spot-check overlay (side-by-side, highlights) | E2E | P1 | Y (OT-4) | R3.7a |
| 3.7-E2E-5 | citation-or-silence invariant visible in spot-check (SEC-5) | E2E | P0 | Y (OT-5) | R3.7a |
| 3.7-E2E-6 | health metrics panel (4 metrics) | E2E | P2 | Y (OT-6) | R3.7c |
| 3.7-E2E-7 | shadcn admin patterns present | E2E | P2 | Y (OT-7) | — |

#### Coverage totals
- **Existing ATDD scaffolds: 44 tests** (all RED/skip) across 8 files.
- **New coverage-gap tests: 6** (3.1-CTR-6, 3.3-CTR-7, 3.3-UNIT-8, 3.4-INT-6, 3.6-UNIT-6, 3.7-INT-6).
- **Total Epic 3 planned tests: 50** — P0: 32, P1: 13, P2: 5.
- **Already GREEN substrate coverage (not re-counted):** 29 ingest-domain contract + 22 ingest-schema integration + 7 queue unit = 58 GREEN tests on landed substrate.

#### Duplicate-coverage guard
No redundancy detected: contract tests (3.2/3.3/3.4) verify pure decision/port logic; integration tests (3.1/3.5/3.6/3.7-API) verify DB+queue+route wiring; E2E (3.7) verifies the operator journey only. Each level tests a distinct aspect (per test-levels-framework.md overlap exception: defense-in-depth on the citation/provenance spine).

### 4.2 NFR Evidence Plan (concise — full assessment deferred to nfr-assess)
| NFR | Validation scenario(s) | Evidence artifact | Status |
|---|---|---|---|
| NFR-S-5 | 3.4-CTR-5 + 3.4-INT-6 (private + versioned bucket) | test report + bucket-config dump | testable |
| FR-1.2 / NFR-L-1 | 3.2-CTR-2/3/4/5 | contract test report | testable |
| NFR-R-2 | 3.6-INT-3 (DLQ) + 3.6-UNIT-6 (backoff curve) | test report | DLQ needs DAG |
| NFR-R-3 | 3.6-INT-2 (checkpoint resume) | test report | needs DAG |
| NFR-O-1 | 3.7-INT-5 + 3.7-E2E-6 (4 metrics) | API + UI assertions | testable |
| Maintainability (Stryker) | widen stryker.config.json scope as modules land | mutation report | planned |

### 4.3 Execution Strategy (PR / Nightly lanes)
- **PR gate (<8 min, deterministic):** all contract tests (3.2/3.3/3.4 — pure, fast) + source-registry routes (3.1) + provenance (3.5) + queue unit + Stryker on changed files only. **Not** the 3-container integration (3.6) or E2E (3.7) — those are nightly.
- **Nightly (<90 min):** 3.6 ingestion-idempotency (real Redis + PG via testcontainers), 3.4-INT-6 (real MinIO), 3.7 E2E (full stack via docker compose), Stryker full on new ingest modules (≥90%).
- **Burn-in:** operator-triage E2E (3.7) is the most flake-prone (UI + 3 backend deps) → 3-run burn-in before unskipping, per project-context.md flaky discipline.

### 4.4 Resource Estimates (ranges)
| Priority | Tests | Estimate |
|---|---|---|
| P0 (incl. 6 gaps) | 32 | ~45–65 hours |
| P1 | 13 | ~20–30 hours |
| P2 | 5 | ~6–12 hours |
| **Total** | **50** | **~70–105 hours** (across story implementation sprints; not a single sprint) |

### 4.5 Quality Gates (Epic 3 release gate)
- **P0 pass rate = 100%** (all 6 BLOCK risks must have GREEN tests — non-negotiable, defamation spine).
- **P1 pass rate ≥ 95%** (with documented justification for any skip).
- **6 coverage-gap tests authored** before stories are marked done (they are RED now — implementing the story without them leaves a known hole).
- **Stryker ≥90%** on new `@iip/ingest` modules (access, fetch, snapshot, provenance).
- **No uncited-path regression** — the Epic 1.12 contract test stays GREEN on every PR touching ingest.
- **Gate decision: FAIL** until all P0 GREEN + gaps closed. (See risk summary §3.4.)

## Step 5: Generate Output & Validate

### Output document
- **Path:** `_bmad-output/test-artifacts/test-design-epic-3.md`
- **Mode:** Epic-level (single document; no handoff doc — that's system-level only)
- **Template:** `test-design-template.md` (populated)

### Validation against checklist (epic-level)
- [x] Story markdown with clear AC exists (epics.md, Epic 3)
- [x] Architecture docs available (project-context.md)
- [x] Existing test coverage analyzed (44 RED scaffolds + 58 GREEN substrate)
- [x] Knowledge fragments loaded (risk-governance, probability-impact, test-levels, test-priorities, nfr-criteria)
- [x] Genuine risks identified (24), classified (TECH/SEC/DATA/OPS), scored (P×I), high-priority flagged
- [x] Mitigation plans + owners for all 6 BLOCK risks
- [x] NFR thresholds extracted (NFR-S-5, FR-1.2, NFR-L-1, NFR-R-2/3, NFR-O-1); unknown threshold (ingest p95) marked, not invented
- [x] Coverage matrix: AC → scenario → level → priority; no duplicate coverage; 6 gap tests identified
- [x] Execution strategy: PR / Nightly lanes (simple, no redundant tiers)
- [x] Resource estimates as ranges (~70–105 hours)
- [x] Quality gates: P0=100%, P1≥95%, SEC=100%, Stryker≥90%
- [x] Risk IDs unique; scores calculated correctly; high-priority marked

### Completion
- **Workflow status:** completed
- **CLI/browser sessions:** none opened (AI-generation mode, no live exploration)
- **Temp artifacts:** all in `_bmad-output/test-artifacts/`
