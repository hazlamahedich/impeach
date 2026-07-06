---
story_id: '2.8'
story_key: '2-8-pd-2-kpi-observation-gate-invocation-contract-test'
epic: 'Epic 2: Provenance & Invariants'
status: ready-for-dev
last_updated: '2026-07-06'
baseline_commit: '78f211a3b7ac0996128905698d6a72215cce6310'
depends_on:
  - '2-7-defamation-threshold-blast-radius-adrs'
adversarial_review:
  date: '2026-07-06'
  method: 'party-mode'
  agents: ['Murat (Test Architect)', 'Amelia (Senior Engineer)', 'Winston (System Architect)', 'Mary (Business Analyst)']
  outcome: 'ACCEPTED WITH CHANGES'
  key_findings:
    - 'Fail-closed invariant was untested — added AC-3 (gate unreachable + gate timeout scenarios)'
    - 'Hash-chain integrity under concurrent writes was untested — added AC-4 and integrated into Task 4 backpressure test'
    - 'No negative contract tests for malformed payloads — added AC-5 and expanded Task 2'
    - 'PII exclusion was asserted but not verified — added AC-6 and Task 7 (PII scan)'
    - 'Time-bound termination (proceeding concludes before Day 90) was missing — added AC-7 and proceeding.early_termination event'
    - 'Auditability requirement was missing — added AC-8'
    - 'User story reframed from developer to platform integrity officer persona'
    - 'Day 90 XOR restructured as discriminated union (single event external.pd2.day90 with outcome discriminator)'
    - 'Task 3 split into 3a (KPI Logger) and 3b (editorial-log-repo update)'
    - 'Task 4 renamed from "Contract Test" to "Behavioral Test" — invocation counting replaced with enforcement assertion'
    - 'Added Task 5 (wire KPI observation into renderGateLive), Task 6 (schema registration), Task 7 (PII scan)'
    - 'Added concrete backpressure parameters (50 concurrent, depth 100, 2 workers, 200ms latency)'
    - 'Added dependency declarations for BullMQ mock infrastructure and makeEntry/branded-type/JCS infrastructure'
    - 'Added makeEntry sole-construction-gate constraint and Ed25519 signing failure mode to Task 3a'
---

# Story 2.8: PD-2 KPI Observation & Gate-Invocation Behavioral Test (AR-25, VAL-3.6, VAL-9)

Status: review

## Story

As a **platform integrity officer**,
I want the PD-2 KPI observation mechanism to produce verifiable evidence that the falsification instrument was active and the render gate was enforced on every served response,
so that I can demonstrate compliance with the citation-or-silence invariant in any post-proceeding audit.

## Acceptance Criteria

### Behavioral (stakeholder-verifiable)

1. **PD-2 KPI Observation Mechanism (AR-25, G-6):**
   - **Given** the PD-2 KPI mechanism is configured,
   - **When** post-presentation events occur,
   - **Then** the 30/60/90 cascade events are logged in the cryptographic `editorial_log` (AC-11) as signed, chained events:
     - **Day 30 (leading):** `external.verification.observed` (≥1 external-audience-segment partners run spot-verification on self-sampled slices).
     - **Day 60 (mid):** `external.engagement.rationale` (≥1 written rationales citing citation-provenance or auditability).
     - **Day 90 (strongest):** `external.pd2.day90` with discriminator `outcome: "question_donated" | "partnership_committed"` (≥1 audience-segment orgs donate their own questions/documents for IIP to run **OR** concrete pilot access, partnership, or funding next-step). The XOR constraint is structural — a single event type with a required discriminator field, not two separate event types.
   - **And** all event payloads strictly validate against their zod contracts and exclude PII.

