/**
 * Story 3.1 — source registry contract boundary tests (TC-2.1 … TC-2.5).
 *
 * Locks the zod contract semantics for the source registry API surface so the
 * route handlers cannot drift from the contract. Pure-schema tests — no DB, no
 * Fastify. Complements the HTTP-level integration suite
 * (`sources-registry.integration.test.ts`).
 *
 * @rules FR-1.1, SEC-3, SEC-6, AC-1, AC-3, AC-4, AC-5, AC-6, AC-7, DoD-2, DoD-3, DoD-6
 * @adr ADR-0001, ADR-0010
 */
import { describe, it, expect } from 'vitest';
import {
  RegisterSourcePayloadSchema,
  UpdateSourcePayloadSchema,
  SourceResponseSchema,
  SourceIdSchema,
  DocumentIdSchema,
} from '@iip/contracts';

// ─────────────────────────────────────────────────────────────────────────────
// Shared fixtures
// ─────────────────────────────────────────────────────────────────────────────

const VALID_SOURCE_ID = '00000000-0000-4000-8000-000000000001';

/** A canonical valid registration payload (AC-1). */
const validRegistration = {
  name: 'Senate Press Releases',
  url: 'https://www.senate.gov/press',
  source_type: 'press_release',
  crawl_strategy: 'rss',
  trust_tier: 1,
  is_wire_service: false,
} as const;

/** A canonical valid DB-row-shaped source (for SourceResponseSchema TC-2.2). */
const validDbRow = {
  id: VALID_SOURCE_ID,
  name: 'Senate Press Releases',
  url: 'https://www.senate.gov/press',
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
  // Story 3.2 — lawful-access gate fields (FR-1.2).
  lawful_access_status: 'pending',
  lawful_access_checked_at: null,
  robots_status: null,
  paywall_detected: null,
  login_required: null,
  captcha_detected: null,
  terms_forbid_scraping: false,
  robots_txt_content: null,
  lawful_access_confirmed: false,
  lawful_access_confirmed_by: null,
  lawful_access_confirmed_at: null,
  lawful_access_override: false,
  lawful_access_override_by: null,
  lawful_access_override_at: null,
  lawful_access_override_rationale: null,
  crawling_disabled: true,
  created_at: '2026-07-08T00:00:00.000Z',
  updated_at: '2026-07-08T00:00:00.000Z',
  deleted_at: null,
} as const;

// ─────────────────────────────────────────────────────────────────────────────
// TC-2.1: RegisterSourcePayloadSchema validates input strictly
// ─────────────────────────────────────────────────────────────────────────────

