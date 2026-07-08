/**
 * Story 3.6 — Idempotent / observable / resilient ingestion integration test.
 *
 * This is the RUNNABLE counterpart to the RED markdown contract
 * `tests/contract/ingestion-idempotency-contract.md` (TD4 prep-sprint output).
 * It exercises the BullMQ substrate + Enqueuer handoff + LangGraph checkpointing
 * against REAL Redis via Testcontainers. The markdown spec is the source of
 * truth for the scenarios (IC-1…IC-5); this file adapts them to the real harness
 * per the atdd-specification-guideline (do NOT copy the spec verbatim).
 *
 * The orchestrator.ts + graphs/ DAG do NOT exist yet (deferred per the prep
 * sprint). This suite is RED by design (describe.skip) until Story 3.6 ships
 * `apps/ingest-worker/src/orchestrator.ts` + the LangGraph checkpoint slice.
 *
 * @rules FR-1.6, STR-3, NFR-R-1, NFR-R-2, NFR-R-3, PC-2.4
 * @adr ADR-001
 *
 * GIVEN ingestion jobs are running
 * WHEN a job is processed
 * THEN jobs are idempotent (re-running is safe via content_checksum dedup)
 *   AND jobs are observable (status + throughput visible)
 *   AND per-job retry with capped exponential backoff is active (NFR-R-2)
 *   AND a dead-letter queue with typed errors exists (dlq:ingest)
 *   AND jobId = sha256(dedupe-anchor) (PC-2.4)
 *   AND event-driven Enqueuer handoff: stages emit stage.completed → next (STR-3)
 *   AND LangGraph state checkpointed per node for resume-after-crash (NFR-R-3)
 */

import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { INGEST_QUEUE_NAME, INGEST_DLQ_NAME } from '@iip/contracts';
import { makeValidJobId, makeValidSourceId } from '../support/helpers/ingest';

// ─── RED-PHASE STUB ────────────────────────────────────────────────────────
// Story 3.6 has not shipped orchestrator.ts yet. Dynamic import lets the suite
// COLLECT. Once the module lands, remove `describe.skip`.
async function loadOrchestrator() {
  // Variable specifier so Vite cannot statically resolve a subpath absent from
  // the package `exports` map (Story 3.6 module not shipped yet). The catch
  // keeps the suite GREEN at collection; describe.skip quarantines the body.
  const specifier = '@iip/ingest-worker/orchestrator';
  return import(specifier).catch(() => null);
}

// The Testcontainers Redis harness is shared with the existing integration suite.
async function loadTestRedis() {
  // Variable specifier so Vite cannot statically resolve a not-yet-existing
  // helper (the Testcontainers harness is authored at green phase). The catch
  // keeps the suite GREEN at collection; describe.skip quarantines the body.
  const specifier = '../support/helpers/test-redis';
  return import(specifier).catch(() => null);
}

