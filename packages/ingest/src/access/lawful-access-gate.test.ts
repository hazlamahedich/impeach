/**
 * Story 3.2 — Lawful-access gate pure-decision unit tests (DoD-4).
 *
 * Exercises `assessLawfulAccess` + `overrideDisable` as pure functions over the
 * five detection signals. The gate is defamation-adjacent (T1 invariant): the
 * core property is **disable, never bypass** — any single blocking signal
 * disables crawling; only an explicit operator override can re-enable it.
 *
 * These tests are the unit-level mutation target. Full HTTP-level coverage
 * (robots.txt fetch, paywall/login/CAPTCHA scanning) lives in Story 3.3's fetch
 * adapter + the integration test (Task 5).
 *
 * @rules FR-1.2, NFR-L-1, SEC-5, AC-1, AC-4, AC-11
 * @adr ADR-0001, ADR-0007
 */
import { describe, it, expect } from 'vitest';
import { assessLawfulAccess, overrideDisable } from './lawful-access-gate.js';

const SOURCE_ID = '11111111-1111-4111-8111-111111111111' as never; // branded SourceId

const ALLOWED_INPUT = {
  robotsCheck: { allowed: true, crawlDelayMs: null },
  paywallDetected: false,
  loginRequired: false,
  captchaRequired: false,
  tosForbidden: false,
};

describe('assessLawfulAccess', () => {
  it('[P0] a public source (all clear) → decision: allowed', () => {
    const result = assessLawfulAccess(ALLOWED_INPUT);
    expect(result.decision).toBe('allowed');
    expect(result.reason).toBe('public_source_robots_allowed');
    expect(result.recordedAt).toBeInstanceOf(Date);
  });

  it('[P0] robots-disallowed → decision: disable (NFR-L-1, priority #1)', () => {
    const result = assessLawfulAccess({ ...ALLOWED_INPUT, robotsCheck: { allowed: false, crawlDelayMs: null } });
    expect(result.decision).toBe('disable');
    expect(result.reason).toBe('robots_disallowed');
  });

  it('[P0] paywall detected → decision: disable (priority #2)', () => {
    const result = assessLawfulAccess({ ...ALLOWED_INPUT, paywallDetected: true });
    expect(result.decision).toBe('disable');
    expect(result.reason).toBe('paywall');
  });

  it('[P0] login required → decision: disable (priority #3)', () => {
    const result = assessLawfulAccess({ ...ALLOWED_INPUT, loginRequired: true });
    expect(result.decision).toBe('disable');
    expect(result.reason).toBe('login_required');
  });

  it('[P0] CAPTCHA required → decision: disable (priority #4)', () => {
    const result = assessLawfulAccess({ ...ALLOWED_INPUT, captchaRequired: true });
    expect(result.decision).toBe('disable');
    expect(result.reason).toBe('captcha');
  });

  it('[P0] ToS forbidden → decision: disable (priority #5)', () => {
    const result = assessLawfulAccess({ ...ALLOWED_INPUT, tosForbidden: true });
    expect(result.decision).toBe('disable');
    expect(result.reason).toBe('tos_forbidden');
  });

  it('priority order: robots beats paywall when both block', () => {
    const result = assessLawfulAccess({
      ...ALLOWED_INPUT,
      robotsCheck: { allowed: false, crawlDelayMs: null },
      paywallDetected: true,
    });
    expect(result.reason).toBe('robots_disallowed');
  });

  it('crawlDelayMs does not affect the allowed decision', () => {
    const result = assessLawfulAccess({ ...ALLOWED_INPUT, robotsCheck: { allowed: true, crawlDelayMs: 5000 } });
    expect(result.decision).toBe('allowed');
  });
});

describe('overrideDisable', () => {
  it('rejects an empty justification → { ok: false } (AC-11 mandatory rationale)', () => {
    const result = overrideDisable(SOURCE_ID, { justification: '', url: 'https://example.com' });
    expect(result.ok).toBe(false);
  });

  it('rejects a whitespace-only justification → { ok: false }', () => {
    const result = overrideDisable(SOURCE_ID, { justification: '   ', url: 'https://example.com' });
    expect(result.ok).toBe(false);
  });

  it('accepts a non-empty justification → { ok: true } with editorial-log entry (AC-4, AC-11)', () => {
    const result = overrideDisable(SOURCE_ID, {
      justification: 'FOI request #1234 granted 2026-07-01',
      url: 'https://example.com',
    });
    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.editorialLogEntry.event).toBe('source.access_override');
      expect(result.editorialLogEntry.payload.source_id).toBe(SOURCE_ID);
      expect(result.editorialLogEntry.payload.url).toBe('https://example.com');
      expect(result.editorialLogEntry.payload.rationale).toBe('FOI request #1234 granted 2026-07-01');
    }
  });
});
