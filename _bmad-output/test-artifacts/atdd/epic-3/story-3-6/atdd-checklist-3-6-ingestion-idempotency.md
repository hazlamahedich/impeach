---
stepsCompleted: ['step-01-preflight-and-context','step-02-generation-mode','step-03-test-strategy','step-04-generate-tests','step-04c-aggregate']
lastStep: 'step-04c-aggregate'
lastSaved: '2026-07-08'
workflowType: 'testarch-atdd'
storyId: '3.6'
storyKey: '3-6-ingestion-idempotency'
storyFile: '_bmad-output/planning-artifacts/epics.md (Epic 3, Story 3.6, lines 816-832)'
atddChecklistPath: '_bmad-output/test-artifacts/atdd/epic-3/story-3-6/atdd-checklist-3-6-ingestion-idempotency.md'
generatedTestFiles:
  - 'tests/integration/ingestion-idempotency.integration.test.ts'
inputDocuments:
  - '_bmad-output/planning-artifacts/epics.md'
  - '_bmad-output/project-context.md'
  - 'tests/contract/ingestion-idempotency-contract.md'
  - 'apps/ingest-worker/src/queue.ts'
  - 'apps/enqueuer/src/index.ts'
  - 'packages/config/src/queues.ts'
  - 'packages/db/src/schema/ingestion-jobs.ts'
  - 'tests/support/helpers/ingest.ts'
activationState: 'RED'
activatesIn: 'Story 3.6 implementation (orchestrator.ts + LangGraph graphs DAG + checkpoint slice)'
---

# ATDD Checklist — Epic 3, Story 3.6: Idempotent, Observable, Resilient Ingestion

**Date:** 2026-07-08 · **Primary Test Level:** integration (real Redis via Testcontainers) · **Severity:** **T1 — ingestion pipeline spine**

> RED-phase scaffold. This is the RUNNABLE counterpart to `tests/contract/ingestion-idempotency-contract.md` (TD4 prep-sprint RED spec). The `orchestrator.ts` + `graphs/` DAG do not exist yet (deferred per prep sprint). Tests quarantined via `describe.skip`. The markdown spec is the source of truth — this file ADAPTS it to the real harness (do NOT copy the spec verbatim, per `docs/atdd-specification-guideline.md`).

## Story Summary
As an Intake Operator, I want ingestion jobs that are idempotent, observable, and resilient, so that re-running is safe, status is visible, and failures are retried automatically.

## Acceptance Criteria
1. Jobs are idempotent (re-running safe — content_checksum dedup)
2. Jobs are observable (status, throughput visible on dashboard)
3. Per-job retry with capped exponential backoff (NFR-R-2)
4. Dead-letter queue with typed errors (dlq:ingest)
5. One queue per stage (ingest:queue), jobId = sha256(dedupe-anchor), backoff in config (PC-1d, PC-2.4)
6. Event-driven Enqueuer handoff: stages emit stage.completed → Enqueuer enqueues next (STR-3)
7. LangGraph state checkpointed per node for resume-after-crash (NFR-R-3)

## Red-Phase Scaffolds
**File:** `tests/integration/ingestion-idempotency.integration.test.ts` (5 tests, all RED/skipped)

- ⏭️ **[P0] IC-1:** re-enqueueing the same dedupe anchor produces ONE job (idempotent) — RED
- ⏭️ **[P0] IC-2:** a job interrupted mid-stage resumes from its checkpointed state — RED
- ⏭️ **[P0] IC-3:** a job that exhausts max_attempts is moved to dlq:ingest — RED
- ⏭️ **[P1] IC-4:** identical content from two sources produces distinct jobs (provenance distinction) — RED
- ⏭️ **[P0] IC-5:** a stage.completed event triggers the Enqueuer to enqueue the next stage — RED

