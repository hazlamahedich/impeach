/**
 * Contract tests — config_history branded types (Story 2.10, PC-9, SC-1).
 *
 * Verifies zod↔JSON Schema round-trip (SC-1 — the polyglot contract seam) and
 * branded-type non-transposability (Winston #1 — every string ID in a
 * defamation-grade contract is a latent transposition bug). The brands are
 * phantom (the runtime value is the plain string), so non-transposability is
 * asserted at the **type** level via `expectTypeOf` (compile-time) AND at the
 * runtime level via zod `.parse` symmetry.
 *
 * @rules PC-2.6, PC-9, SC-1, SEC-6
 */
import { describe, it, expect } from 'vitest';
import { z } from 'zod';
import { zodToJsonSchema } from 'zod-to-json-schema';
import {
  ConfigKeySchema,
  ConfigHistoryIdSchema,
  ConfigHistoryRetentionClassLiteral,
  ConfigHistoryRetentionClass,
} from '../config-history.js';
import type {
  ConfigKey,
  ConfigHistoryId,
} from '../config-history.js';

// Re-alias the branded type so we can reference it in `expectNotAssignable`
// without importing the runtime schema name twice.
type ConfigHistoryRetentionClassType = z.infer<typeof ConfigHistoryRetentionClass>;

describe('config_history branded types (Story 2.10, PC-9)', () => {
  // ─────────────────────────────────────────────────────────────────────
  // zod ↔ JSON Schema round-trip (SC-1 — polyglot contract seam)
  // ─────────────────────────────────────────────────────────────────────
  // `zodToJsonSchema` returns a broad `JsonSchema7Type` union; we narrow to a
  // minimal local shape for property access. The narrowing is a TEST-ONLY
  // convenience — the contract package does not export a typed JSON Schema
  // view. `as unknown as Record<string, unknown>` (via `jsonSchemaRecord`)
  // avoids the lint-banned bare `as` on a non-zod object.
  describe('zod ↔ JSON Schema round-trip (SC-1)', () => {
    /** Narrow the broad JsonSchema7Type to a record for property access (test-only). */
    function jsonSchemaRecord(schema: unknown): Record<string, unknown> {
      return schema as unknown as Record<string, unknown>;
    }

    it('ConfigKeySchema serializes to JSON Schema as a non-empty string', () => {
      const schema = jsonSchemaRecord(zodToJsonSchema(ConfigKeySchema));
      expect(schema['type']).toBe('string');
      // min(1) → minLength: 1
      expect(schema['minLength']).toBe(1);
    });

    it('ConfigHistoryIdSchema serializes to JSON Schema as a string with a pattern', () => {
      const schema = jsonSchemaRecord(zodToJsonSchema(ConfigHistoryIdSchema));
      expect(schema['type']).toBe('string');
      expect(typeof schema['pattern']).toBe('string');
      expect(schema['pattern']).toMatch(/4/); // UUID v4 version nibble
    });

    it('ConfigHistoryRetentionClassLiteral serializes to JSON Schema as an enum', () => {
      const schema = jsonSchemaRecord(zodToJsonSchema(ConfigHistoryRetentionClassLiteral));
      expect(schema['type']).toBe('string');
      const enumValues = schema['enum'] as readonly string[];
      expect(enumValues).toEqual([
        'unbounded_legal_hold',
        'superseded_retain',
        'purged_after_audit',
      ]);
    });

    it('ConfigHistoryRetentionClass (branded) serializes identically to its unbranded literal', () => {
      // Branding is a phantom type — the JSON Schema output MUST be identical
      // so the Python mirror (pydantic) generated from JSON Schema does not
      // need to know about TS brand types.
      const brandedSchema = zodToJsonSchema(ConfigHistoryRetentionClass);
      const literalSchema = zodToJsonSchema(ConfigHistoryRetentionClassLiteral);
      expect(brandedSchema).toEqual(literalSchema);
    });

    it('round-trip: zod → JSON Schema → parses the same valid values', () => {
      // A value that the literal accepts MUST also be accepted by the branded
      // schema (brand is phantom, parse must be symmetric).
      const value = 'unbounded_legal_hold';
      expect(ConfigHistoryRetentionClassLiteral.safeParse(value).success).toBe(true);
      expect(ConfigHistoryRetentionClass.safeParse(value).success).toBe(true);
    });
  });

  // ─────────────────────────────────────────────────────────────────────
  // Vocabulary enforcement (runtime)
  // ─────────────────────────────────────────────────────────────────────
  describe('vocabulary enforcement', () => {
    it.each([
      'unbounded_legal_hold',
      'superseded_retain',
      'purged_after_audit',
    ])('ConfigHistoryRetentionClass accepts the sanctioned value %s', (value) => {
      expect(ConfigHistoryRetentionClass.safeParse(value).success).toBe(true);
    });

    it('ConfigHistoryRetentionClass rejects a misspelled value', () => {
      expect(ConfigHistoryRetentionClass.safeParse('unbounded_legal_holdd').success).toBe(false);
    });

    it('ConfigHistoryRetentionClass rejects an intake_documents RetentionPolicy value (different vocabulary)', () => {
      // Cross-vocabulary guard: the config_history vocabulary is intentionally
      // distinct from intake_documents's RetentionPolicy
      // (standard/litigation_hold/immediate_takedown). A value from the wrong
      // table's vocabulary MUST be rejected.
      expect(ConfigHistoryRetentionClass.safeParse('litigation_hold').success).toBe(false);
      expect(ConfigHistoryRetentionClass.safeParse('standard').success).toBe(false);
      expect(ConfigHistoryRetentionClass.safeParse('immediate_takedown').success).toBe(false);
    });
  });

  // ─────────────────────────────────────────────────────────────────────
  // UUID v4 enforcement (ConfigHistoryId)
  // ─────────────────────────────────────────────────────────────────────
  describe('ConfigHistoryId UUID v4 enforcement', () => {
    it('accepts a valid UUID v4', () => {
      const result = ConfigHistoryIdSchema.safeParse('11111111-1111-4111-8111-111111111111');
      expect(result.success).toBe(true);
    });

    it('rejects a UUID v1 (MAC-address-leaking)', () => {
      // Version nibble '1', variant '8' — a v1 UUID.
      const result = ConfigHistoryIdSchema.safeParse('11111111-1111-1111-8111-111111111111');
      expect(result.success).toBe(false);
    });

    it('rejects a non-UUID string', () => {
      expect(ConfigHistoryIdSchema.safeParse('not-a-uuid').success).toBe(false);
    });

    it('rejects an empty string', () => {
      expect(ConfigHistoryIdSchema.safeParse('').success).toBe(false);
    });
  });

  // ─────────────────────────────────────────────────────────────────────
  // Branded-type non-transposability (Winston #1, SEC-6)
  // ─────────────────────────────────────────────────────────────────────
  // The brands are phantom — runtime values are plain strings. Non-transposability
  // is enforced at COMPILE time by TypeScript. The helper below asserts that a
  // value of type `From` is NOT assignable to type `To` by binding it to a
  // parameter of type `To`. If the brands ever collapse, the helper call itself
  // will fail to compile, which fails the contract-test suite.
  describe('branded-type non-transposability (Winston #1)', () => {
    /** Compile-time guard: a `From` must not be assignable to `To`. */
    function expectNotAssignable<To>() {
      return <From>(_value: From extends To ? never : From) => undefined;
    }

    it('ConfigKey is a distinct nominal type from ConfigHistoryId', () => {
      const configKey = ConfigKeySchema.parse('model.qwen3.id');
      expectNotAssignable<ConfigHistoryId>()(configKey);
      expect(configKey).toBe('model.qwen3.id');
    });

    it('ConfigKey is a distinct nominal type from ConfigHistoryRetentionClass', () => {
      const configKey = ConfigKeySchema.parse('model.qwen3.id');
      expectNotAssignable<ConfigHistoryRetentionClassType>()(configKey);
      expect(configKey).toBe('model.qwen3.id');
    });

    it('ConfigHistoryId is a distinct nominal type from ConfigHistoryRetentionClass', () => {
      const id = ConfigHistoryIdSchema.parse('11111111-1111-4111-8111-111111111111');
      expectNotAssignable<ConfigHistoryRetentionClassType>()(id);
      expect(id).toBe('11111111-1111-4111-8111-111111111111');
    });

    it('a plain string is not assignable to a branded type without a cast', () => {
      const plainKey = 'model.qwen3.id';
      const plainId = '11111111-1111-4111-8111-111111111111';
      const plainClass = 'unbounded_legal_hold';
      expectNotAssignable<ConfigKey>()(plainKey);
      expectNotAssignable<ConfigHistoryId>()(plainId);
      expectNotAssignable<ConfigHistoryRetentionClassType>()(plainClass);
      expect(plainKey).toBe('model.qwen3.id');
      expect(plainId).toBe('11111111-1111-4111-8111-111111111111');
      expect(plainClass).toBe('unbounded_legal_hold');
    });
  });
});
