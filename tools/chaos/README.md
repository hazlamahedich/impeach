# tools/chaos — k6 chaos workspace (SC-6, ADR-0029)

Load generation (`k6` 0.50.x) and failure injection for the citation-or-silence
invariant (INV-001 / AC-2) under partial failure (ADR-0029).

> **STR-12 — NOT a pnpm workspace member.** This `package.json` is a **shim**:
> `"private": true`, **no dependencies**, scripts-only. The pnpm-workspace.yaml
> lists `apps/*` + `packages/*` ONLY. k6 is a Go binary invoked directly via
> Homebrew (`brew install k6`), `go install`, or the official installer — **NOT**
> `pnpm add k6` (k6 is not an npm package). An agent that "fixes" this by adding
> `tools/*` to `pnpm-workspace.yaml` will break `pnpm install`.

## Story 2.9a scope (SC-6, AC-2 — infrastructure/baseline)

This is **infrastructure + baseline characterization**, NOT full citation-invariant verification:

- **k6 load characterization:** 10 → 50 → 100 RPS ramp (30s per phase) against the local
  Docker Compose stack. Identifies the saturation point (p99 latency > 10s or error rate > 1%).
- **Structural response validation:** 200 responses have valid JSON shape with a `citations`
  array; 503s are returned (not 200-with-empty-body) when the serving path is degraded.
- **Failure-injection harness — resilience:** network partition, audit-worker node loss,
  clock-skew, serve-worker crash-stop, render-queue saturation. Asserts **resilience**
  (recover without corruption), NOT correctness (fail-closed on audit-death).
- **Soft CI gate:** failure of the chaos suite logs a warning, does NOT block merge.
  Hard gate deferred to Story 2.9b.

### Deferred to Story 2.9b (Epic 4+, blocked on golden corpus)

- Full 500 RPS citation-invariant verification on the frozen golden corpus (Epic 4).
- Semantic citation correctness (citations match source spans).
- Full ADR-0029 matrix coverage + SEC-8 red-team mapping.
- Hard CI gate (blocking merge on chaos failure).
- Audit-death fail-closed verification — depends on Story 2.11 (ADR-0029 §5, OQ-29.6).

## Prerequisites

### k6 binary (v0.50.x)

Install via one of:

```bash
# macOS
brew install k6

# Linux — official installer
sudo gpg -k && \
  sudo gpg --no-default-keyring --keyring /usr/share/keyrings/k6-archive-keyring.gpg --keyserver hkp://keyserver.ubuntu.com:80 --recv-keys C5AD17C747E3415A3642D57D77C6C491D6AC1D69 && \
  echo "deb [signed-by=/usr/share/keyrings/k6-archive-keyring.gpg] https://dl.k6.io/deb stable main" | sudo tee /etc/apt/sources.list.d/k6.list && \
  sudo apt update && sudo apt install k6

# Go install (any OS with Go toolchain)
go install go.k6.io/k6@v0.50.0
```

Verify:

```bash
k6 version   # must report v0.50.x
```

### Docker Compose stack

The chaos suite runs against the local compose stack. Start it before running k6:

```bash
docker compose -f infra/docker-compose.yml up -d --wait
```

### toxiproxy (failure injection — Subtask 3a)

Network-partition injection uses `toxiproxy`. The `inject-failures.sh` harness
will start a `toxiproxy` container on demand if not already running. Source of
truth for the client CLI: https://github.com/Shopify/toxiproxy.

## Usage

### Baseline load characterization (Task 2)

```bash
# 1. Start the compose stack
docker compose -f infra/docker-compose.yml up -d --wait

# 2. Run the baseline ramp (10 -> 50 -> 100 RPS, 30s each)
k6 run tools/chaos/chaos-suite.js

# 3. Override the target URL (default: http://localhost:8080 via Caddy)
BASE_URL=http://localhost:3000 k6 run tools/chaos/chaos-suite.js
```

k6 prints p50/p95/p99 latency + error rate per phase and reports threshold
breaches. Record the saturation point in `docs/ci/perf-baseline.md`.

### Failure-injection harness (Task 3)

```bash
# Run one scenario (see the script's --help for the full list):
./tools/chaos/inject-failures.sh partition
./tools/chaos/inject-failures.sh node-loss
./tools/chaos/inject-failures.sh clock-skew
./tools/chaos/inject-failures.sh partial-render
./tools/chaos/inject-failures.sh queue-saturation
```

Each scenario: injects the fault, asserts the resilience contract, heals the
fault, asserts recovery. Exit non-zero on contract violation. **None of these
verify fail-closed on audit-death** (Story 2.11 + 2.9b scope).

## k6 runtime constraints (load-bearing)

k6 runs on the **Goja** JavaScript runtime (ES2015 subset). This constrains what
the load scripts can do:

- **No `require()` / no Node APIs / no `Proxy` or `Reflect`.**
- **No external schema libraries** (Zod, ajv) — they depend on Node APIs.
- **No `async`/`await`** in handler contexts (k6's `default` function is synchronous;
  `http.*` calls block the VU).
- All response validation uses **`check()` with manual `JSON.parse()` + property
  traversal.** `check()` is k6's built-in assertion primitive.
- Custom metrics use **`Trend`, `Counter`, `Rate`** from `k6/metrics` (built-in).

## Files

| File | Purpose |
|------|---------|
| `chaos-suite.js` | k6 baseline load characterization (replaces `baseline-smoke.js`). |
| `inject-failures.sh` | Failure-injection harness (partition / node-loss / clock-skew / partial-render / queue-saturation). |
| `package.json` | STR-12 shim (private, no deps, `scripts.chaos` only). |

## References

- [ADR-0029: 6-Process Blast-Radius Matrix](../../docs/adr/0029-6-process-blast-radius-matrix.md)
- [ADR-0028: Numeric Defamation Threshold](../../docs/adr/0028-numeric-defamation-threshold.md)
- [Perf Baseline](../../docs/ci/perf-baseline.md)
- [Architecture: SC-6 Chaos at F1](../../_bmad-output/planning-artifacts/architecture.md)
