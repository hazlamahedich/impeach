/**
 * FirecrawlAdapter — Tier-1 scrapable-source crawler (ADR-007, AC-4).
 *
 * Firecrawl is an external service that handles HTML rendering + JavaScript
 * execution for scrapable sources. This adapter wraps the Firecrawl API:
 *
 *  - `discover()` — calls Firecrawl's `/map` endpoint to enumerate URLs.
 *  - `fetch()` — calls Firecrawl's `/scrape` endpoint for a single URL.
 *  - `clean()` — strips HTML to plain text (Firecrawl already does basic
 *    cleanup; this is a secondary pass for load-bearing verb preservation).
 *
 * **Injectable `fetchImpl` (FA-8):** the HTTP boundary is injectable so tests
 * can mock the Firecrawl API call without a real network. The adapter
 * propagates an `AbortSignal.timeout(10000)` to the underlying fetch to
 * prevent external-dep stalls from blocking worker queues (AC-7).
 *
 * @rules FR-1.3, AC-2, AC-4, AC-7, FA-2, FA-7, FA-8
 * @adr ADR-007
 */
import { createHash } from 'node:crypto';
import type { ContentChecksum, DiscoveredUrl, FetchedDocument, CleanedDocument } from '@iip/contracts';
import { Crawler } from './index.js';
import type { CrawlerSource } from './index.js';

/**
 * The injectable HTTP fetch implementation. Mirrors the `fetch()` global but
 * is injectable for testing (FA-8). The signal is part of the init options.
 */
export type FetchImpl = (
  url: string,
  init?: {
    signal?: AbortSignal;
    headers?: Record<string, string>;
    method?: string;
    body?: string;
  },
) => Promise<Response>;

/**
 * Constructor options for `FirecrawlAdapter`.
 *
 * `fetchImpl` defaults to `globalThis.fetch` when omitted. `endpoint` is the
 * Firecrawl API base URL. `apiKey` is optional — production wiring injects it
 * from secrets; tests omit it.
 */
export interface FirecrawlAdapterOptions {
  fetchImpl?: FetchImpl;
  endpoint: string;
  apiKey?: string;
}

/**
 * Default timeout for Firecrawl API calls (10 seconds).
 *
 * An external-dep stall must not block the orchestrator indefinitely
 * (AC-7, project-context: AbortSignal.timeout on every boundary).
 */
const FIRECRAWL_TIMEOUT_MS = 10_000;

/**
 * FirecrawlAdapter — Tier-1 adapter for scrapable sources.
 *
 * @rules FR-1.3, AC-4, FA-2
 */
export class FirecrawlAdapter extends Crawler {
  override readonly name = 'firecrawl';
  private readonly fetchImpl: FetchImpl;
  private readonly endpoint: string;
  private readonly apiKey: string | undefined;

  constructor(options: FirecrawlAdapterOptions) {
    super();
    this.fetchImpl = options.fetchImpl ?? globalThis.fetch;
    this.endpoint = options.endpoint;
    this.apiKey = options.apiKey;
  }

  override async discover(source: CrawlerSource, options?: { signal?: AbortSignal }): Promise<DiscoveredUrl[]> {
    // Firecrawl /map endpoint enumerates crawlable URLs from a site root.
    const response = await this.fetchImpl(
      `${stripTrailingSlash(this.endpoint)}/v1/map`,
      {
        method: 'POST',
        body: JSON.stringify({ url: source.url }),
        signal: options?.signal ?? AbortSignal.timeout(FIRECRAWL_TIMEOUT_MS),
        headers: {
          'Content-Type': 'application/json',
          ...(this.apiKey ? { Authorization: `Bearer ${this.apiKey}` } : {}),
        },
      },
    );
    if (!response.ok) {
      throw new Error(`Firecrawl /map failed: ${response.status} ${response.statusText}`);
    }
    const json = (await response.json()) as { links?: string[] };
    const links = json.links ?? [];
    const now = new Date().toISOString();
    return links.map((url) => ({ url, discovered_at: now }));
  }

