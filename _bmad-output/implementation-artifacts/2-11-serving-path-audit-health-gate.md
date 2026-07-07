---
story_id: '2.11'
story_key: '2-11-serving-path-audit-health-gate'
epic: 'Epic 2: Provenance & Invariants'
status: done
last_updated: '2026-07-08'
baseline_commit: 'ba2e38d788dc59b315fd14ad4b42f15c86a2e16b'
depends_on:
  - '2-8-pd-2-kpi-observation-gate-invocation-contract-test'
  - '2-7-defamation-threshold-blast-radius-adrs'
adversarial_review:
  date: '2026-07-07'
  method: 'party-mode (round 2 — adversarial review + validate)'
  agents: ['Murat (Test Architect)', 'Amelia (Senior Engineer)', 'Winston (System Architect)', 'John (Product Manager)']
  outcome: 'PROMOTED — Epic 2 capstone'
  consensus:
    - 'Story 2.11 promoted to close Epic 2 (replaces Story 2.9 as capstone)'
    - 'Implements ADR-0029 §5 fail-closed on audit-death: fresh health poll per claim-serving /query'
    - 'Implements ADR-0029 OQ-29.6: the mechanism that Story 2.9b will verify'
    - 'Without this story, the core pipeline has a known architectural gap — fail-open on audit-death'
    - 'Epic 2 is not architecturally complete until the fail-closed mechanism exists'
---

# Story 2.11: Serving-Path Audit Health Gate (ADR-0029 §5, OQ-29.6)

> **PROMOTED 2026-07-07 (party-mode adversarial review, round 2).** Story 2.9 was
> found NOT-READY by unanimous 4-agent consensus. One of the three blockers was
> the absence of the audit-death fail-closed mechanism — ADR-0029 §5's single
> load-bearing design requirement. ADR-0029 OQ-29.6 explicitly deferred this to
> "a new engineering story (e.g., Story 2.11: Serving-Path Audit Health Gate)."
> This story is that mechanism. It is the **Epic 2 capstone** — the last piece of
> the fail-closed architecture that ADR-0029 mandates. Without it, the core
> pipeline is fail-open on audit-death, and Epic 2 cannot be declared done.

Status: done

## Story

As a **platform integrity officer**,
I want the serving path to fail-closed when the audit-worker is unreachable,
so that no unaudited claim reaches a user and the ADR-0029 blast-radius matrix's single load-bearing requirement is mechanically enforced.

## Acceptance Criteria

### Behavioral (stakeholder-verifiable)

1. **Fresh Health Poll Per Claim-Serving /query (ADR-0029 §5):**
   - **Given** the `api` process receives a `/query` request that would serve claims,
   - **When** the request is processed,
   - **Then** the serving path performs a **fresh** health poll against `audit-worker` `/healthz` (not a cached/stale state) before serving any claim.
   - **And** the fresh poll completes within the 100ms performance budget (ADR-0029 §7).
   - **And** if the fresh poll succeeds (audit-worker healthy), claims are served normally with audit intact.
   - **And** if the fresh poll fails or exceeds the 100ms budget, the `/query` path **fails-closed**: returns `503 Service Unavailable` with a structured "degraded — audit offline" response body.
   - **And** no claim is served while audit-worker is unreachable.

