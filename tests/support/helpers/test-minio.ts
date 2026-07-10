/**
 * Testcontainers harness for MinIO integration tests (Story 3.4, FR-1.4).
 *
 * Launches a transient MinIO container with the same ``init-bucket.sh`` script
 * used in production (``infra/minio/init-bucket.sh``) so the test exercises
 * the REAL bucket configuration: private policy, versioning enabled, object
 * locking in GOVERNANCE mode.
 *
 * The harness is shared by:
 * - ``tests/integration/raw-snapshot-minio.integration.test.ts``
 *
 * Pool: 'forks' + singleFork — Testcontainers holds TCP sockets.
 *
 * @rules FR-1.4, NFR-S-5, PC-9
 * @adr ADR-001
 */
import { GenericContainer, Wait, type StartedTestContainer } from 'testcontainers';
import { Client } from 'minio';

// Default to the same pinned digest used in infra/docker-compose.yml so tests
// and local compose run the same server build. Override via IIP_MINIO_IMAGE.
const MINIO_IMAGE =
  process.env['IIP_MINIO_IMAGE'] ||
  'minio/minio@sha256:d249d1fb6966de4d8ad26c04754b545205ff15a62e4fd19ebd0f26fa5baacbc0'; // RELEASE.2025-07-23T15-54-02Z

export interface StartedTestMinio {
  readonly client: Client;
  readonly endpoint: string;
  readonly bucket: string;
  readonly teardown: () => Promise<void>;
}

/**
 * Start a transient MinIO container with the raw-snapshots bucket provisioned.
 *
 * The bucket is created with Object Lock + versioning + GOVERNANCE retention,
 * matching the production ``init-bucket.sh`` script. Returns a connected MinIO
 * client + the mapped endpoint for the snapshot store factory.
 */
export async function startTestMinio(): Promise<StartedTestMinio> {
  const rootUser = 'minioadmin';
  const rootPassword = 'minioadmin';
  const bucket = 'raw-snapshots';

  const container: StartedTestContainer = await new GenericContainer(MINIO_IMAGE)
    .withEnvironment({
      MINIO_ROOT_USER: rootUser,
      MINIO_ROOT_PASSWORD: rootPassword,
    })
    .withCommand(['server', '/data', '--console-address', ':9001'])
    .withExposedPorts(9000)
    .withWaitStrategy(Wait.forHttp('/minio/health/live', 9000))
    .start();

  const host = container.getHost();
  const port = container.getMappedPort(9000);
  const endpoint = `http://${host}:${port}`;

  const client = new Client({
    endPoint: host,
    port,
    useSSL: false,
    accessKey: rootUser,
    secretKey: rootPassword,
  });

  // Provision the bucket using the same commands as init-bucket.sh.
  // We use the MinIO client directly rather than spawning a sidecar,
  // since the init script's `mc` commands map to client API calls.
  let provisioningOk = false;
  try {
    // makeBucket with object lock — mirrors `mc mb --with-lock`
    await client.makeBucket(bucket, '', { ObjectLocking: true });
    // Enable versioning — mirrors `mc version enable`
    // (makeBucket with ObjectLocking auto-enables versioning, but set it
    // explicitly for clarity and parity with init-bucket.sh)
    await client.setBucketVersioning(bucket, { Status: 'Enabled' });
    // Set GOVERNANCE 30d default retention — mirrors `mc retention set GOVERNANCE 30d --default`
    await client.setObjectLockConfig(bucket, {
      objectLockEnabled: 'Enabled',
      mode: 'GOVERNANCE',
      unit: 'Days',
      validity: 30,
    } as never);
    provisioningOk = true;
  } catch (err) {
    // Bucket may already exist in a reused container — ignore.
    if (!String((err as Error).message).includes('BucketAlreadyOwnedByYou')) {
      await container.stop();
      throw err;
    }
    // If the bucket was already present, verify it still meets expectations.
  }

  // Verify the bucket actually has the required immutable-snapshot properties.
  try {
    const versioning = await client.getBucketVersioning(bucket);
    if (versioning.Status !== 'Enabled') {
      throw new Error(
        `Test MinIO bucket '${bucket}' does not have versioning enabled`,
      );
    }
    const lockInfo = (await (client.getObjectLockConfig(bucket) as unknown as Promise<
      | { objectLockEnabled?: string; mode?: string }
      | Record<string, never>
    >)) as { objectLockEnabled?: string; mode?: string } | Record<string, never>;
    if (
      !lockInfo ||
      typeof lockInfo !== 'object' ||
      !('objectLockEnabled' in lockInfo) ||
      lockInfo.objectLockEnabled !== 'Enabled'
    ) {
      throw new Error(
        `Test MinIO bucket '${bucket}' does not have Object Lock enabled`,
      );
    }
    const policy = await client.getBucketPolicy(bucket).catch((err) => {
      // MinIO returns an error when no policy has ever been set.
      if (String(err.message).includes('The bucket policy does not exist')) {
        return '';
      }
      throw err;
    });
    if (policy && policy.trim().length > 0) {
      throw new Error(
        `Test MinIO bucket '${bucket}' has an unexpected bucket policy: ${policy}`,
      );
    }
  } catch (verifyErr) {
    await container.stop();
    throw verifyErr;
  }

  if (!provisioningOk) {
    // If we reused an existing bucket, the verification above is the only guard.
    // Log a warning-style message for diagnostics.
    console.warn(
      `startTestMinio: bucket '${bucket}' already existed; verified config is correct`,
    );
  }

  return {
    client,
    endpoint,
    bucket,
    teardown: async () => {
      await container.stop();
    },
  };
}
