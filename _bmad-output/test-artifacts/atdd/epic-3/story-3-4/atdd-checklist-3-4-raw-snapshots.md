---
stepsCompleted: ['step-01-preflight-and-context','step-02-generation-mode','step-03-test-strategy','step-04-generate-tests','step-04c-aggregate']
lastStep: 'step-04c-aggregate'
lastSaved: '2026-07-08'
workflowType: 'testarch-atdd'
storyId: '3.4'
storyKey: '3-4-raw-snapshots'
storyFile: '_bmad-output/planning-artifacts/epics.md (Epic 3, Story 3.4, lines 785-799)'
atddChecklistPath: '_bmad-output/test-artifacts/atdd/epic-3/story-3-4/atdd-checklist-3-4-raw-snapshots.md'
generatedTestFiles:
  - 'tests/contract/raw-snapshot.contract.test.ts'
inputDocuments:
  - '_bmad-output/planning-artifacts/epics.md'
  - '_bmad-output/project-context.md'
  - 'infra/docker-compose.yml'
  - 'infra/minio/init-bucket.sh'
  - '.env.example'
  - 'tests/support/helpers/ingest.ts'
activationState: 'RED'
activatesIn: 'Story 3.4 implementation (MinIO snapshot client under packages/ingest/src/snapshot/)'
---

# ATDD Checklist — Epic 3, Story 3.4: Immutable Raw Snapshots

**Date:** 2026-07-08 · **Primary Test Level:** contract (snapshot store port + content-addressing) · **Severity:** **T1 — evidence-artifact integrity**

> RED-phase scaffold. The snapshot client (`packages/ingest/src/snapshot/`) does not exist yet — MinIO infra is up but no TS client consumes it. Tests quarantined via `describe.skip`.

## Story Summary
As an Intake Operator, I want immutable raw snapshots of every fetched document stored, so that provenance, replay, and audit are always possible.

## Acceptance Criteria
1. Immutable raw snapshot written to MinIO (private bucket, off serving path)
2. Snapshot includes original fetched content (HTML/PDF bytes) + fetch metadata (url, timestamp, headers)
3. Snapshot is content-addressed (SHA-256 key)
4. MinIO bucket is versioned append-only (NFR-S-5)
5. Snapshot NEVER on the public serving path

## Red-Phase Scaffolds
**File:** `tests/contract/raw-snapshot.contract.test.ts` (5 tests, all RED/skipped)

- ⏭️ **[P0] RS-1:** a RawSnapshotStore port is exported with put() + get() — RED
- ⏭️ **[P0] RS-2:** put() returns a SHA-256 content-addressed key — RED
- ⏭️ **[P0] RS-3:** get() by content key returns original bytes + fetch metadata — RED
- ⏭️ **[P1] RS-4:** re-putting identical content is idempotent (same key, no duplicate) — RED
- ⏭️ **[P1] RS-5:** the snapshot bucket is private (no anonymous/public access) — RED

## Acceptance Criteria Coverage
| AC | Test(s) | Status |
|----|---------|--------|
| RawSnapshotStore port (SC-5) | RS-1 | RED |
| written to MinIO private bucket | RS-5 | RED |
| original content + fetch metadata | RS-3 | RED |
| content-addressed SHA-256 key | RS-2 | RED |
| versioned append-only (idempotent) | RS-4 | RED |
| off serving path (private) | RS-5 | RED |

## Implementation Checklist
- [ ] Create `packages/ingest/src/snapshot/index.ts` exporting `RawSnapshotStore` (abstract: put, get, bucketAccessPolicy) + `createMinioSnapshotStore(config)`
- [ ] Implement `createMinioSnapshotStore` using `minio` npm client (or `@aws-sdk/client-s3` — pick one, pin it)
- [ ] `put(fetched)`: compute `key = sha256(bytes).hex`, upload to bucket, return `{key}`
- [ ] `get(key)`: fetch object, return `{bytes, metadata: {url, fetchedAt, contentType}}`
- [ ] `bucketAccessPolicy()`: return `{anonymousAccess: 'none'}` (assert bucket is private)
- [ ] Configure MinIO bucket versioning + object locking (GOVERNANCE mode) in `infra/minio/init-bucket.sh` (currently only sets private — NFR-S-5 gap)
- [ ] Read MinIO config from `@iip/config` env (`MINIO_ENDPOINT`, `RAW_SNAPSHOTS_BUCKET`) — process.env reads only in @iip/config (PC-2.6)
- [ ] Add `./snapshot` to `packages/ingest` `package.json` `exports`
- [ ] Remove `describe.skip` + convert dynamic import to direct import
- [ ] Run `pnpm vitest --project contract -- raw-snapshot` → all 5 GREEN
- [ ] Add integration test against real MinIO (Testcontainers MinIO or the compose `minio` service)

## Implementation Guidance
**Module path:** `packages/ingest/src/snapshot/index.ts`

**Port shape (SC-5):**
```ts
abstract class RawSnapshotStore {
  abstract put(fetched: FetchedDocument): Promise<{key: string}>;
  abstract get(key: string): Promise<{bytes: Buffer; metadata: FetchMetadata}>;
  abstract bucketAccessPolicy(): Promise<{anonymousAccess: 'none'|'read'|'write'}>;
}
```

**Content-addressing:** `key = createHash('sha256').update(bytes).digest('hex')` — 64-char lowercase hex. Same content → same key (idempotent).

**MinIO config (from `.env.example`, already present):** `MINIO_ENDPOINT`, `MINIO_ROOT_USER`, `MINIO_ROOT_PASSWORD`, `RAW_SNAPSHOTS_BUCKET=raw-snapshots`, ports 9100/9001.

**Infra gap (NFR-S-5):** `infra/minio/init-bucket.sh` currently sets the bucket private but does NOT configure versioning or object locking. Must add `mc version enable` + object-lock config for append-only compliance.

**Estimated Effort:** Medium (client + port; infra gap is the object-lock config).

## Notes
- This is the defamation-critical evidence artifact — the snapshot is what a court would examine. No snapshot = no provenance = no defense.
- The MinIO infra (service + bucket-init sidecar + env) is already landed from the prep sprint; the gap is purely the TS client + object-lock config.
- "Off the serving path" (SEC-5): the snapshot bucket must never be publicly readable; the web app never proxies snapshot bytes. `RS-5` asserts `anonymousAccess: 'none'`.
- Pin the minio client version; `minio` npm package and `@aws-sdk/client-s3` both work with the MinIO S3-compatible API — pick one and document the choice.

**Generated by BMad TEA Agent** — 2026-07-08
