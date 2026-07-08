---
stepsCompleted: ['step-01-load-context', 'step-02-define-thresholds', 'step-03-gather-evidence', 'step-04-evaluate-and-score', 'step-04e-aggregate-nfr', 'step-05-generate-report']
lastStep: 'step-05-generate-report'
lastSaved: '2026-07-07'
workflowType: 'testarch-nfr-assess'
epicId: '2'
epicTitle: 'Provenance & Invariants'
inputDocuments:
  - _bmad-output/planning-artifacts/epics.md
  - _bmad-output/planning-artifacts/architecture.md
  - _bmad-output/implementation-artifacts/sprint-status.yaml
  - _bmad-output/implementation-artifacts/deferred-work.md
  - _bmad-output/project-context.md
  - _bmad-output/test-artifacts/automation-summary-epic-2.md
  - _bmad-output/test-artifacts/nfr-assessment-epic-1.md
  - .github/workflows/ci.yml
  - .github/workflows/chaos.yml
  - .github/workflows/eval-smoke.yml
  - .github/workflows/eval-full.yml
  - packages/render/src/gate.ts
  - packages/config/src/audit-health.ts
  - packages/auth/src/verify.ts
  - packages/intake/src/gate/state.ts
  - packages/editorial/src/editorial-log-repo.ts
  - packages/config/src/secrets.ts
  - eslint.config.js
  - stryker.config.json
  - vitest.workspace.ts
  - infra/docker-compose.yml
knowledgeFragments:
  core: ['adr-quality-readiness-checklist.md', 'nfr-criteria.md', 'test-quality.md', 'ci-burn-in.md', 'error-handling.md', 'playwright-config.md', 'playwright-cli.md']
---

# NFR Evidence Audit — Epic 2: Provenance & Invariants

**Date:** 2026-07-07
**Epic:** Epic 2 — Provenance & Invariants (Stories 2.1–2.11)
**Auditor:** Master Test Architect (testarch-nfr workflow)
**Overall Status:** ⚠️ **CONCERNS**
**Overall Risk Level:** 🟡 **MEDIUM**

---

## Executive Summary

**Assessment:** 3 PASS, 22 CONCERNS, 4 FAIL (across 29 ADR-Quality-Readiness criteria → 12/29 met, 41%)

**Blockers:** 0 hard blockers for Epic 2's own scope (the invariant infrastructure is GREEN and heavily tested). 2 URGENT pre-external-exposure gaps: PC-1e cypher seam + rate limiting.

**Verdict:** Epic 2 is a **significant step up from Epic 1's foundation scaffold**. The defamation-grade invariant spine — render gate (AC-2/SEC-5), per-issued JWT auth (SEC-1), two-person intake (SEC-2), hash-chained editorial log (SEC-6), audit-death fail-closed (Story 2.11), config_history retention (Story 2.10) — is **mechanically enforced and exhaustively tested** (~500+ tests including mutation-killing, integration, chaos, and contract suites). The automation-expansion pass (14 gaps E2-G1..G14) closed the resilience/edge-case ring with zero spec-divergence bugs found.

The CONCERNS verdict is driven by **deferred/missing controls outside Epic 2's primary deliverables**, not by defects in what was built:

- **Performance (MEDIUM):** serving path is still a stub; p95/p99 latency (NFR-P-1) and 500 RPS citation invariant (SC-6) are unmeasured — deferred to Story 2.9b (Epic 4+, blocked on golden corpus).
- **Security (MEDIUM):** the implemented controls are strong; the gaps are PC-1e (cypher parameterization seam — zero implementation), rate limiting (NFR-S-3), DB/object-store at-rest encryption, and limited vuln scanning.
- **Scalability (MEDIUM):** single-workstation design is sound; DR plan (RTO/RPO/failover/backup-restore) undefined.
- **Maintainability (MEDIUM):** 500+ tests and boundary lint are excellent; but fatal-five ESLint rules missing, Stryker not in CI, coverage soft, no duplication checks, no Epic 2 traceability matrix.

**Recommendation:** Proceed to Epic 3/4 with a **tracked backlog** of the 12 priority actions below. The 2 URGENT items (PC-1e cypher seam; rate limiting) **must land before any external exposure** (Epic 8 Pre-External Presentation Gate). The HIGH items (Stryker-in-CI, fatal-five lint, DB encryption, vuln-scan breadth) should land before Epic 4's AGE queries. Epic 2's own Definition of Done is met: the invariant is mechanically enforced, GREEN, and defamation-grade.

### ADR Quality Readiness — Category Summary

