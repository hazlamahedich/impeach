/**
 * Deferred crawler adapters — Tier-2/3/5 scaffolded as interfaces, throwing
 * NOT_IMPLEMENTED (AC-4, ADR-007).
 *
 * These adapters are NOT part of v1. They are scaffolded so the registry can
 * resolve them (returning a stub that throws) and so the interface is locked
 * for future implementation. Each adapter documents its deferral rationale.
 *
 *  - Tier-2 (CrawleeAdapter): Crawlee + Playwright + stealth + residential
 *    proxy. Circumvention-adjacent — needs legal sign-off before v1.x.
 *  - Tier-3 (AlaveteliAdapter): FOI requests via Alaveteli platform.
 *    Deferred to v1.x.
 *  - Tier-5 (SftpAdapter): Partnership SFTP drops. Deferred to v2.
 *
 * @rules FR-1.3, AC-4, ADR-007
 * @adr ADR-007
 */
import type { DiscoveredUrl, FetchedDocument, CleanedDocument } from '@iip/contracts';
import { Crawler } from './index.js';
import type { CrawlerSource } from './index.js';

/**
 * Error code for deferred adapters (AC-4).
 */
export const NOT_IMPLEMENTED_CODE = 'NOT_IMPLEMENTED' as const;

/**
 * Typed error thrown by deferred adapters. Lets the worker/orchestrator
 * distinguish "not yet implemented" from runtime failures without string
 * matching.
 */
export class NotImplementedError extends Error {
  override readonly name = 'NotImplementedError';
  readonly code = NOT_IMPLEMENTED_CODE;
  constructor(
    message: string,
    readonly adapterName: string,
  ) {
    super(message);
  }
}

/**
 * Base class for deferred adapters. Implements the Crawler port but every
 * method throws `NotImplementedError`.
 */
abstract class DeferredAdapter extends Crawler {
  protected abstract readonly tierDescription: string;

  override async discover(_source: CrawlerSource): Promise<DiscoveredUrl[]> {
    throw new NotImplementedError(`${this.name}: ${this.tierDescription} — ${NOT_IMPLEMENTED_CODE}`, this.name);
  }

  override async fetch(
    _urlOrPayload: string | Record<string, unknown>,
    _extra?: { signal?: AbortSignal } & Record<string, unknown>,
  ): Promise<FetchedDocument> {
    throw new NotImplementedError(`${this.name}: ${this.tierDescription} — ${NOT_IMPLEMENTED_CODE}`, this.name);
  }

  override async clean(_raw: { url: string; rawBytes: Uint8Array; contentType: string }): Promise<CleanedDocument> {
    throw new NotImplementedError(`${this.name}: ${this.tierDescription} — ${NOT_IMPLEMENTED_CODE}`, this.name);
  }
}

/**
 * Tier-2 — Crawlee + Playwright + stealth + residential proxy.
 *
 * Circumvention-adjacent: needs legal sign-off before implementation. The
 * adapter would use headless-browser rendering with stealth plugins and
 * residential proxy rotation to access sources that block standard crawlers.
 *
 * @rules ADR-007, AC-4
 */
export class CrawleeAdapter extends DeferredAdapter {
  override readonly name = 'crawlee';
  protected readonly tierDescription = 'Tier-2 (Crawlee + Playwright + stealth + residential proxy) deferred from v1';
}

/**
 * Tier-3 — FOI requests via Alaveteli platform.
 *
 * Deferred to v1.x. The adapter would integrate with the Alaveteli FOI
 * platform API to submit + retrieve freedom-of-information requests.
 *
 * @rules ADR-007, AC-4
 */
export class AlaveteliAdapter extends DeferredAdapter {
  override readonly name = 'alaveteli';
  protected readonly tierDescription = 'Tier-3 (FOI via Alaveteli) deferred from v1';
}

/**
 * Tier-5 — Partnership SFTP drops.
 *
 * Deferred to v2. The adapter would poll partnership SFTP endpoints for
 * document drops from partner organizations.
 *
 * @rules ADR-007, AC-4
 */
export class SftpAdapter extends DeferredAdapter {
  override readonly name = 'sftp';
  protected readonly tierDescription = 'Tier-5 (partnership SFTP drops) deferred from v1';
}
