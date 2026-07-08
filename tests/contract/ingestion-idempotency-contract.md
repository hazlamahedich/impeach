# Ingestion Idempotency Contract (TD4 RED contract, Story 3.6 target)

**Status:** RED (specification — the integration test lands with Story 3.6)
**Rules:** FR-1.6, PC-2.4, STR-3, NFR-R-1, NFR-R-3
**ADR:** ADR-001

> **DO NOT COPY VERBATIM.** This is a specification document (per
> `docs/atdd-specification-guideline.md`, Story 1 retro P1/TD6). The dev authors
> the runnable RED test from this spec, adapting to the real Testcontainers
> harness. Copying verbatim produces a test that looks green but doesn't exercise
> the intended scenario (the Story 1.9 lesson).

## The invariant

An ingestion job MUST be idempotent under crash-retry: re-enqueuing the same
dedupe anchor after a crash resumes the work (from the last checkpoint), it
does NOT duplicate side-effects. The `jobId = sha256(dedupe-anchor)` is the
idempotency key (PC-2.4, FR-1.6).

## Test cases (Story 3.6 implements these against real Redis via Testcontainers)

### IC-1: Re-enqueue the same anchor → no duplicate job

**Setup:** Enqueue a job with anchor `fetch:checksum-A:src-1`. The job
completes. Enqueue the SAME anchor again.

**Assert:** The second enqueue returns `null` (BullMQ deduplicated). Only ONE
job ran. No duplicate side-effects (e.g. one document row, not two).

### IC-2: Crash mid-job → resume from checkpoint → idempotent

**Setup:** Enqueue a job. The worker starts processing, writes a checkpoint
(`state_run_id` in `ingestion_jobs`), then CRASHES (simulate via worker.close()
mid-handler). Re-enqueue the same anchor (or let BullMQ retry).

**Assert:** The job resumes from the checkpoint (the handler sees the
checkpoint state and skips already-completed sub-steps). No duplicate writes
(e.g. one raw snapshot, not two; one document row, not two). The job reaches
`completed` state.

### IC-3: Exhausted retries → DLQ routing → operator triage

**Setup:** Enqueue a job that always fails (handler throws). Let BullMQ
exhaust `maxAttempts` (from `getBackoff()`).

**Assert:** The job appears in the `dlq:ingest` failed set. The `failed` event
fires with `attemptsMade >= maxAttempts`. The `ingestion_jobs.state` row
transitions to `dead_lettered` (FR-1.7).

### IC-4: Dedupe anchor distinguishes provenance chains

**Setup:** Enqueue two jobs: anchor `fetch:checksum-A:src-1` and
`fetch:checksum-A:src-2` (same content, different source).

**Assert:** Both jobs run (NOT deduped) — the same content from different
sources is two independent provenance chains. Two separate `documents` rows
(with different `source_id`).

### IC-5: Stage-completed event → Enqueuer enqueues next stage

**Setup:** A worker completes the `fetch` stage and emits `fetch.completed` to
the Redis Stream. The Enqueuer reads it.

**Assert:** The Enqueuer enqueues the next stage's BullMQ job (e.g. `extract`)
via `enqueueIngestJob`. The Enqueuer ACKs the stream event. No inline enqueue
in the fetch handler (STR-3 — verified by asserting the handler does not call
the queue directly).

## Harness notes

- Use Testcontainers Redis (`redis:7-alpine`) — same image as docker-compose.
- The full DAG mapping (`fetch → extract → index`) lands with Story 3.6
  (`apps/ingest-worker/src/orchestrator.ts`). This contract specifies the
  idempotency invariant the DAG must satisfy.
- BullMQ's Testcontainers integration: the worker + queue share the same
  Redis URL. Use a random consumer-group name per test to isolate.