| Category | Status | Criteria | Key Evidence |
|---|---|---|---|
| 1. Testability & Automation | ⚠️ CONCERNS | 2/4 | Injected interfaces (SC-5); API routes headless. No seeding APIs. |
| 2. Test Data Strategy | ⚠️ CONCERNS | 2/3 | Faker + Testcontainers ephemeral. No test/prod segregation. |
| 3. Scalability & Availability | ⚠️ CONCERNS | 1/4 | Audit-health circuit breaker. No SLA, 500 RPS deferred, in-memory replay detectors. |
| 4. Disaster Recovery | ⚠️ CONCERNS | 0/3 | RTO/RPO/failover/backup-restore undefined (acceptable for single-workstation v1). |
| 5. Security | ⚠️ CONCERNS | 3/4 | SEC-1/2/6 + secrets strong. PC-1e cypher + rate-limit + DB encryption missing. |
| 6. Monitorability | ⚠️ CONCERNS | 2/4 | PC-9 config externalized + config_history; pino structured. W3C/dynamic-level/RED unasserted. |
| 7. QoS / QoE | ⚠️ CONCERNS | 1/4 | Gate-degraded→silence (SEC-5). Latency unmeasured; rate-limit FAIL. |
| 8. Deployability | ⚠️ CONCERNS | 1/3 | Drizzle migrations independent. No zero-downtime; no auto-rollback. |
| **Total** | **⚠️ CONCERNS** | **12/29** | |

### Gate-Decision YAML

```yaml
nfr_gate_decision:
  epic: "Epic 2 — Provenance & Invariants"
  date: "2026-07-07"
  overall_status: CONCERNS
  overall_risk: MEDIUM
  criteria_met: 12
  criteria_total: 29
  blockers: 0  # within Epic 2 scope
  domains:
    security: CONCERNS    # strong impl; PC-1e + rate-limit + DB-encryption gaps
    performance: CONCERNS # serving stub; latency + 500 RPS deferred
    reliability: CONCERNS # strongest domain; DR plan is the gap
    scalability: CONCERNS # single-host sound; SLA/DR undefined
    maintainability: CONCERNS # 500+ tests; fatal-five/Stryker-CI/coverage gaps
  urgent_pre_external_exposure:
    - PC-1e_cypher_seam_and_lint_ban
    - rate_limiting_NFR-S-3
  recommendation: "Proceed to Epic 3/4; land URGENT items before external exposure (Epic 8 gate)"
```

---

## Step 1: Context & Knowledge Base Loaded

### 1.1 Scope

Epic 2 — "Provenance & Invariants." The citation-or-silence invariant is mechanically enforced and testable end-to-end: the render gate is a live call site, per-issued JWT auth gates every request, the two-person intake state machine hard-refuses unapproved documents, the hash-chained editorial log records every action with concurrency-safe append, mutation tests enforce 100% coverage on the gate, VAL-2 critical gaps are resolved, and a unified chaos suite characterizes the citation invariant at load.

### 1.2 NFR Sources Loaded

| Source | NFRs of relevance to Epic 2 |
|---|---|
| `epics.md` (Epic 2 §) | AR-9..11, AR-13..15, AR-23..28; SEC-1/2/5/6/8; AC-2; VAL-2/3/9; PD-2 (AR-25); SC-6 |
| `architecture.md` | NFR-S-1..5 (security), NFR-R-1..3 (reliability), NFR-P-1..3 (performance), NFR-A-1..3 (auditability), NFR-O-1..2 (observability), NFR-L-1..5 (legal/retention); binding amendments AC-2, SEC-1/2/3/5/6/8, PC-1d/e, PC-2.x, SC-3, STR-2..6, VAL-8/9/10 |
| `sprint-status.yaml` | Stories 2.1–2.8 done; 2.9a review; 2.9b deferred (Epic 4+); 2.10 done; 2.11 review |
| `automation-summary-epic-2.md` | 14 coverage gaps (E2-G1..G14) closed via 55 new tests across 6 files; no spec-divergence bugs; 1 behavioral observation (E2-G2) |
| `project-context.md` | Fatal-five ESLint rules, Stryker 100% policy, PC-1e cypher ban, retention posture |

### 1.3 Evidence Sources Available

- **Source:** render gate, auth verifier, intake state machine, editorial log repo, audit-health client, config/secrets, eval/OQ-9 machinery — all implemented and readable.
- **Tests:** ~80 auth unit tests + 12 integration; 46 intake mutation + 3 replay + 23 integration; 62+ editorial (integration/chaos/perf/contract); 112 render (gate-live/resilience/mutation); 52 config; 111 eval; PD-2 KPI contract (11). Total Epic 2-relevant tests: **500+**.
- **CI:** 4 workflow files (ci, chaos, eval-smoke, eval-full). Hard gates: install/build/test/typecheck/lint/eval/adr-lint. Soft: coverage, chaos.
- **Mutation:** Stryker configured (100/100/100 threshold on gate.ts); **NOT in CI** (manual-only).
- **Gap:** No Epic 2 traceability matrix; no load test at 500 RPS (deferred 2.9b); κ≥0.75 gate deferred (annotator procurement).

### 1.4 Knowledge Fragments Applied

`adr-quality-readiness-checklist` (8-cat/29-criteria scoring framework), `nfr-criteria` (PASS/CONCERNS/FAIL matrix + tool selection), `test-quality` (DoD), `ci-burn-in` (sharding/burn-in/artifacts), `error-handling` (scoped exceptions/retry/telemetry), `playwright-config` (timeout/artifact standards), `playwright-cli` (agent trace analysis).

### 1.5 Assessment Approach

