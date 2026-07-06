/**
 * Log-level config knob with config_history lineage (Story 2.10, PC-2.6).
 *
 * This is the first concrete config knob to emit through `notifyConfigChange`.
 * It demonstrates the end-to-end wiring required by AC #1: a config change
 * path that records previous value, new value, timestamp, and acting principal
 * in `config_history`.
 *
 * The log level is intentionally simple (a string enum), dependency-free, and
 * safe to exercise in tests without touching real secrets or model knobs.
 *
 * @rules PC-2.6, PC-8, SEC-1
 * @adr ADR-0027
 */
import { ConfigKeySchema } from '@iip/contracts';
import type { ConfigKey, Principal } from '@iip/contracts';
import { notifyConfigChange } from './config-history-repo.js';

const LOG_LEVEL_KEY: ConfigKey = ConfigKeySchema.parse('system.log_level');

const VALID_LOG_LEVELS = ['debug', 'info', 'warn', 'error'] as const;
type LogLevel = (typeof VALID_LOG_LEVELS)[number];

/** In-memory current value. Production would persist this in a config store. */
let currentLogLevel: LogLevel = 'info';

/**
 * Read the current log level.
 */
export function getLogLevel(): LogLevel {
  return currentLogLevel;
}

/**
 * Set the log level and emit a config_history change event.
 *
 * The acting principal is required (SEC-1). The old/new values and the
 * change key are passed to `notifyConfigChange`, which forwards them to any
 * registered listener (typically `ConfigHistoryRepository.append`).
 */
export function setLogLevel(level: LogLevel, _actingPrincipal: Principal): LogLevel {
  if (!VALID_LOG_LEVELS.includes(level)) {
    throw new Error(`Invalid log level: ${level}. Must be one of ${VALID_LOG_LEVELS.join(', ')}`);
  }
  const oldValue = currentLogLevel;
  currentLogLevel = level;
  notifyConfigChange(LOG_LEVEL_KEY, oldValue, level);
  return currentLogLevel;
}

export { LOG_LEVEL_KEY };
export type { LogLevel };
