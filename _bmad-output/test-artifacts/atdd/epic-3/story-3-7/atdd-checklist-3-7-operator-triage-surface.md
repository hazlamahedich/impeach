---
stepsCompleted: ['step-01-preflight-and-context','step-02-generation-mode','step-03-test-strategy','step-04-generate-tests','step-04c-aggregate']
lastStep: 'step-04c-aggregate'
lastSaved: '2026-07-08'
workflowType: 'testarch-atdd'
storyId: '3.7'
storyKey: '3-7-operator-triage-surface'
storyFile: '_bmad-output/planning-artifacts/epics.md (Epic 3, Story 3.7, lines 834-850)'
atddChecklistPath: '_bmad-output/test-artifacts/atdd/epic-3/story-3-7/atdd-checklist-3-7-operator-triage-surface.md'
generatedTestFiles:
  - 'tests/e2e/operator-triage-surface.spec.ts'
  - 'tests/integration/operator-triage-routes.integration.test.ts'
inputDocuments:
  - '_bmad-output/planning-artifacts/epics.md'
  - '_bmad-output/project-context.md'
  - 'tests/e2e/operator-triage-surface.smoke.spec.ts'
  - 'playwright.config.ts'
  - 'tests/integration/api-routes-intake.integration.test.ts'
  - 'tests/support/helpers/ingest.ts'
activationState: 'RED'
activatesIn: 'Story 3.7 implementation (/admin/ingest route + triage components + createTriageRoutes handler)'
---

# ATDD Checklist — Epic 3, Story 3.7: Operator Triage Surface

**Date:** 2026-07-08 · **Primary Test Level:** E2E (Playwright) + integration (API routes) · **Severity:** **T2 — operational credibility**

> RED-phase scaffold. The `/admin/ingest` route, triage components, and `createTriageRoutes` handler do not exist yet. Tests quarantined via `test.describe.skip` (E2E) and `describe.skip` (integration). The config-compile smoke spec (`operator-triage-surface.smoke.spec.ts`) is retained as the framework-bootstrap guard.

## Story Summary
As an Intake Operator, I want to view failed/dead-lettered jobs, reprocess after fix, and spot-check extraction output against source text, so that I can maintain ingestion health and verify integrity.

## Acceptance Criteria
1. Failed/dead-lettered jobs displayed with typed error categories
2. Operator can reprocess a failed job (re-enqueue to ingest:queue)
3. Operator can spot-check extraction output against source text (side-by-side view)
4. Spot-check view shows document text with extracted artifacts overlaid (entities highlighted, claims marked, citations linked)
5. Stubbed AnswerBlock (Story 1.8) renders ingested content with citation-or-silence invariant visible
6. Dashboard shows ingestion health metrics: success rate, throughput, queue depth, DLQ depth (NFR-O-1)
7. Operator surface inherits shadcn admin patterns

## Red-Phase Scaffolds

### E2E (Playwright)
**File:** `tests/e2e/operator-triage-surface.spec.ts` (7 scenarios, all RED/skipped)

- ⏭️ **[P0] OT-1:** triage queue renders failed + dead-lettered jobs — RED
- ⏭️ **[P0] OT-2:** each job row displays a typed error category — RED
- ⏭️ **[P0] OT-3:** reprocess button re-enqueues a failed job — RED
- ⏭️ **[P1] OT-4:** spot-check view shows source text with extracted artifacts overlaid — RED
- ⏭️ **[P1] OT-5:** spot-check view shows the citation-or-silence invariant — RED
- ⏭️ **[P1] OT-6:** health metrics panel shows success rate + throughput + queue depth + DLQ depth — RED
- ⏭️ **[P2] OT-7:** operator surface inherits shadcn admin patterns — RED

### Integration (API routes)
**File:** `tests/integration/operator-triage-routes.integration.test.ts` (5 tests, all RED/skipped)

- ⏭️ **[P0] OT-API-1:** GET /admin/ingest/jobs returns failed + dead-lettered jobs with typed errors — RED
- ⏭️ **[P0] OT-API-2:** GET /admin/ingest/jobs without admin:ingest:read scope → 403 (SEC-1) — RED
- ⏭️ **[P0] OT-API-3:** POST /admin/ingest/jobs/:id/reprocess re-enqueues a failed job — RED
- ⏭️ **[P1] OT-API-4:** GET /admin/ingest/jobs/:id/spot-check returns source text + extracted artifacts — RED
- ⏭️ **[P1] OT-API-5:** GET /admin/ingest/metrics returns the four health metrics (NFR-O-1) — RED

