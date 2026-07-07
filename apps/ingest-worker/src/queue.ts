/**
 * BullMQ queue + worker factories for the ingest pipeline (TD4, FR-1.6, PC-2.4).
 *
 * Per STR-1, BullMQ wiring lives in the worker package (the original
 * `packages/queues` was consolidated away). This module is the producer+
 * consumer side; `apps/ingest-worker/src/orchestrator.ts` is the sole Enqueuer
 * caller (STR-3 — no inline enqueue in stage handlers).
 *
 * **Idempotency (PC-2.4, FR-1.6):** `jobId = sha256(dedupe-anchor)`. BullMQ
 * deduplicates by `jobId` — re-enqueuing the same anchor is a no-op, so a
 * crashed-and-retried job resumes rather than duplicates. The `ingestion_jobs`
 * table (TD3) mirrors this with a unique index on `job_id`.
 *
 * **Retry discipline (NFR-R-2):** backoff config comes from `@iip/config`
 * (`getBackoff()`). BullMQ's `attempts` + exponential backoff is stamped at
 * enqueue time so a mid-flight config change doesn't alter a running job's
 * budget. When attempts are exhausted, BullMQ moves the job to the DLQ
 * (`dlq:ingest`) for operator triage (FR-1.7).
 *
 * **STR-3 boundary:** this module exposes `enqueueIngestJob` (the sole sanctioned
 * enqueue entrypoint) and `createIngestWorker` (the consumer). The Enqueuer
 * (`apps/enqueuer`) reads stage-completed events from Redis Streams and calls
 * `enqueueIngestJob` for the next stage — it does NOT call BullMQ `Queue.add`
 * directly (STR-3: event-driven handoff, no inline enqueue).
 *
 * @rules FR-1.6, PC-2.4, STR-1, STR-3, NFR-R-1, NFR-R-2
 * @adr ADR-001
 */
import { Queue, Worker, type Job, type ConnectionOptions } from 'bullmq';
import { createHash } from 'node:crypto';
import {
  INGEST_QUEUE_NAME,
  INGEST_DLQ_NAME,
  IngestJobPayloadSchema,
  type IngestJobPayload,
  type JobId,
} from '@iip/contracts';
import { getBackoff, type BackoffConfig } from '@iip/config';

/**
 * Compute the idempotent BullMQ jobId from a dedupe anchor (PC-2.4, FR-1.6).
 *
 * `jobId = sha256(dedupe-anchor)` — 64-char lowercase hex. Two jobs with the
 * same anchor produce the same jobId, so BullMQ treats the second as a
 * duplicate and the work runs exactly once.
 */
export function computeJobId(dedupeAnchor: string): JobId {
  return createHash('sha256').update(dedupeAnchor).digest('hex') as JobId;
}

/**
 * Build a BullMQ ConnectionOptions from a Redis URL. BullMQ requires the
 * `maxRetriesPerRequest: null` setting (it uses long-polling internally).
 */
export function connectionFromUrl(redisUrl: string): ConnectionOptions {
  const url = new URL(redisUrl);
  return {
    host: url.hostname,
    port: Number(url.port || 6379),
    password: url.password || undefined,
    username: url.username || undefined,
    maxRetriesPerRequest: null, // BullMQ requirement
  };
}

/**
 * Create the ingest queue (the producer side). The sole caller is
 * `apps/ingest-worker/src/orchestrator.ts` (STR-3) + the Enqueuer.
 */
export function createIngestQueue(redisUrl: string): Queue<IngestJobPayload> {
  return new Queue<IngestJobPayload>(INGEST_QUEUE_NAME, {
    connection: connectionFromUrl(redisUrl),
    defaultJobOptions: {
      // DLQ routing: BullMQ moves exhausted jobs to the DLQ automatically.
      removeOnComplete: { count: 100, age: 3600 },
      removeOnFail: { count: 500, age: 86400 },
      attempts: getBackoff().maxAttempts,
      backoff: {
        type: 'exponential',
        delay: getBackoff().baseDelayMs,
      },
    },
  });
}

