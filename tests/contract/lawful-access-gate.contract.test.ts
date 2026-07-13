/**
 * Story 3.2 — Lawful-Access Gate contract test (ATDD GREEN).
 *
 * The lawful-access gate decides whether a source may be crawled automatically.
 * It is defamation-adjacent: crawling a paywalled / ToS-forbidden source can
 * contaminate the corpus with unlawfully-obtained evidence, undermining every
 * downstream citation. Hence the gate is a T1 invariant and the "disable,
 * never bypass" property is mechanically enforced here.
 *
 * Activated in Story 3.2: the gate module `@iip/ingest/access/lawful-access-gate`
 * ships `assessLawfulAccess` (pure decision) + `overrideDisable` (AC-11 log
 * entry builder). This suite locks the decision matrix + override contract.
 *
 * @rules FR-1.2, NFR-L-1, SEC-5, AC-1, AC-4, AC-11
 * @adr ADR-0001, ADR-0007
 */

import { describe, it, expect } from 'vitest';
import { assessLawfulAccess, overrideDisable } from '@iip/ingest/access/lawful-access-gate';
import { SourceResponseSchema, EditorialLogEvent } from '@iip/contracts';

// ─────────────────────────────────────────────────────────────────────────────
// Helpers
// ─────────────────────────────────────────────────────────────────────────────

const SOURCE_ID = '11111111-1111-4111-8111-111111111111' as never; // branded SourceId

const ALLOWED_INPUT = {
  robotsCheck: { allowed: true, crawlDelayMs: null },
  paywallDetected: false,
  loginRequired: false,
  captchaRequired: false,
  tosForbidden: false,
};

// ─────────────────────────────────────────────────────────────────────────────
// assessLawfulAccess — decision matrix
// ─────────────────────────────────────────────────────────────────────────────

