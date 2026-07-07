/**
 * Enqueuer — the durable control-plane (STR-3, TD4b, Epic 3 prep).
 *
 * The Enqueuer is the Redis Streams consumer-group leader: it reads
 * `<stage>.completed` events emitted by workers and enqueues the next BullMQ
 * job for the succeeding stage. NO inline enqueue in stage handlers (STR-3) —
 * that would lose the DAG chain on crash and scatter the orchestration.
 *
 * This spike establishes the consumer-group loop + event-schema parsing + the
 * fail-closed boot. The full DAG definition (stage → next-stage mapping) lands
 * with Story 3.6 (`apps/ingest-worker/src/orchestrator.ts`); here we prove the
 * substrate: the Enqueuer boots, connects to Redis, joins the consumer group,
 * and reads events.
 *
 * **DAG boundary (STR-3):** the Enqueuer does NOT call BullMQ `Queue.add`
 * directly via a hard import — it calls `enqueueIngestJob` from
 * `@iip/ingest-worker/queue` (the sole sanctioned enqueue entrypoint). The
 * Enqueuer + orchestrator are the ONLY callers. This keeps the DAG definition
 * in one place (orchestrator) while the Enqueuer handles the durable delivery.
 *
 * @rules STR-3, PC-2.4, NFR-R-1, NFR-R-3, D7
 * @adr ADR-001
 */
import { bootOrDie } from '@iip/config';
import { STAGE_COMPLETED_SUFFIX } from '@iip/contracts';

const STREAM_NAME = 'iip:events';
const CONSUMER_GROUP = 'enqueuer-group';
const CONSUMER_NAME = `enqueuer-${process.pid}`;

/**
 * The Enqueuer main loop. Connects to Redis, ensures the consumer group exists,
 * and reads stage-completed events in a loop. For each event, it would call
 * `enqueueIngestJob` for the next stage (the DAG mapping lands with Story 3.6).
 *
 * This spike proves the substrate works end-to-end against real Redis. The
 * `enqueueNextStage` callback is the seam Story 3.6 fills with the real DAG.
 */
async function main(): Promise<void> {
  // Preserve the docker-compose healthcheck signal.
  process.stdout.write('alive: enqueuer\n');

  const config = bootOrDie();
  const { Redis } = await import('ioredis');
  const redis = new Redis(config.redisUrl, { maxRetriesPerRequest: null });

  // Ensure the consumer group exists (idempotent — MKGROUP errors if it exists).
  try {
    await redis.xgroup('CREATE', STREAM_NAME, CONSUMER_GROUP, '$', 'MKSTREAM');
  } catch (err: unknown) {
    // BUSYGROUP = group already exists (expected on restart). Anything else is fatal.
    if (!(err instanceof Error && err.message.includes('BUSYGROUP'))) {
      process.stderr.write(
        JSON.stringify({
          level: 60,
          time: Date.now(),
          msg: 'enqueuer: failed to create consumer group',
          error: err instanceof Error ? err.message : String(err),
        }) + '\n',
      );
      process.exit(1);
    }
  }

  process.stderr.write(
    JSON.stringify({
      level: 30,
      time: Date.now(),
      msg: 'enqueuer: consumer group ready',
      stream: STREAM_NAME,
      group: CONSUMER_GROUP,
      consumer: CONSUMER_NAME,
    }) + '\n',
  );

  // Graceful shutdown (NFR-R-1).
  let running = true;
  const shutdown = async (signal: string): Promise<void> => {
    process.stderr.write(
      JSON.stringify({ level: 30, time: Date.now(), msg: 'enqueuer: shutting down', signal }) + '\n',
    );
    running = false;
    await redis.quit();
    process.exit(0);
  };
  process.on('SIGTERM', () => void shutdown('SIGTERM'));
  process.on('SIGINT', () => void shutdown('SIGINT'));

  // Main read loop. XREADGROUP blocks for up to 5s; on timeout, loops.
  while (running) {
    try {
      // '>' = only new messages never delivered to this consumer.
      const replies = await redis.xreadgroup(
        'GROUP', CONSUMER_GROUP, CONSUMER_NAME,
        'COUNT', 10,
        'BLOCK', 5_000,
        'STREAMS', STREAM_NAME, '>',
      );

      if (replies === null) continue; // timeout, no new messages

      // ioredis types xreadgroup's reply as `unknown`; narrow to the expected
      // shape: Array<[streamName, Array<[id, string[]]>]>.
      const reply = replies as [string, [string, string[]][]][];
      for (const [, messages] of reply) {
        for (const [id, fields] of messages) {
          // The event fields are [key, value, key, value, ...] per Redis Streams.
          const event = parseStreamEvent(fields);
          if (event === null) {
            process.stderr.write(
              JSON.stringify({
                level: 40,
                time: Date.now(),
                msg: 'enqueuer: malformed stream event, skipping',
                streamId: id,
              }) + '\n',
            );
            // ACK so we don't re-process the malformed message forever.
            await redis.xack(STREAM_NAME, CONSUMER_GROUP, id);
            continue;
          }

          // The DAG mapping (event.stage → next BullMQ job) lands with Story 3.6.
          // For this spike, log the event + ACK to prove the loop works.
          process.stderr.write(
            JSON.stringify({
              level: 30,
              time: Date.now(),
              msg: 'enqueuer: stage-completed event received',
              streamId: id,
              stage: event.stage,
              jobId: event.jobId,
              next: '[Story 3.6 DAG mapping]',
            }) + '\n',
          );

          // ACK the message (Story 3.6 will call enqueueIngestJob for the next stage here).
          await redis.xack(STREAM_NAME, CONSUMER_GROUP, id);
        }
      }
    } catch (err: unknown) {
      process.stderr.write(
        JSON.stringify({
          level: 50,
          time: Date.now(),
          msg: 'enqueuer: read loop error',
          error: err instanceof Error ? err.message : String(err),
        }) + '\n',
      );
      // Brief backoff before retrying the loop (avoid tight error spin).
      await new Promise((resolve) => setTimeout(resolve, 1_000));
    }
  }

  await redis.quit();
}

/**
 * Parse a Redis Streams event payload into a typed stage-completed event.
 *
 * The stream fields are `[key, value, ...]` pairs. Expected fields:
 *  - `event` — the event name (e.g. `fetch.completed`)
 *  - `stage` — the stage that completed (e.g. `fetch`)
 *  - `jobId` — the BullMQ job id of the completed job
 *  - `payload` — optional JSON string with stage-specific data
 *
 * Returns `null` if the required fields are absent (malformed event).
 */
function parseStreamEvent(fields: string[]): { stage: string; jobId: string; payload?: unknown } | null {
  const map = new Map<string, string>();
  for (let i = 0; i < fields.length; i += 2) {
    map.set(fields[i]!, fields[i + 1]!);
  }
  const event = map.get('event');
  const stage = map.get('stage');
  const jobId = map.get('jobId');
  if (event === undefined || stage === undefined || jobId === undefined) return null;
  if (!event.endsWith(STAGE_COMPLETED_SUFFIX)) return null; // not a stage-completed event
  let payload: unknown;
  const payloadRaw = map.get('payload');
  if (payloadRaw !== undefined) {
    try {
      payload = JSON.parse(payloadRaw);
    } catch {
      // Malformed payload JSON — keep the event but flag it.
      payload = { _raw: payloadRaw, _parseError: true };
    }
  }
  return { stage, jobId, payload };
}

void main();
