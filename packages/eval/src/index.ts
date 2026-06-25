export { runPythonEval } from './bridge.js';
export {
  EVAL_BRIDGE_TIMEOUT_MS,
  EVAL_BRIDGE_GRACE_MS,
} from './bridge.js';
export type { EvalBridgeError } from './bridge.js';

export const packageName = '@iip/eval';

export function hello(): string {
  return `alive: ${packageName}`;
}
