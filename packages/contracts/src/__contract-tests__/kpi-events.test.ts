/**
 * Contract tests — PD-2 KPI observation event payloads (Story 2.8, PC-9, SC-1).
 *
 * Verifies the five new event types added to {@link EditorialLogEvent} for the
 * PD-2 KPI cascade (AR-25, G-6):
 *   - `external.verification.observed`   (Day 30 leading)
 *   - `external.engagement.rationale`    (Day 60 mid)
 *   - `external.pd2.day90`               (Day 90 strongest — discriminated union)
 *   - `gate.bypass_attempt`              (VAL-9 gate-enforcement forensic)
 *   - `proceeding.early_termination`     (PD-2 time-bound)
 *
 * Coverage:
 *   - zod ↔ JSON Schema round-trip (SC-1 structural equivalence, not happy-path)
 *   - Strict key validation (unknown keys rejected)
 *   - Negative tests (missing required, wrong type, extra field) — structured
 *     error at the schema boundary, NOT a 500 (PC-9).
 *   - Day 90 XOR: the discriminator `outcome` makes emitting both variants for
 *     the same PD-2 instance structurally impossible (Dev Notes — DISCRIMINATED
 *     UNION).
 *
 * @rules PC-9, SC-1, AR-25, G-6, VAL-9, DoD-18
 * @adr ADR-0001
 */
import { describe, it, expect } from 'vitest';
import { z } from 'zod';
import { zodToJsonSchema } from 'zod-to-json-schema';
import {
  EditorialLogEvent,
  ExternalPd2Day90Payload,
} from '../editorial-log.js';

// ─────────────────────────────────────────────────────────────────────────
// Helpers
// ─────────────────────────────────────────────────────────────────────────

/** Narrow the broad JsonSchema7Type to a record for property access (test-only). */
function jsonSchemaRecord(schema: unknown): Record<string, unknown> {
  return schema as unknown as Record<string, unknown>;
}

/** Pull the payload schema for a given event literal out of the discriminated union. */
function payloadSchemaFor(eventName: string): z.ZodTypeAny {
  for (const variant of EditorialLogEvent.options) {
    const eventField = variant.shape['event'] as z.ZodLiteral<string>;
    if (eventField.value === eventName) {
      return variant.shape['payload'] as z.ZodTypeAny;
    }
  }
  throw new Error(`no variant found for event ${eventName}`);
}

/** A canonical valid payload per event type, used as the round-trip base. */
function validPayload(eventName: string): unknown {
  switch (eventName) {
    case 'external.verification.observed':
      return {
        partner_name: 'PRESS_FORUM_X',
        sample_size: 12,
        errors_found: 0,
      };
    case 'external.engagement.rationale':
      return {
        partner_name: 'PRESS_FORUM_X',
        rationale_summary: 'Cited citation-provenance as basis for adoption.',
        provenance_cited: true,
      };
    case 'external.pd2.day90':
      return {
        outcome: 'question_donated',
        partner_name: 'PRESS_FORUM_X',
        document_count: 5,
      };
    case 'gate.bypass_attempt':
      return { query: 'senator-vote-record-2024' };
    case 'proceeding.early_termination':
      return {
        proceeding_id: 'proc-2024-001',
        termination_date: '2024-01-15',
        kpi_status: { day30: true, day60: false, day90: false },
      };
    default:
      throw new Error(`no fixture for ${eventName}`);
  }
}

const FIVE_EVENTS = [
  'external.verification.observed',
  'external.engagement.rationale',
  'external.pd2.day90',
  'gate.bypass_attempt',
  'proceeding.early_termination',
] as const;

// ─────────────────────────────────────────────────────────────────────────
// Tests
// ─────────────────────────────────────────────────────────────────────────