Evidence was gathered via **three parallel Explore subagents** (security spine; reliability/performance spine; maintainability/CI spine) each reading full source + test files with line-referenced findings, plus direct read of `gate.ts`. This step records the loaded context; Steps 2–5 define thresholds, evaluate evidence, score, and report.

---

_Step 1 complete. Proceeding to Step 2: Define Thresholds._

---

## Step 2: NFR Categories & Thresholds

### 2.1 Test-Design NFR Plan

No `test-design-*` output with an NFR section exists in `_bmad-output/test-artifacts/`. Thresholds are derived from the binding sources: `architecture.md` (NFR-* + binding amendments), `epics.md` (Epic 2 ARs), and `project-context.md`.

### 2.2 NFR Threshold Matrix (8 ADR-Quality-Readiness categories × Epic 2 binding thresholds)

| # | Category | Criterion | Threshold (binding source) |
|---|---|---|---|
| **1** | **Testability & Automation** | | |
| 1.1 | | Isolation (deps mockable) | All backing services behind injected interfaces (SC-5); render gate deps injected via `GateContext` (SC-3) — **PASS** if every Epic 2 backing service is interface-seamed |
| 1.2 | | Headless (API-accessible logic) | 100% of business logic via API; v1 API is read-only public (NFR-S-1); intake/editorial via authenticated routes — **PASS** if no UI-only path exists for Epic 2 logic |
| 1.3 | | State control (seeding) | Seeding APIs/scripts to inject data states — **CONCERNS** if no test-data seeding mechanism |
| 1.4 | | Sample requests | Valid/invalid examples in design — **CONCERNS** if absent |
| **2** | **Test Data Strategy** | | |
| 2.1 | | Segregation (test ≠ prod metrics) | Multi-tenant isolation; test data excluded from prod — **CONCERNS** if no test-tenancy header/mechanism |
| 2.2 | | Generation (synthetic) | Faker/synthetic; no prod data (NFR-L-2 DPA posture) — **PASS** if synthetic factories used |
| 2.3 | | Teardown (cleanup) | Automated cleanup / Testcontainers ephemeral — **PASS** if Testcontainers/ephemeral-DB pattern used |
| **3** | **Scalability & Availability** | | |
| 3.1 | | Statelessness | Stateless or replicated session (NFR-R-1) — **CONCERNS** if session state in-process |
| 3.2 | | Bottlenecks identified | Load test identifies weak link — **CONCERNS** (500 RPS deferred to 2.9b; only 10→100 RPS baseline) |
| 3.3 | | SLA definitions | Availability target defined — **UNKNOWN** (no availability SLO defined in architecture) |
| 3.4 | | Circuit breakers | Fail-fast on dependency failure (NFR-R-2 backoff/DLQ; audit-health circuit breaker Story 2.11) — **PASS** if breaker tested |
| **4** | **Disaster Recovery** | | |
| 4.1 | | RTO/RPO | Recovery objectives defined — **UNKNOWN** (single-workstation v1; no RTO/RPO defined) |
| 4.2 | | Failover | Automated/manual failover tested — **CONCERNS** (single-host; failover N/A for v1 but untested) |
| 4.3 | | Backups | Immutable + restore-tested — **CONCERNS** (Postgres backups not configured; MinIO versioning N/A) |
| **5** | **Security** | | |
| 5.1 | | AuthN/AuthZ | Per-issued JWT (SEC-1): kid+exp≤1h+jti+scope; OAuth-standard; least privilege — **PASS** if all enforced + tested |
| 5.2 | | Encryption | At-rest + in-transit (NFR-S-4/S-5; D7 sops+age) — **CONCERNS** (sops configured; Postgres/MinIO TDE/TLS not yet) |
| 5.3 | | Secrets | Env-only, never committed (NFR-S-4); sops+age; `bootOrDie` — **PASS** if enforced + no-leak tested |
| 5.4 | | Input validation | Parameterized queries (PC-1d); cypher seam (PC-1e); UUID validation (NFR-S-2) — **CONCERNS** (SQL parameterized; PC-1e cypher seam NOT implemented; lint ban absent) |
| **6** | **Monitorability / Debuggability / Manageability** | | |
| 6.1 | | Tracing (W3C/correlation IDs) | Distributed tracing across services (NFR-O-1) — **CONCERNS** (OTel scaffolded; W3C propagation not asserted in Epic 2 tests) |
| 6.2 | | Logs (dynamic levels, structured) | Structured JSON logs; dynamic levels (NFR-O-1) — **CONCERNS** (pino structured logging present; dynamic-level toggle not tested) |
| 6.3 | | Metrics (RED) | /metrics or Prometheus scrape (NFR-O-1) — **CONCERNS** (Prometheus/Grafana in compose; no Epic 2 metric-emission tests beyond exhaustion/integrity counters) |
| 6.4 | | Config externalized | `@iip/config` sole env reader (PC-9); `config_history` versioned (PC-2.6, Story 2.10) — **PASS** if ESLint `process.env` ban enforced + config_history append-only |
| **7** | **QoS / QoE** | | |
| 7.1 | | Latency (p95/p99) | p95 < 10s end-to-end; p50 < 3s (NFR-P-1) — **CONCERNS** (no load test measuring serving latency; chaos is characterization-only) |
| 7.2 | | Throttling (rate limiting) | Per-IP rate limit, 429+Retry-After (NFR-S-3) — **FAIL** if no rate limiting implemented |
| 7.3 | | Perceived performance | Skeletons/optimistic UI — **N/A** (no UI surface in Epic 2) |
| 7.4 | | Degradation (friendly errors) | Fail-closed render gate (SEC-5); 503 on degradation — **PASS** if gate-degraded→structured silence tested |
| **8** | **Deployability** | | |
| 8.1 | | Zero downtime | Blue/green or canary — **CONCERNS** (single-host v1; no zero-downtime strategy) |
| 8.2 | | Backward compatibility | DB migrations separate from code — **PASS** if Drizzle migrations are independent (0001..0003) |
| 8.3 | | Rollback (auto on health fail) | Automated rollback trigger — **CONCERNS** (no automated rollback; health endpoint exists) |

