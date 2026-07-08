---
stepsCompleted: ['step-01-preflight-and-context','step-02-generation-mode','step-03-test-strategy','step-04-generate-tests','step-04c-aggregate']
lastStep: 'step-04c-aggregate'
lastSaved: '2026-07-08'
workflowType: 'testarch-atdd'
storyId: '3.5'
storyKey: '3-5-document-provenance'
storyFile: '_bmad-output/planning-artifacts/epics.md (Epic 3, Story 3.5, lines 801-814)'
atddChecklistPath: '_bmad-output/test-artifacts/atdd/epic-3/story-3-5/atdd-checklist-3-5-document-provenance.md'
generatedTestFiles:
  - 'tests/integration/document-provenance.integration.test.ts'
inputDocuments:
  - '_bmad-output/planning-artifacts/epics.md'
  - '_bmad-output/project-context.md'
  - 'packages/db/src/schema/documents.ts'
  - 'packages/db/src/upsert.ts'
  - 'packages/citation/src/index.ts'
  - 'tests/support/helpers/ingest.ts'
  - 'tests/integration/ingest-schema.integration.test.ts'
activationState: 'RED'
activatesIn: 'Story 3.5 implementation (provenance-wiring service under packages/ingest/src/provenance/)'
---

# ATDD Checklist — Epic 3, Story 3.5: Per-Artifact Provenance

**Date:** 2026-07-08 · **Primary Test Level:** integration (real PG via Testcontainers) · **Severity:** **T1 — provenance spine**

> RED-phase scaffold. The provenance-wiring service (`packages/ingest/src/provenance/`) does not exist yet — the `documents` table + `upsertLastWriteWins` + `citation` package all exist, but the join between them is absent. Tests quarantined via `describe.skip`.

## Story Summary
As an Intake Operator, I want every extracted artifact to record its source document and character span, so that nothing exists without a source pointer.

## Acceptance Criteria
1. Every document records source_id, content_checksum, raw_snapshot_key, fetch metadata
2. Per-artifact provenance (source_doc_id + character span) wired into the citation package from Story 1.6
3. `documents` table uses idempotent upsert on content_checksum (`upsertLastWriteWins`, PC-1a)
4. Provenance decoupled from embeddings (AC-4) — re-embedding preserves citation validity

## Red-Phase Scaffolds
**File:** `tests/integration/document-provenance.integration.test.ts` (5 tests, all RED/skipped)

- ⏭️ **[P0] PR-1:** registering a document records source_id + checksum + snapshot key + fetch metadata — RED
- ⏭️ **[P0] PR-2:** re-registering the same content_checksum is idempotent (no duplicate row) — RED
- ⏭️ **[P0] PR-3:** a document row produces a resolvable citation tuple (source_doc_id, span, content_hash) — RED
- ⏭️ **[P1] PR-4:** changing the embedding does not invalidate the citation tuple (AC-4 decoupling) — RED
- ⏭️ **[P1] PR-5:** a document cannot reference a non-existent source_id (FK violation rejected) — RED

## Acceptance Criteria Coverage
| AC | Test(s) | Status |
|----|---------|--------|
| documents row carries full provenance | PR-1 | RED |
| idempotent upsert on content_checksum (PC-1a) | PR-2 | RED |
| citation-tuple wiring (FR-1.5) | PR-3 | RED |
| AC-4 decoupling (re-embedding safe) | PR-4 | RED |
| FK integrity (source_id → sources.id) | PR-5 | RED |

## Implementation Checklist
- [ ] Create `packages/ingest/src/provenance/index.ts` exporting `registerDocument(db, input)`, `emitCitationForDocument(db, docId, {spanStart, spanEnd})`, `verifyCitation(db, tuple)`, `reembedDocument(db, docId, opts)`
- [ ] `registerDocument`: `upsertLastWriteWins` into `documents` on `contentChecksum`; return the row with all provenance fields
- [ ] `emitCitationForDocument`: call `packages/citation` `emit(span, source)` with the document as source; persist the tuple
- [ ] `verifyCitation`: call `packages/citation` `verify(citation, source)`; return `{valid, contentHash}`
- [ ] `reembedDocument`: bump embedding version on the document row WITHOUT touching content_checksum/provenance (AC-4)
- [ ] Create `tests/support/helpers/test-db.ts` — Testcontainers PG harness (shared across integration tests)
- [ ] Remove `describe.skip` + convert dynamic imports to direct imports
- [ ] Run `pnpm vitest --project integration -- document-provenance` → all 5 GREEN

## Implementation Guidance
**Module path:** `packages/ingest/src/provenance/index.ts`

**registerDocument (PC-1a upsert):**
```ts
await upsertLastWriteWins(db, documents, { contentChecksum }, {
  sourceId, contentChecksum, rawSnapshotKey, fetchMetadata,
});
```

**AC-4 decoupling (the key invariant):** the citation tuple is `(source_doc_id, span_start, span_end, content_hash)`. None of these depend on the embedding. `reembedDocument` changes only the embedding column; `verifyCitation` re-derives `content_hash` from the document content (unchanged) → tuple stays valid.

**Testcontainers harness:** `tests/support/helpers/test-db.ts` should start a PG container (the custom `pgvector/pgvector:pg16` + AGE image), run migrations, and return `{client, teardown}`. This is shared infrastructure — other integration tests will reuse it.

**Estimated Effort:** Medium (the wiring is thin; the Testcontainers harness is the reusable asset).

## Notes
- The two halves (documents table + citation package) already exist and are GREEN — this story is the JOIN between them. "Nothing exists without a source pointer" (FR-1.5) is mechanically enforced by `PR-3` (every document emits a resolvable tuple) + `PR-5` (FK integrity).
- AC-4 decoupling (`PR-4`) is the defamation-critical property: re-embedding must never break a citation, because re-embedding happens on model swaps (bge-m3 → future model) and a broken citation = retracted evidence silently orphaned.
- The `documents` schema FK (`source_id → sources.id ON DELETE RESTRICT`) already enforces referential integrity at the DB layer; `PR-5` tests it through the application path.

**Generated by BMad TEA Agent** — 2026-07-08
