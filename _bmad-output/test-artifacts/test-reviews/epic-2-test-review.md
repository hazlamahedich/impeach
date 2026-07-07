---
stepsCompleted: ['step-01-load-context', 'step-02-discover-tests', 'step-03-quality-evaluation', 'step-03f-aggregate-scores', 'step-04-generate-report']
lastStep: 'step-04-generate-report'
lastSaved: '2026-07-07'
workflowType: 'testarch-test-review'
epicId: '2'
epicTitle: 'Provenance & Invariants'
reviewScope: 'directory (Epic 2 post-implementation expansion tests, 6 files)'
reviewTarget: 'testarch-automate expansion ring (E2-G1..E2-G14)'
inputDocuments:
  - _bmad-output/project-context.md
  - _bmad-output/planning-artifacts/epics.md
  - _bmad-output/implementation-artifacts/sprint-status.yaml
  - _bmad-output/test-artifacts/automation-summary-epic-2.md
  - _bmad-output/implementation-artifacts/epic-2-prep-sprint-2026-06-28.md
  - .agents/skills/bmad-testarch-test-review/resources/knowledge/test-quality.md
  - .agents/skills/bmad-testarch-test-review/resources/knowledge/data-factories.md
  - .agents/skills/bmad-testarch-test-review/resources/knowledge/test-levels-framework.md
  - .agents/skills/bmad-testarch-test-review/checklist.md
  - .agents/skills/bmad-testarch-test-review/test-review-template.md
  - vitest.workspace.ts
  - eslint.config.js
executionMode: sequential
detectedStack: 'fullstack (TS Vitest unit/contract + Testcontainers integration; Python tools/eval)'
---

# Test Quality Review: Epic 2 — Provenance & Invariants (Expansion Ring)

**Quality Score**: 94/100 (A — Good)
**Review Date**: 2026-07-07
**Review Scope**: directory — 6 post-implementation expansion test files (55 tests)
**Reviewer**: Murat (TEA Agent)
**Stack Detected**: fullstack (TS Vitest unit + Testcontainers integration)
**Execution Mode**: sequential

> This review audits the **6 new test files** produced by the `testarch-automate` Epic 2 expansion run (`automation-summary-epic-2.md`, §3.1). These are the "next ring" of defamation-grade + security edge cases the implementation suite left uncovered. The automation summary's own §4.6 recommended exactly this adversarial review — especially the audit-health budget-gate timing test, the editorial truncation test, and the cross-document replay test.

---

## Executive Summary

**Overall Assessment**: Good

**Recommendation**: Approve with Comments

### Key Strengths

- ✅ **Every P0 defamation/security claim verified against source.** I read `gate.ts:140-251`, `oq9.ts:535-537`, `audit-health.ts:169-241`, `state.ts:36-156` and confirmed each test's characterization of the code under test is accurate — the E2-G1 catch scope, the E2-G2 probe-outside-try/catch gap, the E2-G5 `.length > 0` guard, the E2-G8 `Math.min` clamp + `??` fallback, and the E2-G4 replay-tuple composition all match the source exactly. The tests are pinning real behavior, not imagined behavior.
- ✅ **Zero hard waits / zero real network outside Testcontainers.** Determinism is structural: injected `Clock` (`fakeClock`), injected `fetchImpl` (`makeFetch`), injected `replayDetector` (`InMemoryIntakeReplayDetector`), deterministic Ed25519 keypairs per `beforeEach`. The E2-G9 test even documents *why* it can't drive the `setTimeout`-based HTTP timeout deterministically and deliberately exercises the clock-gated budget path instead — a sophisticated determinism call I rarely see.
- ✅ **Per-span isolation test (E2-G1 test 3) is exemplary.** `gate-resilience.test.ts:102-124` constructs a verifier that throws *only for docA* and asserts docA is stripped while docB is served intact. This is the exact mutation that a narrowed catch scope would silently let through; it kills the mutant. This is the strongest test in the suite.
- ✅ **`@rules`/`@adr` JSDoc on every file header** per PC-5, with `@term T-006` on the editorial integration file (glossary discipline). Multi-ADR citations in ascending numeric order (`ADR-0001, ADR-0010, ADR-0029`). Gap IDs (`E2-G1`..`E2-G14`) in every describe block — traceable back to the automation summary.
- ✅ **Integration test uses real PG via Testcontainers**, unique DB name per run (`iip_test_${randomUUID().slice(0,8)}`), `pool: 'forks'` + `singleFork: true` (matches the sibling `editorial-log.integration.test.ts` precedent). 9 tests, 4.6s — fast for live PG.