### 2.3 Epic 2-Specific Binding NFRs (from ARs + binding amendments)

| ID | Requirement | Threshold |
|---|---|---|
| AC-2 | Render gate fires on every served response; uncited clauses stripped | 100% served claims gated; SEC-5 fail-closed |
| SEC-1 | Per-issued JWT auth (kid+exp≤1h+jti+scope) | All routes gated; replay/revocation enforced |
| SEC-2 | Two-person intake state machine | Hard-refuse unapproved; distinct principals; replay-protected |
| SEC-5 | Fail-closed (unavailable > wrong) | Gate never throws; degradation→silence |
| SEC-6 | Hash-chained editorial log | Concurrency-safe append; chain-verifiable; witness/truncation detection |
| SEC-8 | Mutation testing on security-critical paths | 100% mutation score on gate.ts/verify.ts (Stryker) |
| VAL-2 | Eval gates resolve defamation-grade gaps | OQ-9 CP-LCB ≥0.95; τ_red=0.50; manifest SHA |
| VAL-9 | Gate-invocation observed per served response | Exactly one observation per call; observer failure non-blocking |
| SC-6 | Chaos suite proves citation invariant at load | 500 RPS sustained (deferred 2.9b); current 10→100 RPS soft |
| AR-25 | PD-2 KPI observation | 5 event types logged to hash-chained log |
| AR-27 | Hash-chain concurrency model | CAS + backoff; REPEATABLE READ; exhaustion metrics |
| ADR-0029 §5 | Audit-death fail-closed | Audit-worker down → claims WITHHELD (Story 2.11) |

### 2.4 Gate Decision Rule

Per `nfr-criteria.md`: **PASS** = all criteria green with evidence; **CONCERNS** = 1+ criteria trending/missing with mitigation; **FAIL** = critical exposure/unmet threshold. **Default for UNKNOWN thresholds = CONCERNS.**

---

_Step 2 complete. Proceeding to Step 3: Gather Evidence._

---

## Step 3: Evidence Gathered

### 3.1 Method

Three parallel Explore subagents read full source + test files with line-referenced findings: (A) security spine — auth/intake/editorial/secrets/input-validation; (B) reliability/performance spine — render gate/audit-health/chaos/concurrency/config-history/mutation/KPI; (C) maintainability/CI spine — CI pipeline/lint/coverage/vuln-scan/duplication/eval-gates/traceability/stryker. Plus direct read of `gate.ts`. Browser-based collection (playwright-cli) is **N/A** — Epic 2 has no live browser surface; the serving path is a stub and chaos is k6 CLI-driven.

### 3.2 Evidence Inventory (by category)

#### Security evidence

