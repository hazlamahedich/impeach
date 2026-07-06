/**
 * Test factory for config_history rows (Story 2.10, PC-2.6, PC-9).
 *
 * Produces valid `ConfigHistoryEntry` records with sensible defaults that the
 * `ConfigHistoryRepository` (and integration tests) can consume directly. The
 * branded types (`ConfigKey`, `ConfigHistoryId`, `ConfigHistoryRetentionClass`,
 * `Principal`) are constructed via `asConfigKey` / `asConfigHistoryId` /
 * `asConfigHistoryRetentionClass` cast helpers because the brand is a
 * phantom — the runtime value is the plain string. Tests do not need to
 * exercise the zod `.parse` gate on every field to obtain a typed value.
 *
 * @rules PC-2.6, PC-9
 */
import {
  ConfigKeySchema,
  ConfigHistoryIdSchema,
  ConfigHistoryRetentionClass as ConfigHistoryRetentionClassSchema,
  PrincipalSchema,
} from '@iip/contracts';
import type {
  ConfigKey,
  ConfigHistoryId,
  ConfigHistoryRetentionClass,
  Principal,
} from '@iip/contracts';
import type { ConfigHistoryEntry } from '@iip/config';

/** Branded-bypass for tests: parse a plain string into a branded ConfigKey. */
export function asConfigKey(key: string): ConfigKey {
  return ConfigKeySchema.parse(key);
}

/** Branded-bypass for tests: parse a plain string into a branded ConfigHistoryId. */
export function asConfigHistoryId(id: string): ConfigHistoryId {
  return ConfigHistoryIdSchema.parse(id);
}

/** Branded-bypass for tests: parse a sanctioned value into a branded ConfigHistoryRetentionClass. */
export function asConfigHistoryRetentionClass(
  value: 'unbounded_legal_hold' | 'superseded_retain' | 'purged_after_audit',
): ConfigHistoryRetentionClass {
  return ConfigHistoryRetentionClassSchema.parse(value);
}

/** Branded-bypass for tests: parse a plain string into a branded Principal. */
export function asPrincipal(sub: string): Principal {
  return PrincipalSchema.parse(sub);
}

export type { ConfigHistoryEntry } from '@iip/config';

const DEFAULT_NOW = () => new Date('2026-07-06T00:00:00.000Z');

/**
 * Build a config_history entry with sensible defaults (PC-9).
 *
 * Every field can be overridden. The defaults are:
 *  - `id`: a fresh UUID v4
 *  - `config_key`: `model.qwen3.id`
 *  - `old_value`: `null` (first-ever value for the key)
 *  - `new_value`: `{ model_id: 'qwen3:14b' }`
 *  - `effective_from`: `2026-07-06T00:00:00Z` (deterministic)
 *  - `acting_principal`: `operator-001`
 *  - `retention_class`: `unbounded_legal_hold` (the default IS the truth — VAL-8)
 *  - `legal_hold`: `true` (NOT NULL DEFAULT true)
 *  - `created_at`: `2026-07-06T00:00:00Z` (deterministic)
 *
 * Deterministic timestamps (rather than `new Date()`) keep test assertions
 * stable; tests that need a fresh timestamp pass `effective_from: new Date()`
 * or `created_at: new Date()` explicitly.
 *
 * @rules PC-9, VAL-8
 */
export function makeConfigHistoryEntry(
  overrides: Partial<ConfigHistoryEntry> = {},
): ConfigHistoryEntry {
  const now = overrides.created_at ?? DEFAULT_NOW();
  return {
    id: overrides.id ?? asConfigHistoryId(crypto.randomUUID()),
    config_key: overrides.config_key ?? asConfigKey('model.qwen3.id'),
    old_value: overrides.old_value ?? null,
    new_value: overrides.new_value ?? { model_id: 'qwen3:14b' },
    effective_from: overrides.effective_from ?? DEFAULT_NOW(),
    acting_principal: overrides.acting_principal ?? asPrincipal('operator-001'),
    retention_class: overrides.retention_class ?? asConfigHistoryRetentionClass('unbounded_legal_hold'),
    legal_hold: overrides.legal_hold ?? true,
    created_at: now,
  };
}
