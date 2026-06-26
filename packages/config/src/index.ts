export const packageName = '@iip/config';

export function hello(): string {
  return `alive: ${packageName}`;
}

// Story 1.11 — Sops + Age secrets + fail-closed boot (D7, NFR-S-4, ADR-019)
export {
  validateConfig,
  bootOrDie,
  type Result,
  type ConfigError,
  type ValidatedConfig,
  type DatabaseUrl,
  type RedisUrl,
} from './secrets.js';