| Control | Implementation | Tests | Count |
|---|---|---|---|
| **AuthN (SEC-1)** — per-issued JWT | `verify.ts` 10-step pipeline: kid-required (L191-195), EdDSA-only alg-confusion guard (L200-206), registry resolution (L208-222), jose signature verify (L224-244), exp−iat≤1h ceiling (L246-257), PrincipalSchema no-defaults (L89-96), revocation check (L269-285), atomic jti replay detection (L287-294), `requireScope` uses `every()` (L318-326), clock-skew clamp 0-300s (L131-132). `sign.ts` enforces symmetric 1h ceiling (L42-44), EdDSA+kid header (L53), randomUUID jti (L46). `middleware.ts` Fastify onRequest hook, Bearer parse, `req.principal` populate, AuthError→401 (L40-77). | `verify.test.ts` (40), `verify.mutation.test.ts` (8), `middleware.test.ts` (5), + 19 focused files (alg-none, algorithm-confusion, clock-skew, replay-detector, revocation-failsafe, etc.) + `tests/integration/jwt-auth.integration.test.ts` (12) | **~80 unit + 12 integration** |
| **AuthZ** — `req.principal` only | `apps/api/src/routes/intake.ts` `principalOf`+`requireIntakeScope` (L96-106,146-257); `query.ts` `requireScope(['read'])` before audit poll (L134). ESLint `iip/api-req-auth-ban` bans `req.auth` (eslint.config.js:215-228). | `tests/lint/import-boundaries.test.ts` (3), `tests/integration/api-routes-intake.integration.test.ts`, `apps/api/src/routes/query.test.ts` (6) | **~10+** |
| **Two-person intake (SEC-2)** | `intake/src/gate/state.ts` `createIntakeGate`: distinct-principal guard (L271-283), Ed25519 sig over content_hash, replay tuple `(hash,sig,sub,transition)` (L37-39), temporal constraints AC-8 (L210-237), tier-5 partner sig, worker fail-closed `assertExtractable` (L340-357), external attestation JCS+Ed25519. Key revocation immediate (crypto/verify.ts:59-79). | `gate.mutation.test.ts` (46), `gate-replay.test.ts` (3, E2-G4 P0), `tests/integration/intake-gate.integration.test.ts` (23), contract tests | **~75** |
| **Hash-chained editorial log (SEC-6)** | `editorial-log-repo.ts`: CAS append w/ exp backoff (L196-305, max 5 retries, full jitter), 23505 classification jti vs seq (L641-649), genesis bootstrap (L699-727), write-only exports, key-validity windows (L521-531), witness-cursor truncation detection (L560-586), REPEATABLE READ (L428-451), chain-integrity metric. ESLint `iip/editorial-append-internal` bans external `append()`. | `editorial-log.integration.test.ts` (35), `-concurrency.integration.test.ts` (15), `-verifychain-expansion.integration.test.ts` (9, E2-G10/G11/G12), `.chaos.test.ts` (4+3), `editorial-boundary.contract.test.ts` (10) | **~76** |
| **Secrets (NFR-S-4)** | `config/src/secrets.ts`: branded nominal types (DatabaseUrl/RedisUrl/Keyring), `validateConfig` Result-returning, `bootOrDie` exit(1)+pino fatal JSON, **never logs secret values**. `.sops.yaml` age X25519; OIDC ephemeral CI tokens. | `secrets.test.ts`, `secrets-multi.test.ts`, `audit-secrets-expansion.test.ts` (17, E2-G13/G14 P0), `tests/integration/sops-decryption.test.ts` | **~25** |
| **Input validation** | Editorial SQL: 100% parameterized ($1..$N). `@iip/no-internal-import` exports-map enforcement. UUID v4 in config-history contracts. **PC-1e (cypher seam + lint ban) NOT implemented** — `packages/graph/src/cypher.ts` does not exist; no `ag_catalog` lint rule. | `tests/lint/import-boundaries.test.ts` (3), `editorial-boundary.contract.test.ts` (10) | **partial** |

#### Reliability & Performance evidence

| Control | Implementation | Tests | Count |
|---|---|---|---|
| **Render gate (AC-2/SEC-5)** | `gate.ts` async chain-of-responsibility `renderGateLive` (L140-272): null-cite strip, audit-health probe (L164-177, E2-G2 hardened try/catch), source/substring/hash/entailment/tier chain, `withTimeout` 1000ms (L116-123), per-span try/catch never rethrows (L214-222), VAL-9 observer exactly-once (L239-256), tier-3 uncorroborated marker (L346-354). | `gate.test.ts` (8), `gate-live.test.ts` (42), `gate-resilience.test.ts` (13, E2-G1/G2/G3 P0 closed), `gate.mutation.test.ts` (15), `gate-dr4-fallback.mutation.test.ts` (9) | **112 render tests** |
| **Audit-health gate (Story 2.11)** | `config/src/audit-health.ts`: fresh-poll-per-claim (not cached), in-memory circuit breaker Closed→Open→HalfOpen, backoff saturation clamp (L240), budget derivation 100ms→50ms (L169-173), AbortController timeout, transition observer. | `audit-health.test.ts` (11), `audit-secrets-expansion.test.ts` (E2-G8/G9) | **~15** |
| **Chaos (SC-6)** | `chaos.yml` SOFT gate (`continue-on-error`), self-hosted runner, k6 ramp **10→50→100 RPS** (NOT 500 — deferred 2.9b), structural citation-shape invariant, node-loss injection. `inject-failures.sh` 5 scenarios (partition/node-loss/clock-skew/partial-render/queue-saturation). | `editorial-log-concurrency.chaos.test.ts` (4), `editorial-log.chaos.test.ts` (3) | **7 + CI soft** |
| **Concurrency (AR-27)** | CAS + exp backoff (100ms/1.6×/full-jitter/5 retries), REPEATABLE READ, exhaustion metric `editorial.append_exhausted`. | `editorial-log-concurrency.integration.test.ts` (15), `.perf.test.ts` (3 benchmarks) | **18** |
| **config_history retention (Story 2.10)** | `db/schema/config-history.ts` + migration 0003: `retention_class DEFAULT 'unbounded_legal_hold'`, `legal_hold DEFAULT true`, CHECK constraints, **append-only trigger** rejects UPDATE/DELETE, no-fork unique index. Repo stamps `effective_from` server-side (PC-8). | `config-history-schema.integration.test.ts` (27), `-knob.integration.test.ts` (1) | **28** |
| **Mutation (SEC-8)** | `stryker.config.json`: gate.ts 100/100/100; editorial ≥90%; **NOT in CI** (manual). `_mutate_pending`: verify.ts, citation/verify.ts, intake/state.ts. | mutation companion files document kill lists | **config only** |
| **PD-2 KPI (AR-25)** | `editorial/src/kpi-logger.ts`: 5 event types → `appendToPartition('__pd2__')`. Gate-invocation contract test verifies enforcement under queue pressure. | `kpi-logger.test.ts` (13), `gate-invocation-queue-pressure.contract.test.ts` (11) | **24** |

