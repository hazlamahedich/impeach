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


## Deferred from: code review of story-2-6-retention-takedown-schema-filipino-eval-spec (2026-07-03)

- Drizzle schema omits the two partial indexes declared in the SQL migration (drift hazard). Pre-existing project convention — 0000/0001 also hand-author indexes not modeled in Drizzle. Add a documenting comment or model indexes in Drizzle when the index-source-of-truth convention is settled project-wide. [packages/db/src/schema/intake-documents.ts vs 0002_intake_retention.sql:63-69]
- Vocabulary CHECK lives only in raw SQL; Drizzle has no knowledge of it → drift hazard. Pre-existing pattern (hand-authored migrations due to drizzle-kit version-check); spec explicitly chose SQL-only CHECK. Track until Drizzle `check()` adoption is decided. [packages/db/drizzle/0002_intake_retention.sql vs packages/db/src/schema/intake-documents.ts:217]
- Branded `RetentionPolicy` applied via `.$type<>()` with no runtime `.parse()` on the read path. Pre-existing pattern; no read path exists yet. Validate with `RetentionPolicyLiteral.parse(...)` at the repository boundary when the read path lands. [packages/db/src/schema/intake-documents.ts:217]
- Integration test applies only migrations 0000 + 0002, skipping 0001 — unrealistic chain. Applying the full journal chain (0000→0001→0002) in `beforeAll` is a test-architecture improvement tracked with the broader migration-test convention. [tests/integration/retention-schema.integration.test.ts:428-429]
- Scope leak: uncommitted Story 2.5 editorial-log changes co-mingled in the working tree (eslint.config.js, packages/contracts/src/editorial-log.ts, packages/editorial/*, tests/{chaos,integration,perf}/editorial-log-concurrency.*). These are Story 2.5 leftovers, not 2.6 dependencies — must be split into separate commits before any 2.6 commit/merge.

## Deferred from: CI red-main investigation (2026-07-03)

- **drizzle-orm SQL-injection advisory (GHSA-gpj5-g38j-94v9 / CVE-2026-39356)** — `drizzle-orm@0.35.3` is vulnerable to SQL injection via improperly escaped SQL identifiers (`escapeName`); fixed in 0.45.2. The project pins drizzle-orm 0.35.3 + drizzle-kit 0.28.1 (minors must match per project-context; migrations are hand-authored due to a drizzle-kit version-check issue). **Exposure assessment (2026-07-03):** NOT currently exploitable — grep found zero usage of the vulnerable code path (no `sql.identifier()`, no dynamic table/column names from user input, no raw AGE cypher in source). All schema identifiers are static. **Action:** bumping to 0.45.2 is a 5-minor jump that needs migration-tooling revalidation; deserves a dedicated investigation, not a rushed piggyback. CI `audit` job stays red until this lands. Owner: needs decision (bump + revalidate migrations, or document risk-acceptance and quiet the advisory).