describe('Story 3.2 — Lawful-Access Gate contract', () => {
  // ─────────────────────────────────────────────────────────────────────────
  // POSITIVE: public source cleared for crawl (FR-1.2)
  // ─────────────────────────────────────────────────────────────────────────

  it('[P0] LA-1: a public source (no paywall, robots allow) → decision: allowed', () => {
    const result = assessLawfulAccess(ALLOWED_INPUT);
    expect(result.decision).toBe('allowed');
    expect(result.reason).toBe('public_source_robots_allowed');
    expect(result.recordedAt).toBeInstanceOf(Date);
  });

  // ─────────────────────────────────────────────────────────────────────────
  // NEGATIVE: disable, never bypass (FR-1.2 — the core property)
  // ─────────────────────────────────────────────────────────────────────────

  it('[P0] LA-2: a paywalled source → decision: disable (never bypass)', () => {
    const result = assessLawfulAccess({ ...ALLOWED_INPUT, paywallDetected: true });
    expect(result.decision).toBe('disable');
    expect(result.reason).toContain('paywall');
  });

  it('[P0] LA-3: a login-required source → decision: disable', () => {
    const result = assessLawfulAccess({ ...ALLOWED_INPUT, loginRequired: true });
    expect(result.decision).toBe('disable');
    expect(result.reason).toContain('login');
  });

  it('[P0] LA-4: a CAPTCHA-protected source → decision: disable', () => {
    const result = assessLawfulAccess({ ...ALLOWED_INPUT, captchaRequired: true });
    expect(result.decision).toBe('disable');
    expect(result.reason).toContain('captcha');
  });

  it('[P0] LA-5: a robots.txt-disallowed path → decision: disable (NFR-L-1)', () => {
    const result = assessLawfulAccess({
      ...ALLOWED_INPUT,
      robotsCheck: { allowed: false, crawlDelayMs: null },
    });
    expect(result.decision).toBe('disable');
    expect(result.reason).toContain('robots');
  });

  it('[P0] LA-7: a ToS-forbidden source → decision: disable', () => {
    const result = assessLawfulAccess({ ...ALLOWED_INPUT, tosForbidden: true });
    expect(result.decision).toBe('disable');
    expect(result.reason).toBe('tos_forbidden');
  });

  it('[P1] LA-8: robots.txt unreachable → decision: disable (fail-closed)', () => {
    // An unreachable robots.txt maps to robotsAllowed=false (AC-7 fail-closed);
    // the pure gate sees allowed=false and disables via robots_disallowed.
    const result = assessLawfulAccess({
      ...ALLOWED_INPUT,
      robotsCheck: { allowed: false, crawlDelayMs: null },
    });
    expect(result.decision).toBe('disable');
    expect(result.reason).toBe('robots_disallowed');
  });

  // ─────────────────────────────────────────────────────────────────────────
  // OVERRIDE: AC-11 editorial-log requirement (FR-1.2 manual override)
  // ─────────────────────────────────────────────────────────────────────────

  it('[P1] LA-6: override of a disabled source requires AC-11 justification (no silent bypass)', () => {
    // When: an operator attempts to override WITHOUT justification.
    const overrideAttempt = overrideDisable(SOURCE_ID, { justification: '', url: 'https://example.com' });
    // Then: the override is REJECTED — justification is mandatory.
    expect(overrideAttempt.ok).toBe(false);

    // When: the override includes a non-empty justification.
    const validOverride = overrideDisable(SOURCE_ID, {
      justification: 'FOI request #1234 granted 2026-07-01',
      url: 'https://example.com',
    });
    // Then: the override succeeds AND emits an AC-11 editorial-log entry.
    expect(validOverride.ok).toBe(true);
    if (validOverride.ok) {
      expect(validOverride.editorialLogEntry.event).toBe('source.access_override');
      expect(validOverride.editorialLogEntry.payload.source_id).toBe(SOURCE_ID);
      expect(validOverride.editorialLogEntry.payload.rationale).toBe('FOI request #1234 granted 2026-07-01');
    }
  });

  // ─────────────────────────────────────────────────────────────────────────
  // Contract shapes: SourceResponseSchema carries all 15 lawful-access fields
  // ─────────────────────────────────────────────────────────────────────────

  it('SourceResponseSchema parses a response with all 15 lawful-access fields', () => {
    const response = {
      id: SOURCE_ID,
      name: 'Senate Press',
      url: 'https://senate.gov/press',
      source_type: 'press_release',
      crawl_strategy: 'rss',
      trust_tier: 1,
      confirmed: false,
      confirmation_status: 'tentative',
      is_wire_service: false,
      original_publisher_id: null,
      confirmed_by: null,
      confirmed_at: null,
      confirmation_rationale: null,
      lawful_access_status: 'blocked',
      lawful_access_checked_at: '2026-07-09T00:00:00.000Z',
      robots_status: 'disallowed',
      paywall_detected: true,
      login_required: false,
      captcha_detected: false,
      terms_forbid_scraping: false,
      robots_txt_content: 'User-agent: *\nDisallow: /',
      lawful_access_confirmed: false,
      lawful_access_confirmed_by: null,
      lawful_access_confirmed_at: null,
      lawful_access_override: true,
      lawful_access_override_by: 'operator-1',
      lawful_access_override_at: '2026-07-09T00:00:01.000Z',
      lawful_access_override_rationale: 'FOI grant',
      crawling_disabled: false,
      created_at: '2026-07-09T00:00:00.000Z',
      updated_at: '2026-07-09T00:00:01.000Z',
      deleted_at: null,
    };
    const result = SourceResponseSchema.safeParse(response);
    expect(result.success).toBe(true);
  });

  it('EditorialLogEvent accepts a source.access_override event', () => {
    const event = {
      event: 'source.access_override',
      payload: {
        source_id: SOURCE_ID,
        url: 'https://example.com',
        rationale: 'FOI request #1234 granted 2026-07-01',
      },
    };
    const result = EditorialLogEvent.safeParse(event);
    expect(result.success).toBe(true);
  });

  it('EditorialLogEvent rejects a source.access_override with empty rationale', () => {
    const event = {
      event: 'source.access_override',
      payload: { source_id: SOURCE_ID, url: 'https://example.com', rationale: '' },
    };
    const result = EditorialLogEvent.safeParse(event);
    expect(result.success).toBe(false);
  });
});