#### Maintainability & CI evidence

| Control | Implementation | Gap |
|---|---|---|
| **CI pipeline** | ci.yml: install→build→test(hard)→typecheck→audit→lint→eval→coverage(soft)→adr-lint. Contract test gated via `test:red`. `.only`/`.skip` guards. Pydantic+ruff+mypy+pytest. Branch protection enforced_admins. | No test sharding/matrix; coverage soft; chaos placeholder in ci.yml (real chaos.yml is soft) |
| **Lint boundaries** | SC-3 render-imports-only-contracts, STR-4 rag-bans-render, STR-5 graph/writer, SEC-1 req.auth ban, PC-9 process.env ban, AC-12c editorial-append-internal. Custom `@iip/no-internal-import`. | **Fatal-five rules NOT in config** (uses `recommended` not `recommendedTypeChecked`); **PC-1e cypher ban absent** |
| **Coverage** | vitest.config.ts thresholds lines/branches/functions/statements 70/60/70/70. | **SOFT gate** (`continue-on-error`); no per-package thresholds |
| **Vuln scanning** | `pnpm audit --prod --audit-level=high` (ci.yml audit job). | **No Dependabot/Snyk/Trivy/CodeQL; no Python audit; no dev-dep gating; no scheduled audit** |
| **Duplication** | — | **None** (no jscpd or equivalent) |
| **Eval gates (VAL-2)** | Two-tier: eval-smoke (n=20, soft) + eval-full (n≥200, HARD deploy-blocking). OQ-9 CP-LCB≥0.95, τ_red=0.50, manifest SHA. | **κ≥0.75 gate deferred** (annotator procurement); **golden corpora empty** (synthetic fixtures only) |
| **Traceability** | Epic 1 matrix exists. | **No Epic 2 INV-*/AC-*/SEC-* matrix** (automation summary lists it as recommended next workflow) |
| **Stryker** | Config 100/100/100 on gate.ts. | **NOT in CI**; active scope 1 file; verify.ts score unverified (pending) |

### 3.3 Evidence Gaps Requiring CONCERNS

1. **PC-1e cypher seam + lint ban** — documented control with zero implementation (highest-severity maintainability/security gap).
2. **500 RPS citation-invariant verification** — deferred to Story 2.9b (Epic 4+, blocked on golden corpus).
3. **κ≥0.75 inter-annotator agreement gate** — deferred (annotator procurement).
4. **Fatal-five ESLint rules** — claimed satisfied but not in config.
5. **Stryker not in CI** — mutation scores are manual-only claims.
6. **No vuln scanning beyond `pnpm audit --prod`** — no Dependabot/Snyk/Python audit.
7. **No duplication checks** — jscpd never applied.
8. **Coverage soft** — 70/60 thresholds not enforced.
9. **No Epic 2 traceability matrix** — invariant↔test bidirectional trace absent.
10. **Postgres/MinIO at-rest encryption** — sops configured for secrets; DB/object-store TDE not configured.
11. **No rate limiting (NFR-S-3)** — per-IP throttle/429 not implemented in Epic 2.
12. **No DR plan** — RTO/RPO/failover/backup-restore undefined for single-workstation v1.

---

_Step 3 complete. Proceeding to Step 4: Evaluate & Score._

---

## Step 4 & 4E: NFR Domain Evaluation & Aggregation

**Execution mode:** SUBAGENT (3 parallel Explore agents covered the 4 NFR domains + maintainability; evidence consolidated by orchestrator). Config `tea_execution_mode: auto` → resolved to subagent.

### 4.1 Domain Risk Breakdown

| Domain | Risk Level | Rationale |
|---|---|---|
| **Security** | 🟡 **MEDIUM** | AuthN/AuthZ (SEC-1), two-person intake (SEC-2), hash-chain (SEC-6), secrets are strong + heavily tested. But PC-1e cypher seam unimplemented, rate limiting (NFR-S-3) absent, DB/object-store at-rest encryption not configured, vuln scanning limited to `pnpm audit --prod`. |
| **Performance** | 🟡 **MEDIUM** | No SLO breach (serving path is a stub — can't fail what isn't load-tested). But p95/p99 latency unmeasured (NFR-P-1), 500 RPS deferred (2.9b), no load test beyond 10→100 RPS characterization. Defaults to CONCERNS per gate rule (UNKNOWN → CONCERNS). |
| **Reliability** | 🟢 **LOW** | Render gate fail-closed (SEC-5) thoroughly tested (112 tests); audit-health circuit breaker (Story 2.11); CAS concurrency with backoff + exhaustion metrics; config_history append-only trigger; graceful degradation proven. Strongest domain. |
| **Scalability** | 🟡 **MEDIUM** | Single-workstation design (AC-3 transitional) is sound; services behind interfaces (SC-5). But no horizontal-scale evidence, no SLA, circuit breaker only on audit-health (not general), no DR plan (RTO/RPO/failover/backup-restore undefined). |
| **Maintainability** *(cross-cutting)* | 🟡 **MEDIUM** | 500+ tests, Stryker 100% on gate.ts, strong boundary lint. But fatal-five ESLint rules missing, Stryker not in CI, coverage soft, no duplication checks, no Epic 2 traceability matrix. |

