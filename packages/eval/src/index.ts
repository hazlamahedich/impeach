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

// Story 2.6b-code — Inter-annotator agreement statistics (κ function — ADR-0025 §3/§4)
export {
  cohenKappa,
  fleissKappa,
  type CohenMatrix,
  type CohenKappaResult,
  type FleissRow,
  type FleissKappaResult,
} from './kappa.js';

// Story 2.6b-code — OQ-9 measurement protocol (pass/fail rule + Decimal CP-LCB — ADR-0025 §4)
export {
  clopperPearsonLcb95,
  evaluateOQ9Grouped,
  OQ9_METRICS,
  TAU_RED,
  TAU_DOC,
  TAU_STRATUM_LCB,
  BOUNDARY_TOLERANCE,
  KAPPA_LICENSE_THRESHOLD,
  KAPPA_GATE_THRESHOLD,
  type OQ9Metric,
  type DocMetricScore,
  type StratumMetricInput,
  type StratumMetricResult,
  type OQ9GroupedInput,
  type OQ9Result,
} from './oq9.js';

export const packageName = '@iip/eval';

export function hello(): string {
  return `alive: ${packageName}`;
}
