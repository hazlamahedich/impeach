# Deferred Work

## Deferred from: code review of 2-4-hash-chained-editorial-log (2026-06-30)

- Full DB-level chaos tests (pool exhaustion, transaction timeout) beyond compute-only stubs — deferred to Story 2.5 per story scope. [tests/chaos/editorial-log.chaos.test.ts]
- Performance SLA enforcement at 100K entries against a real PostgreSQL instance — deferred to Story 2.5. [tests/perf/editorial-log.perf.test.ts]
- External witnessing implementation and periodic root-hash publication — explicitly deferred to Story 2.5. [packages/editorial/src/editorial-log-repo.ts:330-341, packages/db/drizzle/0001_editorial_log.sql]

## Deferred from: code review of 2-3-two-person-intake-state-machine (2026-06-30)

- `requireTransition` emits `intake.invalid_transition` events with empty `principal_sub` and `key_kid` — `packages/intake/src/gate/state.ts:100-115`, `packages/contracts/src/intake/IntakeEventLogger.ts:58-68`. The event schema accepts the values but audit quality is weakened. Defer to a future audit-hardening story. [reviewer note: consider deriving a meaningful principal/kid value for invalid-transition events]

- DB migration `packages/db/drizzle/0000_intake_documents.sql:8-25` has no CHECK constraints for `status` values or `content_hash` format. The gate enforces these at the app layer; DDL hardening is a follow-up improvement, not a Story 2.3 blocker. [reviewer note: add `CHECK (status IN (...))` and `CHECK (content_hash ~ '^[a-f0-9]{64}$')` when DDL maintenance is scheduled]

## Deferred from: code review of 1-2-postgresql-pgvector-age-compatibility-proof (2026-06-23)

- `scripts/age-migrate.ts` boot runner and `packages/contracts/__fixtures__/containers.ts` do not exist yet — these are explicitly in scope for Story 1.3, not Story 1.2. Story 1.2 only seeds the migration file and proves the image works. [ADR-002:162-165]

- No automated re-audit of the "AGE has no GA release" claim — the evidence is a manual 2026-06-23 GitHub check. There is no CI job or scheduled check that fails if a GA release or `PG16/v1.7.0` tag later appears. Operational/ADR hygiene item for future CI setup. [ADR-002:12]

## Deferred from: code review of 1-6-citation-package (2026-06-25)

- `crypto.subtle` global availability is assumed without runtime check — runtime guarantee is outside story 1.6 scope.
- `span_start` can equal `span_end` (zero-length citation) — product semantics of a zero-length citation should be decided later; code correctly handles it.
- `@iip/contracts` exports `CorpusHash` as a type only — export the runtime branded schema from `index.ts` if consumers need it; not required by this story.

## Deferred from: code review of 1-11-ci-pipeline-gate-artifact-store (2026-06-26)

- ADR formatting/normalization edits are Story 1.10 carry-over — not introduced by Story 1.11 implementation; no action needed here. [docs/adr/0001-*.md]
- Full sops decryption integration test — requires actual encrypted secrets under `secrets/`; no files exist yet. [packages/config/src/secrets.ts]
- Real polyglot eval bridge invocation in CI — deferred to Epic 4 per implementation notes; current smoke is intentional. [.github/workflows/ci.yml:242]
- GPU passthrough runner config — already documented as commented-out and deferred to Epic 4. [infra/runner/provision.pkr.hcl:145]
- Metric value range validation — real metrics (RAGAS/DeepEval) not defined yet; `{ echo: 1.0 }` smoke is sufficient for Epic 1. [packages/eval/src/reproduce.ts:57]

