/**
 * Story 3.7 — Operator triage surface E2E (ATDD RED phase).
 *
 * This REPLACES the framework-bootstrap smoke spec
 * (`operator-triage-surface.smoke.spec.ts`, kept as the config-compile guard).
 * This spec exercises the real `/admin/ingest` triage surface that Story 3.7
 * will build. The route does NOT exist yet — all scenarios are RED by design
 * (`test.skip`) until Story 3.7 lands the route + components.
 *
 * Selectors use stable `data-testid` anchors (the canonical selector strategy
 * for admin surfaces). The smoke spec remains the config-compile guard.
 *
 * @rules FR-1.7, NFR-O-1
 * @adr ADR-001
 * @activates-in Epic 3 (Story 3.7 — /admin/ingest route + triage components)
 *
 * GIVEN the operator accesses the ingestion dashboard
 * WHEN viewing the triage surface
 * THEN failed/dead-lettered jobs are displayed with typed error categories
 *   AND the operator can reprocess a failed job (re-enqueue to ingest:queue)
 *   AND the operator can spot-check extraction output against source text
 *   AND the dashboard shows ingestion health metrics (NFR-O-1)
 */

import { test, expect } from '@playwright/test';

/*
 * Scenario map (RED — all skipped until Story 3.7 implements the route):
 *
 * OT-1 [P0] triage queue renders failed + dead-lettered jobs
 * OT-2 [P0] each job row shows a typed error category
 * OT-3 [P0] reprocess button re-enqueues a failed job
 * OT-4 [P1] spot-check view shows source text with extracted artifacts overlaid
 * OT-5 [P1] spot-check view shows the citation-or-silence invariant
 * OT-6 [P1] health metrics panel shows success rate + throughput + queue depth + DLQ depth
 * OT-7 [P2] operator surface inherits shadcn admin patterns
 */

test.describe.skip('Story 3.7 — Operator triage surface E2E (ATDD RED)', () => {
  test('[P0] OT-1: triage queue renders failed + dead-lettered jobs', async ({ page }) => {
    // Given: the operator triage surface is deployed at /admin/ingest.
    // When: the operator navigates to it.
    await page.goto('/admin/ingest');

    // Then: the triage queue renders with a stable data-testid anchor.
    const triageQueue = page.getByTestId('operator-triage-queue');
    await expect(triageQueue).toBeVisible();

    // And: it contains rows for failed + dead-lettered jobs.
    await expect(page.getByTestId('triage-row').first()).toBeVisible();
    const deadLetterRow = page.getByTestId('triage-row-dead-lettered').first();
    await expect(deadLetterRow).toBeVisible();
  });

  test('[P0] OT-2: each job row displays a typed error category', async ({ page }) => {
    // Given: a triage queue with failed jobs.
    await page.goto('/admin/ingest');
    // When: the operator inspects a failed-job row.
    const failedRow = page.getByTestId('triage-row-failed').first();
    await expect(failedRow).toBeVisible();
    // Then: the row shows a typed error category badge.
    const errorBadge = failedRow.getByTestId('error-category-badge');
    await expect(errorBadge).toBeVisible();
    // And: the category is one of the known typed errors (not a raw stack).
    await expect(errorBadge).toContainText(/ocr|fetch|parse|timeout|dedup|unknown/);
  });

  test('[P0] OT-3: reprocess button re-enqueues a failed job', async ({ page }) => {
    // Given: a failed job in the triage queue.
    await page.goto('/admin/ingest');
    const failedRow = page.getByTestId('triage-row-failed').first();
    await expect(failedRow).toBeVisible();
    // When: the operator clicks "Reprocess".
    const reprocessButton = failedRow.getByTestId('reprocess-button');
    await reprocessButton.click();
    // Then: a success toast/confirmation appears.
    await expect(page.getByTestId('reprocess-confirmed')).toBeVisible();
    // And: the row transitions out of the failed state (re-enqueued).
    await expect(failedRow.getByTestId('row-status')).toHaveText(/requeued|processing/);
  });

  test('[P1] OT-4: spot-check view shows source text with extracted artifacts overlaid', async ({ page }) => {
    // Given: a job with extraction output.
    await page.goto('/admin/ingest');
    const jobRow = page.getByTestId('triage-row').first();
    // When: the operator opens the spot-check view.
    await jobRow.getByTestId('spot-check-button').click();
    // Then: a side-by-side view opens.
    const spotCheck = page.getByTestId('spot-check-view');
    await expect(spotCheck).toBeVisible();
    // And: the document text is shown.
    await expect(spotCheck.getByTestId('source-text')).toBeVisible();
    // And: extracted entities are highlighted.
    await expect(spotCheck.getByTestId('entity-highlight').first()).toBeVisible();
    // And: extracted claims are marked.
    await expect(spotCheck.getByTestId('claim-marker').first()).toBeVisible();
  });

  test('[P1] OT-5: spot-check view shows the citation-or-silence invariant', async ({ page }) => {
    // Given: the spot-check view is open.
    await page.goto('/admin/ingest');
    await page.getByTestId('triage-row').first().getByTestId('spot-check-button').click();
    const spotCheck = page.getByTestId('spot-check-view');
    // Then: every claim marker links to a citation (or shows an explicit "no evidence" state).
    const claimMarkers = spotCheck.getByTestId('claim-marker');
    const count = await claimMarkers.count();
    for (let i = 0; i < count; i++) {
      const marker = claimMarkers.nth(i);
      // Each marker EITHER has a citation link OR an explicit no-evidence badge.
      const hasCitation = await marker.getByTestId('citation-link').count();
      const hasNoEvidence = await marker.getByTestId('no-evidence-badge').count();
      expect(hasCitation + hasNoEvidence).toBeGreaterThan(0);
    }
  });

  test('[P1] OT-6: health metrics panel shows success rate + throughput + queue depth + DLQ depth', async ({ page }) => {
    // Given: the operator triage surface.
    await page.goto('/admin/ingest');
    // Then: the health metrics panel is visible.
    const metrics = page.getByTestId('ingestion-health-metrics');
    await expect(metrics).toBeVisible();
    // And: it shows all four required metrics (NFR-O-1).
    await expect(metrics.getByTestId('metric-success-rate')).toBeVisible();
    await expect(metrics.getByTestId('metric-throughput')).toBeVisible();
    await expect(metrics.getByTestId('metric-queue-depth')).toBeVisible();
    await expect(metrics.getByTestId('metric-dlq-depth')).toBeVisible();
  });

  test('[P2] OT-7: operator surface inherits shadcn admin patterns', async ({ page }) => {
    // Given: the operator triage surface.
    await page.goto('/admin/ingest');
    // Then: the layout uses the shadcn admin shell (sidebar + main).
    await expect(page.getByTestId('admin-sidebar')).toBeVisible();
    await expect(page.getByTestId('admin-main')).toBeVisible();
    // And: the triage queue uses a data table pattern.
    await expect(page.getByTestId('triage-data-table')).toBeVisible();
  });
});
