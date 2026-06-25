# Deferred Work

## Deferred from: code review of 1-2-postgresql-pgvector-age-compatibility-proof (2026-06-23)

- `scripts/age-migrate.ts` boot runner and `packages/contracts/__fixtures__/containers.ts` do not exist yet — these are explicitly in scope for Story 1.3, not Story 1.2. Story 1.2 only seeds the migration file and proves the image works. [ADR-002:162-165]

- No automated re-audit of the "AGE has no GA release" claim — the evidence is a manual 2026-06-23 GitHub check. There is no CI job or scheduled check that fails if a GA release or `PG16/v1.7.0` tag later appears. Operational/ADR hygiene item for future CI setup. [ADR-002:12]

## Deferred from: code review of 1-6-citation-package (2026-06-25)

- `crypto.subtle` global availability is assumed without runtime check — runtime guarantee is outside story 1.6 scope.
- `span_start` can equal `span_end` (zero-length citation) — product semantics of a zero-length citation should be decided later; code correctly handles it.
- `@iip/contracts` exports `CorpusHash` as a type only — export the runtime branded schema from `index.ts` if consumers need it; not required by this story.
- No Stryker/mutation test coverage target is set for `packages/citation/src/index.ts` — thresholds are not yet configured; out of scope for story 1.6.