/**
 * Enqueue an ingest job with idempotent `jobId` (PC-2.4, FR-1.6).
 *
 * This is the SOLE sanctioned enqueue entrypoint (STR-3). Re-enqueuing the
 * same dedupe anchor is a no-op (BullMQ deduplicates by jobId).
 *
 * @returns the BullMQ Job, or `null` if the job already existed (idempotent
 *          dedupe — the caller treats null as "already enqueued, nothing to do").
 */
export async function enqueueIngestJob(
  queue: Queue<IngestJobPayload>,
  payload: IngestJobPayload,
): Promise<Job<IngestJobPayload> | null> {
  // Validate the payload against the contract schema (Winston #8 — untrusted
  // boundary, even though the caller is internal; a malformed payload would
  // corrupt the DAG).
  const parsed = IngestJobPayloadSchema.parse(payload);
  const jobId = parsed.jobId;
  // BullMQ's `add` with an explicit `jobId` deduplicates: if a job with that
  // jobId already exists (active/waiting/completed within retention), it returns
  // the existing job rather than creating a duplicate.
  return queue.add('ingest', parsed, { jobId });
}

/**
 * Job handler signature — the worker-side processing function.
 *
 * The handler receives the validated payload + the BullMQ Job (for progress
 * reporting + checkpoint updates). It MUST be idempotent (NFR-R-3 resume-after-
 * crash re-runs the handler from the last checkpoint).
 */
export type IngestJobHandler = (
  payload: IngestJobPayload,
  job: Job<IngestJobPayload>,
) => Promise<void>;

/**
 * Create the ingest worker (the consumer side). Runs `handler` for each job,
 * with the backoff config from `@iip/config`.
 *
 * On exhaustion (attempts exhausted), BullMQ moves the job to the DLQ
 * (`dlq:ingest`) automatically — the `failed` event here is for logging/triage,
 * not re-enqueue (re-enqueue is the operator's call via the triage surface).
 */
export function createIngestWorker(
  redisUrl: string,
  handler: IngestJobHandler,
  opts?: { concurrency?: number; backoff?: BackoffConfig },
): Worker<IngestJobPayload> {
  const backoff = opts?.backoff ?? getBackoff();
  const worker = new Worker<IngestJobPayload>(
    INGEST_QUEUE_NAME,
    async (job: Job<IngestJobPayload>) => {
      // Validate before processing (STR-2 — consumer MUST parse the message
      // before handler logic; a poisoned message drifts the consumer's model).
      const payload = IngestJobPayloadSchema.parse(job.data);
      await handler(payload, job);
    },
    {
      connection: connectionFromUrl(redisUrl),
      concurrency: opts?.concurrency ?? 4,
    },
  );

  // DLQ + triage logging. BullMQ's built-in DLQ routing is configured via
  // defaultJobOptions.attempts + the failed-event; the worker just reports.
  worker.on('failed', (job, err) => {
    // When attempts are exhausted, BullMQ emits 'failed' with job.attemptsMade
    // >= job.opts.attempts. The job is then available in the failed set; the
    // operator triage surface (FR-1.7) surfaces it.
    const attemptsLeft = backoff.maxAttempts - (job?.attemptsMade ?? 0);
    process.stderr.write(
      JSON.stringify({
        level: attemptsLeft > 0 ? 40 : 50, // warn if retries remain, error if DLQ-bound
        time: Date.now(),
        msg: 'ingest job failed',
        jobId: job?.id,
        attemptsMade: job?.attemptsMade,
        attemptsLeft,
        dlq: INGEST_DLQ_NAME,
        error: err.message,
      }) + '\n',
    );
  });

  return worker;
}

/**
 * Compute the dedupe anchor for a fetch-stage job (FR-1.3, PC-1a).
 *
 * The anchor is the content checksum + source id + stage — two jobs with the
 * same content from the same source at the same stage produce the same anchor
 * and thus the same jobId, ensuring the work runs once.
 */
export function fetchDedupeAnchor(contentChecksum: string, sourceId: string): string {
  return `fetch:${contentChecksum}:${sourceId}`;
}

export { INGEST_QUEUE_NAME, INGEST_DLQ_NAME };