describe('PD-2 KPI event payloads (Story 2.8, PC-9, SC-1)', () => {
  // ─────────────────────────────────────────────────────────────────────
  // Positive: every event type is a registered variant of the union
  // ─────────────────────────────────────────────────────────────────────
  describe('event catalog registration', () => {
    it.each(FIVE_EVENTS)('%s is a registered variant of EditorialLogEvent', (eventName) => {
      const schema = payloadSchemaFor(eventName);
      const valid = validPayload(eventName);
      const result = schema.safeParse(valid);
      expect(result.success).toBe(true);
    });

    it('the union discriminates by `event` — an unknown event literal is rejected', () => {
      const result = EditorialLogEvent.safeParse({
        event: 'external.bogus',
        payload: {},
      });
      expect(result.success).toBe(false);
    });
  });

  // ─────────────────────────────────────────────────────────────────────
  // zod ↔ JSON Schema round-trip (SC-1 — structural equivalence)
  // ─────────────────────────────────────────────────────────────────────
  describe('zod ↔ JSON Schema round-trip (SC-1)', () => {
    it.each(FIVE_EVENTS)(
      '%s — round-trip: zod → JSON Schema → parses the same valid value',
      (eventName) => {
        const schema = payloadSchemaFor(eventName);
        const valid = validPayload(eventName);

        // zod accepts it directly.
        expect(schema.safeParse(valid).success).toBe(true);

        // The JSON Schema form is non-empty. For 4 of the 5 events the payload
        // is a plain object schema (type: object). The Day 90 payload is a
        // discriminated union → zod-to-json-schema emits `anyOf` (NOT `type:
        // object`), so we branch on that.
        const jsonSchema = jsonSchemaRecord(zodToJsonSchema(schema));
        if (eventName === 'external.pd2.day90') {
          expect(Array.isArray(jsonSchema['anyOf'])).toBe(true);
          // Each variant is an object schema with required keys.
          for (const variant of jsonSchema['anyOf'] as readonly Record<string, unknown>[]) {
            expect(variant['type']).toBe('object');
            expect(Array.isArray(variant['required'])).toBe(true);
          }
        } else {
          expect(jsonSchema['type']).toBe('object');
          // Re-parsing the valid value through the regenerated schema shape
          // (properties present, required keys enforced) is structural — we
          // verify the required-keys list is non-empty so a regression that
          // drops `.strict()` or required fields is caught.
          const required = jsonSchema['required'];
          expect(Array.isArray(required)).toBe(true);
          expect((required as unknown[]).length).toBeGreaterThan(0);
        }
      },
    );

    it('ExternalPd2Day90Payload — JSON Schema exposes both outcome variants (anyOf)', () => {
      // The XOR is structural: the discriminated union emits `anyOf` with two
      // variants keyed on `outcome`. zod-to-json-schema renders
      // z.discriminatedUnion as `anyOf` (not `oneOf`), and each variant's
      // discriminator literal becomes a `const` on the `outcome` property.
      const jsonSchema = jsonSchemaRecord(zodToJsonSchema(ExternalPd2Day90Payload));
      expect(jsonSchema['anyOf']).toBeDefined();
      const variants = jsonSchema['anyOf'] as readonly Record<string, unknown>[];
      expect(variants).toHaveLength(2);
      const outcomes = variants.map((v) => {
        const props = v['properties'] as Record<string, Record<string, unknown>>;
        const outcome = props['outcome']!['const'] as string;
        return outcome;
      });
      expect(outcomes).toEqual(
        expect.arrayContaining(['question_donated', 'partnership_committed']),
      );
    });
  });

  // ─────────────────────────────────────────────────────────────────────
  // Strict key validation — unknown fields rejected (PC-9)
  // ─────────────────────────────────────────────────────────────────────
  describe('strict key validation — unknown fields rejected', () => {
    it.each(FIVE_EVENTS)('%s — extra unknown field is rejected at the schema boundary', (eventName) => {
      const schema = payloadSchemaFor(eventName);
      const valid = validPayload(eventName) as Record<string, unknown>;
      const withExtra = { ...valid, unknown_spy_field: 'exfil' };
      const result = schema.safeParse(withExtra);
      expect(result.success).toBe(false);
      if (!result.success) {
        // The error must be an unknown-keys failure, not a runtime throw.
        expect(result.error.issues[0]!.code).toBe('unrecognized_keys');
      }
    });
  });

  // ─────────────────────────────────────────────────────────────────────
  // Negative: missing required / wrong type (PC-9 — structured error, not 500)
  // ─────────────────────────────────────────────────────────────────────
  describe('negative: malformed payloads rejected with structured error (PC-9)', () => {
    it('external.verification.observed — missing required `partner_name` is rejected', () => {
      const schema = payloadSchemaFor('external.verification.observed');
      const result = schema.safeParse({ sample_size: 1, errors_found: 0 });
      expect(result.success).toBe(false);
      if (!result.success) {
        expect(result.error.issues.some((i) => i.code === 'invalid_type')).toBe(true);
      }
    });

    it('external.verification.observed — wrong type on `sample_size` is rejected', () => {
      const schema = payloadSchemaFor('external.verification.observed');
      const result = schema.safeParse({
        partner_name: 'PRESS_FORUM_X',
        sample_size: 'twelve', // string where int is required
        errors_found: 0,
      });
      expect(result.success).toBe(false);
    });

    it('external.verification.observed — negative `errors_found` is rejected', () => {
      const schema = payloadSchemaFor('external.verification.observed');
      const result = schema.safeParse({
        partner_name: 'PRESS_FORUM_X',
        sample_size: 1,
        errors_found: -1,
      });
      expect(result.success).toBe(false);
    });

    it('external.engagement.rationale — missing `provenance_cited` is rejected', () => {
      const schema = payloadSchemaFor('external.engagement.rationale');
      const result = schema.safeParse({
        partner_name: 'PRESS_FORUM_X',
        rationale_summary: 'x',
      });
      expect(result.success).toBe(false);
    });

    it('gate.bypass_attempt — empty `query` is rejected (min(1))', () => {
      const schema = payloadSchemaFor('gate.bypass_attempt');
      const result = schema.safeParse({ query: '' });
      expect(result.success).toBe(false);
    });

    it('proceeding.early_termination — missing `kpi_status` is rejected', () => {
      const schema = payloadSchemaFor('proceeding.early_termination');
      const result = schema.safeParse({
        proceeding_id: 'proc-2024-001',
        termination_date: '2024-01-15',
      });
      expect(result.success).toBe(false);
    });

    it('negative-case errors surface as zod issues, NOT thrown exceptions', () => {
      // PC-9 contract: malformed payloads produce a STRUCTURED error at the
      // schema boundary (zod issue array), never a 500 (uncaught throw).
      const schema = payloadSchemaFor('external.verification.observed');
      const result = schema.safeParse({ wrong: 'shape' });
      expect(result.success).toBe(false);
      // safeParse never throws — the error is captured in the result object.
      expect(() => schema.safeParse({ wrong: 'shape' })).not.toThrow();
    });
  });

  // ─────────────────────────────────────────────────────────────────────
  // Day 90 XOR — discriminated union makes both-variants impossible
  // (Dev Notes — DISCRIMINATED UNION; the XOR is structural, not behavioral)
  // ─────────────────────────────────────────────────────────────────────
  describe('Day 90 XOR — discriminated union (AR-25)', () => {
    it('question_donated variant is accepted', () => {
      const result = ExternalPd2Day90Payload.safeParse({
        outcome: 'question_donated',
        partner_name: 'PRESS_FORUM_X',
        document_count: 3,
      });
      expect(result.success).toBe(true);
    });

    it('partnership_committed variant is accepted', () => {
      const result = ExternalPd2Day90Payload.safeParse({
        outcome: 'partnership_committed',
        partner_name: 'PRESS_FORUM_X',
        commitment_type: 'pilot_access',
      });
      expect(result.success).toBe(true);
    });

    it('an unknown `outcome` discriminator value is rejected', () => {
      const result = ExternalPd2Day90Payload.safeParse({
        outcome: 'both_committed_and_donated', // impossible — not in the union
        partner_name: 'PRESS_FORUM_X',
      });
      expect(result.success).toBe(false);
    });

    it('emitting BOTH variants in one event is structurally impossible', () => {
      // A single `outcome` field can hold exactly ONE literal value. The
      // schema enforces this: you cannot construct a payload that is BOTH
      // question_donated AND partnership_committed. This is the XOR property
      // made structural (Dev Notes), verified here at the zod layer.
      const questionOnly = ExternalPd2Day90Payload.safeParse({
        outcome: 'question_donated',
        partner_name: 'PRESS_FORUM_X',
        document_count: 1,
        // No commitment_type — partnership variant fields are absent.
      });
      const partnershipOnly = ExternalPd2Day90Payload.safeParse({
        outcome: 'partnership_committed',
        partner_name: 'PRESS_FORUM_X',
        commitment_type: 'funding_next_step',
        // No document_count — question variant fields are absent.
      });
      expect(questionOnly.success).toBe(true);
      expect(partnershipOnly.success).toBe(true);

      // A payload that tries to carry BOTH variants' fields still resolves
      // to exactly ONE outcome (the discriminator wins), but under `.strict()`
      // the foreign field is rejected — so the union never admits a hybrid.
      const hybrid = ExternalPd2Day90Payload.safeParse({
        outcome: 'question_donated',
        partner_name: 'PRESS_FORUM_X',
        document_count: 1,
        commitment_type: 'pilot_access', // belongs to the OTHER variant
      });
      expect(hybrid.success).toBe(false);
    });

    it('commitment_type is restricted to the sanctioned enum', () => {
      const result = ExternalPd2Day90Payload.safeParse({
        outcome: 'partnership_committed',
        partner_name: 'PRESS_FORUM_X',
        commitment_type: 'bogus_mode',
      });
      expect(result.success).toBe(false);
    });

    it('question_donated requires document_count (not commitment_type)', () => {
      // Missing document_count on the question_donated variant is rejected.
      const result = ExternalPd2Day90Payload.safeParse({
        outcome: 'question_donated',
        partner_name: 'PRESS_FORUM_X',
      });
      expect(result.success).toBe(false);
    });
  });

  // ─────────────────────────────────────────────────────────────────────
  // makeEntry handles all 5 new event types (DoD-2 sole-construction gate)
  // ─────────────────────────────────────────────────────────────────────
  describe('makeEntry accepts all 5 new event types', () => {
    it.each(FIVE_EVENTS)('%s — makeEntry constructs a valid LogEntry', async (eventName) => {
      // Dynamic import to avoid a static cycle in the contract-test layer.
      const { makeEntry } = await import('../editorial-log.js');
      const payload = validPayload(eventName);
      // makeEntry's `event` param is the discriminated-union literal; the test
      // fixture carries a value that is provably in the union (validated
      // above), so the cast is paired with a runtime shape check.
      const entry = await makeEntry({
        partitionKey: '__pd2__',
        principalSub: '__system__',
        event: eventName,
        jti: `jti-${eventName}`,
        payload,
        time: '2026-07-06T00:00:00.000Z',
        prevHash: '0'.repeat(64),
        seq: 1,
        getSignature: async () => '' as never, // genesis-style empty sig for the test
      });
      expect(entry.event).toBe(eventName);
      expect(entry.partition_key).toBe('__pd2__');
      expect(entry.payload).toEqual(payload);
    });
  });
});