describe.skip('Story 3.6 — Idempotent ingestion integration (ATDD RED)', () => {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  let redis: any;
  let teardown: (() => Promise<void>) | undefined;

  beforeAll(async () => {
    const harness = await loadTestRedis();
    const started = harness ? await harness.startTestRedis() : null;
    redis = started?.client;
    teardown = started?.teardown;
  });

  afterAll(async () => {
    await teardown?.();
  });

  // ─────────────────────────────────────────────────────────────────────────
  // IC-1: Re-enqueue the same anchor → no duplicate job (FR-1.6, PC-2.4)
  // ─────────────────────────────────────────────────────────────────────────

  it('[P0] IC-1: re-enqueueing the same dedupe anchor produces ONE job (idempotent)', async () => {
    const orch = await loadOrchestrator();
    const dedupeAnchor = `${makeValidSourceId()}|${'checksum-ic-1'}`;
    const expectedJobId = makeValidJobId(dedupeAnchor);
    // When: the same anchor is enqueued twice.
    const first = orch ? await orch.enqueueIngest(redis, { sourceId: makeValidSourceId(), dedupeAnchor, stage: 'fetch' }) : undefined;
    const second = orch ? await orch.enqueueIngest(redis, { sourceId: makeValidSourceId(), dedupeAnchor, stage: 'fetch' }) : undefined;
    // Then: both return the SAME jobId (sha256(dedupeAnchor)) and only one job exists.
    expect(first?.jobId).toBe(expectedJobId);
    expect(second?.jobId).toBe(expectedJobId);
    const queue = orch ? await orch.getQueue(redis) : undefined;
    const active = queue ? await queue.getActive() : [];
    expect(active).toHaveLength(1);
  });

  // ─────────────────────────────────────────────────────────────────────────
  // IC-2: Crash mid-job → resume from LangGraph checkpoint (NFR-R-3)
  // ─────────────────────────────────────────────────────────────────────────

  it('[P0] IC-2: a job interrupted mid-stage resumes from its checkpointed state', async () => {
    const orch = await loadOrchestrator();
    const dedupeAnchor = `${makeValidSourceId()}|checksum-ic-2`;
    const jobId = makeValidJobId(dedupeAnchor);
    // Given: a job that has checkpointed state after the "fetch" node.
    await orch?.seedCheckpoint(redis, jobId, { completedNodes: ['fetch'], pendingNodes: ['clean', 'snapshot', 'index'] });
    // When: the worker resumes the job (simulating crash-recovery).
    const resumed = orch ? await orch.resumeJob(redis, jobId) : undefined;
    // Then: it does NOT re-run "fetch" (already checkpointed) — it picks up at "clean".
    expect(resumed?.replayedNodes).toEqual(['fetch']);
    expect(resumed?.nextNode).toBe('clean');
  });

  // ─────────────────────────────────────────────────────────────────────────
  // IC-3: Exhausted retries → routed to dlq:ingest with typed error (NFR-R-2)
  // ─────────────────────────────────────────────────────────────────────────

  it('[P0] IC-3: a job that exhausts max_attempts is moved to dlq:ingest', async () => {
    const orch = await loadOrchestrator();
    const dedupeAnchor = `${makeValidSourceId()}|checksum-ic-3`;
    const jobId = makeValidJobId(dedupeAnchor);
    // Given: a job that always fails at the "clean" node.
    await orch?.seedFailingJob(redis, jobId, { failingNode: 'clean', errorType: 'clean.pdf_ocr_failed' });
    // When: the job is processed past max_attempts.
    const outcome = orch ? await orch.processUntilTerminal(redis, jobId) : undefined;
    // Then: it lands in the DLQ with the typed error category.
    expect(outcome?.terminalState).toBe('dead_lettered');
    expect(outcome?.dlqName).toBe(INGEST_DLQ_NAME);
    expect(outcome?.lastError?.type).toBe('clean.pdf_ocr_failed');
  });

  // ─────────────────────────────────────────────────────────────────────────
  // IC-4: Provenance-chain distinction (identical content, different source)
  // ─────────────────────────────────────────────────────────────────────────

  it('[P1] IC-4: identical content from two sources produces distinct jobs (provenance distinction)', async () => {
    const orch = await loadOrchestrator();
    const checksum = 'checksum-shared-content';
    // Given: two DIFFERENT sources serving the SAME content checksum.
    const anchorA = `${makeValidSourceId()}|${checksum}`;
    const anchorB = `${makeValidSourceId()}|${checksum}`;
    // When: both are enqueued.
    const jobA = orch ? await orch.enqueueIngest(redis, { sourceId: makeValidSourceId(), dedupeAnchor: anchorA, stage: 'fetch' }) : undefined;
    const jobB = orch ? await orch.enqueueIngest(redis, { sourceId: makeValidSourceId(), dedupeAnchor: anchorB, stage: 'fetch' }) : undefined;
    // Then: the jobIds are DISTINCT (dedupe anchor includes sourceId).
    expect(jobA?.jobId).not.toBe(jobB?.jobId);
  });

  // ─────────────────────────────────────────────────────────────────────────
  // IC-5: Event-driven Enqueuer handoff (STR-3 — stage.completed → next)
  // ─────────────────────────────────────────────────────────────────────────

  it('[P0] IC-5: a stage.completed event triggers the Enqueuer to enqueue the next stage', async () => {
    const orch = await loadOrchestrator();
    const sourceId = makeValidSourceId();
    // Given: the "fetch" stage completed and emitted a stream event.
    await orch?.emitStageCompleted(redis, { sourceId, stage: 'fetch', documentChecksum: 'checksum-ic-5' });
    // When: the Enqueuer consumes the event (with a small poll window).
    await orch?.drainEnqueuerOnce(redis);
    // Then: the NEXT stage ("clean") was enqueued on ingest:queue.
    const queue = orch ? await orch.getQueue(redis) : undefined;
    const jobs = queue ? await queue.getWaiting() : [];
    const nextJob = jobs.find((j: { name: string }) => j.name.startsWith('clean'));
    expect(nextJob).toBeDefined();
    expect(queue?.name).toBe(INGEST_QUEUE_NAME);
  });
});