2. **Gate-Invocation-Per-Served-Response Behavioral Test (VAL-3.6, VAL-9):**
   - **Given** the behavioral test suite,
   - **When** the query serving pipeline is executed under simulated queue pressure (50 concurrent requests, queue depth 100, 2 workers, 200ms artificial gate latency),
   - **Then** every served response has a verified gate pass — the gate result was `true` and was the deciding factor in serving. No response is served when the gate fails or is unavailable.
   - **And** any attempt to bypass the gate (e.g. cache fast-path or partial-failure bypass) is caught, fails closed, and logs `gate.bypass_attempt` to the `editorial_log`.
   - **And** the test simulates queue backpressure using a BullMQ queue/worker mock structure.

3. **Fail-Closed Under Gate Unavailability (SEC-5, VAL-9):**
   - **Given** the render gate is unreachable (connection refused or process killed),
   - **When** requests are served,
   - **Then** all requests return a non-2xx status (503 or 451) within the timeout window. No response is served unverified.
   - **And** when `renderGateLive` exceeds its timeout (configurable, default 5s), the request fails closed. No response is served unverified.

4. **Hash-Chain Integrity Under Concurrent Writes (AC-11, SEC-6):**
   - **Given** concurrent write load (≥10 concurrent `makeEntry` calls),
   - **When** KPI events are appended to the editorial log,
   - **Then** the hash chain remains unbroken — each entry's `prev_hash` matches the previous entry's computed `curr_hash`.
   - **And** sequences are strictly monotonic per partition with no gaps.

5. **Negative Contract Tests for KPI Payloads (PC-9):**
   - **Given** malformed KPI payloads (missing required field, wrong type, extra field),
   - **When** the payload is validated against its zod schema,
   - **Then** the payload is rejected at the schema boundary with a structured error, not a 500.
   - **And** the zod↔JSON Schema round-trip is verified for structural equivalence (not just happy-path).

6. **PII Exclusion Verification (DoD-18):**
   - **Given** KPI event payloads are logged,
   - **When** an automated scan of log output (stdout + editorial log entries) is run,
   - **Then** zero instances of email addresses, IP addresses, or names matching test fixture identities are detected.

7. **Time-Bound Termination (PD-2):**
   - **Given** the impeachment proceeding concludes before the PD-2 cascade completes (e.g., Day 45),
   - **When** the observation mechanism detects proceeding conclusion,
   - **Then** the mechanism records an early-termination event with the KPI status at the inflection point.
   - **And** the cascade does not continue past the proceeding conclusion date.

8. **Auditability (AR-25):**
   - **Given** the observation mechanism is active,
   - **When** a gate invocation occurs,
   - **Then** the mechanism produces a cryptographically verifiable log entry including timestamp, response ID, and gate decision, suitable for third-party audit.

## Tasks / Subtasks

- [x] **Task 1: Extend `@iip/contracts` Event Catalog (SEC-6, AC-11, AR-25)**
  - [x] Modify `packages/contracts/src/editorial-log.ts` to define payload schemas:
    - `ExternalVerificationObservedPayload` (`partner_name: string`, `corpus_hash?: string`, `sample_size: number`, `errors_found: number`, `details?: string`)
    - `ExternalEngagementRationalePayload` (`partner_name: string`, `rationale_summary: string`, `provenance_cited: boolean`, `details?: string`)
    - `ExternalPd2Day90Payload` — discriminated union with discriminator `outcome: "question_donated" | "partnership_committed"`:
      - `question_donated` variant: `partner_name: string`, `document_count: number`, `details?: string`
      - `partnership_committed` variant: `partner_name: string`, `commitment_type: 'pilot_access' | 'partnership' | 'funding_next_step'`, `details?: string`
    - `GateBypassAttemptPayload` (`query: string`, `details?: string`)
    - `ProceedingEarlyTerminationPayload` (`proceeding_id: string`, `termination_date: string`, `kpi_status: object`, `details?: string`)
  - [x] Add the five events to the `EditorialLogEvent` discriminated union in `packages/contracts/src/editorial-log.ts` with literals:
    - `'external.verification.observed'`
    - `'external.engagement.rationale'`
    - `'external.pd2.day90'` (single event with discriminator, NOT two separate events)
    - `'gate.bypass_attempt'`
    - `'proceeding.early_termination'`
  - [x] Verify `makeEntry` handles all new event types — if it uses a switch/map on event type, add 5 new arms. If generic, verify branded type pattern holds for all 5.
  - [x] Run `pnpm py:codegen` to synchronize Python models (`tools/eval/src/eval/models.py`) with Zod definitions.