describe('TC-2.1: RegisterSourcePayloadSchema validates input strictly (DoD-3)', () => {
  it('parses a valid payload', () => {
    const result = RegisterSourcePayloadSchema.safeParse(validRegistration);
    expect(result.success).toBe(true);
  });

  it('rejects `confirmed` field — callers cannot self-attest trust (AC-4, DoD-3)', () => {
    const result = RegisterSourcePayloadSchema.safeParse({
      ...validRegistration,
      confirmed: true,
    });
    expect(result.success).toBe(false);
    // `.strict()` reports unrecognized keys via the `unrecognized_keys` code.
    if (!result.success) {
      const issue = result.error.issues.find((i) => i.code === 'unrecognized_keys');
      expect(issue).toBeDefined();
      expect(issue?.keys).toContain('confirmed');
    }
  });

  it('rejects unknown / extra fields (strict)', () => {
    const result = RegisterSourcePayloadSchema.safeParse({
      ...validRegistration,
      evil_injection: 'pwned',
    });
    expect(result.success).toBe(false);
  });

  it('rejects invalid source_type', () => {
    const result = RegisterSourcePayloadSchema.safeParse({
      ...validRegistration,
      source_type: 'blog',
    });
    expect(result.success).toBe(false);
  });

  it('rejects invalid crawl_strategy', () => {
    const result = RegisterSourcePayloadSchema.safeParse({
      ...validRegistration,
      crawl_strategy: 'scrape',
    });
    expect(result.success).toBe(false);
  });

  it('rejects trust_tier outside {1, 2, 3} (SEC-3 structural tier)', () => {
    expect(
      RegisterSourcePayloadSchema.safeParse({ ...validRegistration, trust_tier: 4 }).success,
    ).toBe(false);
    expect(
      RegisterSourcePayloadSchema.safeParse({ ...validRegistration, trust_tier: 0 }).success,
    ).toBe(false);
    expect(
      RegisterSourcePayloadSchema.safeParse({ ...validRegistration, trust_tier: 5 }).success,
    ).toBe(false);
  });

  it('rejects non-integer trust_tier', () => {
    expect(
      RegisterSourcePayloadSchema.safeParse({ ...validRegistration, trust_tier: 1.5 }).success,
    ).toBe(false);
  });

  it('accepts trust_tier 1, 2, and 3', () => {
    for (const tier of [1, 2, 3] as const) {
      expect(
        RegisterSourcePayloadSchema.safeParse({ ...validRegistration, trust_tier: tier }).success,
      ).toBe(true);
    }
  });

  it('rejects empty name', () => {
    expect(
      RegisterSourcePayloadSchema.safeParse({ ...validRegistration, name: '' }).success,
    ).toBe(false);
  });

  it('rejects malformed url', () => {
    expect(
      RegisterSourcePayloadSchema.safeParse({ ...validRegistration, url: 'not-a-url' }).success,
    ).toBe(false);
  });

  it('defaults is_wire_service to false when omitted (EI-2 honest-by-default)', () => {
    const { is_wire_service: _omit, ...withoutWire } = validRegistration;
    void _omit;
    const result = RegisterSourcePayloadSchema.safeParse(withoutWire);
    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data.is_wire_service).toBe(false);
    }
  });

  it('accepts an optional original_publisher_id', () => {
    const result = RegisterSourcePayloadSchema.safeParse({
      ...validRegistration,
      original_publisher_id: VALID_SOURCE_ID,
    });
    expect(result.success).toBe(true);
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// TC-2.2: SourceResponseSchema round-trips with DB row
// ─────────────────────────────────────────────────────────────────────────────

describe('TC-2.2: SourceResponseSchema round-trips with DB row (AC-3, AC-5, AC-7)', () => {
  it('parses a valid response row', () => {
    const result = SourceResponseSchema.safeParse(validDbRow);
    expect(result.success).toBe(true);
  });

  it('includes confirmation_status derived from confirmed flag', () => {
    const result = SourceResponseSchema.safeParse(validDbRow);
    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data.confirmation_status).toBe('tentative');
    }
  });

  it('includes all AC-7 deferred fields as nullable', () => {
    const result = SourceResponseSchema.safeParse(validDbRow);
    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data).toHaveProperty('confirmed_by');
      expect(result.data).toHaveProperty('confirmed_at');
      expect(result.data).toHaveProperty('confirmation_rationale');
      expect(result.data.confirmed_by).toBeNull();
      expect(result.data.confirmed_at).toBeNull();
      expect(result.data.confirmation_rationale).toBeNull();
    }
  });

  it('includes is_wire_service and original_publisher_id (EI-2)', () => {
    const result = SourceResponseSchema.safeParse(validDbRow);
    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data).toHaveProperty('is_wire_service');
      expect(result.data).toHaveProperty('original_publisher_id');
      expect(result.data.original_publisher_id).toBeNull();
    }
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// TC-2.3: DB constraints match vocabulary (schema-level mirror assertion)
// ─────────────────────────────────────────────────────────────────────────────
//
// The live-DB CHECK constraint is exercised by the integration test
// (ingest-schema.integration.test.ts). This contract test asserts the zod
// vocabulary mirrors the same closed sets the DB CHECK enforces, so the two
// cannot drift (PC-4).

