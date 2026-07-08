---
stepsCompleted: ['step-01-preflight-and-context','step-02-generation-mode','step-03-test-strategy','step-04-generate-tests','step-04c-aggregate']
lastStep: 'step-04c-aggregate'
lastSaved: '2026-07-08'
workflowType: 'testarch-atdd'
storyId: '3.1'
storyKey: '3-1-source-registry-routes'
storyFile: '_bmad-output/planning-artifacts/epics.md (Epic 3, Story 3.1, lines 734-749)'
atddChecklistPath: '_bmad-output/test-artifacts/atdd/epic-3/story-3-1/atdd-checklist-3-1-source-registry-routes.md'
generatedTestFiles:
  - 'tests/integration/source-registry-routes.integration.test.ts'
inputDocuments:
  - '_bmad-output/planning-artifacts/epics.md'
  - '_bmad-output/project-context.md'
  - 'packages/contracts/src/ingest.ts'
  - 'packages/db/src/schema/sources.ts'
  - 'tests/support/helpers/ingest.ts'
  - 'tests/integration/api-routes-intake.integration.test.ts'
activationState: 'RED'
activatesIn: 'Story 3.1 implementation (createSourceRoutes handler + Fastify registration)'
---

# ATDD Checklist — Epic 3, Story 3.1: Source Registry API Routes

**Date:** 2026-07-08 · **Primary Test Level:** integration (Fastify `app.inject`) · **Severity:** **T1 — defamation provenance foundation**

> RED-phase scaffold. The `createSourceRoutes` handler does not exist yet. Tests are quarantined via `describe.skip` and the route module is loaded via a variable-specifier dynamic import (Vite cannot statically resolve a subpath absent from `@iip/api`'s `exports` map). At green phase, remove `describe.skip` and the dynamic-import wrapper, replacing with a direct import once `apps/api/src/routes/sources.ts` lands.

## Story Summary
As an Intake Operator, I want to register and configure sources by type and crawl strategy with a confirmed trust tier, so that evidence reliability and citation-quality floor are grounded in validated source authenticity.

## Acceptance Criteria
1. source_type (government, court, media, press_release, transcript) + crawl_strategy (rss, sitemap, list_page, api, manual) set on registration
2. trust_tier (1 primary → 3 aggregator) assigned + **confirmed** (source-authenticity validated, not self-declared)
3. trust tier feeds evidence reliability + citation-quality floor (EI-8)
4. `sources` Drizzle schema: id, name, url, source_type, crawl_strategy, trust_tier, confirmed, wire_service, original_publisher
5. upstream feed provenance tracked (wire_service, original_publisher) for EI-2 independence
6. SEC-3: trust tier assigned AT INGEST + persisted as structural graph property

## Red-Phase Scaffolds
**File:** `tests/integration/source-registry-routes.integration.test.ts` (5 tests, all RED/skipped)

- ⏭️ **[P0] SC-1:** POST /sources with `sources:write` scope → 201 + persisted source with confirmed trust tier — RED
- ⏭️ **[P0] SC-2:** POST /sources without `sources:write` scope → 403 (SEC-1 principal boundary) — RED
- ⏭️ **[P1] SC-3:** POST /sources with no Authorization → 401 — RED
- ⏭️ **[P0] SC-4:** POST /sources with trust_tier outside {1,2,3} → 400 (SEC-3 structural tier) — RED
- ⏭️ **[P1] SC-5:** GET /sources/:id returns source with confirmed trust tier + provenance (EI-8) — RED

## Acceptance Criteria Coverage
| AC | Test(s) | Status |
|----|---------|--------|
| source_type + crawl_strategy set | SC-1, SC-4 | RED |
| trust_tier assigned + confirmed | SC-1, SC-4, SC-5 | RED |
| feeds EI-8 reliability floor | SC-5 | RED |
| sources schema fields | SC-1, SC-5 | RED |
| wire_service/original_publisher provenance | SC-1, SC-5 | RED |
| SEC-3 trust tier structural | SC-4 | RED |
| SEC-1 scope enforcement | SC-2, SC-3 | RED |

## Implementation Checklist
- [ ] Create `apps/api/src/routes/sources.ts` exporting `createSourceRoutes(deps)` (mirror `createIntakeRoutes` shape)
- [ ] Add `POST /sources` handler: zod-parse body (reuse `SourceSourceType`, `CrawlStrategy`, trust_tier 1-3), insert via repo, return 201
- [ ] Add `GET /sources/:id` handler: fetch by id, return 200 with provenance fields, 404 if absent
- [ ] Register `createSourceRoutes` in `apps/api/src/server.ts` Fastify bootstrap (TD1)
- [ ] Define SEC-1 scopes: `sources:write`, `sources:read` (extend `packages/auth` scope table)
- [ ] Wire the source repo to the real `sources` Drizzle table (TD3 landed the schema)
- [ ] Confirm trust-tier confirmation logic (validated, not self-declared — SEC-3) — legal procurement gates this (TD parallel)
- [ ] Add `@iip/api/routes/sources` to `apps/api` `package.json` `exports`
- [ ] Remove `describe.skip` + convert dynamic import to `import { createSourceRoutes } from '@iip/api/routes/sources'`
- [ ] Run `pnpm vitest --project integration -- source-registry-routes` → all 5 GREEN

## Implementation Guidance
**Endpoint to implement:**
- `POST /sources` → 201 (body: name, url, source_type, crawl_strategy, trust_tier, confirmed, wire_service?, original_publisher?)
- `GET /sources/:id` → 200 (returns source with all provenance fields)

**SEC-1 scopes to add:** `sources:write`, `sources:read`

**Repo interface:** inject a `SourceRegistryRepo` (in-memory stub for tests; real Drizzle impl for prod) following the `IntakeRouteDeps` injection pattern.

**Estimated Effort:** Small-Medium (route + scope + repo; schema is already landed).

## Notes
- The `sources` table, `SourceSourceType`/`CrawlStrategy` zod enums, and CHECK constraints are already GREEN (TD3 + `ingest-domain.contract.test.ts`). This story is the API surface on top of the landed substrate.
- Trust-tier **confirmation** criteria (SEC-3) is a legal/editorial judgment — coordinate with the parallel legal procurement track (TD prep sprint). The route persists `confirmed: true` only after that judgment; the test asserts the persisted value, not the judgment itself.
- Mirrors Story 2.3's integration-test pattern exactly: real Ed25519 JWT via `jose`, `app.inject()`, injected stub deps.

**Generated by BMad TEA Agent** — 2026-07-08
