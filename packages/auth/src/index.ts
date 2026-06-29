/**
 * @iip/auth — Per-issued JWT authentication (SEC-1).
 *
 * Token issuance, verification, replay detection, revocation, and
 * Fastify middleware for the SEC-1 attribution boundary.
 *
 * @rules SEC-1
 * @adr ADR-0001
 */

// Verification
export {
  createVerifyJwt,
  requireScope,
  PrincipalSchema,
  AuthError,
} from './verify.js';
export type {
  ResolvedPrincipal,
  VerifyJwtConfig,
  KeyEntry,
  KeyRegistry,
  RevocationChecker,
  AuthErrorCode,
  PrincipalSchemaType,
} from './verify.js';

// Token issuance
export { signJwt } from './sign.js';
export type { SignKeyEntry, SignOptions } from './sign.js';

// Replay detection
export { InMemoryReplayDetector } from './replay-detector.js';
export type { ReplayDetector } from './replay-detector.js';

// Event logging
export { NoopAuthEventLogger } from './event-logger.js';
export type { AuthEventLogger } from './event-logger.js';

// Fastify middleware
export { createVerifyMiddleware } from './middleware.js';
export { createVerifyMiddleware as verifyMiddleware } from './middleware.js';
export type { MiddlewareConfig } from './middleware.js';
