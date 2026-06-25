import { describe, it, expect } from 'vitest';
import { EvalInput, EvalResult, EVAL_SCHEMA_VERSION } from './eval.js';

describe('EvalInput / EvalResult (Story 1.5)', () => {
  describe('schemaVersion pinning (AC #1, #7)', () => {
    it('exposes a pinned EVAL_SCHEMA_VERSION constant', () => {
      expect(EVAL_SCHEMA_VERSION).toBe('1.0.0');
    });

    it('accepts a valid EvalInput', () => {
      const parsed = EvalInput.safeParse({
        schemaVersion: '1.0.0',
        suite: 'smoke',
        fixtures: [{ id: 'f1', payload: { q: 'a' } }],
      });
      expect(parsed.success).toBe(true);
    });

    it('accepts a valid EvalResult', () => {
      const parsed = EvalResult.safeParse({
        schemaVersion: '1.0.0',
        suite: 'smoke',
        metrics: [{ fixture_id: 'f1', metric: 'faithfulness', score: 0.875 }],
      });
      expect(parsed.success).toBe(true);
    });

    it('rejects a mismatched schemaVersion on EvalInput', () => {
      const parsed = EvalInput.safeParse({
        schemaVersion: '2.0.0',
        suite: 'smoke',
        fixtures: [],
      });
      expect(parsed.success).toBe(false);
    });

    it('rejects a mismatched schemaVersion on EvalResult', () => {
      const parsed = EvalResult.safeParse({
        schemaVersion: '0.9.0',
        suite: 'smoke',
        metrics: [],
      });
      expect(parsed.success).toBe(false);
    });
  });

  describe('unknown field rejection — z.strictObject (AC #7)', () => {
    it('rejects unknown fields on EvalInput', () => {
      const parsed = EvalInput.safeParse({
        schemaVersion: '1.0.0',
        suite: 'smoke',
        fixtures: [],
        rogue: 'nope',
      });
      expect(parsed.success).toBe(false);
    });

    it('rejects unknown fields on EvalResult', () => {
      const parsed = EvalResult.safeParse({
        schemaVersion: '1.0.0',
        suite: 'smoke',
        metrics: [],
        rogue: 'nope',
      });
      expect(parsed.success).toBe(false);
    });

    it('rejects score out of [0,1] range', () => {
      const parsed = EvalResult.safeParse({
        schemaVersion: '1.0.0',
        suite: 'smoke',
        metrics: [{ fixture_id: 'f1', metric: 'm', score: 1.5 }],
      });
      expect(parsed.success).toBe(false);
    });

    it('rejects non-finite score (NaN)', () => {
      const parsed = EvalResult.safeParse({
        schemaVersion: '1.0.0',
        suite: 'smoke',
        metrics: [{ fixture_id: 'f1', metric: 'm', score: Number.NaN }],
      });
      expect(parsed.success).toBe(false);
    });
  });
});
