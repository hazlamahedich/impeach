/**
 * Immutable raw-snapshot store — content-addressed MinIO object storage (FR-1.4).
 *
 * Every fetched document is written as an immutable raw snapshot to a private,
 * versioned, object-locked MinIO bucket. The snapshot is the evidence artifact
 * a court would examine: if the cited PDF cannot be retrieved in its original
 * form, the provenance defense collapses. No snapshot = no provenance = no
 * defense.
 *
 * **Content-addressed (AC-3):** the object key is the SHA-256 of the raw bytes.
 * Identical content is idempotent (same key); tampering is detected as a
 * distinct object (the original is never mutated).
 *
 * **Off the serving path (SEC-5, AC-5):** the bucket is private with anonymous
 * access disabled. Snapshots are never served directly to users.
 *
 * **Typed errors (AC-7):** all MinIO failures surface as `SnapshotStoreError`
 * so the caller (ingestion job) can branch exhaustively for retry/DLQ routing.
 * The store never silently drops data.
 *
 * @rules FR-1.4, NFR-S-5, SEC-5
 * @adr ADR-001
 */
import { Buffer } from 'node:buffer';
import type { Client as MinioClient } from 'minio';
import { RawSnapshotKeySchema, type RawSnapshotKey } from '@iip/contracts';

// ─────────────────────────────────────────────────────────────────────────
// Types
// ─────────────────────────────────────────────────────────────────────────

/**
 * Fetch metadata preserved alongside the raw snapshot bytes (AC-2).
 *
 * `url` is the source URL; `fetchedAt` is the ISO-8601 UTC fetch timestamp;
 * `contentType` is the MIME type from the fetch response (recorded but not
 * enforced — AC-8: the store is a byte-level primitive).
 */
export interface SnapshotMetadata {
  readonly url: string;
  readonly fetchedAt: string;
  readonly contentType: string;
}

/**
 * The full raw snapshot — original bytes + reconstructed metadata (AC-2, AC-6).
 *
 * Returned by {@link RawSnapshotStore.get}. The bytes are verified against the
 * content-addressed key (round-trip integrity, AC-6).
 */
export interface RawSnapshot {
  readonly bytes: Buffer;
  readonly metadata: SnapshotMetadata;
}

/**
 * Input accepted by `put()`. Accepts both the canonical `FetchedDocument` shape
 * (`rawBytes: Uint8Array`) and the simpler `{ bytes: Buffer }` shape used by
 * callers that have the raw bytes in a Node Buffer.
 *
 * The store is a byte-level primitive (AC-8): content-type validation is the
 * caller's responsibility. The store records `contentType` from the input but
 * does not enforce it.
 */
export interface SnapshotInput {
  /** Source URL of the fetched document. */
  readonly url: string;
  /** ISO-8601 UTC timestamp the fetch completed. */
  readonly fetchedAt: string;
  /** MIME type from the fetch response (recorded, not enforced — AC-8). */
  readonly contentType: string;
  /** Raw bytes of the fetched document (HTML, PDF, etc.). */
  readonly bytes?: Buffer | Uint8Array;
  /** Canonical `FetchedDocument` raw bytes field. */
  readonly rawBytes?: Uint8Array;
}

/**
 * Factory config for {@link createMinioSnapshotStore}.
 *
 * `endpoint`, `rootUser`, and `bucket` are the non-secret connection params
 * (from `@iip/config`'s `getMinioConfig`); `rootPassword` is the secret half
 * (from `@iip/config`'s `minioRootPassword`). An injectable `client` allows
 * tests to substitute a mock MinIO client (SC-5).
 */
export interface MinioSnapshotStoreConfig {
  readonly endpoint: string;
  readonly rootUser: string;
  readonly rootPassword: string;
  readonly bucket: string;
  /** Injectable MinIO client (SC-5). If absent, a real client is created. */
  readonly client?: MinioClient;
}

/**
 * Bucket anonymous-access policy (AC-5).
 */
export interface BucketAccessPolicy {
  readonly anonymousAccess: 'none' | 'read' | 'write';
}

/**
 * Bucket versioning configuration (AC-4, NFR-S-5).
 */
export interface BucketVersioningConfig {
  readonly status: 'Enabled' | 'Suspended' | 'Disabled';
}

/**
 * Bucket object-lock configuration (AC-4, NFR-S-5).
 */
export interface BucketObjectLockConfig {
  readonly objectLockEnabled: boolean;
  readonly mode?: 'GOVERNANCE' | 'COMPLIANCE';
}

