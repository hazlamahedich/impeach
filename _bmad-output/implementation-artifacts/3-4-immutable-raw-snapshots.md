---
story_id: '3.4'
story_key: '3-4-immutable-raw-snapshots'
epic: 'Epic 3: Source Onboarding & Intelligence Ingestion'
status: done
baseline_commit: '23b2a658dc6279670dc7775482c8285b03046a62'
last_updated: '2026-07-10'
---

# Story 3.4: Immutable Raw Snapshots (FR-1.4)

Status: done

<!-- Note: Validation is optional. Run validate-create-story for quality check before dev-story. -->

## Story

As an Intake Operator,
I want immutable raw snapshots of every fetched document stored,
so that provenance, replay, and audit are always possible.

## Prerequisites

- **Story 3.3 (Deduplication & Adapters):** COMPLETE — The `Crawler` port and adapters (`FirecrawlAdapter`, `ManualUploadAdapter`) exist, and type schemas (e.g. `FetchedDocument`, `FetchMetadata`) are defined.
- **MinIO Container:** Up and running under `infra/docker-compose.yml` (on port 9100 for API / 9001 for Console).
- **Prep Sprint (TD1–TD3):** BLOCKING — The API server bootstrap (TD1), STR-1 consolidation (TD2), and new DB tables (TD3) are not yet complete. Story 3.4's snapshot client is a leaf module (no dependency on the API server or DB tables) and can be implemented in parallel with TD1–TD3, but integration tests against the real MinIO container require the compose stack to be healthy (TD1). The snapshot module itself has no blocking dependency on TD2 or TD3.

## Acceptance Criteria

### Behavioral (stakeholder-verifiable)

- **AC-1: Immutable Snapshot Storage (FR-1.4)**
  - When the raw snapshot is stored, an immutable raw snapshot is written to MinIO (private bucket `raw-snapshots`, off serving path).
- **AC-2: Original Content & Fetch Metadata Preservation (FR-1.4)**
  - The snapshot includes the original fetched content (HTML/PDF bytes) and the fetch metadata (`url`, `fetchedAt`, `contentType`).
- **AC-3: Content-Addressable Storage (FR-1.4)**
  - The snapshot is content-addressed using its SHA-256 hash as the key.
- **AC-4: Versioned Append-Only Bucket (NFR-S-5)**
  - The MinIO bucket must be configured with versioning and object locking (Governance/Compliance mode) enabled.
- **AC-5: Isolated Serving Path (SEC-5)**
  - The snapshot bucket is private. No anonymous/public access is allowed (`anonymousAccess: 'none'`).
- **AC-6: Round-Trip Integrity (FR-1.4)**
  - A stored snapshot can be retrieved by its content key and the returned bytes + metadata match the original fetch exactly. The round-trip is the provenance defense: if you can't get back what you put in, the snapshot is not evidence.
- **AC-7: Failure Contract (SEC-5)**
  - When MinIO is unreachable, `put()` throws a typed `SnapshotStoreError` (not a generic Error). The caller (ingestion job) is responsible for retry/DLQ routing. The snapshot store does not silently drop data.
- **AC-8: Content-Type Boundary**
  - `put()` accepts any `Buffer` — the snapshot store is a byte-level primitive. Content-type validation (HTML/PDF only) is the caller's responsibility. The store records `contentType` from the fetch metadata but does not enforce it.

## Tasks / Subtasks

- [x] **Task 0: Enable Versioning & Object Lock in Infra (`infra/minio/init-bucket.sh`)** (AC-4)
  - [x] Modify `infra/minio/init-bucket.sh` to enable Object Lock at bucket creation using the `--with-lock` flag: `mc mb "local/${BUCKET}" --ignore-existing --with-lock`.
  - [x] Explicitly enable versioning using: `mc version enable "local/${BUCKET}"`.
  - [x] Set a default governance-mode retention policy: `mc retention set GOVERNANCE 30d "local/${BUCKET}" --default`.
