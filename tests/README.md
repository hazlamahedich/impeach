# IIP Test Suite

The Impeachment Intelligence Platform (IIP) test architecture — a defamation-grade
risk-weighted diamond (unit/contract → integration → E2E → eval/chaos/red-team),
where the eval/chaos apex carries **more risk-reduction than the unit base.

> Authority: AC-1 (eval = 8th architectural plane), AC-2 (render gate, fail-closed),
> SEC-2/SEC-3/SEC-5/SEC-6/SEC-8, VAL-9, PC-1a/PC-4/PC-9. See
> `_bmad-output/project-context.md` §Testing Rules for the full invariant ledger.

---

## Stack

| Layer | Framework | Scope |
|---|---|---|
| Unit / contract / component (TS) | **Vitest 2.x** | co-located `*.test.ts` + `tests/contract/` |
| Integration | **Testcontainers 10.16.0** | real PG+AGE+pgvector, MinIO, Redis via custom Docker image |
| Property | **fast-check 3.x** | AC-2 no-uncited-path, provenance depth-N |
| Mutation | **Stryker 8.x** | 100/100/100 on `gate.ts`/`verify.ts` |
| E2E (browser) | **Playwright 1.50.x** | operator surfaces (Story 3.7+) |
| Python eval | **pytest** (uv + ruff + mypy) | `tools/eval` polyglot bridge (ADR-014) |
| Chaos | k6 0.50.x + toxiproxy + Pumba | `tests/chaos/` (SC-6) |

## Setup

```bash
pnpm install                        # installs all workspace deps (Vitest, Playwright, etc.)
pnpm exec playwright install        # downloads chromium + firefox binaries for E2E
cp .env.example .env                # then edit secrets for local dev
pnpm compose:up                     # PG + Redis + MinIO + Ollama + Grafana (Docker Compose)
```

**Prerequisite:** Docker runtime running (Colima or OrbStack on Apple Silicon —
faster than Docker Desktop). The custom PG16+AGE+pgvector image is pinned by
digest in `.env.example` (`IIP_PG_AGE_VECTOR_IMAGE`).

## Running tests

### TS tests (Vitest)

```bash
pnpm test                           # smoke + contract + lint, then turbo run test (all packages)
pnpm test:coverage                  # with v8 coverage
pnpm test:red                       # the RED contract project (citation-or-silence)
pnpm test:integration               # Testcontainers suites (needs compose:up)
pnpm --filter @iip/<pkg> test       # single package
pnpm vitest run --project contract  # single root project
```

Vitest projects (see `vitest.workspace.ts`): `packages/*` (12 packages) +
root suites: `smoke`, `contract`, `contract-red`, `integration`, `lint`,
`support`, `perf`, `chaos`.

### E2E (Playwright)

```bash
pnpm test:e2e                       # headless (CI mode: retries=2, workers=1)
pnpm test:e2e:ui                    # interactive UI mode (local debugging)
TEST_ENV=local pnpm test:e2e        # explicit env
pnpm test:e2e:report                # open the HTML report after a run
```

Config: `playwright.config.ts` (root). Base URL via `PLAYWRIGHT_BASE_URL`
(default `http://localhost:3000`). Reuses a running dev server if present;
otherwise boots `pnpm --filter @iip/web dev`.

### Python eval (`tools/eval`)

```bash
pnpm py:test                        # pytest via uv
pnpm py:lint                        # ruff
pnpm py:typecheck                   # mypy (strict + pydantic plugin)
```

## Architecture overview

### Test factories — `packages/test-utils/src/factories/`

Factory functions (`makeSource(overrides)`, `makeDocument(overrides)`,
`makeIngestionJob(overrides)`, ...) produce complete, valid objects with
deterministic defaults and explicit overrides. Brand-bypass helpers
(`asSourceId`, `asContentChecksum`, ...) wrap `Schema.parse()` to produce
branded nominal types without the runtime cost of full validation on every
field. Mirrors the production zod schemas 1:1.

| Factory | Domain | Rules |
|---|---|---|
| `intake.ts` | SEC-2 two-person gate (principal, keypair, signature, document) | SEC-2, DoD-5/6 |
| `config-history.ts` | config_history rows | PC-2.6, PC-9 |
| `source.ts` | `sources` table (FR-1.1) | FR-1.1, SEC-3, EI-8 |
| `document.ts` | `documents` table (FR-1.3, FR-1.5) | FR-1.3, FR-1.5, PC-1a, AC-4 |
| `ingestion-job.ts` | `ingestion_jobs` table (FR-1.6) | FR-1.6, PC-2.4, NFR-R-1/2/3 |

### Helpers — `tests/support/helpers/`

Pure functions (no framework dependency) for contract/integration tests.
- `ingest.ts` — `makeValidSourceId()`, `makeValidContentChecksum(seed?)`,
  `makeValidJobId(seed?)`, `makeInvalidUuid()`, `makeInvalidHex()`. Each returns
  values matching (or violating) the branded zod schemas.

### Fixtures & page objects — `tests/support/fixtures/`, `tests/support/page-objects/`

- `tests/support/fixtures.ts` — defamation-spine fixture module.
- `tests/support/fixtures/` — Playwright fixture composition
  (`mergeTests` pattern from the fixture-architecture playbook).
- `tests/support/page-objects/` — Playwright page objects (Story 3.7 fills these).

## Best practices

**Selectors:** prefer `data-testid` (resilient to DOM/styling churn). Avoid
CSS-class or text-based selectors in E2E. See `selector-resilience` knowledge
fragment.

**Isolation:** every factory returns fresh UUIDs/timestamps by default
(parallel-safe). Tests that need determinism pass explicit overrides
(`id`, `created_at`). No shared mutable state between tests.

**Cleanup:** Vitest auto-cleans in-process; integration tests use
Testcontainers' Ryuk for container teardown. E2E tests rely on per-test browser
contexts (Playwright default).

**Determinism contract (lint-enforced):** no real clocks (inject `FakeTime`);
no `setTimeout`-based waits in Playwright (auto-waiting only); no real network
outside testcontainers/VCR; no `Date.now()` in assertions.

**Citations in comments:** every test file carries a `@rules`/`@adr` JSDoc tag
linking to the binding amendment it exercises (PC-5). Divergences use the exact
form `// diverges — see ADR-NNNN` (em-dash load-bearing).

## CI integration

- **PR gate (<8 min):** Vitest unit + contract + Playwright smoke (5 scenarios
  max) + Stryker on changed files only + fast-check property + SEC-8 smoke.
  Never full RAGAS/chaos/Inspect/Stryker-100.
- **Nightly (<90 min):** full RAGAS + DeepEval + Inspect + red-team + golden
  corpus + Stryker full (100/100/100 on `gate.ts`/`verify.ts`) + chaos-lite.
- **PD-3 release gate:** see `_bmad-output/test-artifacts/traceability/`.
- Runner: GitHub Actions self-hosted, **isolated** (SEC-4).

## Knowledge base references

TEA knowledge fragments live in
`.agents/skills/bmad-testarch-framework/resources/knowledge/`. The load-bearing
ones for this monorepo:

- `fixture-architecture.md` — pure function → fixture → `mergeTests` pattern.
- `data-factories.md` — factory-with-overrides, API-first seeding.
- `playwright-config.md` — env map, timeout standards, artifact policy.
- `test-levels-framework.md` — unit vs integration vs E2E decision matrix.
- `test-priorities-matrix.md` — P0–P3 criteria + coverage targets.
- `contract-testing.md` — PactV4 determinism (when Pact is enabled).
- `ci-burn-in.md` — staged jobs, shard orchestration, flake budget.
