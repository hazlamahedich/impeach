/**
 * Story 3.2 — Lawful-Access Gate contract test (ATDD RED phase).
 *
 * The lawful-access gate decides whether a source may be crawled automatically.
 * It has NO implementation yet — this suite is RED by design (describe.skip)
 * until Story 3.2 ships the gate module under `packages/ingest/src/access/`.
 *
 * The gate is defamation-adjacent: crawling a paywalled / ToS-forbidden source
 * can contaminate the corpus with unlawfully-obtained evidence, undermining
 * every downstream citation. Hence the gate is a T1 invariant and the "disable,
 * never bypass" property is mechanically enforced here.
 *
 * @rules FR-1.2, NFR-L-1, SEC-5, AC-11
 * @adr ADR-001, ADR-0007
 * @activates-in Epic 3 (Story 3.2 — assessLawfulAccess gate module)
 *
 * GIVEN a source is registered for automated crawling
 * WHEN the lawful-access gate runs
 * THEN public sources are cleared for crawl
 *   AND paywall/login/CAPTCHA/ToS-forbidden sources are DISABLED (never bypassed)
 *   AND robots.txt directives are respected (NFR-L-1)
 *   AND the gate result is recorded with timestamp + operator confirmation
 *   AND a disabled source can be overridden only with AC-11-logged justification
 */

import { describe, it, expect } from 'vitest';
import { SourceSourceType, CrawlStrategy } from '@iip/contracts';

// ─── RED-PHASE STUB ────────────────────────────────────────────────────────
// Story 3.2 has not shipped `assessLawfulAccess` yet. We dynamically import so
// the suite COLLECTS without failing. Once the gate module lands, remove
// `describe.skip` and the dynamic-import wrapper.
async function loadGate() {
  // Variable specifier so Vite cannot statically resolve a subpath absent from
  // the package `exports` map (Story 3.2 module not shipped yet). The catch
  // keeps the suite GREEN at collection; describe.skip quarantines the body.
  const specifier = '@iip/ingest/access/lawful-access-gate';
  return import(specifier).catch(() => null);
}

describe.skip('Story 3.2 — Lawful-Access Gate contract (ATDD RED)', () => {
  // ─────────────────────────────────────────────────────────────────────────
  // POSITIVE: public source cleared for crawl (FR-1.2)
  // ─────────────────────────────────────────────────────────────────────────

  it('[P0] LA-1: a public source (no paywall, robots allow) → decision: ALLOW', async () => {
    const gate = await loadGate();
    // Given: a public government source whose robots.txt allows crawling.
    const input = {
      source: {
        id: 'src-allow-001',
        url: 'https://www.senate.gov/press/releases.rss',
        source_type: SourceSourceType.enum.press_release,
        crawl_strategy: CrawlStrategy.enum.rss,
      },
      robotsCheck: { allowed: true, crawlDelayMs: null },
      paywallDetected: false,
      loginRequired: false,
      captchaRequired: false,
      tosForbidden: false,
    };
    // When: the gate assesses lawful access.
    const result = gate?.assessLawfulAccess(input);
    // Then: the decision is ALLOW with a recorded timestamp.
    expect(result?.decision).toBe('allow');
    expect(result?.reason).toBe('public_source_robots_allowed');
    expect(result?.recordedAt).toBeInstanceOf(Date);
  });

  // ─────────────────────────────────────────────────────────────────────────
  // NEGATIVE: disable, never bypass (FR-1.2 — the core property)
  // ─────────────────────────────────────────────────────────────────────────

  it('[P0] LA-2: a paywalled source → decision: DISABLE (never bypass)', async () => {
    const gate = await loadGate();
    const input = {
      source: { id: 'src-paywall', url: 'https://paywalled.example.com', source_type: SourceSourceType.enum.media, crawl_strategy: CrawlStrategy.enum.api },
      robotsCheck: { allowed: true, crawlDelayMs: null },
      paywallDetected: true,
      loginRequired: false,
      captchaRequired: false,
      tosForbidden: false,
    };
    const result = gate?.assessLawfulAccess(input);
    expect(result?.decision).toBe('disable');
    expect(result?.reason).toContain('paywall');
  });

  it('[P0] LA-3: a login-required source → decision: DISABLE', async () => {
    const gate = await loadGate();
    const input = {
      source: { id: 'src-login', url: 'https://login.example.com', source_type: SourceSourceType.enum.media, crawl_strategy: CrawlStrategy.enum.list_page },
      robotsCheck: { allowed: true, crawlDelayMs: null },
      paywallDetected: false,
      loginRequired: true,
      captchaRequired: false,
      tosForbidden: false,
    };
    const result = gate?.assessLawfulAccess(input);
    expect(result?.decision).toBe('disable');
    expect(result?.reason).toContain('login');
  });

  it('[P0] LA-4: a CAPTCHA-protected source → decision: DISABLE', async () => {
    const gate = await loadGate();
    const input = {
      source: { id: 'src-captcha', url: 'https://captcha.example.com', source_type: SourceSourceType.enum.government, crawl_strategy: CrawlStrategy.enum.sitemap },
      robotsCheck: { allowed: true, crawlDelayMs: null },
      paywallDetected: false,
      loginRequired: false,
      captchaRequired: true,
      tosForbidden: false,
    };
    const result = gate?.assessLawfulAccess(input);
    expect(result?.decision).toBe('disable');
    expect(result?.reason).toContain('captcha');
  });

  it('[P0] LA-5: a robots.txt-disallowed path → decision: DISABLE (NFR-L-1)', async () => {
    const gate = await loadGate();
    const input = {
      source: { id: 'src-robots', url: 'https://blocked.example.com/secret', source_type: SourceSourceType.enum.media, crawl_strategy: CrawlStrategy.enum.rss },
      robotsCheck: { allowed: false, crawlDelayMs: null },
      paywallDetected: false,
      loginRequired: false,
      captchaRequired: false,
      tosForbidden: false,
    };
    const result = gate?.assessLawfulAccess(input);
    expect(result?.decision).toBe('disable');
    expect(result?.reason).toContain('robots');
  });

  // ─────────────────────────────────────────────────────────────────────────
  // OVERRIDE: AC-11 editorial-log requirement (FR-1.2 manual override)
  // ─────────────────────────────────────────────────────────────────────────

  it('[P1] LA-6: override of a disabled source requires AC-11 justification (no silent bypass)', async () => {
    const gate = await loadGate();
    const input = {
      source: { id: 'src-override', url: 'https://tos-forbidden.example.com', source_type: SourceSourceType.enum.media, crawl_strategy: CrawlStrategy.enum.api },
      robotsCheck: { allowed: true, crawlDelayMs: null },
      paywallDetected: false,
      loginRequired: false,
      captchaRequired: false,
      tosForbidden: true,
    };
    const assessment = gate?.assessLawfulAccess(input);
    expect(assessment?.decision).toBe('disable');

    // When: an operator attempts to override WITHOUT justification.
    const overrideAttempt = gate?.overrideDisable(input.source.id, { justification: '' });
    // Then: the override is REJECTED — justification is mandatory.
    expect(overrideAttempt?.ok).toBe(false);

    // When: the override includes a non-empty justification.
    const validOverride = gate?.overrideDisable(input.source.id, { justification: 'FOI request #1234 granted 2026-07-01' });
    // Then: the override succeeds AND emits an AC-11 editorial-log entry.
    expect(validOverride?.ok).toBe(true);
    expect(validOverride?.editorialLogEntry).toBeDefined();
    expect(validOverride?.editorialLogEntry?.event).toBe('source.access_override');
  });
});