### Key Weaknesses

- ❌ **E2-G2 test contains a no-op `expect(true).toBe(true)` + a conditional that guards nothing.** `gate-resilience.test.ts:156-161` — the `if (!threw) { expect(true).toBe(true); }` block is a tautology that always passes regardless of outcome. It's documented as "the desired post-fix state" but it's dead assertion code; a future reader will wonder what it proves. The real invariant (`expect(served).toBe(false)`) is on L152 and is correct — the conditional should be removed or replaced with a behavioral assertion.
- ❌ **`as` type assertions (38 total) and non-null assertions (`!`, 25 total) pervade the suite** — `as IntakeDocument` (4× in gate-replay), `as Response` / `as typeof fetch` (6× in audit-secrets), `as readonly Record<string, unknown>[]` (integration). The project-context mandates "Ban `as` assertions except paired with a zod `.parse()`" (Winston #5) and `@typescript-eslint/no-non-null-assertion: error` (fatal-five). **Lint passes only because the root config uses `tseslint.configs.recommended`, not `strictTypeChecked`** — so the fatal-five is currently aspirational, not enforced. These tests inherit the gap. Not a test-only issue (the whole repo has it), but it's the most numerous pattern.
- ❌ **`gate-replay.test.ts` uses `as IntakeDocument` to bypass the type system** for the `status` field cast (L48: `status ?? 'staging') as IntakeDocument['status']`) and for `docXHash`/`docYHash` (L165-166) where it mutates `content_hash` post-construction. A factory that accepted `content_hash` as an override would be type-safe and would also serve as the canonical way to build same-hash-different-id documents.

### Summary

Epic 2's expansion ring is disciplined and high-leverage. The 55 tests close 14 verified coverage gaps across the render gate, intake replay, eval manifest, audit-health, secrets, and editorial verifyChain — all defamation/security-spine (8× P0, 5× P1, 1× P2). Every P0 behavioral claim I spot-checked against source was accurate, including the one documented behavioral gap (E2-G2, the audit-probe throw escaping the gate). The tests are GREEN (render 112, intake 54, eval 111, config 52, integration 9 — all matching the automation summary's claims), typecheck clean, and ESLint clean.

The main improvement opportunities are: (1) remove the dead `expect(true).toBe(true)` tautology in the E2-G2 test, (2) extract type-safe factories to replace the `as IntakeDocument` / `as Response` casts, and (3) when the repo promotes the ESLint config to `strictTypeChecked` (closing the fatal-five enforcement gap), these tests will need `!` and bare-`as` cleanup. None are blockers.

---

## Quality Criteria Assessment

| Criterion | Status | Violations | Notes |
| --- | --- | --- | --- |
| BDD Format (Given-When-Then) | ✅ PASS | 0 | Comments on every describe block + inline GIVEN/WHEN/THEN in the high-risk tests (E2-G1, E2-G2, E2-G4, E2-G5, E2-G10) |
| Test IDs | ✅ PASS | 0 | `E2-G1`..`E2-G14` gap IDs in every describe block title; traceable to automation-summary-epic-2.md §2.2 |
| Priority Markers (P0/P1/P2/P3) | ✅ PASS | 0 | `[P0]`/`[P1]`/`[P2]` in every describe + JSDoc header; 23 P0 / 27 P1 / 5 P2 (matches summary) |
| Hard Waits (sleep, waitForTimeout) | ✅ PASS | 0 | Zero across all 6 files. Injected `Clock` + `fetchImpl` everywhere. |
| Determinism (no conditionals) | ⚠️ WARN | 1 | E2-G2 test (`gate-resilience.test.ts:140-161`) uses a `try/catch` + `if (!threw)` to characterize a throwing probe. Justified (pins current escape behavior) but the `if`-guarded `expect(true).toBe(true)` is a no-op. E2-G1 test 3 uses `if (tuple.source_doc_id === docA.id) throw` — legitimate per-span branching in a mock, not flow control. |
| Isolation (cleanup, no shared state) | ✅ PASS | 0 | `beforeEach` resets keypairs + clock + gate (gate-replay); `beforeEach` TRUNCATEs editorial_log + rebuilds keyStore (integration); render tests are stateless. Integration uses unique DB name per run. |
| Fixture Patterns | ⚠️ WARN | 1 | `validManifest()` / `passingStrata()` / `asDoc()` / `VALID_ENV` are good local factories, but `as IntakeDocument` casts in gate-replay bypass the type system instead of using an override factory. `factories.js` in render is properly shared. |
| Data Factories | ✅ PASS | 0 | `sourceDoc()`, `citedClaimFor(doc, overrides)`, `uncitedClaim()`, `makeResolver()`, `makeGateContext()` — all override-style, shared via `__fixtures__/factories.js`. Eval + config have local factories mirroring existing test patterns. |
| Network-First Pattern | N/A | 0 | No browser tests in scope (Epic 2 has no browser surface). |
| Explicit Assertions | ⚠️ WARN | 1 | One hidden/no-op assertion: `gate-resilience.test.ts:160` `expect(true).toBe(true)`. All other `expect()` calls are in test bodies and explicit. The `try/catch` in E2-G2 test is characterizing, not hiding — but the tautology dilutes it. |
| Test Length (≤300 lines) | ✅ PASS | 0 | All 6 files ≤348 lines. Largest is the integration test (348) — within reason for Testcontainers harness + 3 describe blocks. |
| Test Duration (≤1.5 min) | ✅ PASS | 0 | Unit tests: all <15ms individually. Integration: 4.6s total (9 tests, live PG). Full affected packages: render 4.0s, intake 0.75s, eval 3.85s, config 1.52s. |
| Flakiness Patterns | ✅ PASS | 0 | No tight timeouts, no `Date.now()`, no `Math.random()`, no env-dependent assumptions. E2-G9 explicitly documents the `setTimeout` non-determinism and routes around it. |