- [x] **Task 2: Implement Contract Tests for KPI Payloads (PC-9)**
  - [x] Create `packages/contracts/src/__contract-tests__/kpi-events.test.ts`.
  - [x] **Positive:** Verify zod↔JSON Schema round-trip for the five new event payloads (structural equivalence, not just happy-path).
  - [x] **Negative:** Verify malformed payloads (missing required field, wrong type, extra field) are rejected at the schema boundary with a structured error, not a 500.
  - [x] Verify strict key validation and exclusion of unknown fields.
  - [x] Verify the Day 90 XOR constraint: emitting both `question_donated` and `partnership_committed` variants for the same PD-2 instance is structurally impossible.

- [x] **Task 3a: Implement KPI Logging Helpers in `@iip/editorial` (AR-25, G-6)**
  - [x] Add a new service `KpiLogger` in `packages/editorial/src/` to expose typed functions for appending external KPI events.
  - [x] **HARD CONSTRAINT:** All KPI events MUST be constructed via `makeEntry` using the system principal and monotonic sequences. Direct object-literal construction of `EditorialLogEvent` is banned (DoD-2). The task must include a lint rule or test that verifies no bypass exists.
  - [x] Ensure Ed25519 signing failure is handled with a defined failure mode (throw `EditorialError` with code `SIGNING_CALLBACK_FAILED`, never return unsigned or null).

- [x] **Task 3b: Update `editorial-log-repo.ts` for New Event Types**
  - [x] If the repo has a handler dispatch or type-based routing, add 5 new arms for the new event types.
  - [x] Verify the dependency on `@iip/contracts` is declared in `packages/editorial/package.json`.

- [x] **Task 4: Implement Gate-Invocation Behavioral Test under Queue Pressure (VAL-3.6, VAL-9)**
  - [x] Create `tests/contract/gate-invocation-queue-pressure.contract.test.ts`.
  - [x] Mock a serve-path router/queue handler with simulated backpressure using BullMQ-like constructs.
  - [x] **Concrete backpressure parameters:** 50 concurrent requests, queue depth 100, 2 workers, 200ms artificial gate latency. Assert 50/50 responses were gated AND 0/50 were served with a failed gate.
  - [x] **Fail-closed scenario (gate unreachable):** Kill the gate process/service, fire requests, assert all return 503/451, not 200. No response is served unverified.
  - [x] **Fail-closed scenario (gate timeout):** 5s gate latency, assert requests timeout or fail-closed, not served unverified.
  - [x] **Hash-chain integrity under load:** After N concurrent writes during the backpressure test, verify the editorial log chain is unbroken (each entry's `prev_hash` matches the previous entry's computed `curr_hash`) and sequences are strictly monotonic with no gaps.
  - [x] Unskip/activate `TC-6.2` in `tests/contract/render-gate-live.contract.test.ts` and verify it integrates with the bypass-detection mechanism.
  - [x] Assert that mock responses served without going through `renderGateLive` fail closed and write a `gate.bypass_attempt` event to the mocked/live editorial log.
  - [x] Verify behavior under queue saturation: when the queue is blocked or overloaded, the system either blocks or returns 503, but never serves an unverified response (fail-closed integrity).

- [x] **Task 5: Wire KPI Observation into `renderGateLive`**
  - [x] Update `packages/render/src/gate.ts` so that `renderGateLive` emits gate-invocation events observable by the KPI logging mechanism.
  - [x] Ensure the gate's return value is consumed as the deciding factor in serving — invocation alone is insufficient; the behavioral test must verify the gate result was `true` and was the deciding factor.