/**
 * Abstract port for the immutable raw-snapshot store (SC-5 boundary).
 *
 * Concrete implementations (e.g. {@link createMinioSnapshotStore}) encapsulate
 * MinIO/S3 interaction logic. Other packages consume this interface, never the
 * concrete implementation — enabling test substitution and future storage
 * backends.
 *
 * @rules FR-1.4, SC-5, SEC-5
 */
export abstract class RawSnapshotStore {
  /**
   * Store a raw snapshot, content-addressed by SHA-256 of the bytes (AC-1, AC-3).
   *
   * Returns the content-addressed key. Re-putting identical content is
   * idempotent (same key). The caller is responsible for content-type
   * validation (AC-8).
   */
  abstract put(input: SnapshotInput): Promise<{ key: RawSnapshotKey }>;

  /**
   * Retrieve a raw snapshot by its content-addressed key (AC-6).
   *
   * The returned bytes are verified against the key (round-trip integrity).
   * Throws `SnapshotStoreError` if the object is missing or the round-trip
   * hash mismatches.
   */
  abstract get(key: RawSnapshotKey): Promise<RawSnapshot>;

  /**
   * Assert the bucket is private — no anonymous/public access (AC-5).
   */
  abstract bucketAccessPolicy(): Promise<BucketAccessPolicy>;

  /**
   * Query the bucket versioning configuration (AC-4).
   */
  abstract bucketVersioningConfig(): Promise<BucketVersioningConfig>;

  /**
   * Query the bucket object-lock configuration (AC-4).
   */
  abstract bucketObjectLockConfig(): Promise<BucketObjectLockConfig>;
}

// ─────────────────────────────────────────────────────────────────────────
// Typed errors (AC-7 — Winston #17 canonical AppError discipline)
// ─────────────────────────────────────────────────────────────────────────

/**
 * Error code for snapshot store failures (AC-7).
 */
export const SNAPSHOT_STORE_ERROR_CODE = 'snapshot_store_error' as const;

/**
 * Error code for round-trip integrity failures (AC-6).
 */
export const SNAPSHOT_INTEGRITY_ERROR_CODE = 'snapshot_integrity_error' as const;

/**
 * Typed error thrown when the snapshot store cannot complete an operation.
 *
 * All MinIO failures (connection refused, bucket not found, timeout) surface
 * as this error so the caller can branch exhaustively for retry/DLQ routing
 * (AC-7). The store never silently drops data.
 *
 * Follows the project's canonical `AppError` discipline (Winston #17): a
 * discriminable `code` field lets callers switch without string matching.
 */
export class SnapshotStoreError extends Error {
  override readonly name = 'SnapshotStoreError';
  readonly code: string;
  constructor(
    message: string,
    code: string = SNAPSHOT_STORE_ERROR_CODE,
    options?: { readonly cause?: unknown },
  ) {
    super(message, options);
    this.code = code;
  }
}

/**
 * Typed error thrown when round-trip integrity verification fails (AC-6).
 *
 * The retrieved bytes do not hash to the expected content-addressed key. This
 * means the snapshot was corrupted or the object was silently swapped — a
 * defamation-grade integrity violation.
 */
export class SnapshotIntegrityError extends Error {
  override readonly name = 'SnapshotIntegrityError';
  readonly code = SNAPSHOT_INTEGRITY_ERROR_CODE;
  constructor(
    message: string,
    readonly expectedKey: string,
    readonly actualKey: string,
  ) {
    super(message);
  }
}

// ─────────────────────────────────────────────────────────────────────────
// Content-addressed key derivation (AC-3)
// ─────────────────────────────────────────────────────────────────────────

/**
 * Compute the SHA-256 content-addressed key for a byte sequence (AC-3).
 *
 * Uses `crypto.subtle.digest` (NOT `node:crypto`) per project-context:
 * available in Node 18+, Bun, and edge runtimes. The key is a 64-char
 * lowercase hex digest, branded as `RawSnapshotKey`.
 *
 * Exported for unit testing the content-addressing invariant directly.
 */