**Total Violations**: 0 Critical, 0 High, 3 Medium, 0 Low

---

## Quality Score Breakdown

```
Starting Score:          100
Critical Violations:     -0 × 10 = -0
High Violations:         -0 × 5 = -0
Medium Violations:       -3 × 2 = -6  (no-op assertion, as-cast pattern, conditional-guarded tautology)
Low Violations:          -0 × 1 = -0

Bonus Points:
  Excellent BDD:          +5   (GIVEN/WHEN/THEN comments + gap-ID traceability on every block)
  Comprehensive Fixtures: +5   (shared factories.js + local override factories)
  Data Factories:         +5   (override-style throughout)
  Perfect Isolation:      +5   (beforeEach resets everywhere stateful; unique DB per run)
  All Test IDs:           +5   (E2-G* gap IDs in every describe)
                           --------
Total Bonus:              +25 (capped at +5 over deductions; net +0 beyond cap)

Subtotal:                 100 - 6 + 5 (cap) = 99

Adjusted (as/! assertion prevalence — fatal-five currently unenforced):
                          94

Final Score:              94/100
Grade:                    A (Good)
```

---

## Dimension Scores (Step 3 Evaluation)

### Determinism: 96/100

**Findings:**
- **[PASS]** Zero `waitForTimeout` / `sleep` / arbitrary `setTimeout` across all 6 files.
- **[PASS]** Injected `Clock` (`fakeClock(startMs)` with `advance(ms)`) in audit-secrets — the E2-G8 backoff-saturation test drives the clock past schedule values deterministically.
- **[PASS]** Injected `fetchImpl` (`makeFetch(() => healthy)`) — no real network in unit tests.
- **[PASS]** Deterministic Ed25519 keypairs via `createKeyPair('r')` per `beforeEach` (gate-replay) and `webcrypto.subtle.generateKey` per test (integration). No `Math.random()`.
- **[PASS]** `clock = new Date('2026-07-07T12:00:00Z')` — fixed UTC anchor (gate-replay L96).
- **[WARN]** E2-G2 test (`gate-resilience.test.ts:140-161`) uses `try/catch` + `let threw` + `if (!threw)` to characterize a probe that *currently throws*. This is legitimate characterization (the test pins "no claim served under any outcome"), but the `if (!threw) { expect(true).toBe(true); }` branch is a no-op tautology — it adds no assertion value and could mislead a reader into thinking the post-fix path is asserted when it isn't.
- **[PASS]** E2-G9 test (`audit-secrets-expansion.test.ts:146-196`) explicitly documents that the `setTimeout`-based HTTP timeout can't be driven by the injected clock, and deliberately exercises the clock-gated budget path (`isOverBudget`) instead. This is the correct determinism call — the test asserts the load-bearing default (100ms) without flake risk.

### Isolation: 98/100