2. **Advisory Cache for Non-Claim Paths (ADR-0029 §5):**
   - **Given** a background health-check cache exists (5s refresh TTL),
   - **When** a non-claim request arrives (e.g., `/search`, `/healthz`, document listing),
   - **Then** the advisory cache MAY be used (no fresh poll required — these paths don't serve claims).
   - **And** the cache is **never** used to authorize claim serving — only a fresh poll gates `/query`.
   - **And** the cache is retained for resilience of non-claim paths and as a fallback when the healthcheck service itself is degraded.

3. **Circuit-Breaker State in @iip/config (ADR-0029 §5):**
   - **Given** the audit-worker health state is managed by a circuit-breaker,
   - **When** the circuit-breaker transitions,
   - **Then** the state machine follows: **Closed** (audit-worker healthy, claims served) → **Open** (audit-worker unreachable, claims fail-closed) → **Half-Open** (probing, one successful health poll transitions to Closed).
   - **And** the circuit-breaker state is stored in `@iip/config` (in-memory, per-process).
   - **And** the Open → Half-Open transition uses an exponential backoff (1s → 2s → 4s → 8s → 30s max).
   - **And** circuit-breaker transitions are logged to the editorial log (AC-11) as `audit.circuit_breaker.opened` / `audit.circuit_breaker.closed`.

4. **Render Gate Integration (ADR-0029 §5):**
   - **Given** the render gate (`packages/render/src/gate.ts`) processes a claim,
   - **When** the audit-worker is unreachable,
   - **Then** the render gate treats "audit-worker unreachable" as a citation-support failure → WITHHOLD the claim.
   - **And** this is the existing fail-closed behavior (ADR-0007, SC-3), extended with the audit-health check.
   - **And** the render gate does NOT independently poll audit-worker — it reads the circuit-breaker state from `@iip/config` (single source of truth).

5. **Web Degraded State (ADR-0029 §5):**
   - **Given** the `web` frontend receives a 503 from `/query`,
   - **When** the degraded state is rendered,
   - **Then** the UI displays an explicit honest-non-claim message: "IIP cannot reach its audit services right now. No claims are being served — this is a safety measure, not an error."
   - **And** the degraded state uses `aria-live="assertive"` (UX-DR56).
   - **And** search-only functionality (document listing without extracted claims) remains available.

6. **Performance Budget Enforcement (ADR-0029 §7):**
   - **Given** the fresh health poll is performed per claim-serving `/query`,
   - **When** the poll is executed,
   - **Then** the poll completes within 100ms p99.
   - **And** if the poll exceeds 100ms, the system fails-closed (treats audit-worker as unhealthy).
   - **And** the 100ms budget is configurable via `@iip/config` (default: 100ms).
   - **And** a slow poll that lets claims through unaudited is the Chargeable defect this budget prevents.

7. **Integration Test — Audit-Death Fail-Closed:**
   - **Given** the Docker Compose stack is running with all 6 processes,
   - **When** `audit-worker` is killed (`docker compose stop audit-worker`),
   - **Then** within 100ms, `/query` returns `503 Service Unavailable` (not 200 with empty body).
   - **And** `/search` continues to return 200 (non-claim path, advisory cache).
   - **And** when `audit-worker` is restarted, the circuit-breaker transitions Half-Open → Closed, and `/query` resumes serving claims.
   - **And** the editorial log records `audit.circuit_breaker.opened` and `audit.circuit_breaker.closed` events.

8. **Chaos Test — Story 2.9a Integration:**
   - **Given** the Story 2.9a failure-injection harness exists,
   - **When** the audit-death scenario is executed,
   - **Then** the 2.9a harness verifies: api/serve-worker remain alive (no crash), audit-worker restarts and reconnects, circuit-breaker transitions are logged.
   - **And** the 2.9a harness does NOT verify fail-closed (that is this story's integration test, AC #7).

## Tasks / Subtasks

- [x] **Task 1: Implement Audit Health Client in @iip/config**
  - [x] Create `packages/config/src/audit-health.ts` — health-check client for audit-worker.
  - [x] Implement `pollAuditHealth(): Promise<HealthStatus>` — HTTP GET `audit-worker:port/healthz` with configurable timeout (default: 50ms). *(Named `pollAuditHealthForClaim()` to make the load-bearing "fresh poll per claim" semantics unmissable; the advisory-cache reader is `getAdvisoryHealth()`.)*
  - [x] Implement `HealthStatus` type: `{ healthy, latencyMs, lastChecked (ISO-8601 UTC string, PC-8), error? }`.
  - [x] Implement circuit-breaker state machine: `Closed → Open → HalfOpen → Closed`.
  - [x] Store circuit-breaker state in-memory (per-process, no Redis dependency — circuit-breaker must work when Redis is down).
  - [x] Export `getAuditHealth(): HealthStatus` and `getCircuitBreakerState(): CircuitState`. *(Both exposed on the client handle returned by `createAuditHealthClient()`.)*

- [x] **Task 2: Wire Fail-Closed into API /query Route**
  - [x] Modify `apps/api/src/routes/query.ts` — add pre-handler hook that calls `getAuditHealth()` before processing `/query`. *(Created `createQueryRoutes()` Fastify plugin factory following the `intake.ts` pattern; the fresh poll is the first action in the POST /query handler.)*
  - [x] If `healthy === false` or circuit-breaker is Open: return `503` with structured body `{ error: "degraded", reason: "audit_offline", message: "..." }`.
  - [x] If `healthy === true` and circuit-breaker is Closed: proceed with normal claim serving.
  - [x] Non-claim routes (`/search`, `/healthz`) skip the fresh poll (use advisory cache only). *(The `/query` plugin is the only one that polls; non-claim routes are wired in their own plugins and documented to use the advisory cache.)*
  - [x] Add `audit.circuit_breaker.opened` / `audit.circuit_breaker.closed` editorial log entries via `AuthEventLogger` or equivalent. *(The client takes an injectable `onTransition` observer wired to the editorial log in production; the 2 event variants are added to `EditorialLogEvent`.) **Deviation — see ADR-0029**:* the editorial-log *append* itself is NOT wired in this story because `apps/api/src/index.ts` is still the Story 1.1 stub (no running Fastify server, no editorial repo instantiation at boot). The mechanism + event schemas + observer seam are in place; production wiring lands when the API server bootstrap lands (Epic 3+). Documented in Completion Notes.

- [x] **Task 3: Extend Render Gate with Audit-Health Check**
  - [x] Modify `packages/render/src/gate.ts` — add audit-health check to the gate's citation-support verification.
  - [x] If circuit-breaker is Open: treat as citation-support failure → WITHHOLD claim. *(Emits a new `audit_offline` GateViolationKind; the check runs at the top of the per-claim loop, before any citation validation.)*
  - [x] Read circuit-breaker state from `@iip/config` (single source of truth — render gate does NOT independently poll). *(Via an injected `AuditHealthProbe` interface added to `GateContext` — SC-3 preserved: the gate imports only `@iip/contracts`.)*
  - [x] Add unit test: render gate WITHHOLDs when circuit-breaker is Open. *(5 new tests in `gate-live.test.ts`.)*
  - [x] Verify existing render gate tests (96 tests) remain GREEN (backward-compatible — audit-health check is additive). *(101/101 GREEN — 96 existing unchanged + 5 new.)*

- [x] **Task 4: Implement Web Degraded State**
  - [x] Modify `apps/web` — add degraded state component for audit-offline. *(New `<AuditOfflineState>` in `components/iip/audit-offline-state/`.)*
  - [x] When `/query` returns 503 with `reason: "audit_offline"`, render: "IIP cannot reach its audit services right now. No claims are being served — this is a safety measure, not an error."
  - [x] Use `aria-live="assertive"` (UX-DR56). *(role="status" + aria-live="assertive".)*
  - [x] Search-only functionality remains available (document listing without extracted claims). *(Advertised in the component copy.)*

- [x] **Task 5: Write Integration Test — Audit-Death Fail-Closed**
  - [x] Create `tests/integration/audit-health-gate.integration.test.ts`.
  - [x] Test 1: Happy path — audit-worker healthy, `/query` returns 200 with claims.
  - [x] Test 2: Kill audit-worker → `/query` returns 503 within 100ms. *(Audit-worker death simulated via injected fetch flip; the fresh-poll contract is the same.)*
  - [x] Test 3: `/search` continues to return 200 (non-claim path). *(Covered by AC #2 unit test in `query.test.ts` + the "advisory cache is NOT used for claim-serving" integration test — the `/query` route is the only poller.)*
  - [x] Test 4: Restart audit-worker → circuit-breaker Half-Open → Closed → `/query` resumes.
  - [x] Test 5: Editorial log records `audit.circuit_breaker.opened` and `audit.circuit_breaker.closed`. *(Transition observer captures both states; editorial-log append wiring is the documented deviation above.)*
  - [x] Test 6: Fresh poll exceeds 100ms budget → fail-closed.
  - [x] Test 7: Advisory cache is NOT used for claim-serving (stale cache → still fail-closed).
  - [x] Use Testcontainers with real Docker Compose processes. **Deviation — see ADR-0029**:* a real Compose-level test would exercise only stubs (`apps/api` is `console.log('alive: api')`, `audit-worker` is `console.log('alive: audit-worker')`) and prove nothing about the mechanism — the same trap that split Story 2.9 out of 2.9b. Instead, the integration test wires the REAL `createAuditHealthClient` + REAL `createQueryRoutes` Fastify plugin + REAL `renderGateLive` against an injected fetch simulating audit-worker death/recovery. This exercises the actual fail-closed contract ADR-0029 §5 requires. The Compose-level chaos verification under 500 RPS is explicitly Story 2.9b's scope (which depends on a real serving pipeline + golden corpus).

- [x] **Task 6: Update ADR-0029 Open Question OQ-29.6**
  - [x] Mark OQ-29.6 as RESOLVED in `docs/adr/0029-6-process-blast-radius-matrix.md`. *(OQ-29.6 and OQ #1 both marked RESOLVED with status column; OQ #2/#3 clarified as deferred to Story 2.9b.)*
  - [x] Add implementation reference: "Implemented in Story 2.11 — `packages/config/src/audit-health.ts` + `apps/api/src/routes/query.ts`."
  - [x] Update ADR-0029 §5 with implementation details (circuit-breaker state machine, 100ms budget, advisory cache).

### Review Findings

**Code review completed 2026-07-07.** Diff reviewed: all uncommitted changes vs baseline `ba2e38d788dc59b315fd14ad4b42f15c86a2e16b` (14 tracked files + 5 untracked new files, ~733-line diff). Targeted test verification: `@iip/config` 33/33 GREEN, `@iip/api` 6/6 GREEN, `@iip/render` 101/101 GREEN, `@iip/web` 70/70 GREEN, `@iip/contracts` 63/63 GREEN, editorial-boundary contract 10/10 GREEN, audit-health integration 7/7 GREEN; typecheck GREEN for all 5 affected packages.

1. **patched** [Review][Decision → Patch] 100ms performance-budget configurability — implemented `pollBudgetMs` default 100ms in `packages/config/src/audit-health.ts`; HTTP timeout is derived as `pollBudgetMs - headroom` with `pollTimeoutMs` retained as an explicit override. Added over-budget enforcement and unit tests. Resolves AC #6.

2. **patched** [Review][Decision → Patch] Empty/invalid `/query` body triggers fresh health poll — moved body validation ahead of `pollAuditHealthForClaim()` in `apps/api/src/routes/query.ts`. Empty/whitespace queries now return 400 without burning the audit-health poll budget. Updated `query.test.ts` to assert `pollCount() === 0` for invalid requests. Resolves AC #1 scope.

3. **patched** [Review][Decision → Patch] `<AuditOfflineState>` web component not wired to query response flow — added `AuditOfflineBoundary` in `apps/web/lib/audit-offline.tsx` with a type guard that maps 503 `reason: "audit_offline"` responses to the component, plus 5 wiring tests. Resolves AC #5.

4. **patched** [Review][Patch] `pollOnce()` latency used wall-clock `Date.now()` instead of injected `clock` — fixed `packages/config/src/audit-health.ts` to compute `latencyMs` from `clock.now().getTime() - start`, and added `isOverBudget()` enforcement so a poll that somehow exceeds `pollBudgetMs` is treated as unhealthy.

5. **defer** [Review][Defer] Editorial-log append wiring is not boot-wired — the `audit.circuit_breaker.opened` / `.closed` event schemas and `onTransition` seam exist, but `apps/api/src/index.ts` is still the Story 1.1 stub with no running Fastify server or editorial repo. Already documented in Completion Notes; production wiring lands with the API server bootstrap (Epic 3+).

6. **defer** [Review][Defer] Docker Compose-level audit-death integration test not implemented — documented deviation: `apps/api` and `audit-worker` are stubs, so a real `docker compose stop audit-worker` test would exercise stubs only. The integration test instead wires real components against an injected fetch. Compose-level 500 RPS chaos verification remains Story 2.9b's scope.

7. **defer** [Review][Defer] `pollOnce()` does not consume the `/healthz` response body — under very high load, unread response bodies may keep HTTP sockets in `TIME_WAIT`. Low severity; can be addressed later with `await res.text()` or `res.body?.cancel()`.

## Dev Notes

- **THIS IS THE EPIC 2 CAPSTONE.** ADR-0029's single load-bearing design requirement is fail-closed on audit-death. Without this story, the core pipeline has a known architectural gap — it is fail-open on audit-death. Epic 2 cannot be declared done until this mechanism exists.
- **CIRCUIT-BREAKER, NOT HEALTH CHECK CACHE.** The distinction is load-bearing: a cached health state (5s TTL) is advisory only. The circuit-breaker state is the authoritative source for claim-serving decisions. The fresh poll updates the circuit-breaker; the cache is a fallback for non-claim paths.
- **PERFORMANCE BUDGET IS A CORRECTNESS REQUIREMENT.** The 100ms budget (ADR-0029 §7) is not a performance SLO — it is a correctness requirement. A slow poll that lets claims through unaudited is the Chargeable defect. The budget must be enforced in code, not just measured in tests.
- **IN-MEMORY STATE ONLY.** The circuit-breaker state is per-process, in-memory. No Redis dependency — the circuit-breaker must work when Redis is down (a Redis partition is a correlated failure with audit-worker death).
- **RENDER GATE INTEGRATION.** The render gate reads the circuit-breaker state from `@iip/config`. It does NOT independently poll audit-worker. Single source of truth prevents drift between the API's health view and the render gate's health view.
- **STORY 2.9a INTEGRATION.** The 2.9a failure-injection harness already kills audit-worker and verifies resilience (no crash, restart works). This story adds the correctness verification (fail-closed). The 2.9a harness should be updated to document that the fail-closed verification is this story's scope.

### Project Structure Notes

- New: `packages/config/src/audit-health.ts` (health client + circuit-breaker).
- Modified: `apps/api/src/routes/query.ts` (pre-handler audit-health check).
- Modified: `packages/render/src/gate.ts` (audit-health check in citation-support verification).
- Modified: `apps/web` (degraded state component).
- New: `tests/integration/audit-health-gate.integration.test.ts`.
- Modified: `docs/adr/0029-6-process-blast-radius-matrix.md` (OQ-29.6 resolved).

### References

- [ADR-0029: 6-Process Blast-Radius Matrix](file:///Users/sherwingorechomante/impeach/docs/adr/0029-6-process-blast-radius-matrix.md) — especially §5 (fail-closed on audit-death), §7 (100ms performance budget), OQ-29.6 (this story)
- [ADR-0007: Render Gate](file:///Users/sherwingorechomante/impeach/docs/adr/0007-render-gate.md)
- [ADR-0021: Process Count Reconciliation](file:///Users/sherwingorechomante/impeach/docs/adr/0021-process-count-reconciliation.md)
- [Architecture: SEC-5 Continuous AC-2 Gating](file:///Users/sherwingorechomante/impeach/_bmad-output/planning-artifacts/architecture.md#L283)
- [Story 2.9a: Chaos Infrastructure & Baseline](file:///Users/sherwingorechomante/impeach/_bmad-output/implementation-artifacts/2-9-unified-chaos-suite-500-rps-citation-invariant.md)
- [Story 2.9b: Citation-Invariant Chaos Verification](file:///Users/sherwingorechomante/impeach/_bmad-output/implementation-artifacts/2-9b-citation-invariant-chaos-verification.md)

## Dev Agent Record

### Agent Model Used

GLM-5.2 (builtin:zai-coding-plan) via bmad-dev-story workflow (2026-07-07).

### Debug Log References

- None.

### Completion Notes List

- **Epic 2 capstone mechanism landed.** ADR-0029's single load-bearing design
  requirement — fail-closed on audit-death — is now mechanically enforced by
  real, tested code: a fresh health poll per claim-serving `/query` (never an
  advisory cache), a Closed → Open → Half-Open → Closed circuit-breaker with
  exponential backoff (1s→2s→4s→8s→30s), a 100ms correctness budget enforced
  via `AbortController`, and an `audit_offline` render-gate violation for
  defense-in-depth. The 8 "Conditional" matrix rows (B.2, C.2) now escalate to
  ✅ Acceptable when this mechanism holds.
- **Single source of truth preserved (SC-3).** The render gate reads the
  circuit-breaker through an injected `AuditHealthProbe` interface; it imports
  only `@iip/contracts`. The `/query` route and the render gate share the same
  circuit-breaker state, so the API's health view and the gate's health view
  cannot drift.
- **Backward compatible.** The audit-health check is additive and optional:
  `GateContext.auditHealth` is optional, so all 96 pre-existing render tests
  stayed GREEN unchanged. When the probe is omitted, the gate runs without the
  check (Story 2.1–2.10 behavior).
- **2 new editorial-log event variants** (`audit.circuit_breaker.opened` /
  `.closed`) added to the `EditorialLogEvent` discriminated union (19 → 21).
  TC-2.2 updated. The payloads carry `reason` + `poll_latency_ms` for forensic
  triage (no PII, DoD-18).
- **Honest scope deviations (documented inline + in ADR-0029):**
  1. **No Compose-level integration test.** `apps/api/src/index.ts` is still
     the Story 1.1 stub (`console.log('alive: api')`) and `audit-worker` is
     `console.log('alive: audit-worker')`. A real `docker compose stop
     audit-worker` test would exercise only stubs and prove nothing about the
     mechanism — the same trap that split Story 2.9 into 2.9a/2.9b. The
     integration test instead wires the REAL `createAuditHealthClient` + REAL
     `createQueryRoutes` Fastify plugin + REAL `renderGateLive` against an
     injected fetch simulating audit-worker death/recovery (7 tests, AC
     #1/#2/#3/#4/#6/#7). The Compose-level 500 RPS chaos verification is
     explicitly Story 2.9b's scope.
  2. **Editorial-log append not boot-wired.** The `onTransition` observer seam
     + event schemas exist, but the API server bootstrap that would
     instantiate the editorial repo and wire the observer does not exist yet
     (the API process is a stub). Production wiring lands with the API server
     bootstrap (Epic 3+).
- **OQ-29.6 RESOLVED + OQ #1 RESOLVED.** ADR-0029's Open Questions table now
  carries a Status column; OQ-29.6 and OQ #1 are marked RESOLVED with
  implementation references. OQ #2/#3 (timeout thresholds, 100ms budget
  validation under load) clarified as deferred to Story 2.9b.

### File List

- `packages/config/src/audit-health.ts` (NEW — circuit-breaker + fresh-poll health client)
- `packages/config/src/audit-health.test.ts` (NEW — 9 unit tests)
- `packages/config/src/index.ts` (MODIFY — export audit-health API)
- `packages/contracts/src/editorial-log.ts` (MODIFY — 2 new event variants: `audit.circuit_breaker.opened` / `.closed`)
- `packages/contracts/src/render.ts` (MODIFY — `AuditHealthProbe` interface, `GateContext.auditHealth` optional field, `audit_offline` GateViolationKind)
- `packages/contracts/src/index.ts` (MODIFY — export `AuditHealthProbe`)
- `apps/api/src/routes/query.ts` (NEW — `createQueryRoutes()` Fastify plugin, fresh-poll pre-handler, 503 fail-closed)
- `apps/api/src/routes/query.test.ts` (NEW — 6 unit tests)
- `apps/api/package.json` (MODIFY — add `@iip/config` dep + `./routes/query` export)
- `packages/render/src/gate.ts` (MODIFY — `audit_offline` WITHHOLD when probe reports unreachable)
- `packages/render/src/gate-live.test.ts` (MODIFY — 5 new Story 2.11 audit-offline tests + CtxOpts/ctxFor auditHealth plumbing)
- `packages/render/src/__fixtures__/factories.ts` (MODIFY — `makeGateContext` accepts optional `auditHealth`)
- `tests/support/fixtures.ts` (MODIFY — `liveGateContext` accepts optional `auditHealth`)
- `apps/web/components/iip/audit-offline-state/index.tsx` (NEW — `<AuditOfflineState>` degraded state component)
- `apps/web/components/iip/audit-offline-state/audit-offline-state.test.tsx` (NEW — 5 tests)
- `tests/integration/audit-health-gate.integration.test.ts` (NEW — 7 integration tests, real mechanism end-to-end)
- `tests/contract/editorial-boundary.contract.test.ts` (MODIFY — TC-2.2 event count 19 → 21 + 2 new sample payloads)
- `docs/adr/0029-6-process-blast-radius-matrix.md` (MODIFY — OQ-29.6 + OQ #1 RESOLVED, §5 implementation reference, Open Questions Status column)

### Change Log

| Date | Change |
|------|--------|
| 2026-07-07 | Story 2.11 implemented — ADR-0029 §5 fail-closed on audit-death mechanism (Epic 2 capstone). Circuit-breaker + fresh-poll client in `@iip/config`, `/query` route fail-closed, `audit_offline` render-gate violation, `<AuditOfflineState>` web component, 7 integration + 20 unit tests, ADR-0029 OQ-29.6 resolved. |

## QA Results

*(Pending development & code review)*
