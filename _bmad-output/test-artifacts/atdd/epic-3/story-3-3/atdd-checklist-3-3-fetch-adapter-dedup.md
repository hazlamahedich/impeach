---
stepsCompleted: ['step-01-preflight-and-context','step-02-generation-mode','step-03-test-strategy','step-04-generate-tests','step-04c-aggregate']
lastStep: 'step-04c-aggregate'
lastSaved: '2026-07-08'
workflowType: 'testarch-atdd'
storyId: '3.3'
storyKey: '3-3-fetch-adapter-dedup'
storyFile: '_bmad-output/planning-artifacts/epics.md (Epic 3, Story 3.3, lines 767-783)'
atddChecklistPath: '_bmad-output/test-artifacts/atdd/epic-3/story-3-3/atdd-checklist-3-3-fetch-adapter-dedup.md'
generatedTestFiles:
  - 'tests/contract/fetch-adapter.contract.test.ts'
inputDocuments:
  - '_bmad-output/planning-artifacts/epics.md'
  - '_bmad-output/project-context.md'
  - 'docs/adr/0006-ocr-pipeline.md'
  - 'docs/adr/0007-tiered-ingestion-architecture.md'
  - 'tests/support/helpers/ingest.ts'
activationState: 'RED'
activatesIn: 'Story 3.3 implementation (Crawler port + Firecrawl/Manual adapters + deduplicateDocuments)'
---

# ATDD Checklist — Epic 3, Story 3.3: Fetch Adapters + Deduplication

**Date:** 2026-07-08 · **Primary Test Level:** contract (port shape + dedup invariant) · **Severity:** **T1 — provenance dedup spine**

> RED-phase scaffold. The fetch module (`packages/ingest/src/fetch/`) does not exist yet. Tests are quarantined via `describe.skip` and loaded via variable-specifier dynamic import.

## Story Summary
As an Intake Operator, I want the system to discover URLs, fetch documents, clean them to text, and deduplicate by content checksum, so that the same document ingested twice is processed once.

## Acceptance Criteria
1. URLs discovered per crawl strategy (rss, sitemap, list_page, api, manual)
2. HTML/PDF documents fetched and cleaned to text
3. Deduplicated by content_checksum (same doc ingested twice → processed once)
4. v1 adapters: Firecrawl (Tier-1 scrapable) + manual upload (Tier-4 blocked)
5. Tier-2 (Crawlee+stealth), Tier-3 (FOI Alaveteli), Tier-5 (partnership SFTP) scaffolded as interfaces, deferred from v1
6. PDF cleaning includes OCR via Docling + PaddleOCR-VL (ADR-006)
7. Manually uploaded documents carry a provenance record (source_url, obtained_via, retrieved_at, uploader_id, reviewer_id, content_hash, legal_basis)

## Red-Phase Scaffolds
**File:** `tests/contract/fetch-adapter.contract.test.ts` (6 tests, all RED/skipped)

- ⏭️ **[P0] FA-1:** the Crawler port is exported with discover() + fetch() + clean() — RED
- ⏭️ **[P0] FA-2:** FirecrawlAdapter (Tier-1) registered for scrapable sources — RED
- ⏭️ **[P1] FA-3:** ManualUploadAdapter (Tier-4) handles blocked sources — RED
- ⏭️ **[P0] FA-4:** two documents with same content_checksum deduplicated (processed once) — RED
- ⏭️ **[P1] FA-5:** two documents with different content_checksums both kept — RED
- ⏭️ **[P1] FA-6:** a manually uploaded document carries a full provenance record — RED

## Acceptance Criteria Coverage
| AC | Test(s) | Status |
|----|---------|--------|
| Crawler port (SC-5) | FA-1 | RED |
| discover/fetch/clean per strategy | FA-1 | RED |
| Firecrawl v1 (Tier-1) | FA-2 | RED |
| manual upload v1 (Tier-4) | FA-3, FA-6 | RED |
| dedup by content_checksum | FA-4, FA-5 | RED |
| manual provenance record | FA-6 | RED |
| OCR (Docling+PaddleOCR) | (deferred — covered at integration level with real PDFs) | — |
| Tier-2/3/5 deferred interfaces | (out of v1 scope) | — |

## Implementation Checklist
- [ ] Create `packages/ingest/src/fetch/index.ts` exporting the `Crawler` port (abstract: discover, fetch, clean)
- [ ] Create `packages/ingest/src/fetch/firecrawl.ts` — `FirecrawlAdapter implements Crawler` (Tier-1)
- [ ] Create `packages/ingest/src/fetch/manual-upload.ts` — `ManualUploadAdapter` (Tier-4) carrying full provenance
- [ ] Create `packages/ingest/src/fetch/registry.ts` — `adapterRegistry.byTier(n)` mapping
- [ ] Create `packages/ingest/src/fetch/dedup.ts` — `deduplicateDocuments(docs)` grouping by contentChecksum
- [ ] Scaffold Tier-2 (Crawlee), Tier-3 (Alaveteli), Tier-5 (SFTP) as interfaces only (throw `NOT_IMPLEMENTED`)
- [ ] Wire OCR (Docling+PaddleOCR-VL) into the PDF clean path (ADR-006) — separate integration test with real PDFs
- [ ] Add `./fetch` to `packages/ingest` `package.json` `exports`
- [ ] Remove `describe.skip` + convert dynamic import to direct import
- [ ] Run `pnpm vitest --project contract -- fetch-adapter` → all 6 GREEN

## Implementation Guidance
**Crawler port (SC-5 boundary):**
```ts
abstract class Crawler {
  abstract discover(source): Promise<DiscoveredUrl[]>;
  abstract fetch(url): Promise<FetchedDocument>;
  abstract clean(raw): Promise<CleanedDocument>;
}
```

**Dedup (FR-1.3 core invariant):**
- `deduplicateDocuments(docs)` → `{ unique: CleanedDocument[], duplicates: {duplicateOf: string}[] }`
- Group by `contentChecksum`; first occurrence → unique, rest → duplicates with `duplicateOf = first.url`

**Manual-upload provenance (required fields):** `source_url`, `obtained_via`, `retrieved_at`, `uploader_id`, `reviewer_id`, `content_hash`, `legal_basis` (FR-1.3 AC #7).

**Estimated Effort:** Medium (port + 2 adapters + registry + dedup; OCR is the heavy separate piece).

## Notes
- Dedup is defamation-adjacent: processing the same document twice creates duplicate provenance chains that confuse retraction propagation. `content_checksum` must be the single dedup anchor.
- The dedupe-anchor primitives (`upsertLastWriteWins`, unique index `documents_content_checksum_uq`, `fetchDedupeAnchor`) already exist from TD3/TD4 — this story builds the application-level dedup routine on top.
- OCR (Docling+PaddleOCR-VL) is not contract-tested here; it needs real PDF fixtures + latency budgeting (PaddlePaddle on Mac arm64 is CPU-only/slow). Cover at integration level separately.

**Generated by BMad TEA Agent** — 2026-07-08
