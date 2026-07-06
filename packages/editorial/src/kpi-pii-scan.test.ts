/**
 * PII exclusion verification (Story 2.8, DoD-18, AC #6).
 *
 * @rules DoD-18, AR-25, G-6, AC-11
 * @adr ADR-0001
 *
 * Scans KPI event payloads + captured stdout for PII:
 *   - email addresses (RFC 5322 simplified)
 *   - IPv4 / IPv6 addresses
 *   - names matching test fixture identities (the canonical fixture names
 *     used across the repo's test suite)
 *
 * The scan runs at CI time so PII leakage is caught before production, not
 * during a post-proceeding audit. Per Dev Notes: "The KPI event payloads
 * must not carry PII. Keep descriptions and partner names
 * high-level/organizational."
 */
import { describe, it, expect } from 'vitest';
import { createKpiLogger } from './kpi-logger.js';
import type { EditorialLogRepo } from './types.js';

// ─────────────────────────────────────────────────────────────────────────
// PII detection patterns
// ─────────────────────────────────────────────────────────────────────────

/** Simplified email regex (sufficient for leak detection, not validation). */
const EMAIL_RE = /[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}/;

/** IPv4 regex — matches dotted-quad, rejecting version numbers like 1.2.3. */
const IPV4_RE = /\b(?:\d{1,3}\.){3}\d{1,3}\b/;

/**
 * IPv6 regex (simplified — matches the common compressed forms). Production
 * PII scanners should use a fuller grammar; this catches the obvious case.
 */
const IPV6_RE = /\b(?:[A-Fa-f0-9]{1,4}:){2,7}[A-Fa-f0-9]{1,4}\b/;

/**
 * Test-fixture identity names — the canonical human names used across the
 * repo's test fixtures. If any of these leak into a KPI payload, the scan
 * fails. These are deliberately the names that would re-identify a real
 * subject if they appeared in a defamation-grade audit log.
 */
const FIXTURE_NAMES = [
  'Sherwin',
  'Gorechomante',
  'anti lustay',
  'Juan dela Cruz',
  'Maria Santos',
  'Test User',
  'testuser',
  'sherwin.gorechomante',
] as const;

/** Detect any PII token in a string. Returns the first match or null. */
function detectPii(text: string): { kind: string; match: string } | null {
  const email = text.match(EMAIL_RE);
  if (email) return { kind: 'email', match: email[0] };
  const ipv4 = text.match(IPV4_RE);
  if (ipv4 && isValidIpv4(ipv4[0])) return { kind: 'ipv4', match: ipv4[0] };
  const ipv6 = text.match(IPV6_RE);
  if (ipv6) return { kind: 'ipv6', match: ipv6[0] };
  for (const name of FIXTURE_NAMES) {
    if (text.toLowerCase().includes(name.toLowerCase())) {
      return { kind: 'fixture_name', match: name };
    }
  }
  return null;
}

/** Reject false-positive IPv4 matches like semver "1.2.3.4" in version strings. */
function isValidIpv4(s: string): boolean {
  const parts = s.split('.').map(Number);
  return parts.length === 4 && parts.every((p) => p >= 0 && p <= 255);
}

// ─────────────────────────────────────────────────────────────────────────
// Capturing editorial log mock
// ─────────────────────────────────────────────────────────────────────────

/** A mock repo that captures every appended payload for PII scanning. */
function makeCapturingRepo(): {
  repo: EditorialLogRepo;
  payloads: Array<{ event: string; payload: unknown }>;
} {
  const payloads: Array<{ event: string; payload: unknown }> = [];
  let seq = 0;
  const repo: EditorialLogRepo = {
    async append() {
      return { ok: true, seq: ++seq as never };
    },
    async appendToPartition(params) {
      payloads.push({ event: params.event, payload: params.payload });
      return ++seq as never;
    },
    async getTip() {
      return null;
    },
    async queryLog() {
      return [];
    },
    async verifyChain() {
      return {
        partitionKey: '__pd2__',
        valid: true,
        entriesVerified: 0,
        failures: [],
        warnings: [],
        verifiedAt: new Date(),
      };
    },
  };
  return { repo, payloads };
}

// ─────────────────────────────────────────────────────────────────────────
// stdout capture
// ─────────────────────────────────────────────────────────────────────────

/**
 * Async-friendly stdout capture. Runs `fn`, collecting every console output
 * line, and returns the merged output alongside the result.
 */