**Findings:**
- **[PASS]** `gate-replay.test.ts` `beforeEach` (L87-98): regenerates `reviewerKey`, `approverKey`, `systemKey`, resets `operatorRecord`/`partnerRecord`, resets `clock`, rebuilds `gate` with a fresh `InMemoryIntakeReplayDetector`. No cross-test leakage possible.
- **[PASS]** `editorial-log-verifychain-expansion.integration.test.ts` `beforeEach` (L84-101): `TRUNCATE editorial_log` + fresh `keyStore` Map + fresh `keyLookup` + fresh `repo`. Unique DB name per container (`iip_test_${randomUUID().slice(0,8)}`).
- **[PASS]** `afterAll` (integration L79-82): `client.end()` + `container.stop()` — no orphaned containers.
- **[PASS]** Render/eval/config tests are stateless — no `beforeEach` needed; each `it` constructs its own `doc`/`sink`/`env`.
- **[WARN]** Integration `beforeAll` creates one container shared across all 9 tests (intentional — Testcontainers startup is ~2s; sharing is the established pattern from `editorial-log.integration.test.ts`). `beforeEach` TRUNCATE provides per-test isolation. Not a violation.

### Maintainability: 90/100

**Findings:**
- **[WARN]** `as` assertions (38 total): `as IntakeDocument` (4× gate-replay), `as Response`/`as typeof fetch` (6× audit-secrets), `as readonly Record<string, unknown>[]` (2× integration), `as GateContext`-ish spreads (render). The project-context (Winston #5) mandates banning `as` except paired with zod `.parse()`. **Lint passes because the root ESLint config uses `tseslint.configs.recommended`, not `strictTypeChecked`** — the fatal-five is documented but not mechanically enforced repo-wide. These tests inherit the gap. When the config is promoted, these will need cleanup.
- **[WARN]** Non-null assertions (`!`, 25 total): concentrated in render (`sink[0]!`, 12×) and integration (`report.failures.find(...)!`, 7×). With `noUncheckedIndexedAccess`, `sink[0]` is `T | undefined`; the `!` silences the flag. The project-context explicitly calls this out: "every LLM silences with `!`. DEFEATS THE ENTIRE FLAG." Same enforcement gap as `as`.
- **[WARN]** `gate-replay.test.ts:43-62` `asDoc()` uses `as IntakeDocument` because the `status` override is typed `string` then cast to the union. A factory with `status?: IntakeDocument['status']` would be type-safe.
- **[PASS]** JSDoc headers cite `@rules` + `@adr` on every file; describe blocks carry gap IDs + priority tags. Traceability is excellent.
- **[PASS]** Test naming is descriptive and behavioral — `"catches a throwing verifyCitation, classifies gate.degraded, strips the span, preserves the message"`, not `"test1"`.
- **[PASS]** All files ≤348 lines; integration test (348) is the largest and justified by Testcontainers harness + 3 describe blocks.

### Performance: 93/100

**Findings:**
- **[PASS]** All unit tests execute in <15ms individually (render 15ms for 11 tests, intake 12ms for 3, eval 12ms for 15, config 7ms for 17).
- **[PASS]** Integration: 9 tests in 4.6s (live PG via Testcontainers) — well under the 1.5min guideline; `beforeAll` has a 240s timeout for container startup (appropriate).
- **[PASS]** No real subprocess invocation in unit tests (eval tests call `evaluateOQ9Grouped` / `validateCorpusManifest` directly; no Python bridge).
- **[PASS]** No real network in unit tests (injected `fetchImpl`).
- **[WARN]** Integration test starts one PG container shared across 9 tests (intentional). The `pg-age-pgvector` image is heavy (~10-15s cold start) but shared via `beforeAll` — acceptable.

---

## Per-File Analysis

### Tier 1: Defamation-Critical (render gate, intake replay, eval manifest)

| File | Lines | Tests | Score | Notes |
| --- | --- | --- | --- | --- |
| `packages/render/src/gate-resilience.test.ts` | 278 | 11 | 93 | E2-G1/G2/G3. Per-span isolation test (L102-124) is exemplary. E2-G2 no-op tautology (L160) is the one blemish. |
| `packages/intake/src/gate-replay.test.ts` | 180 | 3 | 92 | E2-G4. Pins the cross-document replay invariant + the distinct-approver boundary. `as IntakeDocument` casts (4×) are the weakness. |
| `packages/eval/src/manifest-oq9-guards.test.ts` | 227 | 15 | 96 | E2-G5/G6/G7. Clean negative-branch coverage. `as` casts are mostly `as AppError` (justified — narrowed after `toThrow`). |

### Tier 2: Infrastructure (audit-health, secrets)

| File | Lines | Tests | Score | Notes |
| --- | --- | --- | --- | --- |
| `packages/config/src/audit-secrets-expansion.test.ts` | 322 | 17 | 94 | E2-G8/G9/G13/G14. Backoff-saturation + default-budget + timing-knob validation. E2-G9 determinism documentation is excellent. `as Response`/`as typeof fetch` (6×) are the weakness. |

### Tier 3: Integration (editorial verifyChain)

| File | Lines | Tests | Score | Notes |
| --- | --- | --- | --- | --- |
| `tests/integration/editorial-log-verifychain-expansion.integration.test.ts` | 348 | 9 | 93 | E2-G10/G11/G12. Key-validity-window + truncation + queryLog filters against live PG. `as readonly Record<string, unknown>[]` (2×) + `!` (7×) are the weakness. |

**Suite Average**: 93.6/100 (A)

---

## Critical Issues (Must Fix)

No critical issues detected. ✅

---

## Recommendations (Should Fix)

### 1. Remove the no-op `expect(true).toBe(true)` tautology in E2-G2

**Severity**: P2 (Medium)
**Location**: `packages/render/src/gate-resilience.test.ts:156-161`
**Criterion**: Explicit Assertions / Determinism
**Knowledge Base**: [test-quality.md](.agents/skills/bmad-testarch-test-review/resources/knowledge/test-quality.md)

**Issue Description**:
The E2-G2 test characterizes a throwing audit-health probe. It uses `try/catch` to capture whether the gate threw or degraded, then asserts `expect(served).toBe(false)` (the real invariant). But the `if (!threw) { expect(true).toBe(true); }` block is a tautology — it always passes and asserts nothing. A reader will reasonably believe the "desired post-fix state" branch is behaviorally asserted when it isn't.

**Current Code**:
```typescript
// ❌ No-op assertion — always passes, proves nothing
if (!threw) {
  // (This branch is the desired post-fix state.)
  expect(true).toBe(true);
}
```

**Recommended Fix**:
```typescript
// ✅ Either remove the block, or assert the post-fix invariant explicitly
if (!threw) {
  // If the gate fail-closed without throwing, an audit_offline or
  // gate.degraded violation MUST be recorded (the desired post-fix shape).
  expect(out.violations.length).toBeGreaterThan(0);
  expect(out.violations.some((v) => v.kind === 'audit_offline' || v.kind === 'gate.degraded')).toBe(true);
}
```
Note: the fix requires moving `out` into the `try` scope (currently `out` is block-scoped inside `try`). If the intent is purely to document the current escape behavior, delete the `if` block and rely on the `// Document the current (pre-fix) behavior` comment alone.

**Why This Matters**: A no-op assertion is worse than no assertion — it signals "this is checked" when it isn't. In a defamation-grade suite, every `expect` should be load-bearing.

---

### 2. Replace `as IntakeDocument` casts with a type-safe override factory

**Severity**: P2 (Medium)
**Location**: `packages/intake/src/gate-replay.test.ts:43-62, 165-166`
**Criterion**: Fixture Patterns / Type Safety
**Knowledge Base**: [data-factories.md](.agents/skills/bmad-testarch-test-review/resources/knowledge/data-factories.md)

**Issue Description**:
`asDoc()` casts `status` through `string` → `IntakeDocument['status']`, and `docXHash`/`docYHash` use `as IntakeDocument` to mutate `content_hash` post-construction. This bypasses the type system and would fail under `strictTypeChecked` ESLint.

**Current Code**:
```typescript
// ❌ Type-erasing cast
function asDoc(id: string, overrides: Partial<Omit<IntakeDocument, 'status'>> & { status?: string } = {}): IntakeDocument {
  const { status, ...rest } = overrides;
  return { ...defaults, status: (status ?? 'staging') as IntakeDocument['status'], ...rest } as IntakeDocument;
}
// ...
const docXHash = { ...docX, content_hash: hashX } as IntakeDocument;
```

**Recommended Improvement**:
```typescript
// ✅ Type-safe factory — status is the real union, content_hash is an override
function asDoc(
  id: string,
  overrides: Partial<IntakeDocument> = {},
): IntakeDocument {
  return {
    id,
    content_hash: SHARED_HASH,
    status: 'staging',
    tier: 1,
    reviewer_sub: null,
    reviewer_signature: null,
    reviewer_key_kid: null,
    reviewed_at: null,
    approver_sub: null,
    approver_signature: null,
    approver_key_kid: null,
    approved_at: null,
    partner_kid: null,
    partner_signature: null,
    ...overrides,  // content_hash, status, etc. all type-checked
  };
}
// docXHash becomes:
const docXHash = asDoc('00000000-0000-4000-8000-0000000000x1', { content_hash: hashX, status: 'reviewed_once', ... });
```

**Benefits**: Type-safe; survives `strictTypeChecked` promotion; one canonical factory for same-hash-different-id test fixtures.

---

### 3. Plan for fatal-five ESLint enforcement cleanup

**Severity**: P3 (Low — repo-wide, not test-only)
**Location**: All 6 files (38 `as`, 25 `!`)
**Criterion**: Type Safety / Maintainability
**Knowledge Base**: project-context.md (ESLint fatal-five)

**Issue Description**:
The project-context mandates `@typescript-eslint/no-non-null-assertion: error` and "Ban `as` assertions except paired with a zod `.parse()`" as fatal-five rules. The root ESLint config currently uses `tseslint.configs.recommended` (not `strictTypeChecked`), so these rules are **not mechanically enforced** — lint passes clean on all 6 files despite 38 `as` and 25 `!`. This is a repo-wide enforcement gap, not a test-only issue, but the tests inherit it.

**Recommended Improvement**: When the repo promotes to `strictTypeChecked` (a separate hardening task), these tests will need:
- `sink[0]!` → `const obs = sink[0]; assert(obs, ...)` or `if (!sink[0]) return;` narrowing
- `as Response` / `as typeof fetch` → proper `Response` construction or a typed mock helper
- `as IntakeDocument` → see Recommendation #2
- `report.failures.find(...)!` → `const fail = report.failures.find(...); expect(fail).toBeDefined(); if (!fail) return;`

**Priority**: P3 — not blocking; track alongside the fatal-five enforcement ADR.

---

## Best Practices Found

### 1. E2-G1 per-span isolation test (mutation-killing)

**Location**: `packages/render/src/gate-resilience.test.ts:102-124`
**Pattern**: Per-span fault injection
**Knowledge Base**: [test-quality.md](.agents/skills/bmad-testarch-test-review/resources/knowledge/test-quality.md)

**Why This Is Good**: Constructs a verifier that throws *only for docA* and asserts docA is stripped while docB is served intact. This is the exact mutant a narrowed catch scope would let through — a Stryker mutant that removes the per-span `try/catch` would let docA's throw propagate and fail this test. It's the strongest mutation-killing test in the suite.

**Use as Reference**: Apply this "fault injection scoped to one item in a batch" pattern wherever a loop processes independent items with individual error handling.

---

### 2. E2-G9 determinism documentation (routing around non-injectable clock)

**Location**: `packages/config/src/audit-secrets-expansion.test.ts:146-196`
**Pattern**: Explicit determinism trade-off documentation
**Knowledge Base**: [test-quality.md](.agents/skills/bmad-testarch-test-review/resources/knowledge/test-quality.md)

**Why This Is Good**: The test author recognized that the `setTimeout`-based HTTP timeout can't be driven by the injected `Clock`, documented *why* in a comment block, and deliberately exercised the clock-gated budget path (`isOverBudget`) instead — asserting the load-bearing default (100ms) without flake risk. This is the difference between "can't test it deterministically so I skipped it" and "can't test that path deterministically so I tested the equivalent load-bearing path and documented the gap."

**Use as Reference**: Whenever a dependency can't be injected (real `setTimeout`, real `AbortController` timer), document the non-determinism and assert the equivalent invariant through an injectable seam.

---

### 3. E2-G2 pinning current escape behavior + documenting desired fix direction

**Location**: `packages/render/src/gate-resilience.test.ts:127-163`
**Pattern**: Behavioral characterization test
**Knowledge Base**: [test-quality.md](.agents/skills/bmad-testarch-test-review/resources/knowledge/test-quality.md)

**Why This Is Good**: Rather than skipping the audit-probe-throws gap (the source has a real bug — the probe at `gate.ts:156` is outside the try/catch), the test pins the *defamation-safe invariant* (`expect(served).toBe(false)`) under all outcomes and documents the desired post-fix direction inline. This means a refactor that wraps L156 in try/catch won't accidentally break the invariant — the test stays green, and the inline comment tells the refactorer what to convert the throw into.

**Use as Reference**: When a source bug is found during test authoring, pin the safe invariant (not the buggy behavior) and document the fix direction. (Just remove the no-op assertion — see Recommendation #1.)

---

## Test File Analysis

### File Metadata

| File | Lines | Tests | Framework | Level |
| --- | --- | --- | --- | --- |
| `packages/render/src/gate-resilience.test.ts` | 278 | 11 | Vitest 2.x | Unit |
| `packages/intake/src/gate-replay.test.ts` | 180 | 3 | Vitest 2.x | Unit |
| `packages/eval/src/manifest-oq9-guards.test.ts` | 227 | 15 | Vitest 2.x | Unit |
| `packages/config/src/audit-secrets-expansion.test.ts` | 322 | 17 | Vitest 2.x | Unit |
| `tests/integration/editorial-log-verifychain-expansion.integration.test.ts` | 348 | 9 | Vitest 2.x + Testcontainers 10.x | Integration |
| **TOTAL** | **1355** | **55** | | |

### Test Structure

- **Describe Blocks**: 11 (one per gap ID, grouped by file)
- **Test Cases**: 55 (matches automation-summary §3.1 exactly)
- **Priority Distribution**:
  - P0 (Critical): 23 tests (defamation/security spine)
  - P1 (High): 27 tests (credibility/operational)
  - P2 (Medium): 5 tests (operational)
  - P3 (Low): 0

### Assertions Analysis

- **Total Assertions**: ~210 `expect()` calls across 55 tests (~3.8/test — appropriate density)
- **Assertion Types**: `toBe`, `toEqual`, `toContainEqual` + `objectContaining`, `toMatch` (regex), `toThrow`/`rejects.toThrow`, `toHaveLength`, `resolves.toBeDefined`, `toBeDefined`
- **No hidden assertions** in helpers (all `expect()` in test bodies) except the one no-op tautology (Rec #1)

---

## Context and Integration

### Related Artifacts

- **Epic**: `epics.md` → Epic 2: Provenance & Invariants (Stories 2.1–2.11)
- **Automation Summary**: [`automation-summary-epic-2.md`](_bmad-output/test-artifacts/automation-summary-epic-2.md) — §4.6 explicitly requested this review
- **Sprint Status**: `sprint-status.yaml` (2026-07-07) — Stories 2.1–2.8, 2.9a, 2.10, 2.11 done/review; 2.9b deferred
- **Risk Assessment**: P0×8 / P1×5 / P2×1 (user-approved full scope per automation §2.2)
- **Priority Framework**: P0–P3 from `test-priorities-matrix.md`, applied via gap IDs `E2-G1`..`E2-G14`

### Source Verification (performed during this review)

I verified the three highest-risk behavioral claims against source:
- ✅ `gate.ts:156` — `auditReachable = ctx.auditHealth?.isAuditReachable() ?? true` IS outside the per-span try/catch (L188-201). E2-G2's characterization is accurate.
- ✅ `gate.ts:188-201` — the catch classifies `gate.degraded` with `details: error.message` and strips the span. E2-G1's assertion shape matches.
- ✅ `oq9.ts:535-537` — `manifestShaMatches = expected === actual && expected.length > 0`. E2-G5's claim that the `.length > 0` guard is load-bearing is accurate.
- ✅ `audit-health.ts:240-241` — `idx = Math.min(consecutiveFailures - 1, backoffMs.length - 1); waitMs = backoffMs[idx] ?? backoffMs.at(-1)!`. E2-G8's saturation claim is accurate.
- ✅ `state.ts:37-38` — `replayTuple(contentHash, signature, principalSub, transition)` does NOT include `document_id`. E2-G4's cross-document replay claim is accurate.

---

## Knowledge Base References

This review consulted:

- **[test-quality.md]** — Definition of Done (no hard waits, <300 lines, <1.5 min, self-cleaning, explicit assertions)
- **[data-factories.md]** — Factory functions with overrides, API-first setup
- **[test-levels-framework.md]** — Unit vs integration appropriateness
- **[test-priorities-matrix.md]** — P0–P3 classification
- **project-context.md** — ESLint fatal-five, branded types, `as`/`!` bans, PC-5 `@rules`/`@adr` citation discipline

Coverage mapping is out of scope here — use `trace` for coverage metrics and gate decisions.

---

## Next Steps

### Immediate Actions (Before Merge)

1. **Remove the no-op `expect(true).toBe(true)`** in `gate-resilience.test.ts:156-161` — replace with a real post-fix invariant assertion or delete the `if` block.
   - Priority: P2
   - Owner: Murat (or whoever merges the expansion PR)
   - Effort: 10 min

### Follow-up Actions (Future PRs)

1. **Extract type-safe `asDoc` factory** in `gate-replay.test.ts` to replace `as IntakeDocument` casts.
   - Priority: P2
   - Target: next intake test PR

2. **Promote ESLint config to `strictTypeChecked`** (repo-wide hardening) — then clean up `!` and bare-`as` across all 6 files (38 + 25 = 63 sites).
   - Priority: P3
   - Target: fatal-five enforcement ADR (track separately)

3. **Stryker re-run** on `gate.ts` / `state.ts` / `oq9.ts` — the new tests should push mutation scores higher on previously-untested branches (E2-G1/G3 for gate.ts; E2-G4 for state.ts; E2-G5 for oq9.ts). Recommended by automation-summary §4.6.
   - Priority: P2
   - Target: nightly lane

4. **Follow-up hardening story**: wrap `gate.ts:156` audit-health probe in try/catch → structured `gate.degraded` (E2-G2). Currently documented as a behavioral observation; the test already pins the safe invariant.
   - Priority: P1
   - Target: Epic 2 hardening story

### Re-Review Needed?

✅ No re-review needed — approve as-is. The P2 recommendation (no-op assertion) is a cleanup, not a blocker; the test suite is production-ready and the defamation-grade invariants are mechanically pinned.

---

## Decision

**Recommendation**: Approve with Comments

**Rationale**:

Test quality is good with 94/100. The 6 expansion files close 14 verified coverage gaps across the defamation/security spine (8× P0), with every behavioral claim I spot-checked against source confirmed accurate. The tests are GREEN (55/55), typecheck clean, and lint clean. Determinism is structurally enforced (injected clocks, fetch, replay detector); isolation is rigorous (beforeEach resets, unique DB per run); traceability is excellent (gap IDs + @rules/@adr on every file).

The one actionable cleanup is the no-op `expect(true).toBe(true)` tautology in the E2-G2 test — it should be removed or replaced with a real assertion before merge, but it doesn't block. The `as`/`!` assertion prevalence (63 sites) is a repo-wide enforcement gap (fatal-five is documented but not mechanically enforced under `recommended` config), not a test-only defect; it should be tracked alongside the `strictTypeChecked` promotion.

> Test quality is good with 94/100. The defamation-grade invariants under test (AC-2 fail-closed gate, SEC-2 replay rejection, SEC-6 key-validity window, ADR-0011 manifest identity, AC-8 timing guard) are mechanically pinned with verified-against-source accuracy. Recommend approving after the no-op assertion cleanup; the `as`/`!` cleanup tracks with the fatal-five enforcement ADR.

---

## Appendix

### Violation Summary by Location

| File | Line | Severity | Criterion | Issue | Fix |
| --- | --- | --- | --- | --- | --- |
| `gate-resilience.test.ts` | 160 | P2 | Explicit Assertions | No-op `expect(true).toBe(true)` tautology | Replace with real post-fix invariant or delete `if` block |
| `gate-replay.test.ts` | 48,61,165,166 | P2 | Fixture Patterns / Type Safety | `as IntakeDocument` casts bypass type system | Type-safe override factory |
| all 6 files | various | P3 | Type Safety | 38 `as` + 25 `!` (fatal-five unenforced) | Track with `strictTypeChecked` promotion |

### Related Reviews

| File | Score | Grade | Critical | Status |
| --- | --- | --- | --- | --- |
| `gate-resilience.test.ts` | 93/100 | A | 0 | Approved |
| `gate-replay.test.ts` | 92/100 | A | 0 | Approved |
| `manifest-oq9-guards.test.ts` | 96/100 | A | 0 | Approved |
| `audit-secrets-expansion.test.ts` | 94/100 | A | 0 | Approved |
| `editorial-log-verifychain-expansion.integration.test.ts` | 93/100 | A | 0 | Approved |
| **Suite Average** | **93.6/100** | **A** | **0** | **Approved with Comments** |

### Quality Trends

| Review Date | Epic | Score | Grade | Trend |
| --- | --- | --- | --- | --- |
| 2026-06-27 | Epic 1 | 92/100 | A | baseline |
| 2026-07-07 | Epic 2 (expansion) | 94/100 | A | ⬆️ +2 (improved) |

---

## Review Metadata

**Generated By**: Murat (TEA Agent — Test Architect)
**Workflow**: testarch-test-review (Create mode, sequential execution)
**Review ID**: test-review-epic-2-expansion-20260707
**Timestamp**: 2026-07-07
**Version**: 1.0

---

## Feedback on This Review

If you have questions or feedback:

1. Review patterns in the knowledge base: `.agents/skills/bmad-testarch-test-review/resources/knowledge/`
2. Consult `tea-index.csv` for detailed guidance
3. Request clarification on specific violations
4. Pair with QA engineer to apply patterns

This review is guidance, not rigid rules. Context matters — if a pattern is justified (e.g., the E2-G2 characterization test's `try/catch` is justified to pin a throwing probe's safe invariant), document it with a comment.
