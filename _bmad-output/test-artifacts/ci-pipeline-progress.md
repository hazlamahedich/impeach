---
workflow: bmad-testarch-ci
mode: create
stepsCompleted: []
lastStep: 'step-01-preflight'
lastSaved: '2026-06-22'
status: 'halted-deferred'
haltReason: 'No source code or test framework — F1 scaffold not yet run'
resumeCondition: 'F1 scaffold complete (apps/, packages/, tools/ exist with real test configs)'
targetPlatform: 'github-actions'
inferredStackType: 'fullstack'
---

# CI/CD Pipeline Setup — Progress

## Step 1: Preflight (HALTED 2026-06-22)

### Run Result: ⛔ DEFERRED — user decision

Preflight halted at Step 3 (Verify Test Framework). No code or test configuration
exists in the repository; F1 scaffold has not been executed.

### Findings

| Check | Result | Evidence |
|---|---|---|
| 1. Git repo | ✅ pass | `.git/` present at project root; no remote configured (OK — optional per preflight) |
| 2. Stack type | ⚠️ inferred | No source to scan. Set `fullstack` from `project-context.md`: Next.js 15 App Router (frontend) + Fastify 5 (backend) + Python `tools/eval` + `tools/chaos` |
| 3. Test framework | ❌ fail | No `playwright.config`, `vitest.config`, `jest.config`, or `pyproject.toml` anywhere in tree. Step rule: HALT with "Run `framework` workflow first." |
| 4. Local tests | ❌ n/a | No `apps/`, `packages/`, `tools/`, `tests/`, or `scripts/` dirs. Nothing to execute. |
| 5. CI platform | ℹ️ resolved | None present. `ci_platform: auto` in `_bmad/tea/config.yaml`. Architecture (SEC-4) pins **GitHub Actions self-hosted isolated runner** → target `github-actions` |
| 6. Env context | ℹ️ pending | `.nvmrc`, `.python-version`, `uv.lock`, root `package.json` all awaiting F1 |

### Root Cause

Planning artifacts complete in `_bmad-output/planning-artifacts/` (architecture.md,
epics.md, ADRs, UX designs, implementation-readiness-report-2026-06-22.md), but
**F1 scaffold has not run**. `project-context.md` itself flags two open items
blocking F1: AGE version pin unverified, bge-m3 serving path unspecified.

### User Decision

**Defer until post-F1.** Workflow halted cleanly. Resume this workflow after
the F1 monorepo scaffold exists with real test configurations.

---

## Resume Checklist (post-F1)

When resuming, verify before re-running preflight:

- [ ] F1 scaffold complete: `apps/{api,web,ingest-worker,serve-worker,audit-worker,enqueuer}`, `packages/*`, `tools/{eval,chaos}` exist
- [ ] Root `package.json` with `packageManager: "pnpm@9.x.x"` exact, `engines.node: "22"`
- [ ] `.nvmrc` → 22, `.python-version` → 3.12.x, `uv.lock` committed at root
- [ ] `playwright.config.ts` (pinned 1.50.x), `vitest.config.ts` (pinned 2.x)
- [ ] `tools/eval/pyproject.toml` + `tools/chaos/pyproject.toml` under `uv`
- [ ] Custom Docker image built (PG16 + pgvector + AGE + pg_trgm + uuid-ossp), digest pinned, shared by `infra/docker-compose.yml` + Testcontainers
- [ ] `pnpm test` + `pnpm test:e2e` pass locally
- [ ] `uv run pytest` passes in `tools/eval` and `tools/chaos`
- [ ] Git remote configured (so PR-triggered CI runs have a host)

## Pre-loaded Decisions for Step 2 (Pipeline Generation)

These are locked by the architecture and project-context — Step 2 should apply
them without re-asking:

- **Platform:** GitHub Actions, self-hosted isolated runner (SEC-4). NOT on corpus/GPU workstation.
- **Auth:** OIDC ephemeral tokens ≤1h. No persistent sops keys on PR-triggered runs.
- **T1 shard abort:** defamation invariants abort the build on first failure (no point running T3 while T1 is red).
- **Stryker:** `concurrency: 1` for AC-11 hash-chain tests; thresholds `{high:100, low:100, break:100}` on `packages/render/gate.ts` + `packages/auth/verify.ts`.
- **Testcontainers:** digest-pinned custom PG image; `testcontainers.reuse.enable=true` dangerous for parallel suites — configure Ryuk + per-suite isolation.
- **Python isolation:** `tools/eval` and `tools/chaos` under `uv` with separate `uv.lock`; NOT part of pnpm workspace (STR-12).
- **Polyglot contract tests:** TS zod ↔ Python pydantic generated from one source via `datamodel-code-generator`; contract tests on both sides gate the build.
- **SEC-8 fixtures:** `FIXTURE_USE_ONLY` watermark + manifest SHA-256 asserted at test startup (legal-exposure requirement).
- **VAL-9:** OpenTelemetry span on `gate()` + collector (Tempo/Jaeger) in Testcontainers stack; assert `gate_span_count == served_response_count` under BullMQ backpressure.
- **Mutation (Python):** `mutmut` OR `cosmic-ray` on `tools/eval` (Stryker is TS-only) — non-negotiable for defamation-grade libel-injection evals.
- **Cache:** local-only Turborepo cache recompiles everything in CI; remote cache decision is an open ADR (Vercel remote likely disqualified by SEC-4 isolated runner).

## Recommended Next Workflows (in order)

1. Resolve the two F1 open items (AGE version pin per ADR-002; bge-m3 serving path)
2. Run F1 scaffold (`bmad-quick-dev` or the project's foundation workflow)
3. Run `bmad-testarch-framework` to initialize Playwright/Vitest/Testcontainers config
4. **Resume this workflow (`bmad-testarch-ci`)** — preflight should then pass
5. Then `bmad-testarch-atdd` → `bmad-testarch-automate` → `bmad-testarch-gate`
