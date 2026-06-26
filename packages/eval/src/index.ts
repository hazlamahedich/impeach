export { runPythonEval } from './bridge.js';
export {
  EVAL_BRIDGE_TIMEOUT_MS,
  EVAL_BRIDGE_GRACE_MS,
} from './bridge.js';
export type { EvalBridgeError } from './bridge.js';

// Story 1.11 — Corpus freeze + gate decision/reproduce primitives (SC-7, AC-F1-10)
export {
  freezeCorpus,
  MANIFEST_SCHEMA_VERSION,
  DEFAULT_CORPUS_DIR,
  DEFAULT_OUT_DIR,
  type CorpusManifest,
  type CorpusFile,
  type CorpusFreezeResult,
} from './freeze.js';
export {
  recordGateDecision,
  reproduceRun,
  DECISION_SCHEMA_VERSION,
  DEFAULT_GATES_DIR,
  type GateDecision,
  type GateDecisionInput,
  type RecordResult,
  type ReproduceError,
  type Decision,
} from './reproduce.js';

export const packageName = '@iip/eval';

export function hello(): string {
  return `alive: ${packageName}`;
}
