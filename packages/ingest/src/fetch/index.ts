/**
 * Crawler port — the SC-5 boundary every fetch adapter implements (AC-6).
 *
 * An abstract class (not an interface) so the contract test can inspect
 * `Crawler.prototype` for the method set. Every adapter — Firecrawl (Tier-1),
 * manual upload (Tier-4), and the deferred Tier-2/3/5 stubs — implements the
 * same three methods:
 *
 *  - `discover(source)` — discover URLs per the source's crawl strategy (AC-1).
 *  - `fetch(url)` — fetch the raw document bytes from a discovered URL (AC-2).
 *  - `clean(raw)` — clean raw bytes to structured text (AC-2, FA-7).
 *
 * TECH-DEBT (STORY-3.3-CLEANER-SPLIT): `clean()` will be extracted to a separate
 * `DocumentCleaner` port per ADR-006's `OcrPort` precedent. The Crawler port
 * should expose only `discover()` + `fetch()`; cleaning is a domain-pipeline
 * concern, not a source-concern. This port ships with `clean()` because the
 * ATDD contract test (FA-7) currently asserts it as an instance method. When
 * the port splits, FA-7 moves to a new `cleaner.contract.test.ts`.
 *
 * @rules FR-1.3, SC-5, AC-1, AC-2, AC-6, FA-1
 * @adr ADR-007
 */
import type {
  DiscoveredUrl,
  FetchedDocument,
  CleanedDocument,
  SourceResponse,
} from '@iip/contracts';

// Re-export deduplicateDocuments so consumers can import it from @iip/ingest/fetch
// (the contract test imports everything from this module).
export { deduplicateDocuments, type DedupDocument, type DuplicateEntry, type DedupResult } from '../dedupe/index.js';

/**
 * The source shape passed to `discover()`. A subset of `SourceResponse`
 * carrying only the fields the crawler needs: the configured crawl strategy
 * and the source URL.
 */
export interface CrawlerSource {
  url: string;
  crawlStrategy: string;
  crawlingDisabled: boolean;
}

/**
 * Convert a `SourceResponse` to the minimal `CrawlerSource` the port needs.
 *
 * This keeps the port decoupled from the full API response shape — the crawler
 * does not need trust-tier or lawful-access fields.
 */
export function toCrawlerSource(source: SourceResponse): CrawlerSource {
  return {
    url: source.url,
    crawlStrategy: source.crawl_strategy,
    crawlingDisabled: source.crawling_disabled,
  };
}

/**
 * The abstract Crawler port. Every adapter implements these three methods.
 *
 * `fetch()` accepts a variadic second argument so adapters can accept
 * adapter-specific input (e.g. `ManualUploadAdapter` takes an upload payload
 * with provenance). The base type uses `unknown` for the input; concrete
 * adapters narrow it.
 *
 * @rules FR-1.3, SC-5, AC-6
 */
export abstract class Crawler {
  /** Adapter name used by the registry for tier resolution. */
  abstract readonly name: string;

  /**
   * Discover URLs per the source's crawl strategy (AC-1).
   *
   * Returns a list of URLs to fetch. For manual-upload sources, this returns
   * an empty list (discovery is operator-driven, not automated).
   *
   * Concrete adapters override this; the base throws (the port is abstract).
   */
  discover(_source: CrawlerSource): Promise<DiscoveredUrl[]> {
    throw new Error('Crawler.discover() not implemented — override in a concrete adapter');
  }

  /**
   * Fetch the raw document bytes from a URL or upload payload (AC-2).
   *
   * @param urlOrPayload - the URL to fetch, or an adapter-specific payload
   *   (e.g. `{ sourceId, fileName, bytes, provenance }` for manual uploads).
   * @param extra - optional second argument for adapter-specific data (e.g.
   *   the full upload payload when the first arg is a sourceId string).
   *
   * Concrete adapters override this; the base throws.
   */
  fetch(
    _urlOrPayload: string | Record<string, unknown>,
    _extra?: { signal?: AbortSignal } & Record<string, unknown>,
  ): Promise<FetchedDocument> {
    throw new Error('Crawler.fetch() not implemented — override in a concrete adapter');
  }

  /**
   * Clean raw document bytes to structured text (AC-2, FA-7).
   *
   * The cleaned text MUST be a faithful containment of the source — no
   * hallucinated tokens. The `contentChecksum` (SHA-256 of the cleaned text)
   * is the dedupe anchor (FR-1.3).
   *
   * TECH-DEBT (STORY-3.3-CLEANER-SPLIT): will be extracted to a separate
   * `DocumentCleaner` port.
   *
   * Concrete adapters override this; the base throws.
   */
  clean(_raw: { url: string; rawBytes: Uint8Array; contentType: string }): Promise<CleanedDocument> {
    throw new Error('Crawler.clean() not implemented — override in a concrete adapter');
  }
}

// Re-export adapters + registry so consumers import from @iip/ingest/fetch.
export { FirecrawlAdapter, type FirecrawlAdapterOptions, type FetchImpl } from './firecrawl.js';
export { ManualUploadAdapter, type ManualUploadPayload } from './manual-upload.js';
export { CrawleeAdapter, AlaveteliAdapter, SftpAdapter, NOT_IMPLEMENTED_CODE } from './deferred-adapters.js';
export { adapterRegistry, createAdapterRegistry, type AdapterRegistry, type RegistryEntry, type RegistryFirecrawlOptions } from './registry.js';
