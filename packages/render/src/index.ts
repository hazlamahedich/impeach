export { renderGate, renderGateLive } from './gate.js';
export type { GateViolationKind } from './gate.js';
export { StubEntailmentChecker } from './entailment.js';
export const packageName = '@iip/render';

export function hello(): string {
  return `alive: ${packageName}`;
}
