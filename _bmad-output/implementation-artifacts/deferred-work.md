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

- **drizzle-orm SQL-injection advisory (GHSA-gpj5-g38j-94v9 / CVE-2026-39356)** — RESOLVED 2026-07-03: bumped drizzle-orm 0.35.3→0.45.2 + drizzle-kit 0.28.1→0.31.10 (PR #4). Advisory cleared; CI `audit` job green. **Investigation finding (separate, still open):** the hand-authored migrations (0000/0001/0002) have no `meta/NNNN_snapshot.json` files, so `drizzle-kit generate` produces a phantom full-creation migration regardless of drizzle-kit version (verified pre-existing — reproduces identically on 0.28.1 and 0.31.10). This breaks `generate`-based diffing; the project already works around it by hand-authoring migrations. Properly restoring the snapshot history is a separate task (regenerate/reconcile snapshots for 0000/0001/0002) — not blocking, since the runtime/migration execution is unaffected (retention 13/13 + editorial concurrency 15/15 GREEN against live PG).

## Deferred from: code review of 2-6b-code-filipino-eval-gate-scaffolding (2026-07-03)

- **`no-non-null-assertion` (`!`) used in kappa.ts/oq9.ts** [packages/eval/src/kappa.ts:204,232,240; oq9.ts:371] — deferred, pre-existing tooling gap. The project-context "fatal-five" text lists `no-non-null-assertion: error` as load-bearing, but the actual root `eslint.config.js` uses `tseslint.configs.recommended` (NOT `strict`/`strict-type-checked`), so the rule is not active anywhere in the repo. Lint passes clean. The aspirational rule should be enabled repo-wide in a dedicated lint-hardening story, not patched piecemeal here.
- **`JSON.parse` + bare `as` cast in filipino-oq9.spec.ts** [packages/eval/src/__tests__/filipino-oq9.spec.ts:91] — deferred, test-only. Project-context bans `JSON.parse` for typed data and `as` without zod, but this is a test fixture read (not a production untrusted boundary) and the zod-parse helper pattern isn't yet established for eval-package test fixtures. Subsumed by the manifest-schema Decision-Needed item — once the manifest shape is decided, the parse should use the canonical `CorpusManifest` type guard.
- **Decimal boundary path returns `lo.toNumber()`, collapsing 30-sig-fig back to double** [packages/eval/src/oq9.ts bisectCdfLcbDecimal] — deferred, low impact. The Decimal re-evaluation's marginal value over a careful double bisection is theatre (`BOUNDARY_TOLERANCE = 1e-9` ≫ double epsilon ~2e-16, so double already resolves the band). Not wrong, just over-engineered; belongs in a future eval-harness-hardening pass.
- **kappa.test.ts "naive reference" reuses the same formula structure** [packages/eval/src/kappa.test.ts:60-99 KA-1, 165-203 KA-10] — deferred, low impact. The reference impl catches transcription typos but not formula errors (same-structure re-derivation). A published worked-example number (classic Fleiss 6-rater table) would be a stronger oracle. Belongs in a future eval-harness-hardening pass.

## Deferred from: code review of 2-6c-english-extraction-quality-eval-gate (2026-07-03)

- **`validateCorpusManifest()` consumed only by the English spec; Filipino spec + Python `tools/eval` bypass it** [packages/eval/src/manifest.ts] — the "shared-harness, every-language-instance" framing in ADR-0025 §2/§6 is aspirational: `filipino-oq9.spec.ts` hand-rolls its own `JSON.parse` + shape checks, and the Python side uses its own pydantic model. Wiring Filipino + Python in is sibling work outside this slice's scope; today the regression-guard value holds only for English.
- **EN-DR-1 assumes `essence_sentence` derives from `answer_text`** [packages/render/src/gate-dr4-fallback.mutation.test.ts EN-DR-1] — the `expect(out.essence_sentence).toContain('coverage gap')` assertion is only robust if `renderGateLive` derives `essence_sentence` from `answer_text`; if it's generated from cited claims (of which there are none), the assertion could be vacuous. Needs `gate.ts` verification, which is outside the diff. Pre-existing render behavior, not introduced by this story.

## Deferred from: code review of 2-7-defamation-threshold-blast-radius-adrs (2026-07-06)

- **Render gate does not yet mechanically enforce 0.00% allegation-as-fact detection target** [packages/render/src/gate.ts] — The current gate strips uncited claims and marks lone Tier-3 claims; it does not block a misclassified `claim_type='fact'` with a syntactically valid citation. Pre-existing implementation gap; Story 2.8/2.9 and the SEC-8 red-team battery are the enforcement path. [deferred, pre-existing]
- **Fail-closed-on-audit-death requirement has no serving-path implementation yet** [apps/api, apps/serve-worker] — Expected for this ADR-only story; implementation is tracked by Story 2.8 / dedicated health/circuit-breaker story. [deferred, pre-existing]
- **Failure classes are not exhaustive (omission, byzantine/colluding, partial partition)** [docs/adr/0029-6-process-blast-radius-matrix.md §3] — The three declared classes are sufficient for the stated evidence standard; further classes can be added when concrete failure modes are discovered. [deferred, out of scope]
- **Timeout/corrupt-output analysis does not address Next.js ISR/CDN caching** [docs/adr/0029-6-process-blast-radius-matrix.md §6] — Caching layers are not yet part of the serving path; defer to a web-gate/caching story. [deferred, out of scope]