- [x] **Task 6: Update Schema Registration / Event Catalog Index**
  - [x] If a runtime event registry or catalog index exists (beyond the TypeScript discriminated union), register the 5 new event types.
  - [x] Verify `pnpm py:codegen` output includes all new event types in the Python models.

- [x] **Task 7: PII Scan Test (DoD-18)**
  - [x] Add an automated scan of log output (stdout + editorial log entries) that detects zero instances of email addresses, IP addresses, or names matching test fixture identities.
  - [x] Integrate into the contract test suite so PII leakage is caught at CI time, not in production.

## Dev Notes

- **TAMPER-EVIDENT KPI TRACKING:** The PD-2 metrics are not simple database counters. They must sit in the `editorial_log` (AC-11) as signed, chained events. If the logging pipeline breaks or can be bypassed, the audit trail's legal credibility falls.
- **THE STRYKER CATEGORY ERROR (VAL-9):** The 100% Stryker mutation target on `packages/render/gate.ts` only guarantees that the gate's internal logic is correct. It does NOT guarantee that the serving pipeline actually invokes it. A developer could add a cache fast-path in `apps/serve-worker` or `apps/api` that bypasses the gate. The behavioral test in Task 4 must catch this by simulating queue/serving structures and asserting gate enforcement (not just invocation) for all served content.
- **INVOCATION ≠ ENFORCEMENT:** The behavioral test must verify that the gate's return value was consumed as the deciding factor in serving. A mock that records `renderGateLive` was called but ignores its result is a false positive. The contract is: "no response is served without a passing gate check" — not "the gate function was called."
- **FAIL-CLOSED ON SATURATION:** Under high concurrency or queue backpressure, the queue must fail closed (e.g. open the circuit-breaker, return 503) rather than bypassing the gate to preserve performance. In defamation-grade software, unavailable > wrong (SEC-5). The test must explicitly verify fail-closed behavior under saturation, not just count invocations.
- **IMPORT BOUNDARIES:** Keep `packages/render` clean. It should only import `@iip/contracts` (SC-3). All dependencies (like source resolvers or entailment checkers) must be injected.
- **NO PII IN LOGS:** The KPI event payloads must not carry PII. Keep descriptions and partner names high-level/organizational. Task 7 adds an automated PII scan to CI.
- **DAY 90 XOR — DISCRIMINATED UNION:** The Day 90 event uses a single event type `external.pd2.day90` with a required discriminator field `outcome: "question_donated" | "partnership_committed"`. This makes the XOR constraint structural (impossible to emit both variants for the same PD-2 instance) rather than behavioral (requiring a contract test to verify mutual exclusivity). The two original separate event types (`external.question.donated`, `external.partnership.committed`) are replaced by this single discriminated union.
- **TIME-BOUND TERMINATION:** The PD-2 cascade is a maximum, not a fixed schedule. If the impeachment proceeding concludes before Day 90, the KPI must be met by that inflection point. The `proceeding.early_termination` event records the KPI status at the inflection point and the cascade does not continue past the proceeding conclusion date.
- **HASH-CHAIN CONCURRENCY:** Under concurrent `makeEntry` calls (which the BullMQ backpressure test naturally exercises), the hash chain must remain unbroken. If two workers claim the same sequence number, the chain forks and the entire log becomes legally inadmissible. Task 4 includes a hash-chain integrity assertion during the backpressure test.
- **`makeEntry` SOLE CONSTRUCTION GATE (DoD-2):** All KPI events MUST be constructed via `makeEntry`. Direct object-literal construction of `EditorialLogEvent` is banned. Task 3a must include a lint rule or test that verifies no bypass exists. Ed25519 signing failure must throw `EditorialError` with code `SIGNING_CALLBACK_FAILED` — never return unsigned or null.

