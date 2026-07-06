/**
 * @iip/test-utils barrel — test factories for the IIP monorepo.
 *
 * @rules SEC-2, PC-2.6, PC-9
 */
export {
  createKeyPair,
  createSignature,
  createContentHash,
  createPrincipal,
  createDocument,
  asPrincipalSub,
} from './factories/intake.js';
export type {
  TestKeyPair,
  TestPrincipal,
  TestIntakeDocument,
} from './factories/intake.js';

// Story 2.10 — config_history test factory (PC-2.6, PC-9)
export {
  asConfigKey,
  asConfigHistoryId,
  asConfigHistoryRetentionClass,
  asPrincipal,
  makeConfigHistoryEntry,
} from './factories/config-history.js';
export type { ConfigHistoryEntry } from '@iip/config';
