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

/** Operator public key record shape for the intake state machine (SEC-2, DoD-4). */
export interface OperatorKeyConfig {
  readonly key: string;
  readonly status: 'active' | 'revoked';
  readonly revokedAt?: string;
}

/** A validated operator keyring record for intake signature verification. */
export type IntakeOperatorKeyring = Brand<
  Record<string, OperatorKeyConfig>,
  'IntakeOperatorKeyring'
>;

/** A validated partner keyring record for Tier-5 provenance verification (SEC-2, AC-5). */
export type IntakePartnerKeyring = Brand<Record<string, string>, 'IntakePartnerKeyring'>;

/** A validated MinIO root password — the S3-compatible credential for the raw-snapshot bucket (Story 3.4). */
export type MinioPassword = Brand<string, 'MinioPassword'>;

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
  /** MinIO root password — the S3-compatible credential for the raw-snapshot bucket (Story 3.4, FR-1.4). */
  readonly minioRootPassword: MinioPassword;
  /** Intake two-person state machine configuration (SEC-2, DoD-4). */
  readonly intake: {
    /** Operator public keys by kid: base64 SPKI Ed25519 + revocation status. */
    readonly operatorPublicKeys: IntakeOperatorKeyring;
    /** Tier-5 partner provenance keys by kid: base64 SPKI Ed25519. */
    readonly partnerPublicKeys: IntakePartnerKeyring;
    /** Maximum seconds between review and approval before reverting to staging. */
    readonly approvalWindowSeconds: number;
    /** Minimum milliseconds between review and approval signatures (AC-8). */
    readonly minInterSignatureDelayMs: number;
  };
  /** Per-IP rate limiting on query endpoints (NFR-S-3, ADR-0004). */
  readonly rateLimit: {
    /** Sliding window length in milliseconds. Default 60000 (1 minute). */
    readonly windowMs: number;
    /** Maximum requests per window per IP. Default 30. */
    readonly max: number;
  };
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

/** Treat absent, empty, and whitespace-only JSON strings as "missing". */
function readRequiredJson<T>(
  source: Record<string, string | undefined>,
  name: string,
): Result<T, ConfigError> {
  const raw = source[name];
  if (raw === undefined || raw.trim().length === 0) {
    return { ok: false, error: { kind: 'MISSING', name } };
  }
  try {
    return { ok: true, value: JSON.parse(raw) as T };
  } catch {
    return {
      ok: false,
      error: { kind: 'MALFORMED', name, reason: 'must be valid JSON' },
    };
  }
}

/** Validate that every value in an operator keyring is a non-empty base64 SPKI string with a valid status. */
function validateOperatorKeyring(
  raw: unknown,
): Result<IntakeOperatorKeyring, ConfigError> {
  if (raw === null || typeof raw !== 'object' || Array.isArray(raw)) {
    return {
      ok: false,
      error: {
        kind: 'MALFORMED',
        name: 'INTAKE_OPERATOR_PUBLIC_KEYS',
        reason: 'must be a JSON object mapping kid to { key, status }',
      },
    };
  }
  const record = raw as Record<string, unknown>;
  for (const [kid, entry] of Object.entries(record)) {
    if (
      entry === null ||
      typeof entry !== 'object' ||
      typeof (entry as { key?: unknown }).key !== 'string' ||
      (entry as { key: string }).key.trim().length === 0 ||
      !['active', 'revoked'].includes((entry as { status?: unknown }).status as string)
    ) {
      return {
        ok: false,
        error: {
          kind: 'MALFORMED',
          name: 'INTAKE_OPERATOR_PUBLIC_KEYS',
          reason: `kid ${kid} must have non-empty key and status active|revoked`,
        },
      };
    }
  }
  return { ok: true, value: raw as IntakeOperatorKeyring };
}

/** Validate that every value in a partner keyring is a non-empty base64 SPKI string. */
function validatePartnerKeyring(
  raw: unknown,
): Result<IntakePartnerKeyring, ConfigError> {
  if (raw === null || typeof raw !== 'object' || Array.isArray(raw)) {
    return {
      ok: false,
      error: {
        kind: 'MALFORMED',
        name: 'INTAKE_PARTNER_PUBLIC_KEYS',
        reason: 'must be a JSON object mapping kid to base64 public key',
      },
    };
  }
  const record = raw as Record<string, unknown>;
  for (const [kid, key] of Object.entries(record)) {
    if (typeof key !== 'string' || key.trim().length === 0) {
      return {
        ok: false,
        error: {
          kind: 'MALFORMED',
          name: 'INTAKE_PARTNER_PUBLIC_KEYS',
          reason: `kid ${kid} must have a non-empty base64 public key`,
        },
      };
    }
  }
  return { ok: true, value: raw as IntakePartnerKeyring };
}

