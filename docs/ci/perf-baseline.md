# Perf Baseline — Compose Stack

**Created:** 2026-06-28
**Source:** Epic 2 Prep Sprint TD5
**Script:** `tools/chaos/baseline-smoke.js`

## Purpose

Reference point for the compose stack's baseline performance before Epic 2 Story 2.9 (unified chaos suite at 500 RPS). This is a smoke measurement, not a load test.

## Methodology

- **Endpoint:** `GET /healthz` (Caddy reverse proxy → 200 respond)
- **Rate:** 50 RPS constant-arrival-rate
- **Duration:** 30 seconds
- **Tool:** k6 (`tools/chaos/baseline-smoke.js`)

## How to Run

```bash
# Start the compose stack
docker compose -f infra/docker-compose.yml up -d --wait

# Run the baseline
k6 run tools/chaos/baseline-smoke.js

# To override the target URL
BASE_URL=http://localhost:3000 k6 run tools/chaos/baseline-smoke.js
```

## Baseline Results

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

## Interpretation

- This baseline measures the `/healthz` path only (Caddy → respond 200). It does NOT exercise the API, render pipeline, or database.
- The purpose is to detect regressions in the stack's ability to sustain connections, not to measure application throughput.
- Story 2.9's 500 RPS chaos suite will exercise the full citation-invariant path and compare against this (and future) baselines.
