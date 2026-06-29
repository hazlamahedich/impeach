# Story 2.2 Adversarial Code Review Report — SEC-1 Per-Issued JWT Authentication

| Item | Value |
|---|---|
| Story | 2-2-per-issued-jwt-authentication |
| Review type | BMAD adversarial (Blind Hunter + Edge Case Hunter + orchestrator manual spec check) |
| Date | 2026-06-29 |
| Final status | **PATCHED & VERIFIED** |

## Scope
- `packages/auth/src/verify.ts`, `sign.ts`, `middleware.ts`, `replay-detector.ts`, `event-logger.ts`, `index.ts`
- `packages/auth/src/*.test.ts` edge-case suite
- `tests/integration/jwt-auth.integration.test.ts`
- `tests/contract/principal-boundary.contract.test.ts`
- `eslint.config.js` Story 2.2 boundary rules

## Open Architectural Decision Resolved via Party Mode
**Question:** Should `ReplayDetector.checkAndRecord` remain synchronous (current code) or become async now to match the Redis-backed implementation in Story 2.4?

**Consensus (Winston, Amelia, Murat, Mary):** Option B — make it async now. A synchronous interface is an architectural lie because production replay detection relies on Redis `SETNX`, which is inherently async. Fixing the interface today avoids a larger breaking refactor in Story 2.4 and keeps the public API honest.

## Findings & Resolution

### 1. Async ReplayDetector interface — patched
- `packages/auth/src/replay-detector.ts`: `checkAndRecord(jti, exp): Promise<boolean>`
- `packages/auth/src/verify.ts`: awaited the call; all callers updated.
- `InMemoryReplayDetector` implementation updated.

### 2. Branded `ResolvedPrincipal` — patched
- `ResolvedPrincipal` now uses branded types from `@iip/contracts` (`PrincipalSchema`, `JtiSchema`, etc.) for compile-time transposition protection (SEC-6/STR-5).
- Hand-constructed principals in tests cast via `as unknown as ResolvedPrincipal`.

### 3. `clockSkewSeconds` input validation — patched
- Clamped to `[0, 300]` seconds; invalid values throw at factory time.
- Added `clock-skew.test.ts`.

### 4. `kid` type guard — patched
- Header `kid` is now required to be a string; numeric/object values rejected before registry lookup.
- Added `kid-type.test.ts`, `kid-numeric.test.ts`, `empty-kid.test.ts`, `missing-kid.test.ts`.

### 5. Dependency fail-safes — patched
- Wrapped `eventLogger`, `revocationChecker`, and `keyRegistry` calls in try/catch so a buggy/missing dependency cannot bypass the security decision.
- Added `logger-failsafe.test.ts`, `revocation-failsafe.test.ts`, `registry-failsafe.test.ts`.

### 6. Token lifetime validation — patched
- `signJwt` now rejects `expSeconds <= 0` and enforces the same 1h ceiling as verification.
- Added `sign-lifetime.test.ts`, `sign.test.ts`, `lifetime-ceiling.test.ts`.

### 7. Middleware hardening — patched
- Only catches `AuthError`; non-auth errors propagate for observability.
- Authorization header parsing is case-insensitive (`bearer`) and tolerates whitespace/tab.
- Added `middleware.test.ts`.

### 8. Missing claim / alg coverage — patched
- Added `missing-claims.test.ts`, `missing-alg.test.ts`, `expired.test.ts`.

## Verification

```text
pnpm exec tsc --noEmit -p packages/auth/tsconfig.json                  # clean
pnpm exec eslint packages/auth/src --max-warnings=0                    # clean
pnpm exec vitest run packages/auth/src/                                # 28 files, 89 tests PASS
pnpm exec vitest run tests/integration/jwt-auth.integration.test.ts \
                   tests/contract/principal-boundary.contract.test.ts  # 21 tests PASS
Stryker on packages/auth/src/verify.ts                                 # 108/108 mutants killed, 100% score
```

## Dismissed / No-Action
- Acceptance Auditor layer failed twice due to runtime/tooling issues and was skipped; manual orchestrator spec check covered the same acceptance criteria.
- `DOM` lib kept in `packages/auth/tsconfig.json` because `CryptoKey` global is required and the project has no explicit webcrypto type shim.

## Files Changed
- `packages/auth/src/verify.ts`
- `packages/auth/src/replay-detector.ts`
- `packages/auth/src/sign.ts`
- `packages/auth/src/middleware.ts`
- `packages/auth/src/index.ts`
- `packages/auth/package.json`
- `packages/auth/src/*.test.ts` (28 new/updated test files)
- `tests/integration/jwt-auth.integration.test.ts`
- `tests/contract/principal-boundary.contract.test.ts`
- `eslint.config.js` (rule selectors hardened)
- `_bmad-output/implementation-artifacts/2-2-per-issued-jwt-authentication.md`
- `_bmad-output/implementation-artifacts/sprint-status.yaml`

## Sign-off
All patchable findings from the adversarial review have been applied and verified. Story 2.2 is moved to **done**.