## Acceptance Criteria Coverage
| AC | Test(s) | Status |
|----|---------|--------|
| failed/DLQ jobs displayed w/ typed errors | OT-1, OT-2, OT-API-1 | RED |
| reprocess (re-enqueue) | OT-3, OT-API-3 | RED |
| spot-check side-by-side | OT-4, OT-API-4 | RED |
| artifacts overlaid (entities/claims/citations) | OT-4, OT-API-4 | RED |
| citation-or-silence invariant visible | OT-5 | RED |
| health metrics (NFR-O-1) | OT-6, OT-API-5 | RED |
| shadcn admin patterns | OT-7 | RED |
| SEC-1 scope enforcement | OT-API-2 | RED |

## Implementation Checklist
- [ ] Create `apps/api/src/routes/triage.ts` exporting `createTriageRoutes(deps)` — the API backing the surface
- [ ] `GET /admin/ingest/jobs?filter=...` — query ingestion_jobs by state, return typed error categories
- [ ] `POST /admin/ingest/jobs/:id/reprocess` — re-enqueue to ingest:queue (202)
- [ ] `GET /admin/ingest/jobs/:id/spot-check` — return source text + extracted artifacts (entities/claims/citations)
- [ ] `GET /admin/ingest/metrics` — return successRate, throughput, queueDepth, dlqDepth
- [ ] Define SEC-1 scopes: `admin:ingest:read`, `admin:ingest:write`
- [ ] Register `createTriageRoutes` in `apps/api/src/server.ts`
- [ ] Create `apps/web/app/admin/ingest/page.tsx` — the triage surface route
- [ ] Build triage components: `OperatorTriageQueue`, `TriageRow`, `SpotCheckView`, `HealthMetricsPanel` under `apps/web/components/admin/`
- [ ] Wire the stubbed AnswerBlock (Story 1.8) into the spot-check view (citation-or-silence visible)
- [ ] Add admin link to sidebar nav (`apps/web/components/layout/sidebar.tsx`)
- [ ] Add shadcn admin primitives (data-table, badge, card, tabs) to `apps/web/components/ui/`
- [ ] Add `@iip/api/routes/triage` to `apps/api` `exports`
- [ ] Remove `describe.skip` / `test.describe.skip` + convert dynamic imports
- [ ] Run E2E: `npx playwright test operator-triage-surface.spec.ts` → all 7 GREEN
- [ ] Run integration: `pnpm vitest --project integration -- operator-triage-routes` → all 5 GREEN

## Implementation Guidance
**API routes:** `apps/api/src/routes/triage.ts` (mirrors `createIntakeRoutes` injection pattern)

**Web route:** `apps/web/app/admin/ingest/page.tsx` (Next.js App Router)

**Selectors (stable `data-testid` anchors):**
- `operator-triage-queue`, `triage-row`, `triage-row-failed`, `triage-row-dead-lettered`
- `error-category-badge`, `reprocess-button`, `reprocess-confirmed`, `row-status`
- `spot-check-button`, `spot-check-view`, `source-text`, `entity-highlight`, `claim-marker`, `citation-link`, `no-evidence-badge`
- `ingestion-health-metrics`, `metric-success-rate`, `metric-throughput`, `metric-queue-depth`, `metric-dlq-depth`
- `admin-sidebar`, `admin-main`, `triage-data-table`

**SEC-1 scopes:** `admin:ingest:read`, `admin:ingest:write`

**Estimated Effort:** Large (API + full admin UI + shadcn admin primitives; the broadest Epic 3 story).

## Notes
- The config-compile smoke spec (`operator-triage-surface.smoke.spec.ts`) is RETAINED — it proves the Playwright config compiles independently of the route existing. The new `.spec.ts` is the real ATDD surface.
- OT-5 (citation-or-silence invariant in spot-check) ties this story back to the Epic 1 keystone: the operator must SEE that every claim either has a citation or an explicit no-evidence state. This is the human-in-the-loop verification of the mechanical invariant.
- Health metrics (NFR-O-1) require reading from BullMQ queue depth + the `ingestion_jobs` table + DLQ. The API aggregates these; the UI renders them.
- shadcn admin patterns: the project has generic primitives (`button`, `command`, `sheet`, `skeleton`) but needs admin-specific ones (`data-table`, `badge`, `card`, `tabs`, `dialog`). Add via `shadcn@latest add` (Tailwind-4-compatible flow).

**Generated by BMad TEA Agent** — 2026-07-08
