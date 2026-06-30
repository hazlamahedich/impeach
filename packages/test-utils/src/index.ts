/**
 * @iip/test-utils barrel — test factories for the IIP monorepo.
 *
 * @rules SEC-2
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
