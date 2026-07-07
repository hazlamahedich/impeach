# Perf Baseline — Compose Stack

**Created:** 2026-06-28
**Source:** Epic 2 Prep Sprint TD5 (baseline smoke), extended by Story 2.9a (saturation ramp).
**Scripts:** `tools/chaos/chaos-suite.js` (Story 2.9a — supersedes the TD5 `baseline-smoke.js`).

## Purpose

Reference point for the compose stack's baseline performance. Two layers:

1. **TD5 baseline smoke (Story 1.11):** a 50 RPS / 30s measurement of the
   `/healthz` path to confirm the stack sustains connections. Recorded once at
   Epic 2 kickoff.
2. **Story 2.9a saturation ramp:** a 10 → 50 → 100 RPS phased ramp that
   identifies the **saturation point** — the RPS at which p99 latency exceeds
   10s or error rate exceeds 1% (AC #2). Characterization only (soft gate);
   the hard gate at 500 RPS is Story 2.9b.

> **Note on the stack today:** app services are Story 1.1 process stubs. The
> baseline measures the **stack** (Caddy + compose + container orchestration +
> `/healthz`), NOT application throughput. The 2.9a saturation ramp is the
> load-characterization contract; numbers fill in as the serving path matures.

## Methodology — TD5 baseline smoke

- **Endpoint:** `GET /healthz` (Caddy reverse proxy → 200 respond)
- **Rate:** 50 RPS constant-arrival-rate
- **Duration:** 30 seconds
- **Tool:** k6 (`tools/chaos/chaos-suite.js`, formerly `baseline-smoke.js`)

## Methodology — Story 2.9a saturation ramp

- **Endpoints:** `GET /healthz` + `POST /query` (alternating, per VU)
- **Executor:** `ramping-arrival-rate`, stages:
  - 10 RPS for 30s
  - 50 RPS for 30s
  - 100 RPS for 30s
- **Custom metrics (k6 Trend / Counter / Rate):**
  - `healthz_latency` (Trend, ms) — p50/p95/p99
  - `query_latency` (Trend, ms) — p50/p95/p99
  - `failed_requests` (Rate) — target ≤ 1%
  - `citation_field_present` (Rate) — structural INV-001 check
  - `degraded_served_as_503` (Rate) — SEC-5 fail-closed shape
  - `empty_body_200` (Counter) — contract violation
- **Saturation rule:** the smallest RPS at which **either** `p(99) >= 10000ms`
  **OR** `failed_requests rate >= 0.01` (AC #2 / AC #4).

## How to Run

```bash
# Start the compose stack
docker compose -f infra/docker-compose.yml up -d --wait

# TD5 baseline-style smoke (single-phase, /healthz only — for a quick sanity check,
# configure PHASE_DURATION and override stages in chaos-suite.js, or keep using
# the ramp which exercises the same /healthz path as a subset):
k6 run tools/chaos/chaos-suite.js

# Story 2.9a saturation ramp (default: 10 -> 50 -> 100 RPS, 30s each)
k6 run tools/chaos/chaos-suite.js

# Override the target URL
BASE_URL=http://localhost:3000 k6 run tools/chaos/chaos-suite.js

# Shorter phases for quick iteration
PHASE_DURATION=10s k6 run tools/chaos/chaos-suite.js
```

## TD5 Baseline Results (50 RPS /healthz)

> **Record results here after first run.**
>
> | Metric | Value |
> |--------|-------|
> | p50 latency | TBD |
> | p95 latency | TBD |
> | p99 latency | TBD |
> | Error rate | TBD |
> | Total requests | TBD |
>
> **Date measured:** TBD
> **Environment:** macOS, external exFAT drive, Docker Desktop
> **Notes:** TBD

## Story 2.9a Saturation Ramp Results

> **Record per-phase results after first run on a real (non-stub) serving path.**
>
> | Phase | RPS | healthz p99 (ms) | query p99 (ms) | error rate | citation_field_present rate |
> |-------|-----|------------------|----------------|------------|------------------------------|
> | 1 | 10  | TBD | TBD | TBD | TBD |
> | 2 | 50  | TBD | TBD | TBD | TBD |
> | 3 | 100 | TBD | TBD | TBD | TBD |
>
> **Saturation point (AC #2):** TBD RPS — first phase where `p(99) latency >= 10s`
> OR `error rate >= 1%`.
> **Date measured:** TBD
> **Environment:** TBD
> **SLO reference (ADR-0029 §7):** p99 healthz ≤ 100ms; render-path p99 ≤ 10s.

> **Why "TBD" is honest here:** on the Story 1.1 stub stack, `/query` is not
> routed (no Fastify handler yet) and `citation_field_present` will read ~0.00.
> Filling in numbers now would misrepresent the system. The 2.9a ramp is the
> **contract** for measuring saturation; numbers land with Epic 4's real serving
> path and are re-verified at Story 2.9b's 500 RPS target.

## Interpretation

- The TD5 baseline measures the `/healthz` path only (Caddy → respond 200). It
  does NOT exercise the API, render pipeline, or database.
- The 2.9a ramp exercises `/healthz` + `/query` (structural shape only). It
  detects regressions in the stack's ability to sustain connections AND the
  serving path's fail-closed shape (503-not-200-on-degrade, citation array
  presence on 200s).
- **Story 2.9b** will exercise the full citation-invariant path at 500 RPS on
  the frozen golden corpus and compare against this baseline. Semantic citation
  correctness (citations match source spans) is 2.9b scope.