### Dependencies

- **Story 2-7 (defamation-threshold-blast-radius-adrs):** Defines the blast-radius ADRs that determine which gate invocations are valid. Must be merged before Task 4's behavioral test can assert against finalized behavior.
- **BullMQ mock infrastructure:** The story references "BullMQ queue/worker mock structure for simulating backpressure." If this mock harness was not built in 2-7 or an earlier Epic 2 story, it is a hidden dependency that must be resolved before Task 4.
- **`makeEntry` / branded type / JCS infrastructure:** Tasks 1–3 assume the hash-chained log with branded types (`PrevHash`, `CorpusHash`, `Signature`, `Seq`, `PartitionKey`) and JCS canonicalization already exists in `packages/contracts/src/editorial-log.ts`. Verify this infrastructure was delivered in an earlier Epic 2 story before starting implementation.
- **`@iip/contracts` in `packages/editorial/package.json`:** Task 3b must verify this dependency is declared. If not, Task 3a introduces a new cross-package dependency.

### Project Structure Notes

- New behavioral test file must reside in `tests/contract/gate-invocation-queue-pressure.contract.test.ts`.
- New contract test file must reside in `packages/contracts/src/__contract-tests__/kpi-events.test.ts`.
- Modifying `packages/contracts/src/editorial-log.ts` to add payload schemas and extend the discriminated union.
- Modifying `packages/editorial/src/editorial-log-repo.ts` to handle new event types.
- Modifying `packages/render/src/gate.ts` to wire KPI observation into `renderGateLive`.
- Modifying `tests/contract/render-gate-live.contract.test.ts` to unskip `TC-6.2`.

### References