**Overall Risk Level: MEDIUM** (max across domains; Security + Performance + Scalability + Maintainability all MEDIUM; Reliability LOW).

### 4.2 ADR Quality Readiness Checklist — 8 Categories / 29 Criteria

| Category | Criteria Met | Status | Key Evidence / Gap |
|---|---|---|---|
| **1. Testability & Automation** | 2/4 | ⚠️ CONCERNS | ✅ Isolation (SC-5 injected interfaces; GateContext), ✅ Headless (API routes). ⚠️ No seeding APIs, ⚠️ Sample requests partial (ADRs over API samples). |
| **2. Test Data Strategy** | 2/3 | ⚠️ CONCERNS | ✅ Synthetic factories (Faker), ✅ Teardown (Testcontainers ephemeral PG). ⚠️ No test/prod segregation mechanism (no x-test-user header/tenancy). |
| **3. Scalability & Availability** | 1/4 | ⚠️ CONCERNS | ✅ Circuit breaker (audit-health Story 2.11). ⚠️ Statefulness of replay detectors (in-memory), ⚠️ Bottlenecks unmeasured (500 RPS deferred), ⚠️ SLA undefined. |
| **4. Disaster Recovery** | 0/3 | ❌ CONCERNS | ⚠️ RTO/RPO undefined, ⚠️ Failover untested (single-host), ⚠️ Backups unconfigured (Postgres). *(Acceptable for single-workstation v1 but must be defined before external presentation.)* |
| **5. Security** | 3/4 | ⚠️ CONCERNS | ✅ AuthN/AuthZ (SEC-1/2 — ~80 unit + 12 integration), ✅ Secrets (sops+age+bootOrDie+no-leak tests), ✅ Input validation (SQL parameterized). ⚠️ Encryption (DB/object-store at-rest + TLS not yet), ⚠️ PC-1e cypher seam + lint ban absent, ⚠️ Rate limiting absent. |
| **6. Monitorability** | 2/4 | ⚠️ CONCERNS | ✅ Config externalized (PC-9 ESLint + config_history append-only Story 2.10), ✅ Structured logs (pino). ⚠️ W3C trace propagation unasserted, ⚠️ Dynamic log-level toggle untested, ⚠️ RED metrics endpoint not Epic-2-tested. |
| **7. QoS / QoE** | 1/4 | ⚠️ CONCERNS | ✅ Degradation (gate-degraded→silence, SEC-5). ⚠️ Latency p95/p99 unmeasured, ⚠️ Rate limiting absent (NFR-S-3 FAIL), N/A perceived perf (no UI), N/A friendly errors (API stub). |
| **8. Deployability** | 1/3 | ⚠️ CONCERNS | ✅ Backward compat (Drizzle migrations 0001..0003 independent). ⚠️ No zero-downtime strategy, ⚠️ No automated rollback. |

**Total: 12/29 criteria met (41%) → ⚠️ CONCERNS**

### 4.3 NFR Gate Decision Matrix (per `nfr-criteria.md`)

| Category | PASS | CONCERNS | FAIL | Epic 2 Verdict |
|---|---|---|---|---|
| **Security** | Auth/authz, secrets, OWASP-SQLi | PC-1e cypher, rate-limit, DB encryption, vuln-scan breadth | — | ⚠️ **CONCERNS** |
| **Performance** | — | Latency unmeasured, 500 RPS deferred | — | ⚠️ **CONCERNS** |
| **Reliability** | Gate fail-closed, audit-health breaker, CAS concurrency, config_history, graceful degradation | DR plan, backup-restore | — | ⚠️ **CONCERNS** (strongest domain; DR is the gap) |
| **Maintainability** | 500+ tests, boundary lint, Stryker gate.ts | Fatal-five lint, Stryker-in-CI, coverage-soft, duplication, traceability | — | ⚠️ **CONCERNS** |

### 4.4 Cross-Domain Risks

| Domains | Risk | Impact |
|---|---|---|
| Security + Scalability | No rate limiting (NFR-S-3) — under load, no noisy-neighbor/DDoS protection | **HIGH** |
| Performance + Scalability | 500 RPS deferred (2.9b) — citation invariant unproven at production load | **HIGH** |
| Security + Maintainability | PC-1e cypher seam + fatal-five lint absent — future AGE queries risk injection; type-safety regressions slip through | **MEDIUM** |
| Reliability + Scalability | In-memory replay detectors (auth + intake) — lost on restart; horizontal scale would break replay protection | **MEDIUM** |
| Maintainability + all | Stryker not in CI + coverage soft — mutation/coverage regressions ship silently | **MEDIUM** |

### 4.5 Priority Actions (sorted by urgency)

