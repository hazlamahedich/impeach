/**
 * MinIO non-secret infrastructure config (Story 3.4, FR-1.4, PC-2.6).
 *
 * Config is split by sensitivity (PC-2.6): the root PASSWORD lives in
 * ``secrets.ts`` as ``minioRootPassword``; this module holds the non-secret
 * endpoints + bucket name so that changing a MinIO endpoint does not look
 * like a secret rotation, and a secret rotation does not require touching
 * infrastructure config.
 *
 * ``process.env`` reads are confined to ``@iip/config`` (PC-2.6). Every other
 * package consumes the validated values returned by {@link getMinioConfig}.
 *
 * @rules FR-1.4, PC-2.6, NFR-S-5
 * @adr ADR-001
 */
import process from 'node:process';

/**
 * The default raw-snapshots bucket name. Private, versioned, object-locked.
 * Configurable via ``RAW_SNAPSHOTS_BUCKET`` for non-default deployments.
 */
export const DEFAULT_RAW_SNAPSHOTS_BUCKET = 'raw-snapshots';

/**
 * MinIO non-secret connection configuration for the raw-snapshot store.
 */
export interface MinioConfig {
  /** MinIO API endpoint (e.g. ``http://localhost:9100``). Required. */
  readonly endpoint: string;
  /**
   * MinIO root user / access key. Not a secret in this deployment model —
   * the password is the secret half (PC-2.6).
   */
  readonly rootUser: string;
  /** Raw-snapshots bucket name. Defaults to ``raw-snapshots``. */
  readonly bucket: string;
}

/**
 * Read non-secret MinIO config from the environment.
 *
 * ``MINIO_ENDPOINT`` is required (the snapshot store cannot operate without
 * it). ``MINIO_ROOT_USER`` is required (defaulted for local dev only if the
 * caller passes ``allowDevDefaults``). ``RAW_SNAPSHOTS_BUCKET`` is optional
 * and defaults to {@link DEFAULT_RAW_SNAPSHOTS_BUCKET}.
 *
 * Pass an explicit ``source`` for tests; defaults to ``process.env``.
 */
// S3 bucket naming rules (DNS-compliant, 3–63 chars, lowercase/numbers/hyphens/dot,
// cannot be IP-address-like, cannot start/end with hyphen/dot).
const BUCKET_NAME_RE = /^[a-z0-9][a-z0-9.-]{1,61}[a-z0-9]$/;
const IP_LIKE_RE = /^(\d{1,3}\.){3}\d{1,3}$/;

function validateBucketName(name: string): string {
  if (!BUCKET_NAME_RE.test(name) || IP_LIKE_RE.test(name)) {
    throw new Error(
      `RAW_SNAPSHOTS_BUCKET is not a valid S3 bucket name: ${name}`,
    );
  }
  return name;
}

export function getMinioConfig(
  source: Record<string, string | undefined> = process.env,
): MinioConfig {
  const endpoint = source['MINIO_ENDPOINT'];
  if (endpoint === undefined || endpoint.trim().length === 0) {
    throw new Error('MINIO_ENDPOINT is required');
  }
  const endpointUrl = new URL(endpoint.trim());
  if (endpointUrl.protocol !== 'http:' && endpointUrl.protocol !== 'https:') {
    throw new Error(`MINIO_ENDPOINT must use http:// or https://: ${endpoint}`);
  }
  if (endpointUrl.username || endpointUrl.password) {
    throw new Error('MINIO_ENDPOINT must not embed credentials');
  }

  const rootUser = source['MINIO_ROOT_USER'];
  if (rootUser === undefined || rootUser.trim().length === 0) {
    throw new Error('MINIO_ROOT_USER is required');
  }

  const rawBucket = source['RAW_SNAPSHOTS_BUCKET']?.trim();
  const bucket = rawBucket && rawBucket.length > 0
    ? validateBucketName(rawBucket)
    : DEFAULT_RAW_SNAPSHOTS_BUCKET;

  const normalizedEndpoint = endpointUrl.toString().replace(/\/$/, '');
  return { endpoint: normalizedEndpoint, rootUser: rootUser.trim(), bucket };
}