/** Validate a positive integer config value. Falls back to `defaultValue` when absent/empty. */
function validatePositiveInt(
  raw: string | undefined,
  name: string,
  defaultValue: number,
): Result<number, ConfigError> {
  if (raw === undefined || raw.trim().length === 0) {
    return { ok: true, value: defaultValue };
  }
  const value = Number(raw);
  if (!Number.isFinite(value) || !Number.isInteger(value) || value <= 0) {
    return {
      ok: false,
      error: { kind: 'MALFORMED', name, reason: 'must be a positive integer' },
    };
  }
  return { ok: true, value };
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
 * Intake keyrings are loaded from JSON env vars (DoD-4). In production these
 * values are decrypted from sops-encrypted files by the boot runner; tests can
 * pass explicit JSON strings. Defaults preserve backward compatibility for
 * callers that only need the database/redis config.
 *
 * Returns a {@link Result}; never throws. Pass an explicit ``source`` for
 * tests; defaults to ``process.env``.
 *
 * @rules D7, NFR-S-4, SEC-2, DoD-4
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

  // Story 3.4 — MinIO root password for the raw-snapshot bucket (FR-1.4, PC-2.6).
  const minioPasswordRaw = readRequired(source, 'MINIO_ROOT_PASSWORD');
  if (!minioPasswordRaw.ok) return minioPasswordRaw;
  const minioRootPassword = minioPasswordRaw.value as MinioPassword;

  const operatorKeyringRaw = readRequiredJson<Record<string, OperatorKeyConfig>>(
    source,
    'INTAKE_OPERATOR_PUBLIC_KEYS',
  );
  if (!operatorKeyringRaw.ok) return operatorKeyringRaw;
  const operatorKeyring = validateOperatorKeyring(operatorKeyringRaw.value);
  if (!operatorKeyring.ok) return operatorKeyring;

  const partnerKeyringRaw = readRequiredJson<Record<string, string>>(
    source,
    'INTAKE_PARTNER_PUBLIC_KEYS',
  );
  if (!partnerKeyringRaw.ok) return partnerKeyringRaw;
  const partnerKeyring = validatePartnerKeyring(partnerKeyringRaw.value);
  if (!partnerKeyring.ok) return partnerKeyring;

  const approvalWindowSeconds = validatePositiveInt(
    source['INTAKE_APPROVAL_WINDOW_SECONDS'],
    'INTAKE_APPROVAL_WINDOW_SECONDS',
    3600,
  );
  if (!approvalWindowSeconds.ok) return approvalWindowSeconds;

  const minInterSignatureDelayMs = validatePositiveInt(
    source['INTAKE_MIN_INTER_SIGNATURE_DELAY_MS'],
    'INTAKE_MIN_INTER_SIGNATURE_DELAY_MS',
    60000,
  );
  if (!minInterSignatureDelayMs.ok) return minInterSignatureDelayMs;

  // NFR-S-3 / ADR-0004 — per-IP rate limiting on query endpoints.
  const rateLimitWindowMs = validatePositiveInt(
    source['RATE_LIMIT_WINDOW_MS'],
    'RATE_LIMIT_WINDOW_MS',
    60_000,
  );
  if (!rateLimitWindowMs.ok) return rateLimitWindowMs;

  const rateLimitMax = validatePositiveInt(
    source['RATE_LIMIT_MAX_REQUESTS'],
    'RATE_LIMIT_MAX_REQUESTS',
    30,
  );
  if (!rateLimitMax.ok) return rateLimitMax;

  return {
    ok: true,
    value: {
      databaseUrl: db.value,
      redisUrl: redis.value,
      minioRootPassword,
      intake: {
        operatorPublicKeys: operatorKeyring.value,
        partnerPublicKeys: partnerKeyring.value,
        approvalWindowSeconds: approvalWindowSeconds.value,
        minInterSignatureDelayMs: minInterSignatureDelayMs.value,
      },
      rateLimit: {
        windowMs: rateLimitWindowMs.value,
        max: rateLimitMax.value,
      },
    },
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
