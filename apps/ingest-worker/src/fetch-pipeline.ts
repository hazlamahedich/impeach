/**
 * Fetch pipeline — discover→fetch→clean→dedup integration for the ingest worker
 * (FR-1.3, Story 3.3 Task 5).
 *
 * Wires the fetch adapters, cleanup, OCR, and deduplication into a single
 * processing function the ingest worker calls. The pipeline:
 *
 *  1. **crawling_disabled guard** — checks `sources.crawling_disabled` before
 *     enqueueing fetch jobs (lawful-access requirement, not optional). A source
 *     with `crawling_disabled = true` is legally barred from automated fetching.
 *  2. **discover** — the adapter discovers URLs per the source's crawl strategy.
 *  3. **fetch** — each discovered URL is fetched via the adapter (with
 *     `AbortSignal` propagation, AC-7).
 *  4. **clean** — raw bytes are cleaned to structured text (FA-7 fidelity).
 *  5. **dedup** — documents are deduplicated by `content_checksum` (FR-1.3).
 *
 * STR-3 compliance: discover→fetch→clean transitions go through Redis Streams +
 * Enqueuer. This module does NOT inline-enqueue; it returns the discovered URLs
 * + cleaned documents for the orchestrator to enqueue via `enqueueIngestJob`.
 *
 * @rules FR-1.3, AC-1, AC-2, AC-3, AC-7, STR-3
 * @adr ADR-007
 */
import type { Crawler, CrawlerSource } from '@iip/ingest/fetch';
import type { DiscoveredUrl, FetchedDocument, CleanedDocument } from '@iip/contracts';
import { deduplicateDocuments, type DedupDocument } from '@iip/ingest/dedupe';

/**
 * Error thrown when a source has `crawling_disabled = true`.
 *
 * This is a lawful-access guard: a source with `crawling_disabled = true` is
 * legally barred from automated fetching (FR-1.2, Story 3.2). The guard is
 * NOT optional — skipping it is a compliance violation.
 */
export class CrawlingDisabledError extends Error {
  override readonly name = 'CrawlingDisabledError';
  constructor(
    message: string,
    readonly sourceId: string,
  ) {
    super(message);
  }
}

/**
 * Per-URL fetch/clean outcome. Keeps successful results and failure metadata
 * so a single bad URL does not abort the whole source batch.
 */
interface UrlOutcome {
  url: string;
  fetched?: FetchedDocument;
  cleaned?: CleanedDocument;
  error?: Error;
}

/**
 * The result of a fetch pipeline run: discovered URLs + cleaned documents +
 * dedup result.
 */
export interface FetchPipelineResult {
  discoveredUrls: DiscoveredUrl[];
  cleanedDocuments: CleanedDocument[];
  dedupResult: {
    unique: CleanedDocument[];
    duplicates: { duplicateOf: string }[];
  };
  failures: { url: string; error: string }[];
}

/**
 * Run the fetch pipeline for a source: discover → fetch → clean → dedup.
 *
 * @param adapter - the Crawler adapter to use (resolved from the registry by tier)
 * @param source - the source to fetch from (carries `crawlingDisabled` guard)
 * @param signal - optional AbortSignal to cancel fetches/cleaning
 * @returns the pipeline result: discovered URLs, cleaned documents, dedup result
 * @throws {CrawlingDisabledError} if `source.crawlingDisabled` is true
 *
 * @rules FR-1.3, AC-1, AC-2, AC-3, AC-7
 */
export async function runFetchPipeline(
  adapter: Crawler,
  source: CrawlerSource,
  signal?: AbortSignal,
): Promise<FetchPipelineResult> {
  // ── Lawful-access guard (FR-1.2, Story 3.2) ────────────────────────────
  // A source with `crawling_disabled = true` is legally barred from automated
  // fetching. This guard is NOT optional — skipping it is a compliance
  // violation. The guard runs BEFORE any network I/O.
  if (source.crawlingDisabled) {
    throw new CrawlingDisabledError(
      `Source crawling is disabled (lawful-access gate): ${source.url}`,
      source.url,
    );
  }

  // ── Discover (AC-1) ────────────────────────────────────────────────────
  const discoveredUrls = await adapter.discover(source);

  // ── Fetch + Clean (AC-2, AC-7, FA-7) ───────────────────────────────────
  if (signal?.aborted) {
    throw signal.reason ?? new Error('Fetch pipeline aborted');
  }

  const outcomes: UrlOutcome[] = [];
  for (const discovered of discoveredUrls) {
    if (signal?.aborted) {
      outcomes.push({ url: discovered.url, error: new Error('Fetch pipeline aborted') });
      continue;
    }
    try {
      const fetched: FetchedDocument = await adapter.fetch(discovered.url, signal ? { signal } : {});
      if (signal?.aborted) {
        outcomes.push({ url: discovered.url, error: new Error('Fetch pipeline aborted') });
        continue;
      }
      const cleaned: CleanedDocument = await adapter.clean({
        url: fetched.url,
        rawBytes: fetched.rawBytes,
        contentType: fetched.contentType,
      });
      // Carry provenance through if present (manual uploads, AC-5).
      if (fetched.provenance) {
        cleaned.provenance = fetched.provenance;
      }
      outcomes.push({ url: discovered.url, fetched, cleaned });
    } catch (err) {
      const error = err instanceof Error ? err : new Error(String(err));
      outcomes.push({ url: discovered.url, error });
    }
  }

  const cleanedDocuments: CleanedDocument[] = outcomes
    .map((o) => o.cleaned)
    .filter((c): c is CleanedDocument => c !== undefined);
  const failures = outcomes
    .filter((o) => o.error !== undefined)
    .map((o) => ({ url: o.url, error: o.error!.message }));

  // ── Dedup (AC-3, FR-1.3) ───────────────────────────────────────────────
  const dedupInput: DedupDocument[] = cleanedDocuments.map((doc) => ({
    url: doc.url,
    cleanedText: doc.text,
    contentChecksum: doc.contentChecksum,
  }));
  const deduped = deduplicateDocuments(dedupInput);

  // Map deduped.unique indices back to the full CleanedDocument objects so
  // provenance and other metadata survive deduplication (AC-5).
  const uniqueDocuments: CleanedDocument[] = deduped.unique.map((dedupDoc) => {
    const original = cleanedDocuments.find((doc) => doc.url === dedupDoc.url);
    if (!original) {
      throw new Error(`Dedup returned unknown unique URL: ${dedupDoc.url}`);
    }
    return original;
  });

  return {
    discoveredUrls,
    cleanedDocuments,
    dedupResult: {
      unique: uniqueDocuments,
      duplicates: deduped.duplicates,
    },
    failures,
  };
}