- [x] **Task 1: Extend Environment Config with MinIO Parameters (`packages/config/`)** (AC-1)
  - [x] **Split config by sensitivity (PC-2.6):** secrets (`MINIO_ROOT_PASSWORD`) go in `packages/config/src/secrets.ts`; non-secret infrastructure config (`MINIO_ENDPOINT`, `RAW_SNAPSHOTS_BUCKET`) goes in a new `packages/config/src/minio.ts` module. Do NOT mix secrets and non-secrets in the same config object — every config change should not look like a secret rotation.
  - [x] In `packages/config/src/minio.ts`: export `getMinioConfig()` reading `MINIO_ENDPOINT` (required) and `RAW_SNAPSHOTS_BUCKET` (optional, defaults to `'raw-snapshots'`).
  - [x] In `packages/config/src/secrets.ts`: add `readonly minioRootPassword: string` to `ValidatedConfig`, validated from `MINIO_ROOT_PASSWORD` (required). `MINIO_ROOT_USER` is not a secret — move to `minio.ts`.
  - [x] Update tests in `packages/config/src/secrets.test.ts` and create `packages/config/src/minio.test.ts`.
- [x] **Task 2: Define and Export the Snapshot Store Port (`packages/ingest/`)** (AC-1)
  - [x] Add the `minio` npm package dependency to `packages/ingest` with an EXACT version pin (use `pnpm --filter @iip/ingest add minio@8.0.3` — the `minio` npm package has had breaking changes in minor versions; pin it).
  - [x] Create `packages/ingest/src/snapshot/index.ts` exporting abstract class `RawSnapshotStore` and factory function `createMinioSnapshotStore(config)` (SC-5).
  - [x] Define the abstract class `RawSnapshotStore`:
    ```ts
    export interface RawSnapshot {
      bytes: Buffer;
      metadata: {
        url: string;
        fetchedAt: string;
        contentType: string;
      };
    }

    export abstract class RawSnapshotStore {
      abstract put(fetched: FetchedDocument): Promise<{ key: string }>;
      abstract get(key: string): Promise<RawSnapshot>;
      abstract bucketAccessPolicy(): Promise<{ anonymousAccess: 'none' | 'read' | 'write' }>;
      abstract bucketVersioningConfig(): Promise<{ status: 'Enabled' | 'Suspended' | 'Disabled' }>;
      abstract bucketObjectLockConfig(): Promise<{ objectLockEnabled: boolean; mode?: 'GOVERNANCE' | 'COMPLIANCE' }>;
    }
    ```
  - [x] Add `./snapshot` to `exports` in `packages/ingest/package.json`. Do NOT re-export from the barrel (`packages/ingest/src/index.ts`) — keep the snapshot store on the subpath export only (`@iip/ingest/snapshot`). Re-exporting from the barrel transitively pulls the MinIO client into every consumer of `@iip/ingest`.
- [x] **Task 3: Implement the MinIO Snapshot Client (`packages/ingest/src/snapshot/`)** (AC-1, AC-2, AC-3, AC-6, AC-7, AC-8)
  - [x] Implement `createMinioSnapshotStore({ endpoint, rootUser, rootPassword, bucket })` returning a concrete implementation of `RawSnapshotStore` using the `minio` client.
  - [x] In `put()`:
    - Compute the key using `crypto.subtle.digest('SHA-256', data)` (NOT `node:crypto` — per project-context, `crypto.subtle` is available in Node 18+, Bun, edge).
    - Upload rawBytes to the bucket. Save custom metadata: `x-amz-meta-url`, `x-amz-meta-fetched-at`, `x-amz-meta-content-type`. Note: S3 user metadata is capped at 2 KB total — document this constraint; current fields are well within the limit.
    - On connection failure: throw a typed `SnapshotStoreError` (AC-7). Do not silently return or swallow the error.
  - [x] In `get()`:
    - Call `statObject()` to retrieve `x-amz-meta-*` user metadata.
    - Call `getObject()` to read the raw bytes.
    - Return bytes and reconstructed metadata. Verify the returned bytes match the expected content hash (round-trip integrity, AC-6).
  - [x] In `bucketAccessPolicy()`: Check and assert that anonymous access is disabled.
  - [x] In `bucketVersioningConfig()` and `bucketObjectLockConfig()`: Query MinIO and return status/locking mode.
  - [x] `put()` accepts any `Buffer` — content-type validation is the caller's responsibility (AC-8). The store records `contentType` from fetch metadata but does not enforce it.
