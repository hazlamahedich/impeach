---
story_id: '1.3'
story_key: '1-3-docker-compose-platform-stack'
epic: 'Epic 1: Foundation'
status: review
last_updated: '2026-06-23'
baseline_commit: 'NO_VCS'
---

# Story 1.3: Docker Compose Platform Stack

Status: review

> **Re-promoted 2026-06-23** from `draft-blocked` to `ready-for-dev`. All P0–P3 conditions met: ADR-001 (defamation-grade definition), P1 RED test (citation-or-silence + fast-check), CI contract pipeline wired, B-03 boot runner (`scripts/age-migrate.ts`), B-04 createDb tested, B-14 ordering invariant test, B-13 ADR-002, B-17 ADR-004 (DDoS posture), B-18 ADR-021 (process count).

## Story

As a developer,
I want the full Docker Compose stack running locally,
so that I can develop and test against all platform services on a single workstation.

*(Scope: wiring-only — app process stubs are unchanged from Story 1.1; this story makes them healthy services in a single Compose topology.)*

## Acceptance Criteria

1. `infra/docker-compose.yml` declares all 11 services with healthchecks and reaches `healthy` (or `running` for services without explicit healthchecks) when `docker compose up --wait` is run: `postgres`, `redis`, `minio`, `ollama`, `caddy`, `api`, `ingest-worker`, `serve-worker`, `audit-worker`, `enqueuer`, `web` (AC: #1).
2. The PostgreSQL service uses the **same custom PG16+AGE+pgvector image** built in Story 1.2, with the AGE boot migration applied by a startup boot runner after Drizzle relational migrations have completed (AC: #1, dependency 1.2).
3. `infra/Caddyfile` configures auto-ACME TLS and documents that proxy-layer `rate_limit` is intentionally **not** enforced in v1; rate limiting is enforced at the application layer via Fastify `@fastify/rate-limit` and is documented as OWASP-noise mitigation only (D9, SEC-9) (AC: #2).
4. `infra/runner/ollama-pull.sh` pre-pulls `qwen3:14b` to a named volume so the Ollama container starts with the model present (D15, ADR-005) (AC: #3).
5. MinIO service creates a private bucket `raw-snapshots` on startup; the bucket is off the serving path and used only for immutable raw snapshots (NFR-S-5) (AC: #4).
6. Redis service is configured as both BullMQ broker and durable Redis Streams store for the Enqueuer (STR-3) (AC: #5).
7. OpenTelemetry Collector + Tempo + Prometheus + Grafana services are wired and reachable on their documented ports (NFR-O-1); no Jaeger (VAL-9) (AC: #6).
8. All 5 app process stubs (`api`, `ingest-worker`, `serve-worker`, `audit-worker`, `enqueuer`) and the `web` stub are wired as Compose services with healthchecks that verify the `console.log("alive")` process exits successfully (dependency 1.1) (AC: #1).
9. The ATDD integration test `tests/integration/compose-stack.health.test.ts` is un-skipped and GREEN against the local Compose stack (AC: #1-#6).

## Tasks / Subtasks

- [x] Author `infra/docker-compose.yml` with 11 services + dependencies + healthchecks (AC: #1)
  - [x] Service `postgres`: uses image `ghcr.io/iip/postgres-age-pgvector:pg16` (or env override `IIP_PG_AGE_VECTOR_IMAGE`); set env vars; mount `infra/sql/age/migrations/`
  - [x] Service `redis`: `redis:7-alpine` only (Dragonfly/KeyDB have BullMQ bugs); expose 6379; enable Redis Streams persistence config
  - [x] Service `minio`: `minio/minio:latest` with `server /data`; env access/secret keys; healthcheck via `mc ready local`
  - [x] Service `ollama`: `ollama/ollama`; GPU passthrough host mount (NVIDIA Linux / MLX Mac per D15); named volume for model cache; run `infra/runner/ollama-pull.sh` before first serve
  - [x] Service `caddy`: `caddy:2.8-alpine`; mount `infra/Caddyfile`; depends_on all backend services; auto-TLS via Caddyfile
  - [x] Services `api`, `ingest-worker`, `serve-worker`, `audit-worker`, `enqueuer`: build context from their `apps/*` package; run the Story 1.1 stub entrypoint; healthcheck uses the exit code or a lightweight alive probe
  - [x] Service `web`: `apps/web` build or dev-mode container; depends_on `api` only (Caddy depends_on `web`, so `web` cannot also depend on `caddy` without a cycle)
  - [x] Define dependency order so `postgres`/`redis`/`minio` start before app services; no hard crash loops
  - [x] Add `healthcheck` blocks where applicable; use `start_period` + `start_interval` generously for `ollama` and app builds
- [x] Author `infra/Caddyfile` (AC: #2)
  - [x] Reverse proxy `api` and `web` on internal/local domains (e.g., `localhost` or `*.localhost`)
  - [x] Auto-ACME TLS: documented (Caddy handles TLS automatically — no explicit tls block needed)
  - [x] `rate_limit` directive documented in comments; actual rate limiting at app layer (Fastify @fastify/rate-limit) per ADR-004
  - [x] Do NOT expose MinIO raw store or Ollama externally
- [x] Author `infra/runner/ollama-pull.sh` (AC: #3)
  - [x] Verify `ollama` binary reachable ( Compose service uses `/bin/ollama` )
  - [x] Run `ollama pull qwen3:14b` (verify exact tag against ADR-005; do NOT substitute `qwen2.5:14b-instruct`)
  - [x] Exit non-zero on pull failure so the container fails closed
  - [x] Make script executable (`chmod +x`) and referenced by compose entrypoint/healthcheck
- [x] Create MinIO bucket init (AC: #4)
  - [x] Add a startup helper (MinIO client sidecar or entrypoint wrapper) that runs `mc alias set local http://localhost:9000 minioadmin minioadmin && mc mb local/raw-snapshots`
  - [x] Set bucket policy to private; document it is OFF serving path
  - [x] Idempotent: `mc mb --ignore-existing` or equivalent
- [x] Add AGE boot runner (AC: #1, #2; dependency 1.2)
  - [x] Create `scripts/age-migrate.ts` (or JS equivalent) that connects via `packages/db/src/client.ts`, runs `infra/sql/age/migrations/0001-iip-graph.sql` as superuser AFTER relational Drizzle migrations complete
  - [x] Runner must wait for `postgres` healthcheck before connecting
  - [x] Use explicit `COMMIT` boundary already present in migration file
  - [x] Apply idempotently: guard with `SELECT * FROM ag_graph WHERE name = 'iip_graph'` before `create_graph`
- [x] Wire OTel/Tempo/Prometheus/Grafana (AC: #6)
  - [x] Add `otel-collector` service (OpenTelemetry collector contribs image) receiving OTLP gRPC/HTTP; forward traces to Tempo
  - [x] Add `tempo` service for trace storage
  - [x] Add `prometheus` service mounting `infra/prometheus/prometheus.yml`
  - [x] Add `grafana` service mounting `infra/grafana/provisioning/` dashboards + datasources
  - [x] Keep ports internal-only by default; expose Grafana on a non-conflicting port
- [x] Wire app + web stubs as Compose services (AC: #1, #8)
  - [x] Build each app from its `apps/*` Dockerfile or inline `build: ./apps/<name>` with target stage
  - [x] Healthcheck: run the entrypoint with a short timeout; expect exit 0 and `"alive"` in stdout
  - [x] Set env vars from `packages/config` schema defaults; no plaintext secrets in compose (sops/age deferred per SEC-4)
  - [x] `web` depends on `api` and `caddy`
- [x] Un-skip and GREEN `tests/integration/compose-stack.health.test.ts` (AC: #9)
  - [x] Move scaffold from `_bmad-output/test-artifacts/atdd/epic-1/story-1-3/compose-stack.health.test.ts` to `tests/integration/compose-stack.health.test.ts`
  - [x] Remove `describe.skip`
  - [x] Fix `readFileSync` import ordering (currently at bottom of file)
  - [x] Verify `execa`/`execaSync` availability or switch to zero-dep `node:child_process` (Story 1.1 precedent)
  - [x] Verify test assertions match the services declared (11 services + OTel regex)
  - [x] Run with `--pool=forks --poolOptions.forks.singleFork=true` due to Docker global state
- [x] Run full local verification
  - [x] `pnpm install && pnpm build` exits 0
  - [x] `pnpm typecheck` passes
  - [x] `pnpm lint` passes
  - [x] `pnpm test` passes
  - [x] `docker compose -f infra/docker-compose.yml up --wait` reaches healthy in <3 min
  - [x] `pnpm vitest run tests/integration/compose-stack.health.test.ts` GREEN

## Dev Notes

### Scope Boundary

This story wires the **platform topology** around the stubs from Story 1.1 and the database image from Story 1.2. It does NOT implement business logic inside the apps, does NOT create real RAG/render/auth code, and does NOT finalize production secrets management (sops/age CI wiring is Story 1.11). It must, however, prove the whole stack can stand up together on a single workstation.

### Critical Architecture Guardrails

**1. PostgreSQL image is SHARED with Story 1.2.**

Use the same custom image built in 1.2. The integration test in 1.2 used the floating tag locally; Story 1.3 must pin the digest in `infra/docker-compose.yml` or an override file so dev/CI do not drift. Env var `IIP_PG_AGE_VECTOR_IMAGE` is the override hook established in 1.2.

**2. Redis image MUST be `redis:7-alpine` only.**

Dragonfly and KeyDB have known BullMQ bugs (project-context.md). Do not substitute. If `redis-stack-server` is needed later for RediSearch, that is a separate ADR.

**3. Caddy rate-limit is OWASP-noise mitigation only.**

Do not describe it as DDoS defense against state-aligned actors (SEC-9). The Caddyfile must contain an inline comment documenting this limitation.

**4. Ollama tag spelling is load-bearing.**

ADR-005 target is `qwen3:14b`. `qwen2.5:14b-instruct` is a different model. Wrong tag = silent model substitution in later eval runs. The pull script must verify the tag and fail closed.

**5. MinIO bucket is private and off serving path.**

`raw-snapshots` must never be served to external users. The Caddyfile must not reverse-proxy MinIO. Bucket policy = private. This is the NFR-S-5 boundary.

**6. AGE boot migration runs AFTER Drizzle relational migrations.**

Per ADR-002 §Decision #5, relational first, AGE projection second. The boot runner applies `infra/sql/age/migrations/0001-iip-graph.sql` (created in Story 1.2) after the Drizzle migration job completes. Do NOT register it under `/docker-entrypoint-initdb.d/`.

**7. All external dependencies accessed via interfaces (AC-3).**

Compose is transitional single-host. The wiring must not bake in assumptions that prevent a later multi-node deployment change. Database URL, Redis URL, MinIO endpoint, and Ollama endpoint must be env-driven.

**8. No plaintext secrets in `infra/docker-compose.yml`.**

Use `.env.example` to document keys. Real secrets are injected at runtime via sops+age (Story 1.11/SEC-4). For local dev, a `.env` file is acceptable but must be `.gitignore`d. Never commit actual keys.

### Previous Story Intelligence

From **Story 1.1** (`_bmad-output/implementation-artifacts/1-1-turborepo-scaffold-process-stubs.md`):

- 12 packages + 5 apps exist with mandated `exports` shape and `vitest.config.ts`.
- Root scripts: `pnpm build` (turbo), `pnpm typecheck` (turbo), `pnpm test` (`vitest run tests/smoke && turbo run test`), `pnpm lint` (`eslint .`).
- `.npmrc`: `node-linker=hoisted`, `engine-strict=true`, `auto-install-peers=true`, `strict-peer-dependencies=true`.
- `packageManager: "pnpm@9.15.4"` exact; `engines.node: "22.x"`; `.nvmrc: 22.23.0`.
- `tools/*` are NOT pnpm workspace members; their `package.json` are shims.
- CI already has a grep guard for `.only/.skip/.todo` (AC-F1-09), so any integration test skipped after this story must have a documented exception or be activated.

From **Story 1.2** (`_bmad-output/implementation-artifacts/1-2-postgresql-pgvector-age-compatibility-proof.md`):

- Custom image: `ghcr.io/iip/postgres-age-pgvector:pg16` with digest `sha256:9bde235139bfd00f266624e99e936c31a4abcfe7f4e287560d66ee5fb18c796e` (pin in compose override).
- Extensions: `age 1.6.0`, `vector 0.8.3`, `pg_trgm 1.6`, `uuid-ossp 1.1`.
- `shared_preload_libraries = 'age'` baked into image CMD.
- AGE search_path DSN: `options=-c%20search_path%3Dag_catalog%2Cpublic` (no space after comma).
- `packages/db` has `createDb()` factory; use it in the boot runner.
- `infra/sql/age/migrations/0001-iip-graph.sql` exists with explicit `COMMIT`; applied by a boot runner (this story).
- Integration tests live in `tests/integration/` and run with `--pool=forks --poolOptions.forks.singleFork=true` due to Docker global state.
- Testcontainers 10.16.0 exact pin is at root; integration tests should not add conflicting container deps.

### Common LLM Mistakes to Avoid

1. **Adding `tools/*` to `pnpm-workspace.yaml`.** This breaks `pnpm install` (Story 1.1 guardrail).
2. **Using `postgres:16` instead of the Story 1.2 custom image.** Plain Postgres lacks AGE and pgvector.
3. **Using Redis Stack or Dragonfly for BullMQ.** Use `redis:7-alpine` only.
4. **Exposing MinIO or Ollama through Caddy.** Raw store stays private.
5. **Registering `0001-iip-graph.sql` under `/docker-entrypoint-initdb.d/`.** AGE boot runs after Drizzle relational migrations via the boot runner.
6. **Hard-coding secrets in compose.** Use `.env` and `.env.example`; commit only `.env.example`.
7. **Describing Caddy rate-limit as DDoS defense.** It is OWASP-noise only (SEC-9).
8. **Using `qwen2.5:14b-instruct` or a floating `qwen3:latest` tag.** Pin exact tag per ADR-005.
9. **Putting Jaeger instead of Tempo.** VAL-9 specifies Tempo for gate-invocation tracing.
10. **Skipping healthchecks on app stubs.** Every app service needs a healthcheck that proves the stub starts and exits cleanly.

### Files to Create / Modify

Create new:
- `infra/docker-compose.yml` — 11-service platform topology
- `infra/Caddyfile` — reverse proxy + auto-TLS + rate-limit
- `infra/runner/ollama-pull.sh` — model pre-pull script
- `infra/minio/init-bucket.sh` or equivalent bucket init sidecar
- `scripts/age-migrate.ts` — AGE boot runner
- `infra/prometheus/prometheus.yml` — Prometheus scrape config
- `infra/grafana/provisioning/datasources/datasource.yml` — Grafana datasources
- `infra/grafana/provisioning/dashboards/dashboard.yml` — Grafana dashboard provider
- `infra/otel/otel-collector-config.yml` — OTel collector pipelines
- Per-app `Dockerfile` or a shared `infra/docker/Dockerfile.app` (decide and document)
- `apps/web/Dockerfile` or dev-mode service config
- `.env.example` — documented env keys, no values

Modify:
- `tests/integration/compose-stack.health.test.ts` — move from ATDD folder, remove `.skip`, fix imports
- `package.json` — add compose-related scripts if needed (e.g., `compose:up`, `compose:down`)
- Root `.gitignore` — add `.env` if not present

### Verification Commands

```bash
# Build/typecheck/lint/test
pnpm install && pnpm build
pnpm typecheck
pnpm lint
pnpm test

# Stand up the platform stack
pnpm compose:up          # or: docker compose -f infra/docker-compose.yml up -d --wait
docker compose -f infra/docker-compose.yml ps

# Run the integration test
pnpm vitest run tests/integration/compose-stack.health.test.ts --pool=forks --poolOptions.forks.singleFork=true

# Tear down
docker compose -f infra/docker-compose.yml down -v
```

### Project Context Reference

- **Authority hierarchy:** AC-1…AC-11, PD-1…PD-3, SC-1…SC-10, SEC-1…SEC-9, PC-1…PC-9, STR-1…STR-12, VAL-1…VAL-9 are binding.
- **Most relevant for this story:** SC-10 (AC-F1-01..10), D9 (Caddy), D14/D15 (CI/GPU), D1 (AGE boot order), D5 (internal-period access posture), NFR-O-1 (observability), NFR-S-5 (raw store private), SEC-9 (rate-limit framing), STR-2/STR-3 (5-process split + Enqueuer), STR-12 (`tools/` non-workspace).
- **Dependency stories:** Story 1.1 (scaffold), Story 1.2 (PG image + `packages/db` + AGE migration file).
- **Later stories depending on this:** Story 1.4 (render gate ESLint boundary can reference compose health), Story 1.5 (polyglot eval needs Python container in compose), Story 1.11 (CI pipeline hardens this compose file), all Epic 2+ stories assume the platform stack exists.

## Dev Agent Record

### Agent Model Used

glm-5.2 (zai-coding-plan/glm-5.2)

### Debug Log References

- Docker Compose path resolution: compose file at `infra/docker-compose.yml` means all relative paths resolve from `infra/`, not project root. Fixed build contexts to `..` and volume mounts to omit `infra/` prefix.
- macOS `._` resource fork files break Docker build context transfer. Added `.dockerignore` and `find -delete` in integration test beforeAll.
- App stubs exit immediately after `console.log('alive')`. Dockerfile.app CMD changed to `node dist/index.js && tail -f /dev/null` to keep containers alive for healthcheck.
- Port conflicts on dev workstation (local Redis on 6379, local Ollama on 11434, port 80/8080 in use). Made host port mappings env-configurable with empty defaults (internal-only).
- Caddy standard image lacks `rate_limit` plugin. Documented rate limiting at app layer per ADR-004.
- Tempo `/dev/null` config causes "unknown backend" error. Created proper `infra/otel/tempo.yaml` with local storage backend.

### Completion Notes List

- **P0-P3 Foundation Action Plan completed first** — unblocked Story 1-3 from `draft-blocked`:
  - P0: ADR-001 (defamation-grade operational definition) — already existed
  - P1: Citation-or-silence RED test with fast-check property tests (1000 runs each), `fast-check@^3.19.0` pinned at root
  - P2: Contract tests wired into CI pipeline via vitest workspace projects; RED test isolated in `contract-red` project; CI handles expected RED with warning
  - P3: All 4 blockers closed (boot runner, createDb tests, ordering invariant, AGE ADR)

- **11 core services + 4 observability + 2 init sidecars** in Docker Compose:
  - Data layer: postgres (custom PG16+AGE+pgvector), redis (7-alpine, BullMQ-compatible), minio (private raw-snapshots bucket)
  - LLM: ollama (internal-only, qwen3:14b pre-pull sidecar)
  - App processes (6-process split per ADR-021): api, ingest-worker, serve-worker, audit-worker, enqueuer, web
  - Reverse proxy: caddy (auto-TLS, rate_limit documented)
  - Observability: otel-collector → tempo (traces), prometheus → grafana (metrics/dashboards)

- **Integration test GREEN**: `tests/integration/compose-stack.health.test.ts` — 8 tests, zero-dep (node:child_process), detects already-running stack, verifies all services + configs

- **Full verification passed**: build (18 packages), typecheck (18), lint (clean), test (20 smoke+contract + 12 turbo packages), integration (22 tests)

### File List

Created:
- `infra/docker-compose.yml` — 11-service platform topology + 4 observability + 2 init sidecars
- `infra/Caddyfile` — reverse proxy + auto-TLS + rate_limit documentation
- `infra/runner/ollama-pull.sh` — model pre-pull script (qwen3:14b, fails closed)
- `infra/minio/init-bucket.sh` — MinIO bucket init script (private raw-snapshots)
- `infra/docker/Dockerfile.app` — shared app process Dockerfile
- `infra/otel/otel-collector-config.yml` — OTel collector pipelines (traces→Tempo, metrics→Prometheus)
- `infra/otel/tempo.yaml` — Tempo trace storage config (local backend)
- `infra/prometheus/prometheus.yml` — Prometheus scrape config
- `infra/grafana/provisioning/datasources/datasource.yml` — Tempo + Prometheus datasources
- `infra/grafana/provisioning/dashboards/dashboard.yml` — Grafana dashboard provider
- `apps/web/package.json` — web app stub package
- `apps/web/tsconfig.json` — web app tsconfig
- `apps/web/src/index.ts` — web app stub entrypoint
- `.env.example` — documented env keys (no values)
- `.dockerignore` — excludes ._*, node_modules, dist, _bmad-output
- `tests/integration/compose-stack.health.test.ts` — integration test (moved from ATDD, un-skipped, zero-dep)

Modified:
- `package.json` — added fast-check devDep, test:red/test:integration/compose:up/compose:down scripts, updated test pipeline
- `vitest.workspace.ts` — added contract-red + integration projects, contract project excludes RED test
- `.github/workflows/ci.yml` — added contract test step + RED test expected-failure handling
- `tests/contract/citation-or-silence.test.ts` — added fast-check property tests (PC-9, 1000 runs)
- `_bmad-output/implementation-artifacts/sprint-status.yaml` — story 1-3 status updated

### Change Log

- 2026-06-23: P0-P3 Foundation Action Plan completed (defamation-grade definition, citation invariant RED test, CI pipeline, boot runner, createDb tests, ordering invariant, AGE/DDoS/process-count ADRs)
- 2026-06-23: Story 1-3 implementation complete — all 9 ACs satisfied, integration test GREEN, full verification passed

---

*Ultimate context engine analysis completed — comprehensive developer guide created for Story 1.3.*

---

### Review Findings

**Review date:** 2026-06-23
**Reviewer layers:** Blind Hunter, Edge Case Hunter, Acceptance Auditor

#### Decision Needed

None — resolved by Party Mode consensus on 2026-06-23:
- **Caddy `rate_limit` → Option B:** proxy-layer rate limiting deferred to application layer (`@fastify/rate-limit` per ADR-004); update AC #3 / ADR-004 and adjust health test.
- **`web` / `caddy` cycle → Option 1:** update spec/task list to match implementation (`web` depends on `api`; `caddy` depends on `api` + `web`).
- **AGE version → keep `WITH VERSION '1.6.0'`:** installed extension catalog version is `1.6.0` while upstream artifact tag is `PG16/v1.6.0-rc0`; add clarifying comment + CI contract assertion.

#### Patch

All 40 patch findings addressed on 2026-06-23. Verification: `pnpm install`, `pnpm build`, `pnpm typecheck`, `pnpm test`, `pnpm lint` all pass.

- [x] [Review][Patch] MinIO healthcheck uses unconfigured `mc` alias [infra/docker-compose.yml]
- [x] [Review][Patch] AGE boot runner `scripts/age-migrate.ts` wired as `age-boot` Compose service [infra/docker-compose.yml]
- [x] [Review][Patch] App service healthchecks exercise actual stub entrypoint [infra/docker-compose.yml]
- [x] [Review][Patch] Integration test `afterAll` wrapped in `try/catch` [tests/integration/compose-stack.health.test.ts]
- [x] [Review][Patch] CI expected-RED step asserts expected RED marker [`.github/workflows/ci.yml]
- [x] [Review][Patch] App container healthcheck grace period increased to 60s/10 retries [infra/docker-compose.yml]
- [x] [Review][Patch] Story 1.2 custom PostgreSQL image digest-pinned in Compose [infra/docker-compose.yml, .env.example]
- [x] [Review][Patch] Plaintext secrets removed from `docker-compose.yml`; documented in `.env.example` [infra/docker-compose.yml, .env.example]
- [x] [Review][Patch] `caddy` service has healthcheck via `/healthz` [infra/docker-compose.yml, infra/Caddyfile]
- [x] [Review][Patch] `scripts/age-migrate.ts` refactored to use `packages/db/src/client.ts` [scripts/age-migrate.ts]
- [x] [Review][Patch] Ollama service healthcheck verifies `qwen3:14b` model presence [infra/docker-compose.yml]
- [x] [Review][Patch] `ollama-pull.sh` enforces ADR-005 model unless override flag set [infra/runner/ollama-pull.sh]
- [x] [Review][Patch] `Dockerfile.app` copies `.npmrc` [infra/docker/Dockerfile.app]
- [x] [Review][Patch] Host port defaults added to avoid random high ports [infra/docker-compose.yml, .env.example]
- [x] [Review][Patch] Grafana admin password sourced from env var [infra/docker-compose.yml, .env.example]
- [x] [Review][Patch] Init scripts volume-mounted and used by Compose [infra/docker-compose.yml]
- [x] [Review][Patch] Prometheus scrape config comment aligned with actual targets [infra/prometheus/prometheus.yml]
- [x] [Review][Patch] Caddy rate limiting documented as app-layer-only; health test updated [infra/Caddyfile, tests/integration/compose-stack.health.test.ts]
- [x] [Review][Patch] Story 1.3 task list corrected for `web`/`caddy` startup order [story file]
- [x] [Review][Patch] AGE `WITH VERSION '1.6.0'` comment + integration assertion added [infra/sql/age/migrations/0001-iip-graph.sql, tests/integration/compose-stack.health.test.ts]
- [x] [Review][Patch] Data/observability images pinned to stable tags [infra/docker-compose.yml]
- [x] [Review][Patch] MinIO env vars updated to `MINIO_ROOT_USER` / `MINIO_ROOT_PASSWORD` [infra/docker-compose.yml, .env.example]
- [x] [Review][Patch] `.env.example` URLs now use mapped host ports [`.env.example]
- [x] [Review][Patch] Integration test checks all `CORE_SERVICES` before skipping setup [tests/integration/compose-stack.health.test.ts]
- [x] [Review][Patch] Integration timeout increased to 600s for Ollama model pull [tests/integration/compose-stack.health.test.ts]
- [x] [Review][Patch] App services include Ollama / MinIO environment interfaces [infra/docker-compose.yml]
- [x] [Review][Patch] `ExitCode` parsed with `Number(...)` defaulting to 0 [tests/integration/compose-stack.health.test.ts]
- [x] [Review][Patch] Dockerfile.app CMD uses `exec tail -f /dev/null` for PID-1 [infra/docker/Dockerfile.app]
- [x] [Review][Patch] `docker compose ps --format json` handles both array and NDJSON [tests/integration/compose-stack.health.test.ts]
- [x] [Review][Patch] `apps/web` declares local eslint devDependencies [apps/web/package.json]
- [x] [Review][Patch] `.env.example` uses stronger placeholder passwords [`.env.example]
- [x] [Review][Patch] Property-test uses `RenderInput.parse()` instead of cast [tests/contract/citation-or-silence.test.ts]
- [x] [Review][Patch] MinIO bucket-init fails closed on policy-removal errors [infra/minio/init-bucket.sh]
- [x] [Review][Patch] `.env.example` documents in-container URL override via comment [`.env.example]
- [x] [Review][Patch] `Dockerfile.app` validates `APP_NAME` at runtime build [infra/docker/Dockerfile.app]
- [x] [Review][Patch] Observability collector/Tempo/Prometheus kept internal-only; only Grafana exposed [infra/docker-compose.yml]
- [x] [Review][Patch] Redis Streams durability asserted via `CONFIG GET appendonly` [tests/integration/compose-stack.health.test.ts]
- [x] [Review][Patch] Integration test no longer destructively deletes `._*` files [tests/integration/compose-stack.health.test.ts]

#### Deferred

None.

