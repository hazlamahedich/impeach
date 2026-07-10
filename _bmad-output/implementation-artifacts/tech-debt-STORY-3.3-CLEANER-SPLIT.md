---
ticket_id: 'STORY-3.3-CLEANER-SPLIT'
type: tech-debt
source: 'Story 3.3 adversarial review (2026-07-10)'
status: open
priority: medium
created: '2026-07-10'
target_sprint: 'Post-3.3 (before second cleaner implementation)'
---

# TECH-DEBT: Extract DocumentCleaner port from Crawler

## Problem

`clean()` on the `Crawler` port conflates the adapter boundary with the domain pipeline. Cleaning (text normalization, boilerplate stripping, OCR, metadata extraction) is a domain concern — the same pipeline regardless of whether the document came from Firecrawl or manual upload. Every adapter that implements `Crawler` must also implement `clean()`, which is the wrong kind of coupling.

ADR-006 already established the precedent: OCR gets its own `OcrPort`. The same logic applies to the broader cleaning pipeline.

## Proposed Architecture

```ts
// packages/ingest/src/ports/crawler.ts
interface Crawler {
  discover(source: Source): Promise<DiscoveredUrl[]>;
  fetch(url: string): Promise<FetchedDocument>;
}

// packages/ingest/src/ports/document-cleaner.ts
interface DocumentCleaner {
  clean(raw: FetchedDocument): Promise<CleanedDocument>;
}

// packages/ingest/src/ports/document-ingester.ts
interface DocumentIngester {
  ingest(file: UploadedFile): Promise<FetchedDocument>;
}
```

`ManualUploadAdapter` implements `DocumentIngester`, not `Crawler`. The pipeline composes them:

```
User upload → DocumentIngester.ingest() → DocumentCleaner.clean() → store
Crawler.discover() → Crawler.fetch() → DocumentCleaner.clean() → store
```

## Acceptance Criteria

1. `DocumentCleaner` port exists at `packages/ingest/src/ports/document-cleaner.ts`
2. `DocumentIngester` port exists at `packages/ingest/src/ports/document-ingester.ts`
3. `Crawler` port reduced to `discover()` + `fetch()` only (interface, not abstract class)
4. `ManualUploadAdapter` implements `DocumentIngester` (not `Crawler`)
5. FA-7 contract test moved to `packages/ingest/src/ports/__tests__/cleaner.contract.test.ts`
6. FA-6 contract test moved to `packages/ingest/src/ports/__tests__/ingester.contract.test.ts`
7. All existing contract tests pass under new port structure
8. `packages/ingest/package.json` exports updated for new port paths

## References

- ADR-006 (OcrPort precedent)
- ADR-007 (tiered adapter model)
- SC-5 (port purity)
- Story 3.3 adversarial review consensus (Winston/Amelia/Murat)