export async function computeSnapshotKey(
  bytes: Buffer | Uint8Array,
): Promise<RawSnapshotKey> {
  if (
    !Buffer.isBuffer(bytes) &&
    !(bytes instanceof Uint8Array)
  ) {
    throw new TypeError(
      'computeSnapshotKey requires a Buffer or Uint8Array',
    );
  }
  if (
    'detached' in bytes.buffer &&
    (bytes.buffer as { detached?: boolean }).detached
  ) {
    throw new TypeError('computeSnapshotKey received a detached ArrayBuffer');
  }
  // Normalize to a fresh ArrayBuffer-backed Uint8Array for crypto.subtle.
  // Node's Buffer uses ArrayBufferLike which includes SharedArrayBuffer —
  // crypto.subtle requires ArrayBuffer. Copy into a plain Uint8Array.
  const buf = Buffer.isBuffer(bytes) ? bytes : Buffer.from(bytes);
  const copy = new Uint8Array(buf.length);
  copy.set(buf);
  const digest = await crypto.subtle.digest('SHA-256', copy);
  const hex = Buffer.from(digest).toString('hex');
  return RawSnapshotKeySchema.parse(hex);
}

// ─────────────────────────────────────────────────────────────────────────
// MinIO client creation
// ─────────────────────────────────────────────────────────────────────────

interface ParsedEndpoint {
  readonly protocol: 'http:' | 'https:';
  readonly host: string;
  readonly port: number;
}

/** Max raw snapshot object size (100 MiB). AC-8 does not enforce content-type,
 * but the store MUST bound the bytes it will buffer into memory. */
const MAX_OBJECT_SIZE_BYTES = 100 * 1024 * 1024;

/** Max total S3 user metadata size (2 KiB). */
const MAX_USER_METADATA_BYTES = 2 * 1024;

/**
 * Parse a MinIO endpoint URL into host/port/protocol.
 *
 * Exported for direct unit testing (PC-9).
 */
export function parseEndpoint(endpoint: string): ParsedEndpoint {
  let url: URL;
  try {
    url = new URL(endpoint);
  } catch {
    throw new SnapshotStoreError(`invalid MINIO_ENDPOINT: ${endpoint}`);
  }
  const protocol = url.protocol === 'https:' ? 'https:' : 'http:';
  const host = url.hostname;
  const portStr = url.port;
  const port = portStr
    ? Number(portStr)
    : protocol === 'https:'
      ? 443
      : 80;
  return { protocol, host, port };
}

/**
 * Create a MinIO client from config (SC-5 — injectable for tests).
 *
 * Lazily imported so that consumers who only need the `RawSnapshotStore`
 * interface (and inject a mock client) are not forced to load the `minio` npm
 * package at module-evaluation time.
 */
async function createClient(
  config: MinioSnapshotStoreConfig,
): Promise<MinioClient> {
  const url = parseEndpoint(config.endpoint);
  const { Client } = await import('minio');
  return new Client({
    endPoint: url.host,
    port: url.port,
    useSSL: url.protocol === 'https:',
    accessKey: config.rootUser,
    secretKey: config.rootPassword,
  });
}

// ─────────────────────────────────────────────────────────────────────────
// Helpers
// ─────────────────────────────────────────────────────────────────────────

/**
 * Read a MinIO object stream fully into a Buffer, aborting if the object
 * exceeds {@link MAX_OBJECT_SIZE_BYTES}.
 */
async function readStream(stream: NodeJS.ReadableStream): Promise<Buffer> {
  return new Promise((resolve, reject) => {
    const chunks: Buffer[] = [];
    let total = 0;

    const cleanup = () => {
      stream.removeAllListeners('data');
      stream.removeAllListeners('end');
      stream.removeAllListeners('error');
    };

    stream.on('data', (chunk: unknown) => {
      const data = chunk as unknown;
      let buf: Buffer;
      if (Buffer.isBuffer(data)) {
        buf = data;
      } else if (data instanceof Uint8Array) {
        buf = Buffer.from(data);
      } else {
        buf = Buffer.from(String(data));
      }
      total += buf.length;
      if (total > MAX_OBJECT_SIZE_BYTES) {
        cleanup();
        reject(
          new SnapshotStoreError(
            `snapshot exceeds maximum allowed size of ${MAX_OBJECT_SIZE_BYTES} bytes`,
          ),
        );
        return;
      }
      chunks.push(buf);
    });

    stream.on('end', () => {
      cleanup();
      resolve(Buffer.concat(chunks));
    });

    stream.on('error', (err: Error) => {
      cleanup();
      reject(new SnapshotStoreError(`failed to read object stream: ${err.message}`));
    });
  });
}

/**
 * Determine whether an error from the MinIO client indicates a missing
 * bucket (as opposed to a connection failure or missing object).
 *
 * Exported for direct unit testing (PC-9).
 *
 * Primary signal is the structured `code` field; the message regex is a narrow
 * fallback because "no such bucket" can appear in unrelated policy errors.
 */
