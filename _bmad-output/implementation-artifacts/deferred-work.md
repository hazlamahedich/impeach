# Deferred Work

## Deferred from: code review of 1-2-postgresql-pgvector-age-compatibility-proof (2026-06-23)

- `scripts/age-migrate.ts` boot runner and `packages/contracts/__fixtures__/containers.ts` do not exist yet — these are explicitly in scope for Story 1.3, not Story 1.2. Story 1.2 only seeds the migration file and proves the image works. [ADR-002:162-165]

- No automated re-audit of the "AGE has no GA release" claim — the evidence is a manual 2026-06-23 GitHub check. There is no CI job or scheduled check that fails if a GA release or `PG16/v1.7.0` tag later appears. Operational/ADR hygiene item for future CI setup. [ADR-002:12]