- [x] **Task 4: Enable Tests and Verify (`tests/`)** (all ACs)
  - [x] Create `tests/support/helpers/test-minio.ts` using `testcontainers` to launch a transient MinIO container for integration tests.
  - [x] Unskip contract tests in `tests/contract/raw-snapshot.contract.test.ts` (5 RED tests, already scaffolded). Replace the dynamic `loadSnapshotModule()` wrapper with a direct `import { RawSnapshotStore, createMinioSnapshotStore } from '@iip/ingest/snapshot'`.
  - [x] Unskip integration tests in `tests/integration/raw-snapshot-minio.integration.test.ts` (3 RED tests, already scaffolded). Replace the dynamic `loadSnapshotModule()` + `loadTestMinio()` wrappers with direct imports.
  - [x] Add a `fast-check` property test for idempotency (PC-9): for any byte sequence, `put(bytes)` produces the same key every time. A single example test (RS-4) does not prove the property — content-addressed idempotency is a critical invariant.
  - [x] Add failure-mode contract tests: (a) MinIO unreachable → typed `SnapshotStoreError`, (b) bucket not found → typed error, (c) zero-byte document → accepted (empty snapshot is valid evidence).
  - [x] Run `pnpm vitest --project contract -- raw-snapshot` → all tests GREEN.
  - [x] Run `pnpm vitest --project integration -- raw-snapshot-minio` → all tests GREEN.
  - [x] Run `pnpm stryker run --mutate packages/ingest/src/snapshot/**/*.ts` → ≥90% mutation score. The snapshot store is a defamation-critical evidence artifact; 90% is the floor (matching `citation/verify.ts`, `intake/state.ts`, `extract/worker.ts` per project-context).
  - [x] Fix any linting, type-checking, or testing failures.

## Dev Notes

- **Bucket Locking:** MinIO requires versioning to enable Object Lock. `--with-lock` automatically enables versioning at creation time.
- **Retention Policy:** The default 30-day GOVERNANCE mode is a v1 operational default, not a legal policy. GOVERNANCE mode allows admin override (with `mc retention clear`); COMPLIANCE mode does not. For defamation-grade evidence, the retention period and mode must be reviewed by cyberlibel-aware counsel before broad public launch. The 30-day default is sufficient for the build-team-only phase (Pre-External Presentation Gate, PD-3).
- **Crypto API:** Use `crypto.subtle.digest('SHA-256', data)` for content hashing — NOT `node:crypto`. Per project-context, `crypto.subtle` is available in Node 18+, Bun, and edge runtimes.
- **S3 Metadata Limit:** `x-amz-meta-*` user metadata is capped at 2 KB total per object. Current fields (`url`, `fetchedAt`, `contentType`) are well within this limit, but document the constraint so future metadata additions don't silently truncate.
- **Strict Nominal Typing:** Ensure Zod schemas and branded types (e.g. `RawSnapshotKey`) are respected when storing keys.
- **Port Contract Compliance:** The `RawSnapshotStore` port must be abstract to satisfy contract test structures.
- **Subpath Export Only:** The snapshot module is exported via `@iip/ingest/snapshot` only — NOT re-exported from the `@iip/ingest` barrel. This prevents the MinIO client from becoming a transitive dependency of every ingest consumer.

### Project Structure Notes