export function isNoSuchBucket(error: unknown): boolean {
  if (error == null || typeof error !== 'object') return false;
  const code = (error as { code?: string }).code;
  if (code === 'NoSuchBucket') return true;
  const message = (error as { message?: string }).message ?? '';
  return /^.*no such bucket.*$/i.test(message);
}

/**
 * Resolve the MinIO client — injected (tests) or lazily created (production).
 */
async function resolveClient(
  config: MinioSnapshotStoreConfig,
  clientP: Promise<MinioClient> | undefined,
): Promise<{ client: MinioClient; nextClientP: Promise<MinioClient> }> {
  if (config.client) {
    return {
      client: config.client,
      nextClientP: clientP ?? Promise.resolve(config.client),
    };
  }
  const resolved = clientP ?? createClient(config);
  const client = await resolved;
  return { client, nextClientP: resolved };
}

// ─────────────────────────────────────────────────────────────────────────
// Factory
// ─────────────────────────────────────────────────────────────────────────

/**
 * Create a concrete MinIO-backed `RawSnapshotStore` (SC-5).
 *
 * The store is content-addressed: every `put()` computes the SHA-256 of the
 * raw bytes and uses it as the object key (AC-3). Metadata (`url`,
 * `fetchedAt`, `contentType`) is stored as S3 user metadata (`x-amz-meta-*`),
 * capped at 2 KB total — current fields are well within the limit.
 *
 * Returns a class instance extending {@link RawSnapshotStore} so contract
 * tests can verify `instanceof` and prototype structure.
 *
 * @rules FR-1.4, AC-1..AC-8, SC-5
 */
