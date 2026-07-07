---
story_id: '2.11'
story_key: '2-11-serving-path-audit-health-gate'
epic: 'Epic 2: Provenance & Invariants'
status: backlog
last_updated: '2026-07-07'
baseline_commit: 'a7a8f90b8d0a3a03da1846903dc78890b1d06ce9'
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

Status: backlog

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

- [ ] **Task 1: Implement Audit Health Client in @iip/config**
  - [ ] Create `packages/config/src/audit-health.ts` — health-check client for audit-worker.
  - [ ] Implement `pollAuditHealth(): Promise<HealthStatus>` — HTTP GET `audit-worker:port/healthz` with configurable timeout (default: 50ms).
  - [ ] Implement `HealthStatus` type: `{ healthy: boolean, latencyMs: number, lastChecked: Date, error?: string }`.
  - [ ] Implement circuit-breaker state machine: `Closed → Open → HalfOpen → Closed`.
  - [ ] Store circuit-breaker state in-memory (per-process, no Redis dependency — circuit-breaker must work when Redis is down).
  - [ ] Export `getAuditHealth(): HealthStatus` and `getCircuitBreakerState(): CircuitState`.

- [ ] **Task 2: Wire Fail-Closed into API /query Route**
  - [ ] Modify `apps/api/src/routes/query.ts` — add pre-handler hook that calls `getAuditHealth()` before processing `/query`.
  - [ ] If `healthy === false` or circuit-breaker is Open: return `503` with structured body `{ error: "degraded", reason: "audit_offline", message: "..." }`.
  - [ ] If `healthy === true` and circuit-breaker is Closed: proceed with normal claim serving.
  - [ ] Non-claim routes (`/search`, `/healthz`) skip the fresh poll (use advisory cache only).
  - [ ] Add `audit.circuit_breaker.opened` / `audit.circuit_breaker.closed` editorial log entries via `AuthEventLogger` or equivalent.

- [ ] **Task 3: Extend Render Gate with Audit-Health Check**
  - [ ] Modify `packages/render/src/gate.ts` — add audit-health check to the gate's citation-support verification.
  - [ ] If circuit-breaker is Open: treat as citation-support failure → WITHHOLD claim.
  - [ ] Read circuit-breaker state from `@iip/config` (single source of truth — render gate does NOT independently poll).
  - [ ] Add unit test: render gate WITHHOLDs when circuit-breaker is Open.
  - [ ] Verify existing render gate tests (96 tests) remain GREEN (backward-compatible — audit-health check is additive).

- [ ] **Task 4: Implement Web Degraded State**
  - [ ] Modify `apps/web` — add degraded state component for audit-offline.
  - [ ] When `/query` returns 503 with `reason: "audit_offline"`, render: "IIP cannot reach its audit services right now. No claims are being served — this is a safety measure, not an error."
  - [ ] Use `aria-live="assertive"` (UX-DR56).
  - [ ] Search-only functionality remains available (document listing without extracted claims).

- [ ] **Task 5: Write Integration Test — Audit-Death Fail-Closed**
  - [ ] Create `tests/integration/audit-health-gate.integration.test.ts`.
  - [ ] Test 1: Happy path — audit-worker healthy, `/query` returns 200 with claims.
  - [ ] Test 2: Kill audit-worker → `/query` returns 503 within 100ms.
  - [ ] Test 3: `/search` continues to return 200 (non-claim path).
  - [ ] Test 4: Restart audit-worker → circuit-breaker Half-Open → Closed → `/query` resumes.
  - [ ] Test 5: Editorial log records `audit.circuit_breaker.opened` and `audit.circuit_breaker.closed`.
  - [ ] Test 6: Fresh poll exceeds 100ms budget → fail-closed.
  - [ ] Test 7: Advisory cache is NOT used for claim-serving (stale cache → still fail-closed).
  - [ ] Use Testcontainers with real Docker Compose processes.

- [ ] **Task 6: Update ADR-0029 Open Question OQ-29.6**
  - [ ] Mark OQ-29.6 as RESOLVED in `docs/adr/0029-6-process-blast-radius-matrix.md`.
  - [ ] Add implementation reference: "Implemented in Story 2.11 — `packages/config/src/audit-health.ts` + `apps/api/src/routes/query.ts`."
  - [ ] Update ADR-0029 §5 with implementation details (circuit-breaker state machine, 100ms budget, advisory cache).

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

*(Pending — story is backlog)*

### Debug Log References

- None.

### Completion Notes List

- * (Pending development)

### File List

- `packages/config/src/audit-health.ts` (NEW)
- `apps/api/src/routes/query.ts` (MODIFY)
- `packages/render/src/gate.ts` (MODIFY)
- `apps/web/...` (MODIFY — degraded state component)
- `tests/integration/audit-health-gate.integration.test.ts` (NEW)
- `docs/adr/0029-6-process-blast-radius-matrix.md` (MODIFY — OQ-29.6 resolved)

## QA Results

*(Pending development & code review)*