- Keep all MinIO interaction logic strictly encapsulated within `@iip/ingest`'s `snapshot` submodule. Other packages should only consume it via the `RawSnapshotStore` interface.

### References

- [Source: docs/adr/0007-tiered-ingestion-architecture.md](file:///Users/sherwingorechomante/impeach/docs/adr/0007-tiered-ingestion-architecture.md)
- [Source: _bmad-output/planning-artifacts/epics.md#Story 3.4: Immutable Raw Snapshots (FR-1.4)](file:///Users/sherwingorechomante/impeach/_bmad-output/planning-artifacts/epics.md#L785-L800)
- [Source: _bmad-output/test-artifacts/atdd/epic-3/story-3-4/atdd-checklist-3-4-raw-snapshots.md](file:///Users/sherwingorechomante/impeach/_bmad-output/test-artifacts/atdd/epic-3/story-3-4/atdd-checklist-3-4-raw-snapshots.md)

## Dev Agent Record

### Agent Model Used

Gemini 3.5 Flash (High)

### Debug Log References

None

### Completion Notes List

- Story context analysis complete - comprehensive developer guide created.
- ALL 5 tasks done, all 8 ACs satisfied:
  - **Task 0** infra: `infra/minio/init-bucket.sh` modified — `mc mb --with-lock` (Object Lock at creation), `mc version enable` (explicit versioning), `mc retention set GOVERNANCE 30d --default` (default retention policy). AC-4 satisfied.
  - **Task 1** config: `packages/config/src/secrets.ts` — added branded `MinioPassword` type + `minioRootPassword` to `ValidatedConfig` + validation in `validateConfig()` (required, non-leak). New `packages/config/src/minio.ts` — `getMinioConfig()` reads non-secret `MINIO_ENDPOINT` (required), `MINIO_ROOT_USER` (required), `RAW_SNAPSHOTS_BUCKET` (optional, defaults `raw-snapshots`). Config split by sensitivity per PC-2.6. Tests: 74/74 GREEN (+8 minio, +3 secrets). AC-1 satisfied.
  - **Task 2** port: `packages/ingest/src/snapshot/index.ts` — abstract class `RawSnapshotStore` with `put`/`get`/`bucketAccessPolicy`/`bucketVersioningConfig`/`bucketObjectLockConfig`; factory `createMinioSnapshotStore(config)` returns class instance extending `RawSnapshotStore` (SC-5 injectable client). `minio@8.0.3` pinned. `./snapshot` subpath export added to `package.json`. NOT re-exported from barrel (prevents transitive MinIO dep). AC-1 satisfied.
  - **Task 3** client: full MinIO implementation — `put()` computes SHA-256 via `crypto.subtle.digest`, stores bytes + `x-amz-meta-*` metadata (url, fetchedAt, contentType); `get()` retrieves via statObject+getObject, verifies round-trip hash integrity (AC-6); `bucketAccessPolicy()` parses bucket policy for anonymous access; `bucketVersioningConfig()` + `bucketObjectLockConfig()` query MinIO APIs. All failures surface as typed `SnapshotStoreError` (AC-7); `SnapshotIntegrityError` for hash mismatches. Accepts any `Buffer`/`Uint8Array` (AC-8). AC-1..AC-3, AC-6..AC-8 satisfied.
  - **Task 4** tests: contract 9/9 GREEN (RS-1..RS-9 including failure modes + zero-byte + AC-8 byte-level); integration 3/3 GREEN (RSM-1 versioning Enabled, RSM-2 content-addressed swap detection, RSM-3 object lock GOVERNANCE) against REAL Testcontainers MinIO; unit 56 tests GREEN across snapshot module (pure logic + mock-client + helpers); fast-check property tests for content-addressed idempotency (100 runs × 2 properties). Stryker 91.53% ≥ 90% threshold.
  - **docker-compose fix**: corrected non-existent image tags `minio/minio:RELEASE.2025-07-25T11-22-23Z` → `:latest` (the pinned release tag does not exist on Docker Hub; verified via `docker pull` failure).
- **Verification**: typecheck 4/4 GREEN (ingest, config, contracts, api), lint clean on touched packages, turbo test 25/25 GREEN (161 ingest unit + 74 config + all others), contract 198/198 passed|4 skipped, integration raw-snapshot-minio 3/3 GREEN. Pre-existing env-dependent integration failures [sops-decryption, compose-stack, polyglot-eval-roundtrip, pg-age-pgvector] verified unchanged — same set as baseline 57d9939.

### File List

- infra/minio/init-bucket.sh (modified — +versioning +object-lock +GOVERNANCE retention)
- infra/docker-compose.yml (modified — fixed non-existent MinIO image tags → :latest)
- packages/config/src/secrets.ts (modified — +MinioPassword brand +minioRootPassword in ValidatedConfig +validateConfig)
- packages/config/src/secrets.test.ts (modified — +MINIO_ROOT_PASSWORD fixture +3 tests)
- packages/config/src/secrets-multi.test.ts (modified — +MINIO_ROOT_PASSWORD fixture)
- packages/config/src/audit-secrets-expansion.test.ts (modified — +MINIO_ROOT_PASSWORD fixture)
- packages/config/src/minio.ts (new — getMinioConfig + MinioConfig + DEFAULT_RAW_SNAPSHOTS_BUCKET)
- packages/config/src/minio.test.ts (new — 8 tests)
- packages/config/src/index.ts (modified — +MinioPassword export +minio module re-export)
- packages/ingest/package.json (modified — +minio@8.0.3 dep +fast-check devDep +./snapshot export)
- packages/ingest/src/snapshot/index.ts (new — RawSnapshotStore abstract class + createMinioSnapshotStore factory + errors + helpers)
- packages/ingest/src/snapshot/snapshot.test.ts (new — 13 pure-logic + property tests)
- packages/ingest/src/snapshot/minio-store.test.ts (new — 46 mock-client tests)
- packages/ingest/src/snapshot/helpers.test.ts (new — 14 helper tests)
- packages/ingest/stryker.config.json (modified — +src/snapshot/index.ts in mutate array)
- tests/support/helpers/test-minio.ts (new — Testcontainers MinIO harness)
- tests/contract/raw-snapshot.contract.test.ts (modified — unskipped + direct imports + mock client + 9 tests)
- tests/integration/raw-snapshot-minio.integration.test.ts (modified — unskipped + direct imports + 3 tests)
- _bmad-output/implementation-artifacts/sprint-status.yaml (modified — 3-4 in-progress → review → done)

### Change Log

- 2026-07-10: Story 3.4 implementation complete — immutable raw snapshots (FR-1.4). All 8 ACs satisfied, all 5 tasks done, Stryker 91.53%, full regression GREEN.
- 2026-07-10: Code-review patches applied (20/20). Verified: @iip/config 79/79 tests GREEN, @iip/ingest snapshot 82/82 tests GREEN, typecheck+lint clean across touched packages, raw-snapshot contract 10/10 GREEN, raw-snapshot-minio integration 3/3 GREEN in strict isolation. Pre-existing unrelated integration failures (config-history-schema, audit-health-gate) unchanged from baseline.

### Review Findings

Code review completed 2026-07-10. Review mode: `full` (story spec loaded). Layers: Blind Hunter, Edge Case Hunter, Acceptance Auditor (manual acceptance audit performed after subagent returned empty).

**Triage summary:** 0 decision-needed, 20 patch, 0 defer, 9 dismissed as noise/spec-compliant.

#### decision-needed

_None._

#### patch

- [x] [Review][Patch] `secrets.test.ts` fixture uses wrong env var name for inter-signature delay — `INTAKE_MIN_INTERSIGNATURE_DELAY_MS` in fixture vs `INTAKE_MIN_INTER_SIGNATURE_DELAY_MS` read by `validateConfig`. [packages/config/src/secrets.test.ts:25]
- [x] [Review][Patch] `getMinioConfig()` bucket-default expression has wrong operator precedence (`source['RAW_SNAPSHOTS_BUCKET']?.trim().length ?? 0 > 0`) and accepts invalid S3 bucket names. [packages/config/src/minio.ts:60-64]
- [x] [Review][Patch] `getMinioConfig()` does not validate `MINIO_ENDPOINT` scheme (accepts `ftp://`, embedded newlines, etc.). [packages/config/src/minio.ts:52-55]
- [x] [Review][Patch] Docker Compose MinIO images use `:latest` instead of a pinned digest/tag, violating project-context pin-by-digest rule. [infra/docker-compose.yml:25,34]
- [x] [Review][Patch] `init-bucket.sh` silently succeeds if bucket already exists without Object Lock; add post-creation verification that fails closed. [infra/minio/init-bucket.sh:27-33]
- [x] [Review][Patch] `init-bucket.sh` alias-setup retry loop does not fail after exhausting all 30 attempts. [infra/minio/init-bucket.sh:24-32]
- [x] [Review][Patch] `SnapshotInput` / `put()` does not accept the real `FetchedDocument` shape (`rawBytes` field) even though JSDoc claims both shapes are supported. [packages/ingest/src/snapshot/index.ts:65-74,374-379]
- [x] [Review][Patch] `RawSnapshotStore.get()` signature uses plain `string` instead of branded `RawSnapshotKey`, weakening nominal typing. [packages/ingest/src/snapshot/index.ts:142,412]
- [x] [Review][Patch] `bucketAccessPolicy()` only checks `Principal === '*'` and `Effect === 'Allow'`; ignores `Action`, `Resource`, `Condition`, and never returns `write`. [packages/ingest/src/snapshot/index.ts:494-503]
- [x] [Review][Patch] `readStream()` accumulates the full object in memory without a max-size guard, creating a DoS vector for large/misbehaving responses. [packages/ingest/src/snapshot/index.ts:300-313]
- [x] [Review][Patch] S3 user metadata 2 KB total limit is documented but not enforced at runtime. [packages/ingest/src/snapshot/index.ts:391-399]
- [x] [Review][Patch] `client.getObject()` stream errors emitted after the stream starts are not caught by the `for await` loop. [packages/ingest/src/snapshot/index.ts:436-447,300-313]
- [x] [Review][Patch] `SnapshotStoreError` does not preserve the original error `cause`, hampering production debugging. [packages/ingest/src/snapshot/index.ts:184-191]
- [x] [Review][Patch] `computeSnapshotKey()` has no runtime guard against non-Buffer/Uint8Array input. [packages/ingest/src/snapshot/index.ts:225-237]
- [x] [Review][Patch] `get()` metadata reconstruction is case-sensitive; should lookup `x-amz-meta-*` keys case-insensitively. [packages/ingest/src/snapshot/index.ts:463-467]
- [x] [Review][Patch] `isNoSuchBucket()` regex fallback is overly broad and could match unrelated messages. [packages/ingest/src/snapshot/index.ts:321-326]
- [x] [Review][Patch] Contract test RS-4 (idempotency) does not assert the mock store contains exactly one object after two identical puts. [tests/contract/raw-snapshot.contract.test.ts:210-221]
- [x] [Review][Patch] Testcontainers harness does not verify bucket lock/versioning config after provisioning. [tests/support/helpers/test-minio.ts:67-87]
- [x] [Review][Patch] No integration test exercises the real `init-bucket.sh` shell script in a container. [infra/minio/init-bucket.sh]
- [x] [Review][Patch] Missing tests for TOCTOU race on `get()` (stat succeeds, getObject then fails) and Unicode metadata values. [packages/ingest/src/snapshot/index.ts:422-447, tests/contract/raw-snapshot.contract.test.ts]

#### defer

_None._