  override async fetch(
    urlOrPayload: string | Record<string, unknown>,
    extra?: { signal?: AbortSignal } & Record<string, unknown>,
  ): Promise<FetchedDocument> {
    const url = typeof urlOrPayload === 'string' ? urlOrPayload : String(urlOrPayload['url'] ?? '');
    if (!url || !URL.canParse(url)) {
      throw new Error(`FirecrawlAdapter.fetch() requires a valid URL, got: ${url}`);
    }

    // Firecrawl /scrape endpoint fetches + renders a single URL.
    const signal = extra?.signal;
    const response = await this.fetchImpl(
      `${stripTrailingSlash(this.endpoint)}/v1/scrape`,
      {
        method: 'POST',
        body: JSON.stringify({ url }),
        signal: signal ?? AbortSignal.timeout(FIRECRAWL_TIMEOUT_MS),
        headers: {
          'Content-Type': 'application/json',
          ...(this.apiKey ? { Authorization: `Bearer ${this.apiKey}` } : {}),
        },
      },
    );
    if (!response.ok) {
      throw new Error(`Firecrawl /scrape failed: ${response.status} ${response.statusText}`);
    }

    // Preserve the actual response content type when present; Firecrawl may
    // return JSON envelopes, markdown, or raw HTML/PDF content.
    const responseContentType = response.headers.get('content-type') ?? '';
    let rawText: string;
    let derivedContentType: string;
    if (responseContentType.includes('application/json')) {
      const json = (await response.json()) as {
        data?: { html?: string; markdown?: string; content?: string; metadata?: { title?: string } };
      };
      rawText = json.data?.markdown ?? json.data?.content ?? json.data?.html ?? '';
      derivedContentType = responseContentType;
    } else {
      rawText = await response.text();
      derivedContentType = responseContentType || 'text/html';
    }
    const rawBytes = new TextEncoder().encode(rawText);
    return {
      url,
      rawBytes,
      contentType: derivedContentType,
      fetchedAt: new Date().toISOString(),
    };
  }

  override async clean(raw: { url: string; rawBytes: Uint8Array; contentType: string }): Promise<CleanedDocument> {
    // Use fatal UTF-8 decoding so corrupt byte sequences surface as errors
    // rather than silently mutating the content_checksum anchor (FR-1.3).
    const rawText = new TextDecoder('utf-8', { fatal: true }).decode(raw.rawBytes);
    // Strip HTML tags for a plain-text representation. This is a simple
    // secondary cleanup — Firecrawl already does primary cleaning. The
    // key invariant (FA-7) is that the cleaned text is a faithful containment
    // of the source: no tokens absent from the original are introduced.
    const text = stripHtml(rawText);
    if (!text) {
      throw new Error('FirecrawlAdapter.clean() produced empty text — content_checksum would be ambiguous');
    }
    const contentChecksum = sha256Hex(text) as ContentChecksum;
    return { url: raw.url, text, contentChecksum };
  }
}

/**
 * Strip HTML tags to plain text, preserving whitespace separation.
 *
 * Removes `<script>` and `<style>` blocks entirely (their content is never
 * source text), then strips remaining tags. Does NOT introduce characters
 * absent from the source (FA-7 compliance).
 */
function stripHtml(html: string): string {
  return html
    .replace(/<script[\s\S]*?<\/script>/gi, ' ')
    .replace(/<style[\s\S]*?<\/style>/gi, ' ')
    .replace(/<[^>]+>/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

/**
 * Compute the SHA-256 hex digest of a string (the content_checksum).
 */
function sha256Hex(text: string): string {
  return createHash('sha256').update(text).digest('hex');
}

/**
 * Remove a trailing slash from a URL path, leaving the root slash alone.
 */
function stripTrailingSlash(url: string): string {
  return url.endsWith('/') && url.length > 1 ? url.slice(0, -1) : url;
}
