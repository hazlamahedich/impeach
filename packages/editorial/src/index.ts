/**
 * @iip/editorial barrel — hash-chained editorial log (SEC-6, AC-11).
 *
 * @rules SEC-6, AC-11
 * @term T-006
 */
export const packageName = '@iip/editorial';

export { createEditorialLogRepo, asExecutor } from './editorial-log-repo.js';
export type {
  EditorialLogRepo,
  EditorialRepoConfig,
  QueryExecutor,
  OperatorKeyLookup,
  OperatorPublicKeyEntry,
  AppendParams,
} from './types.js';
export { EditorialAuthEventLogger } from './auth-event-logger-adapter.js';
export type { AppendDelegate } from './auth-event-logger-adapter.js';