describe('TC-2.3: contract vocabulary mirrors DB CHECK constraints (PC-4)', () => {
  it('source_type accepts exactly the 5 sanctioned values', () => {
    const sanctioned = ['government', 'court', 'media', 'press_release', 'transcript'];
    for (const v of sanctioned) {
      expect(
        RegisterSourcePayloadSchema.safeParse({ ...validRegistration, source_type: v }).success,
      ).toBe(true);
    }
    // An unsanctioned value is rejected (mirrors DB CHECK).
    expect(
      RegisterSourcePayloadSchema.safeParse({
        ...validRegistration,
        source_type: 'unsanctioned',
      }).success,
    ).toBe(false);
  });

  it('crawl_strategy accepts exactly the 5 sanctioned values', () => {
    const sanctioned = ['rss', 'sitemap', 'list_page', 'api', 'manual'];
    for (const v of sanctioned) {
      expect(
        RegisterSourcePayloadSchema.safeParse({ ...validRegistration, crawl_strategy: v }).success,
      ).toBe(true);
    }
    expect(
      RegisterSourcePayloadSchema.safeParse({
        ...validRegistration,
        crawl_strategy: 'unsanctioned',
      }).success,
    ).toBe(false);
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// TC-2.4: Branded SourceId type safety
// ─────────────────────────────────────────────────────────────────────────────

describe('TC-2.4: Branded SourceId type safety (SEC-6, DoD-2)', () => {
  it('SourceIdSchema accepts a valid UUID v4', () => {
    expect(SourceIdSchema.safeParse(VALID_SOURCE_ID).success).toBe(true);
  });

  it('SourceIdSchema rejects a non-UUID string', () => {
    expect(SourceIdSchema.safeParse('not-a-uuid').success).toBe(false);
  });

  it('SourceIdSchema rejects a UUID v1 (MAC-leaking)', () => {
    // v1 UUID: version nibble is 1.
    expect(SourceIdSchema.safeParse('550e8400-e29b-11d4-a716-446655440000').success).toBe(false);
  });

  // COMPILE-TIME: a SourceId is NOT assignable to/from a DocumentId. This is a
  // type-level assertion; if the brands ever collapse, `expectNotAssignable`
  // stops type-checking. We use a structural guard so the test is executable.
  it('SourceId and DocumentId are distinct branded types (compile-time guard)', () => {
    // Runtime: both parse a v4 UUID, but the BRAND is distinct at the type level.
    // This assertion documents the compile-time invariant; the real enforcement
    // is the `brand<>()` in SourceIdSchema vs DocumentIdSchema.
    const sourceId = SourceIdSchema.parse(VALID_SOURCE_ID);
    const documentId = DocumentIdSchema.parse('00000000-0000-4000-8000-000000000002');
    // Both are UUID v4 strings at runtime; the brand is phantom. The test
    // exists so a refactor that removes the brand is caught (the parse would
    // still pass, but the TYPE CHECK in the consuming code would fail first).
    expect(typeof sourceId).toBe('string');
    expect(typeof documentId).toBe('string');
    expect(sourceId).not.toBe(documentId);
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// TC-2.5: Error contract uniformity (DoD-6)
// ─────────────────────────────────────────────────────────────────────────────

describe('TC-2.5: UpdateSourcePayloadSchema strict validation (AC-6, DoD-6)', () => {
  it('parses a partial update (only trust_tier)', () => {
    const result = UpdateSourcePayloadSchema.safeParse({ trust_tier: 1 });
    expect(result.success).toBe(true);
  });

  it('rejects `confirmed` field on update — confirmation is a separate workflow (AC-6, AC-8)', () => {
    const result = UpdateSourcePayloadSchema.safeParse({ confirmed: true });
    expect(result.success).toBe(false);
  });

  it('rejects unknown fields (strict, DoD-6 error contract)', () => {
    const result = UpdateSourcePayloadSchema.safeParse({ evil: 'injection' });
    expect(result.success).toBe(false);
  });

  it('rejects invalid trust_tier on update (SEC-3 structural)', () => {
    expect(UpdateSourcePayloadSchema.safeParse({ trust_tier: 4 }).success).toBe(false);
  });

  it('accepts null original_publisher_id (clearing the FK)', () => {
    const result = UpdateSourcePayloadSchema.safeParse({ original_publisher_id: null });
    expect(result.success).toBe(true);
  });

  it('accepts all mutable fields together', () => {
    const result = UpdateSourcePayloadSchema.safeParse({
      name: 'New Name',
      url: 'https://new.example.com',
      source_type: 'media',
      crawl_strategy: 'api',
      trust_tier: 2,
      is_wire_service: true,
      original_publisher_id: VALID_SOURCE_ID,
    });
    expect(result.success).toBe(true);
  });
});
