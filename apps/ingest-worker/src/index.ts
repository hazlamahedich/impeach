/**
 * @iip/ingest-worker — extraction worker (write-path, sole AGE writer).
 *
 * @rules STR-2, SEC-2
 * @adr ADR-0001
 */
export { processIntakeDocument } from './worker.js';
export type { WorkerPrincipal } from './worker.js';

// Story 3.3 — fetch pipeline (FR-1.3)
export {
  runFetchPipeline,
  CrawlingDisabledError,
  type FetchPipelineResult,
} from './fetch-pipeline.js';

export const packageName = '@iip/ingest-worker';

function main(): void {
  process.stderr.write(
    JSON.stringify({ level: 30, time: Date.now(), msg: `alive: ${packageName}` }) + '\n',
  );
}

// Boot guard: only run main when executed directly (not on import).
if (import.meta.url === `file://${process.argv[1]}`) {
  main();
}

export {};