## Acceptance Criteria Coverage
| AC | Test(s) | Status |
|----|---------|--------|
| idempotent re-run (content_checksum dedup) | IC-1, IC-4 | RED |
| observable (status) | IC-1 (getActive), IC-3 (terminalState) | RED |
| retry w/ capped backoff (NFR-R-2) | IC-3 (max_attempts) | RED |
| DLQ w/ typed errors (dlq:ingest) | IC-3 | RED |
| jobId = sha256(dedupe-anchor) (PC-2.4) | IC-1, IC-4 | RED |
| Enqueuer handoff (STR-3) | IC-5 | RED |
| LangGraph checkpoint (NFR-R-3) | IC-2 | RED |

## Implementation Checklist
- [ ] Create `apps/ingest-worker/src/orchestrator.ts` — the DAG definition + sole `enqueueIngestJob` caller (STR-3)
- [ ] Create `apps/ingest-worker/src/graphs/` — LangGraph.js DAG (fetch → clean → snapshot → index nodes)
- [ ] Wire LangGraph per-node state checkpointing to `job_runs.state_run_id` (NFR-R-3) — `@langchain/langgraph` is at 1.4.7 (stable 1.x)
- [ ] Implement `enqueueIngest(redis, payload)`, `getQueue(redis)`, `seedCheckpoint`, `resumeJob`, `seedFailingJob`, `processUntilTerminal`, `emitStageCompleted`, `drainEnqueuerOnce`
- [ ] Wire the Enqueuer DAG mapping (event.stage → next BullMQ job) — currently a stub that logs+ACKs (apps/enqueuer/src/index.ts)
- [ ] Create `tests/support/helpers/test-redis.ts` — Testcontainers Redis harness (shared)
- [ ] Remove `describe.skip` + convert dynamic imports to direct imports
- [ ] Run `pnpm vitest --project integration -- ingestion-idempotency` → all 5 GREEN

## Implementation Guidance
**Module path:** `apps/ingest-worker/src/orchestrator.ts` (sole Enqueuer caller per STR-3)

**DAG nodes:** `fetch → clean → snapshot → index`. Each node emits `<node>.completed` to Redis Streams; the Enqueuer consumes and enqueues the next.

**LangGraph checkpointing (NFR-R-3):** `@langchain/langgraph` 1.4.7 — use `BaseCheckpointSaver` backed by Redis (or PG `job_runs.state_run_id`). On crash-recovery, `resumeJob` reads the checkpoint, replays completed nodes, and picks up at the next pending node.

**Idempotency (IC-1/IC-4):** `jobId = sha256(dedupeAnchor)` where `dedupeAnchor = ${sourceId}|${contentChecksum}`. Same anchor → same jobId → BullMQ dedupes. Different sourceId → different anchor → distinct job (even for identical content).

**Testcontainers harness:** `tests/support/helpers/test-redis.ts` — start a Redis container, return `{client, teardown}`.

**Estimated Effort:** Large (the single biggest technical unknown in Epic 3 per the prep sprint; the LangGraph checkpoint slice is the heaviest piece).

## Notes
- The BullMQ substrate (`queue.ts` factories, `computeJobId`, `fetchDedupeAnchor`, 7 unit tests), backoff config (`queues.ts`), Enqueuer boot (`xgroup`/`xreadgroup`), and `ingestion_jobs` schema are all GREEN from TD4. This story builds the DAG + checkpointing on top.
- `@langchain/langgraph` is now 1.4.7 (stable 1.x) — the project-context pre-1.0 instability warning is resolved. The checkpoint DAG is genuinely this story's deliverable (the prep sprint deliberately deferred it to avoid build-then-rework churn).
- IC-2 (crash-resume) is the defamation-adjacent test: a job that crashes mid-ingestion must not re-process already-completed nodes (which could create duplicate snapshots/provenance) and must not skip pending nodes (which could orphan the document).
- The RED markdown spec (`ingestion-idempotency-contract.md`) remains as the specification document; this runnable test adapts it.

**Generated by BMad TEA Agent** — 2026-07-08