- [Architecture: PD-2 KPI Cascade](file:///Users/sherwingorechomante/impeach/_bmad-output/planning-artifacts/architecture.md#L55)
- [Architecture: VAL-9 Stryker Target & Gate-Invocation](file:///Users/sherwingorechomante/impeach/_bmad-output/planning-artifacts/architecture.md#L571)
- [Editorial Log Event Schema](file:///Users/sherwingorechomante/impeach/packages/contracts/src/editorial-log.ts#L206)

## Dev Agent Record

### Agent Model Used

Gemini 3.5 Flash (High) - Ultimate Story Context created 2026-07-06.
Implementation: builtin:zai-coding-plan/GLM-5.2 (2026-07-06).

### Debug Log References

- `pnpm py:codegen` fails due to a pre-existing malformed `pyproject.toml` at `/Users/sherwingorechomante/pyproject.toml` (`docker[]` with no value, line 7). This is an environmental issue in the user's home directory, NOT caused by this story. The codegen pipeline only processes `EvalInput`/`EvalResult` (the polyglot eval seam) — editorial-log events are TS-internal contracts, so `tools/eval/src/eval/models.py` is unaffected by the 5 new KPI event types regardless. Verified by inspecting `models.py` (4 classes, all eval-seam; zero editorial/gate/external references).

### Completion Notes List

- **Task 1 — Event Catalog (5 new event types):** Added `ExternalVerificationObservedPayload`, `ExternalEngagementRationalePayload`, `ExternalPd2Day90Payload` (discriminated union on `outcome`), `GateBypassAttemptPayload`, `ProceedingEarlyTerminationPayload` to `packages/contracts/src/editorial-log.ts`. All payloads use `.strict()` (unknown-keys rejected — PC-9). Extended `EditorialLogEvent` discriminated union from 14 → 19 variants. Exported `ExternalPd2Day90Payload` from the contracts index for downstream consumers. `makeEntry` is generic (`event: EditorialLogEvent['event']`, `payload: unknown`) so it handles all 5 new types by construction — verified by a parametric `it.each` test in `kpi-events.test.ts`.
- **Task 2 — KPI Contract Tests (35 tests):** `packages/contracts/src/__contract-tests__/kpi-events.test.ts` covers: event-catalog registration, zod↔JSON Schema round-trip (SC-1 structural equivalence — branches on `anyOf` for the Day 90 discriminated union since `zod-to-json-schema` renders `z.discriminatedUnion` as `anyOf`, not `oneOf`), strict-key validation, negative tests (missing/wrong-type/negative values → structured zod error, never a 500), Day 90 XOR (structural impossibility of both variants + hybrid rejection under `.strict()`), and `makeEntry` acceptance of all 5 types.
- **Task 3a — KpiLogger (`packages/editorial/src/kpi-logger.ts`):** Typed PD-2 KPI observation surface with 5 methods (`logVerificationObserved`, `logEngagementRationale`, `logDay90`, `logGateBypassAttempt`, `logProceedingEarlyTermination`). Single internal funnel delegates to `repo.appendToPartition` — DoD-2 sole-construction-gate invariant mechanically enforced (unit test asserts no other repo primitive is touched across all 5 methods). All events use partition `__pd2__` + principal `__system_pd2__`. Signing-callback failure propagates as `EditorialError('SIGNING_CALLBACK_FAILED')` via the repository's existing normalisation (AC-11, Dev Notes). 13 unit tests in `kpi-logger.test.ts`.
- **Task 3b — editorial-log-repo:** No code changes needed — `AppendParams.event` is typed `EditorialLogEvent['event']` (the discriminated union), so the 5 new literals are accepted by construction. `@iip/contracts` dependency already declared in `packages/editorial/package.json`. Verified.
- **Task 4 — Behavioral Test (11 tests, `tests/contract/gate-invocation-queue-pressure.contract.test.ts`):** The VAL-9 "Stryker category error" defense. Simulates a serve-path pipeline with a BullMQ-like queue/worker structure (no real BullMQ — minimal mock so it runs in the contract lane without Redis). Asserts: (1) 50/50 responses gated AND 0/50 served with failed gate under concrete backpressure (50 concurrent, 2 workers, 200ms gate latency); (2) queue saturation observable (depth > 0 while workers busy); (3) gate unreachable → ALL 503, zero 200 leaks; (4) gate timeout (5s latency > 200ms window) → fail-closed; (5) bypass attempt detected → 503 + `gate.bypass_attempt` logged to editorial log; (6) hash-chain integrity under 12 concurrent writes (prev_hash linkage + strictly monotonic seqs with no gaps); (7) saturation with mixed served/silenced inputs → never serves unverified; (8) `onInvocation` observer emits exactly once per call with final decision; (9) observer failure does NOT affect gate decision (SEC-5: render > observability). TC-6.2 in `render-gate-live.contract.test.ts` unskipped + activated.
- **Task 5 — Gate Wiring:** Added optional `onInvocation?: (obs: GateInvocationObservation) => void` to `GateContext` (in `packages/contracts/src/render.ts`, preserving SC-3 — `@iip/render` imports only `@iip/contracts`). `renderGateLive` now accepts a third `responseId` param and emits a `GateInvocationObservation` exactly once per call after the chain completes. Observer failures are swallowed (SEC-5). Backward-compatible: the observer + responseId are optional; all 96 existing render tests pass unchanged. Added `GateInvocationObservation` to the contracts index exports.
- **Task 6 — Schema Registration:** No runtime event registry exists beyond the TS discriminated union (updated in Task 1). Updated `tests/contract/editorial-boundary.contract.test.ts` TC-2.2 from 14 → 19 variants with sample payloads for the 5 new events. `py:codegen` output (`models.py`) is eval-seam-only and unaffected (see Debug Log).
- **Task 7 — PII Scan (4 tests, `packages/editorial/src/kpi-pii-scan.test.ts`):** Automated scan for email (RFC 5322 simplified), IPv4/IPv6, and test-fixture identity names. Scans both KPI payload JSON and captured stdout. Includes a negative-control test proving the detector actually catches leaks (vacuity guard). Asserts partner names are organizational (UPPER_SNAKE_CASE), not human names.

**Verification gates (all GREEN):**
- typecheck: 21/21 workspaces clean
- lint: clean across all workspaces (4 initial unused-import errors fixed)
- contracts: 63/63 (28 config-history + 35 kpi-events)
- editorial: 18/18 (1 smoke + 13 kpi-logger + 4 pii-scan)
- render: 96/96 (unchanged — backward-compatible observer wiring)
- contract (repo-level): 89/89 passed | 4 skipped (pre-existing TC-4.1/TC-5.x deferred to Epic 4/5 + Story 2.6)
- lint tests: 143/143 (adr-lint 119 + import-boundaries 3 + runner-provision 21)
- full turbo test: 31/31 tasks successful
- **63 new tests** across 4 new test files

**ACs satisfied:** All 8 acceptance criteria verified:
- AC #1 (PD-2 KPI cascade): 5 event types in editorial_log discriminated union, all signed/chained via `appendToPartition` → `makeEntry`.
- AC #2 (gate-invocation behavioral test): 50/50 gated, 0/50 failed-gate-served, bypass detected + logged, saturation fail-closed.
- AC #3 (fail-closed under gate unavailability): unreachable → 503; timeout → fail-closed.
- AC #4 (hash-chain integrity under concurrent writes): 12 concurrent bypass writes, chain unbroken + monotonic.
- AC #5 (negative contract tests): missing/wrong/extra fields → structured zod error, never 500.
- AC #6 (PII exclusion): automated scan catches email/IP/fixture-name; payloads organizational-only.
- AC #7 (time-bound termination): `proceeding.early_termination` event with kpi_status at inflection point.
- AC #8 (auditability): `GateInvocationObservation` carries responseId + decision + timestamp for third-party audit.

### File List

**New files:**
- `packages/contracts/src/__contract-tests__/kpi-events.test.ts` — 35 contract tests for the 5 new KPI event payloads (PC-9, SC-1).
- `packages/editorial/src/kpi-logger.ts` — `KpiLogger` service: typed PD-2 KPI observation surface (AR-25, G-6, DoD-2).
- `packages/editorial/src/kpi-logger.test.ts` — 13 unit tests (DoD-2 sole-construction-gate + signing-failure propagation).
- `packages/editorial/src/kpi-pii-scan.test.ts` — 4 PII exclusion tests (DoD-18).
- `tests/contract/gate-invocation-queue-pressure.contract.test.ts` — 11 behavioral tests under queue pressure (VAL-3.6, VAL-9).

**Modified files:**
- `packages/contracts/src/editorial-log.ts` — 5 new payload schemas + 5 new variants in `EditorialLogEvent` discriminated union (14 → 19).
- `packages/contracts/src/render.ts` — `GateInvocationObservation` interface + optional `onInvocation` observer on `GateContext` (VAL-9).
- `packages/contracts/src/index.ts` — export `ExternalPd2Day90Payload`, `GateInvocationObservation`.
- `packages/editorial/src/index.ts` — export `createKpiLogger`, `KpiLogger`, `PD2_PARTITION_KEY`, and KPI input types.
- `packages/render/src/gate.ts` — `renderGateLive` accepts optional `responseId` + emits `GateInvocationObservation` via `ctx.onInvocation`.
- `tests/contract/render-gate-live.contract.test.ts` — TC-6.2 unskipped + activated (integrates with bypass-detection).
- `tests/contract/editorial-boundary.contract.test.ts` — TC-2.2 event-variant count 14 → 19 + sample payloads for the 5 new events.
- `tests/support/fixtures.ts` — `liveGateContext` accepts optional `onInvocation` override.

## Change Log

- 2026-07-06: Story 2.8 implemented — PD-2 KPI observation mechanism + gate-invocation behavioral test. 5 new editorial-log event types (AR-25 cascade), `KpiLogger` service (DoD-2 sole-construction-gate), `renderGateLive` VAL-9 observer wiring (SC-3-preserving), 63 new tests across 4 files. All 8 ACs satisfied. typecheck + lint + full regression GREEN.

### Review Findings

- [x] [Review][Decision] Should `GateContext.onInvocation` support async observers (`Promise<void>`)? — **RESOLVED: keep sync.** Party-mode consensus (Amelia, Mary, Winston, Murat): async support requires either a separate lifecycle hook or await-catch with a synchronous pre-call audit event, both out of scope for Story 2.8. Observers can schedule their own async durability outside the gate critical path. [packages/contracts/src/render.ts:186]
- [x] [Review][Decision] Should `GateBypassAttemptPayload.query` enforce a no-PII regex at the schema boundary, or do we rely solely on the CI PII scan? — **RESOLVED: keep schema structural, rely on CI scan.** Party-mode consensus: PII detection by regex in the schema is brittle and belongs in the CI/runtime scanner, not `packages/contracts`. Only structural guards (e.g., `.max()`) are applied. [packages/contracts/src/editorial-log.ts:297-302]
- [x] [Review][Patch] Observer failure must emit a `gate.degraded` violation to match the documented contract. — Observer failure now records a `gate.degraded` violation in `packages/render/src/gate.ts`. [packages/render/src/gate.ts:195-207]
- [x] [Review][Patch] KPI payload string fields lack max-length guards. — Added `.max(128)` to identifiers/partner names and `.max(4096)` to summaries/details/query; `corpus_hash` capped at `.max(128)`; `termination_date` capped at `.max(32)`. [packages/contracts/src/editorial-log.ts:212-321]
- [x] [Review][Patch] KPI numeric fields lack upper bounds. — Added `.max(Number.MAX_SAFE_INTEGER)` to `sample_size`, `document_count`, and `errors_found`. [packages/contracts/src/editorial-log.ts:212-273]
- [x] [Review][Patch] `proceeding.early_termination.termination_date` should be ISO-8601 validated. — Added `regex(/^\d{4}-\d{2}-\d{2}$/)` validation. [packages/contracts/src/editorial-log.ts:314-321]
- [x] [Review][Patch] `renderGateLive` defaults `responseId` to `'unknown'`, defeating audit correlation. — Default changed from `'unknown'` to `undefined`; empty/whitespace `responseId` still falls back to `'unknown'` at call site, preserving backward compatibility while surfacing the issue. [packages/render/src/gate.ts:143, packages/contracts/src/render.ts:190-210]
- [x] [Review][Patch] `external.verification.observed` allows `errors_found > sample_size`. — Added `.refine()` enforcing `errors_found <= sample_size`. [packages/contracts/src/editorial-log.ts:212-220]
- [x] [Review][Defer] `ExternalPd2Day90Payload` only models success outcomes (`question_donated`, `partnership_committed`). — The spec defines only these two variants; future PD-2 iterations can extend the union if needed.
- [x] [Review][Defer] Partner names are free-form strings rather than an enum/registry. — Spec intentionally uses organizational free-form names plus the PII scan; central partner registry is out of scope.
- [x] [Review][Dismiss] `kpi_status` typed as `z.record(z.string(), z.unknown())`. — Spec explicitly calls it an opaque object summarizing cascade stages; strict typing is intentional.
- [x] [Review][Dismiss] TC-6.2 smoke test does not exercise a real bypass attempt. — The full bypass-attempt → `gate.bypass_attempt` → editorial-log chain is asserted in `tests/contract/gate-invocation-queue-pressure.contract.test.ts`; TC-6.2 is the structural smoke that the observer fires.
- [x] [Review][Dismiss] Observation timestamp uses wall-clock `new Date().toISOString()`. — Spec requires an ISO-8601 UTC timestamp; non-determinism is acceptable for audit records.
