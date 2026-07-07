# Epic 3 Prep Sprint — 2026-07-08

**Source:** Epic 2 retrospective (`epic-2-retro-2026-07-08.md`)
**Decision (anti lustay, Project Lead):** Full prep sprint (TD1–TD9) before any Epic 3 feature story starts. Mirrors the Epic 2 prep sprint pattern (TD1–TD6) that successfully unblocked Epic 2.
**Status:** Not started

---

## BLOCKING (must complete before any Epic 3 feature story)

### TD1 — Bootstrap the real API server
**Owner:** Amelia (Developer)
**Why blocking:** `apps/api/src/index.ts` is still the Story 1.1 `console.log('alive: api')` stub. Story 2.11 explicitly deferred editorial-log boot-wiring to "Epic 3+." Epic 3's operator surfaces (3.1, 3.7) and 3.2's AC-11 logging all need a real Fastify bootstrap.
**Scope:**
- Promote `apps/api/src/index.ts` to a Fastify bootstrap
- Mount `intake.ts` / `query.ts` / `rate-limit.ts` route files (they exist but aren't registered)
- Instantiate the editorial repo at boot
- Instantiate the audit-health client (2.11) at boot
- Wire `audit.circuit_breaker.opened/.closed` `onTransition` → editorial log append (completes the 2.11 seam)
- Start listening
**Done when:** `apps/api` boots a real Fastify server; editorial-log append fires on audit circuit-breaker transitions; `/query` returns 503 when audit-worker is down (integration test against injected fetch).
**Overlaps:** TD5 (editorial-log boot wiring is the same work).

### TD2 — STR-1 `ingest` + `intake` consolidation
**Owner:** Winston (Architect)
**Why blocking:** Architecture (STR-1) says merge `ingest` + `intake` → `ingest` (`src/fetch/` + `src/gate/`). In the repo both packages exist; `packages/intake` holds the real state machine; `packages/ingest` is a `hello()` stub. `apps/ingest-worker` imports `@iip/intake`. Epic 3 builds ingestion on top of this — the inconsistency is live.
**Scope:** Either execute the merge (move `packages/intake/src/gate/*` under `packages/ingest/src/gate/`, update imports, update `package.json` exports) OR formally rescind STR-1 and document the two-package layout.
**Done when:** One package owns the intake gate + (future) fetch path; or STR-1 amended with the two-package rationale. All imports resolve.

### TD3 — New DB tables (`sources`, `documents`, `ingestion_jobs`)
**Owner:** Amelia (Developer)
**Why blocking:** None of these tables exist. Only `editorial-log`, `config-history`, `intake-documents`, `compatibility-probe` schemas are present. Stories 3.1, 3.5, 3.6 assume them.
**Scope:**
- `sources` table (3.1): source_id, type, crawl strategy, trust_tier (1–3, confirmed), wire_service/original_publisher provenance
- `documents` table (3.5): source_id (FK), content_checksum, raw_snapshot_key, fetch metadata; idempotent upsert on content_checksum (PC-1a); lineage relationship to `intake_documents` (likely FK)
- `ingestion_jobs` table (3.6): job state, `state_run_id` (LangGraph checkpoint JOIN), dedupe anchor
- Hand-authored Drizzle migrations (0002 journal precedent from 2.6a — hand-authored, not `drizzle-kit generate` trust)
**Done when:** Tables created with migrations; integration tests assert against live `information_schema`; vocabulary CHECK constraints where applicable.

---

## HIGH (spike before 3.6; can overlap early stories)

### TD4 — Queue/orchestration substrate vertical-slice spike
**Owner:** Winston (Architect)
**Why high:** BullMQ + LangGraph + Enqueuer handoff is the single largest technical unknown in Epic 3. None of it exists yet. Without a vertical-slice spike, 3.6 is likely to force a split (mirrors the 2.9 → 2.9a/2.9b split pattern).
**Scope:**
- BullMQ 5.x `@iip/queues` package; one-queue-per-stage + event-driven Enqueuer handoff (STR-3, PC-2.4)
- DLQ `dlq:ingest` first-class
- LangGraph.js per-node state checkpoint in `job_runs.state_run_id` (NFR-R-3, PC-2.4)
- `jobId = sha256(dedupe-anchor)` idempotency
- **RED contract test for idempotent re-run-on-crash** (TD4 pattern from Epic 2 prep — `tests/contract/ingestion-idempotency-contract.md`)
**Done when:** Vertical slice (enqueue → process → checkpoint → crash-mid-job → resume → idempotent re-run) proven against real Redis via Testcontainers.

**Status (2026-07-08):** BullMQ substrate + Enqueuer boot + idempotency contract COMPLETE. LangGraph checkpoint slice DEFERRED to Story 3.6 — see notes below.

**Completion notes:**
- ✅ `packages/config/src/queues.ts` — backoff config knob (`getBackoff`/`setBackoff`/`backoffDelayMs`) wired to `config_history` (PC-2.6). Defaults: 5 attempts, 1s base, 1.6× growth, 30s cap.
- ✅ `packages/contracts/src/ingest.ts` — queue-name constants (`INGEST_QUEUE_NAME`, `INGEST_DLQ_NAME`), `IngestJobPayloadSchema`, `STAGE_COMPLETED_SUFFIX`.
- ✅ `apps/ingest-worker/src/queue.ts` — BullMQ queue + worker factories: `createIngestQueue`, `enqueueIngestJob` (sole sanctioned enqueue entrypoint, STR-3), `createIngestWorker`, `computeJobId` (= sha256(dedupe-anchor), PC-2.4), `fetchDedupeAnchor`, `connectionFromUrl`.
- ✅ `apps/ingest-worker/src/queue.test.ts` — 7 unit tests proving idempotency contract (deterministic jobId, dedupe-anchor composition, sha256 pinned).
- ✅ `apps/enqueuer/src/index.ts` — real Redis Streams consumer-group leader boot: `bootOrDie()`, `xgroup CREATE` (idempotent), `xreadgroup` blocking loop, `parseStreamEvent`, graceful shutdown, `alive: enqueuer` healthcheck preserved. DAG mapping (event.stage → next BullMQ job) is the Story 3.6 seam.
- ✅ `tests/contract/ingestion-idempotency-contract.md` — RED contract (5 test cases: IC-1 re-enqueue dedupe, IC-2 crash-resume, IC-3 DLQ routing, IC-4 provenance-chain distinction, IC-5 stage→Enqueuer→next). Story 3.6 implements the runnable integration tests.
- ⏩ **LangGraph checkpoint slice deferred to Story 3.6.** `@langchain/langgraph` is now at **1.4.7** (stable 1.x — the project-context pre-1.0 instability warning is resolved). The checkpoint DAG definition is genuinely Story 3.6's deliverable (`apps/ingest-worker/src/graphs/` + the stage→node mapping); building a 2-node placeholder now that 3.6 will rework into the real DAG would be churn. The `ingestion_jobs.state_run_id` column (TD3) is the JOIN key ready for 3.6 to wire. **Decision: defer rather than build-then-rework.**

### TD5 — Editorial-log boot wiring
**Owner:** Amelia (Developer)
**Why high:** The `onTransition` seam + `audit.circuit_breaker.opened/.closed` event schemas (19→21 variants) exist from 2.11 but aren't boot-wired. Story 3.2's manual-override AC-11 logging needs the editorial repo instantiated.
**Scope:** Overlaps TD1 — wire the editorial repo + audit-health client into the API bootstrap.
**Done when:** Editorial-log append fires on real events at boot.

---

## MEDIUM (lands before broad public launch / parallel with Epic 3)

### TD6 — oq9.ts code catch-up (Open Item O-3, 4-part scope)
**Owner:** Murat (Test Architect)
**Why medium:** The recalibrated OQ-9 pass rule (Phase-1/Phase-2 from ADR-0025 amendment) is binding in the ADR but `oq9.ts` still enforces the old `TAU_STRATUM_LCB=0.95`. Old/new rules are non-monotone. Lands before broad public launch (Phase-2).
**Scope (4 parts):**
1. LCB floor 0.95 → 0.90
2. Point-estimate ≥0.95 conjunct
3. AND-joined non-rescuing aggregate-head
4. n_min/INCONCLUSIVE guard
**Done when:** `oq9.ts` enforces the recalibrated rule; honest "code catch-up" banner removed from `OQ9_PASS`; unit tests reflect new rule.

### TD7 — Bootstrap real sops/age encrypted secret + private-key install
**Owner:** Amelia (Developer)
**Why medium:** Carried from Epic 1 TD2. Infrastructure (`.sops.yaml`, runbook, test) is done; the actual encrypted `secrets/dev.sops.yaml` + private-key install is operator-deferred.

### TD8 — Canonical genesis-bootstrap regression test
**Owner:** Amelia (Developer)
**Why medium:** The seq=1 genesis-linkage bug recurred across 2.4 → 2.5. No canonical regression test travels with the editorial package.
**Done when:** `packages/editorial/src/__tests__/genesis-bootstrap.regression.test.ts` asserts seq=1 chains off genesis `curr_hash`, not `GENESIS_PREV_HASH`; test travels with the package.

### TD9 — Error-enum spec/code contract test
**Owner:** Amelia (Developer)
**Why medium:** ADR-named error codes drifted from `EditorialErrorCode` in 2.5. No contract test links them.
**Done when:** Contract test asserts every ADR-named code exists in the implemented union; runs in CI.

---

## PARALLEL (legal/editorial procurement — not developer work)

### Legal/Editorial procurement for 3.1 / 3.2
**Owner:** John (PM) + anti lustay (Project Lead) + editorial owner + cyberlibel-aware counsel
**Why parallel:** Trust-tier "confirmation" criteria (3.1), lawful-access judgement per source + robots.txt/ToS review (3.2), and manual-override policy are legal judgments, not code. The source-ingestion-plan already enumerates blocked sources (Cloudflare WAF on House/Senate/PNA/ABS-CBN).
**Done when:** Trust-tier confirmation rubric documented; lawful-access decision per seed source; manual-override policy logged to AC-11 format.

---

## Process Items (run during prep sprint, not blocking)

- **P1** — Spec-authoring checklist: "one story, one orthogonal axis" (Mary)
- **P2** — Codify Party Mode as default in `docs/dev-workflow.md` (Winston) — carried from Epic 1 P3
- **P3** — "Implicit Prerequisites" section in Epic 3 story files (John) — carried from Epic 1 P2
- **P5** — Resolve Acceptance Auditor reliability (Murat) — before first Epic 3 adversarial review
- **P6** — Tiered-Stryker policy doc `docs/stryker-policy.md` (Murat)
- **P7** — `shellcheck` in CI for `tools/chaos/*.sh` (Murat) — before 2.9b
- **P8** — Status-field hygiene: 2.8/2.10 frontmatter drift; 2.9 filename/content mismatch (Amelia)

---

## Critical Path

1. **Epic 3 planning-review session** — apply spec-authoring checklist (P1) to Epic 3 stories; pre-split orthogonal axes; resolve 3.7-vs-Epic-4 scope
2. **TD1 + TD5** (API bootstrap + editorial-log wiring) — blocking, same work
3. **TD2** (STR-1 consolidation) — blocking
4. **TD3** (new DB tables) — blocking
5. **TD4** (queue-substrate spike) — before 3.6
6. Legal/editorial procurement — parallel, gates 3.1/3.2
7. **P5** (Acceptance Auditor) — before first adversarial review

**Epic 3 feature stories unblocked when:** TD1–TD3 done + planning-review session complete.