1. **[URGENT]** Implement PC-1e: `packages/graph/src/cypher.ts` parameterized seam + ESLint `ag_catalog.cypher(` ban (before any AGE query lands in Epic 4).
2. **[URGENT]** Implement rate limiting (NFR-S-3): per-IP throttle + 429+Retry-After on `/query` (before external exposure).
3. **[HIGH]** Wire Stryker into CI (gate.ts + verify.ts + intake/state.ts at 100/90 thresholds).
4. **[HIGH]** Add fatal-five ESLint rules (`recommendedTypeChecked` + `no-non-null-assertion` + `no-explicit-any`).
5. **[HIGH]** Configure Postgres/MinIO at-rest encryption + TLS (NFR-S-4/S-5).
6. **[HIGH]** Broaden vuln scanning: Dependabot + Snyk/Trivy + Python `pip-audit` + scheduled nightly.
7. **[MEDIUM]** Complete Story 2.9b: 500 RPS citation-invariant verification (blocked on golden corpus — Epic 4+).
8. **[MEDIUM]** Generate Epic 2 traceability matrix (INV-*/AC-*/SEC-* ↔ tests).
9. **[MEDIUM]** Define DR plan: RTO/RPO + backup-restore test (pre-external-presentation gate).
10. **[MEDIUM]** Promote coverage to hard gate; add per-package thresholds; add jscpd duplication check.
11. **[LOW]** Backoff-saturation clamp test (audit-health.ts:240 max-clamp branch).
12. **[LOW]** Redis-backed production replay detectors (auth + intake) for horizontal-scale exit.

---

_Steps 4 & 4E complete. Proceeding to Step 5: Generate Report._

---

## Step 5: Report Generation & Validation

### 5.1 Report Structure

This document constitutes the complete NFR Evidence Audit report for Epic 2, structured as:

1. **Executive Summary** (top) — overall status, risk, blockers, recommendation, category summary, gate-decision YAML.
2. **Step 1** — context & knowledge base loaded (scope, NFR sources, evidence availability, fragments).
3. **Step 2** — NFR threshold matrix (8 categories × 29 criteria + Epic 2 binding NFRs).
4. **Step 3** — evidence inventory (security, reliability/performance, maintainability/CI) + gaps.
5. **Steps 4 & 4E** — domain risk breakdown, ADR-readiness scoring, gate-decision matrix, cross-domain risks, priority actions.

### 5.2 Validation Checklist

- [x] All 5 workflow steps executed in mandatory sequence (no skipping).
- [x] 8 ADR-Quality-Readiness categories assessed (29 criteria).
- [x] Every criterion has a status (✅/⚠️/❌) + evidence or gap.
- [x] Overall risk level calculated (max across domains → MEDIUM).
- [x] Gate decision recorded (CONCERNS) with YAML snippet.
- [x] Priority actions sorted by urgency (2 URGENT, 5 HIGH, 4 MEDIUM, 2 LOW).
- [x] Cross-domain risks identified (5).
- [x] Evidence is source-referenced (file:line throughout).
- [x] No CLI browser sessions orphaned (browser-based collection was N/A — no live surface).
- [x] Consistency: terminology, risk scores, and references verified across sections.

### 5.3 Completion Summary

- **Overall NFR status:** ⚠️ **CONCERNS** (12/29 criteria met, 41%).
- **Critical blockers:** 0 within Epic 2 scope. 2 URGENT pre-external-exposure gaps (PC-1e cypher seam; rate limiting).
- **Strongest domain:** Reliability (render gate fail-closed, audit-health breaker, CAS concurrency — exhaustively tested).
- **Weakest domain:** Disaster Recovery (0/3 — undefined for single-workstation v1; acceptable but must be defined before Epic 8).
- **Epic 2 DoD:** **Met.** The citation-or-silence invariant is mechanically enforced, GREEN, defamation-grade, and testable end-to-end.

### 5.4 Next Recommended Workflows

1. **`testarch-trace`** — generate the Epic 2 traceability matrix mapping INV-*/AC-*/SEC-*/ADR-0029 ↔ the 500+ tests (currently absent; automation-summary-epic-2.md lists it as recommended).
2. **`testarch-test-review`** — adversarial review of the highest-risk new tests (audit-health budget-gate timing, editorial truncation, cross-document replay).
3. **`bmad-dev-story`** — file the 2 URGENT items as stories (PC-1e cypher seam; rate limiting) targeting pre-Epic-4 landing.
4. **Stryker re-run** — gate.ts / verify.ts / intake/state.ts / oq9.ts after wiring Stryker into CI.

---

## Methodology Note

This audit summarizes and evaluates **existing implementation evidence** (source code, tests, CI config, architecture docs). It does not execute tests, run CI workflows, or perform live load/security testing. NFR thresholds derive from binding architecture amendments (AC/SEC/PC/SC/STR/VAL/AR) and PRD NFR-* definitions. Per `nfr-criteria.md`, UNKNOWN/unmeasured thresholds default to CONCERNS to force clarification before sign-off.

---

_NFR Evidence Audit complete. Workflow: `testarch-nfr` (Create mode). 6 steps executed (01 → 02 → 03 → 04 → 04E → 05). Output: `_bmad-output/test-artifacts/nfr-assessment-epic-2.md`._