async function captureStdoutAsync<T>(fn: () => Promise<T>): Promise<{ output: string; result: T }> {
  const chunks: string[] = [];
  const origLog = console.log;
  const origErr = console.error;
  const origWarn = console.warn;
  const origInfo = console.info;
  const push = (...args: unknown[]) => chunks.push(args.map((a) => (typeof a === 'string' ? a : String(a))).join(' '));
  console.log = push;
  console.error = push;
  console.warn = push;
  console.info = push;
  try {
    const result = await fn();
    return { output: chunks.join('\n'), result };
  } finally {
    console.log = origLog;
    console.error = origErr;
    console.warn = origWarn;
    console.info = origInfo;
  }
}

// ─────────────────────────────────────────────────────────────────────────
// Tests
// ─────────────────────────────────────────────────────────────────────────

describe('Story 2.8 — PII exclusion verification (DoD-18, AC #6)', () => {
  it('KPI event payloads carry ZERO email/IP/fixture-name PII', async () => {
    const { repo, payloads } = makeCapturingRepo();
    const kpi = createKpiLogger({
      repo,
      signer: async () => 'sig' as never,
      jti: () => `jti-${Math.random()}`,
    });

    // Emit one of each event type with organizational-only payloads.
    await kpi.logVerificationObserved({
      partner_name: 'PRESS_FORUM_X',
      sample_size: 12,
      errors_found: 0,
    });
    await kpi.logEngagementRationale({
      partner_name: 'CIVIL_SOCIETY_Y',
      rationale_summary: 'Cited citation-provenance as basis for adoption.',
      provenance_cited: true,
    });
    await kpi.logDay90({
      outcome: 'question_donated',
      partner_name: 'NEWSROOM_Z',
      document_count: 5,
    });
    await kpi.logGateBypassAttempt({
      query: 'senator-vote-record-2024',
      details: 'serve-without-gate',
    });
    await kpi.logProceedingEarlyTermination({
      proceeding_id: 'proc-2024-001',
      termination_date: '2024-01-15',
      kpi_status: { day30: true, day60: false, day90: false },
    });

    // Scan every captured payload (serialised as JSON) for PII.
    expect(payloads.length).toBeGreaterThanOrEqual(5);
    for (const { event, payload } of payloads) {
      const serialised = JSON.stringify({ event, payload });
      const pii = detectPii(serialised);
      expect(pii).toBeNull();
    }
  });

  it('stdout during KPI logging carries ZERO PII', async () => {
    const { repo } = makeCapturingRepo();
    const kpi = createKpiLogger({
      repo,
      signer: async () => 'sig' as never,
      jti: () => `jti-${Math.random()}`,
    });

    const { output } = await captureStdoutAsync(async () => {
      await kpi.logVerificationObserved({
        partner_name: 'PRESS_FORUM_X',
        sample_size: 1,
        errors_found: 0,
      });
      await kpi.logDay90({
        outcome: 'partnership_committed',
        partner_name: 'NEWSROOM_Z',
        commitment_type: 'pilot_access',
      });
    });

    const pii = detectPii(output);
    expect(pii).toBeNull();
  });

  it('the PII detector catches a deliberate leak (negative control)', () => {
    // Verify the detector actually fires — if it silently passes a known
    // leak, the preceding tests are vacuous.
    const withEmail = JSON.stringify({
      event: 'external.verification.observed',
      payload: { partner_name: 'leaker@example.com' },
    });
    expect(detectPii(withEmail)?.kind).toBe('email');

    const withIp = JSON.stringify({
      event: 'gate.bypass_attempt',
      payload: { query: 'from 10.0.0.1' },
    });
    expect(detectPii(withIp)?.kind).toBe('ipv4');

    const withName = JSON.stringify({
      event: 'external.engagement.rationale',
      payload: { partner_name: 'Sherwin personally' },
    });
    expect(detectPii(withName)?.kind).toBe('fixture_name');
  });

  it('partner names in payloads are organizational (UPPER_SNAKE_CASE), not human names', async () => {
    const { repo, payloads } = makeCapturingRepo();
    const kpi = createKpiLogger({
      repo,
      signer: async () => 'sig' as never,
      jti: () => `jti-${Math.random()}`,
    });

    await kpi.logVerificationObserved({
      partner_name: 'PRESS_FORUM_X',
      sample_size: 1,
      errors_found: 0,
    });
    await kpi.logEngagementRationale({
      partner_name: 'CIVIL_SOCIETY_Y',
      rationale_summary: 'x',
      provenance_cited: true,
    });

    // Every partner_name looks organizational, not like a human name.
    for (const { payload } of payloads) {
      const p = payload as { partner_name?: string };
      if (p.partner_name !== undefined) {
        // Organizational names are uppercase / snake-case; human names have
        // mixed case + spaces. This is a heuristic guard, not a hard rule —
        // the PII detector above is the authoritative check.
        expect(p.partner_name).toMatch(/^[A-Z][A-Z0-9_]*$/);
      }
    }
  });
});
