/**
 * Sops + Age secrets loading + fail-closed boot validation (D7, NFR-S-4).
 *
 * Secrets are stored at-rest in the repository using ``sops`` with ``age``
 * encryption keys. At process boot (API, ingest-worker, serve-worker,
 * audit-worker, enqueuer) ``bootOrDie()`` MUST be called first; any
 * validation failure logs a pino fatal entry and exits with code 1.
 *
 * The validator NEVER logs secret values — only the env-var name and a
 * generic reason ("missing", "bad scheme"). This is the mechanical
 * enforcement of NFR-S-4's "without leaking secret values".
 *
 * Branded types (Winston #1, SEC-6) ensure a ``DatabaseUrl`` cannot be
 * transposed where a ``RedisUrl`` belongs.
 *
 * @rules D7, NFR-S-4, SEC-4
 * @adr ADR-019
 */
import process from 'node:process';

// ─────────────────────────────────────────────────────────────────────────
// Branded nominal types (project-context: Winston #1, SEC-6)
// ─────────────────────────────────────────────────────────────────────────
declare const __brand: unique symbol;
type Brand<T, B extends string> = T & { readonly [__brand]: B };

/** A validated ``postgres://`` or ``postgresql://`` connection URL. */
export type DatabaseUrl = Brand<string, 'DatabaseUrl'>;
/** A validated ``redis://`` or ``rediss://`` (TLS) URL. */
export type RedisUrl = Brand<string, 'RedisUrl'>;

// ─────────────────────────────────────────────────────────────────────────
// Result<T, E> — this package does not depend on @iip/contracts' Result
// (would create an import cycle once config gains more dependencies).
// ─────────────────────────────────────────────────────────────────────────
export type Result<T, E> =
  | { readonly ok: true; readonly value: T }
  | { readonly ok: false; readonly error: E };

// ─────────────────────────────────────────────────────────────────────────
// ConfigError — closed discriminated union (mirrors AppError discipline)
// ─────────────────────────────────────────────────────────────────────────
export type ConfigError =
  | { readonly kind: 'MISSING'; readonly name: string }
  | {
      readonly kind: 'MALFORMED';
      readonly name: string;
      readonly reason: string;
    };

// ─────────────────────────────────────────────────────────────────────────
// ValidatedConfig
// ─────────────────────────────────────────────────────────────────────────
export interface ValidatedConfig {
  readonly databaseUrl: DatabaseUrl;
  readonly redisUrl: RedisUrl;
}

// ─────────────────────────────────────────────────────────────────────────
// Validators
// ─────────────────────────────────────────────────────────────────────────

/** Treat absent, empty, and whitespace-only strings as "missing". */
function readRequired(
  source: Record<string, string | undefined>,
  name: string,
): Result<string, ConfigError> {
  const raw = source[name];
  if (raw === undefined || raw.trim().length === 0) {
    return { ok: false, error: { kind: 'MISSING', name } };
  }
  return { ok: true, value: raw };
}

/** Validate a Postgres DSN — must start with ``postgres://`` or ``postgresql://``. */
function validateDatabaseUrl(raw: string): Result<DatabaseUrl, ConfigError> {
  if (
    !raw.startsWith('postgres://') &&
    !raw.startsWith('postgresql://')
  ) {
    return {
      ok: false,
      error: {
        kind: 'MALFORMED',
        name: 'DATABASE_URL',
        reason: 'must start with postgres:// or postgresql://',
      },
    };
  }
  return { ok: true, value: raw as DatabaseUrl };
}

/** Validate a Redis URL — must start with ``redis://`` or ``rediss://`` (TLS). */
function validateRedisUrl(raw: string): Result<RedisUrl, ConfigError> {
  if (!raw.startsWith('redis://') && !raw.startsWith('rediss://')) {
    return {
      ok: false,
      error: {
        kind: 'MALFORMED',
        name: 'REDIS_URL',
        reason: 'must start with redis:// or rediss://',
      },
    };
  }
  return { ok: true, value: raw as RedisUrl };
}

/**
 * Validate all required IIP secrets/env vars.
 *
 * Returns a {@link Result}; never throws. Pass an explicit ``source`` for
 * tests; defaults to ``process.env``.
 *
 * @rules D7, NFR-S-4
 */
export function validateConfig(
  source: Record<string, string | undefined> = process.env,
): Result<ValidatedConfig, ConfigError> {
  const dbRaw = readRequired(source, 'DATABASE_URL');
  if (!dbRaw.ok) return dbRaw;
  const db = validateDatabaseUrl(dbRaw.value);
  if (!db.ok) return db;

  const redisRaw = readRequired(source, 'REDIS_URL');
  if (!redisRaw.ok) return redisRaw;
  const redis = validateRedisUrl(redisRaw.value);
  if (!redis.ok) return redis;

  return {
    ok: true,
    value: { databaseUrl: db.value, redisUrl: redis.value },
  };
}

/**
 * Fail-closed boot: validate configuration and, on any error, write a
 * pino-compatible fatal line to stderr and ``process.exit(1)``.
 *
 * The log line carries the env-var NAME and a generic reason only — never
 * the secret value (NFR-S-4). Returns the validated config on success.
 *
 * @rules D7, NFR-S-4
 * @adr ADR-019
 */
export function bootOrDie(
  source: Record<string, string | undefined> = process.env,
): ValidatedConfig {
  const result = validateConfig(source);
  if (result.ok) return result.value;
  const { name } = result.error;
  const reason =
    result.error.kind === 'MISSING'
      ? 'missing'
      : result.error.reason;
  // Pino-shaped JSON line — never includes the secret value. level=fatal=60.
  const line = JSON.stringify({
    level: 60,
    time: Date.now(),
    msg: 'config validation failed — refusing to boot (D7, NFR-S-4)',
    name,
    reason,
  });
  process.stderr.write(line + '\n');
  process.exit(1);
}