export function createMinioSnapshotStore(
  config: MinioSnapshotStoreConfig,
): RawSnapshotStore {
  if (!config.endpoint || config.endpoint.trim().length === 0) {
    throw new Error('MinioSnapshotStoreConfig.endpoint is required');
  }
  if (!config.rootUser || config.rootUser.trim().length === 0) {
    throw new Error('MinioSnapshotStoreConfig.rootUser is required');
  }
  if (!config.rootPassword || config.rootPassword.trim().length === 0) {
    throw new Error('MinioSnapshotStoreConfig.rootPassword is required');
  }
  if (!config.bucket || config.bucket.trim().length === 0) {
    throw new Error('MinioSnapshotStoreConfig.bucket is required');
  }

  let clientP: Promise<MinioClient> | undefined;

  const getClient = async (): Promise<MinioClient> => {
    const resolved = await resolveClient(config, clientP);
    clientP = resolved.nextClientP;
    return resolved.client;
  };

  class MinioSnapshotStoreImpl extends RawSnapshotStore {
    override async put(input: SnapshotInput): Promise<{ key: RawSnapshotKey }> {
      const bytes =
        input.bytes != null
          ? Buffer.isBuffer(input.bytes)
            ? input.bytes
            : Buffer.from(input.bytes)
          : input.rawBytes != null
            ? Buffer.from(input.rawBytes)
            : (() => {
                throw new TypeError(
                  'SnapshotInput must provide either bytes or rawBytes',
                );
              })();

      let client: MinioClient;
      try {
        client = await getClient();
      } catch (error) {
        throw new SnapshotStoreError(
          `failed to connect to MinIO: ${(error as Error).message}`,
          SNAPSHOT_STORE_ERROR_CODE,
          { cause: error },
        );
      }

      const key = await computeSnapshotKey(bytes);

      const metadata: Record<string, string> = {
        'Content-Type': input.contentType,
        'x-amz-meta-url': input.url,
        'x-amz-meta-fetched-at': input.fetchedAt,
        'x-amz-meta-content-type': input.contentType,
      };
      const metadataSize = Object.entries(metadata).reduce(
        (sum, [k, v]) => sum + k.length + (v?.length ?? 0),
        0,
      );
      if (metadataSize > MAX_USER_METADATA_BYTES) {
        throw new SnapshotStoreError(
          `snapshot metadata exceeds ${MAX_USER_METADATA_BYTES} byte S3 user-metadata limit`,
        );
      }

      try {
        await client.putObject(config.bucket, key, bytes, bytes.length, metadata);
      } catch (error) {
        if (isNoSuchBucket(error)) {
          throw new SnapshotStoreError(
            `bucket not found: ${config.bucket}`,
            SNAPSHOT_STORE_ERROR_CODE,
            { cause: error },
          );
        }
        throw new SnapshotStoreError(
          `failed to store snapshot: ${(error as Error).message}`,
          SNAPSHOT_STORE_ERROR_CODE,
          { cause: error },
        );
      }

      return { key };
    }

    override async get(key: RawSnapshotKey): Promise<RawSnapshot> {
      let client: MinioClient;
      try {
        client = await getClient();
      } catch (error) {
        throw new SnapshotStoreError(
          `failed to connect to MinIO: ${(error as Error).message}`,
          SNAPSHOT_STORE_ERROR_CODE,
          { cause: error },
        );
      }

      let metaData: Record<string, string | undefined>;
      try {
        const stat = await client.statObject(config.bucket, key);
        metaData = stat.metaData as Record<string, string | undefined>;
      } catch (error) {
        if (isNoSuchBucket(error)) {
          throw new SnapshotStoreError(
            `bucket not found: ${config.bucket}`,
            SNAPSHOT_STORE_ERROR_CODE,
            { cause: error },
          );
        }
        throw new SnapshotStoreError(
          `snapshot not found for key ${key}: ${(error as Error).message}`,
          SNAPSHOT_STORE_ERROR_CODE,
          { cause: error },
        );
      }

      let rawStream: NodeJS.ReadableStream;
      try {
        rawStream = await client.getObject(config.bucket, key);
      } catch (error) {
        if (isNoSuchBucket(error)) {
          throw new SnapshotStoreError(
            `bucket not found: ${config.bucket}`,
            SNAPSHOT_STORE_ERROR_CODE,
            { cause: error },
          );
        }
        throw new SnapshotStoreError(
          `failed to read snapshot ${key}: ${(error as Error).message}`,
          SNAPSHOT_STORE_ERROR_CODE,
          { cause: error },
        );
      }

      const bytes = await readStream(rawStream);

      // Round-trip integrity (AC-6): verify the retrieved bytes hash to the
      // content-addressed key. A mismatch means corruption or silent swap.
      const actualKey = await computeSnapshotKey(bytes);
      if (actualKey !== key) {
        throw new SnapshotIntegrityError(
          `round-trip integrity failure: expected key ${key} but got ${actualKey}`,
          key,
          actualKey,
        );
      }

      const getMeta = (...keys: string[]): string => {
        for (const k of keys) {
          for (const [metaKey, metaValue] of Object.entries(metaData)) {
            if (metaKey.toLowerCase() === k.toLowerCase() && metaValue != null) {
              return metaValue;
            }
          }
        }
        return '';
      };

      return {
        bytes,
        metadata: {
          url: getMeta('url', 'x-amz-meta-url'),
          fetchedAt: getMeta('fetched-at', 'x-amz-meta-fetched-at'),
          contentType: getMeta('content-type', 'x-amz-meta-content-type'),
        },
      };
    }

    override async bucketAccessPolicy(): Promise<BucketAccessPolicy> {
      let client: MinioClient;
      try {
        client = await getClient();
      } catch (error) {
        throw new SnapshotStoreError(
          `failed to connect to MinIO: ${(error as Error).message}`,
          SNAPSHOT_STORE_ERROR_CODE,
          { cause: error },
        );
      }

      try {
        const policyStr = await client.getBucketPolicy(config.bucket);
        // If no policy exists, the bucket is private by default (no anonymous access).
        if (!policyStr || policyStr.trim() === '') {
          return { anonymousAccess: 'none' };
        }
        const policy = JSON.parse(policyStr) as { Statement?: unknown[] };
        const statements = policy.Statement;
        if (!Array.isArray(statements) || statements.length === 0) {
          return { anonymousAccess: 'none' };
        }

        const isAnonymousPrincipal = (principal: unknown): boolean => {
          if (principal === '*') return true;
          if (
            typeof principal === 'object' &&
            principal !== null &&
            'AWS' in principal
          ) {
            const aws = (principal as { AWS: unknown }).AWS;
            return aws === '*';
          }
          return false;
        };

        const actionAllowsRead = (action: unknown): boolean => {
          if (typeof action === 'string') {
            return action === 's3:GetObject' || action === 's3:*' || action === '*';
          }
          if (Array.isArray(action)) {
            return action.some(
              (a) => a === 's3:GetObject' || a === 's3:*' || a === '*',
            );
          }
          return false;
        };

        const actionAllowsWrite = (action: unknown): boolean => {
          if (typeof action === 'string') {
            return (
              action === 's3:PutObject' || action === 's3:DeleteObject' || action === 's3:*' || action === '*'
            );
          }
          if (Array.isArray(action)) {
            return action.some(
              (a) =>
                a === 's3:PutObject' || a === 's3:DeleteObject' || a === 's3:*' || a === '*',
            );
          }
          return false;
        };

        let read = false;
        let write = false;
        for (const stmt of statements) {
          if (typeof stmt !== 'object' || stmt === null) continue;
          const effect = (stmt as { Effect?: string }).Effect;
          if (effect !== 'Allow') continue;
          const principal = (stmt as { Principal?: unknown }).Principal;
          if (!isAnonymousPrincipal(principal)) continue;
          const action = (stmt as { Action?: unknown }).Action;
          if (actionAllowsRead(action)) read = true;
          if (actionAllowsWrite(action)) write = true;
        }

        let anonymousAccess: BucketAccessPolicy['anonymousAccess'] = 'none';
        if (write) {
          anonymousAccess = 'write';
        } else if (read) {
          anonymousAccess = 'read';
        }
        return { anonymousAccess };
      } catch (error) {
        if (isNoSuchBucket(error)) {
          throw new SnapshotStoreError(
            `bucket not found: ${config.bucket}`,
            SNAPSHOT_STORE_ERROR_CODE,
            { cause: error },
          );
        }
        throw new SnapshotStoreError(
          `failed to query bucket policy: ${(error as Error).message}`,
          SNAPSHOT_STORE_ERROR_CODE,
          { cause: error },
        );
      }
    }

    override async bucketVersioningConfig(): Promise<BucketVersioningConfig> {
      let client: MinioClient;
      try {
        client = await getClient();
      } catch (error) {
        throw new SnapshotStoreError(
          `failed to connect to MinIO: ${(error as Error).message}`,
          SNAPSHOT_STORE_ERROR_CODE,
          { cause: error },
        );
      }

      try {
        const versioning = await client.getBucketVersioning(config.bucket);
        const status = versioning.Status;
        if (status === 'Enabled') return { status: 'Enabled' };
        if (status === 'Suspended') return { status: 'Suspended' };
        return { status: 'Disabled' };
      } catch (error) {
        if (isNoSuchBucket(error)) {
          throw new SnapshotStoreError(
            `bucket not found: ${config.bucket}`,
            SNAPSHOT_STORE_ERROR_CODE,
            { cause: error },
          );
        }
        throw new SnapshotStoreError(
          `failed to query bucket versioning: ${(error as Error).message}`,
          SNAPSHOT_STORE_ERROR_CODE,
          { cause: error },
        );
      }
    }

    override async bucketObjectLockConfig(): Promise<BucketObjectLockConfig> {
      let client: MinioClient;
      try {
        client = await getClient();
      } catch (error) {
        throw new SnapshotStoreError(
          `failed to connect to MinIO: ${(error as Error).message}`,
          SNAPSHOT_STORE_ERROR_CODE,
          { cause: error },
        );
      }

      try {
        // The minio .d.ts has overloaded signatures for getObjectLockConfig;
        // TS picks the `void` overload. Cast through unknown to the Promise form.
        const lockInfo = (await (client.getObjectLockConfig(config.bucket) as unknown as Promise<
          | { objectLockEnabled?: string; mode?: string }
          | Record<string, never>
        >)) as { objectLockEnabled?: string; mode?: string } | Record<string, never>;
        if (
          lockInfo &&
          typeof lockInfo === 'object' &&
          'objectLockEnabled' in lockInfo
        ) {
          const enabled = lockInfo.objectLockEnabled === 'Enabled';
          const mode = lockInfo.mode;
          if (mode === 'GOVERNANCE' || mode === 'COMPLIANCE') {
            return { objectLockEnabled: enabled, mode };
          }
          return { objectLockEnabled: enabled };
        }
        return { objectLockEnabled: false };
      } catch (error) {
        if (isNoSuchBucket(error)) {
          throw new SnapshotStoreError(
            `bucket not found: ${config.bucket}`,
            SNAPSHOT_STORE_ERROR_CODE,
            { cause: error },
          );
        }
        throw new SnapshotStoreError(
          `failed to query bucket object lock: ${(error as Error).message}`,
          SNAPSHOT_STORE_ERROR_CODE,
          { cause: error },
        );
      }
    }
  }

  return new MinioSnapshotStoreImpl();
}
