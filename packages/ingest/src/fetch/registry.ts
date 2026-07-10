/**
 * Adapter registry — tier-based resolution of crawler adapters (AC-4, ADR-007).
 *
 * Maps ingestion tiers (1–5) to their corresponding `Crawler` adapter
 * instances. v1 ships Tier-1 (FirecrawlAdapter) + Tier-4 (ManualUploadAdapter);
 * Tier-2/3/5 are scaffolded stubs that throw `NOT_IMPLEMENTED`.
 *
 * The registry is the single dispatch point: given a source's tier, the
 * ingest worker resolves the adapter and calls `discover()` / `fetch()` /
 * `clean()` through the port interface.
 *
 * @rules FR-1.3, AC-4, ADR-007, FA-2, FA-3
 * @adr ADR-007
 */
import type { Crawler } from './index.js';
import { FirecrawlAdapter, type FetchImpl } from './firecrawl.js';
import { ManualUploadAdapter } from './manual-upload.js';
import { CrawleeAdapter, AlaveteliAdapter, SftpAdapter } from './deferred-adapters.js';

/**
 * A registered adapter entry: the adapter instance + its tier number.
 */
export interface RegistryEntry {
  tier: number;
  name: string;
  adapter: Crawler;
}

/**
 * The adapter registry. Resolves an adapter by tier number.
 *
 * `byTier(n)` returns the `RegistryEntry` for tier `n`, or `undefined` if no
 * adapter is registered for that tier. The contract tests (FA-2, FA-3) assert
 * `byTier(1).name === 'firecrawl'` and `byTier(4).name === 'manual-upload'`.
 */
export interface AdapterRegistry {
  byTier(tier: number): RegistryEntry | undefined;
  entries(): RegistryEntry[];
}

/**
 * Create the default adapter registry with v1 adapters (Tier-1 Firecrawl,
 * Tier-4 manual upload) + deferred stubs (Tier-2/3/5).
 *
 * @param firecrawlOptions - constructor options for the FirecrawlAdapter
 *   (endpoint + optional apiKey + optional fetchImpl). When omitted, the
 *   adapter is constructed with a placeholder endpoint (tests inject options).
 */
export interface RegistryFirecrawlOptions {
  fetchImpl?: FetchImpl;
  endpoint?: string;
  apiKey?: string;
}

export function createAdapterRegistry(firecrawlOptions?: RegistryFirecrawlOptions): AdapterRegistry {
  const firecrawl = new FirecrawlAdapter({
    endpoint: firecrawlOptions?.endpoint ?? 'https://api.firecrawl.dev',
    ...(firecrawlOptions?.apiKey !== undefined ? { apiKey: firecrawlOptions.apiKey } : {}),
    ...(firecrawlOptions?.fetchImpl !== undefined ? { fetchImpl: firecrawlOptions.fetchImpl } : {}),
  });
  const manualUpload = new ManualUploadAdapter();
  const crawlee = new CrawleeAdapter();
  const alaveteli = new AlaveteliAdapter();
  const sftp = new SftpAdapter();

  const registry: Record<number, RegistryEntry> = {
    1: { tier: 1, name: firecrawl.name, adapter: firecrawl },
    2: { tier: 2, name: crawlee.name, adapter: crawlee },
    3: { tier: 3, name: alaveteli.name, adapter: alaveteli },
    4: { tier: 4, name: manualUpload.name, adapter: manualUpload },
    5: { tier: 5, name: sftp.name, adapter: sftp },
  };

  return {
    byTier(tier: number): RegistryEntry | undefined {
      return registry[tier];
    },
    entries(): RegistryEntry[] {
      return Object.values(registry).sort((a, b) => a.tier - b.tier);
    },
  };
}

/**
 * Create a test-only adapter registry with a no-op HTTP boundary.
 *
 * This is the safe registry to use in tests and any context where live
 * Firecrawl calls are undesirable. The no-op fetch returns empty responses
 * so tests can inspect port shape without network I/O.
 */
export function createNoOpAdapterRegistry(): AdapterRegistry {
  const noOpFetch: FetchImpl = async () => new Response('', { status: 200 });
  return createAdapterRegistry({
    endpoint: 'https://api.firecrawl.dev',
    fetchImpl: noOpFetch,
  });
}

/**
 * The default adapter registry instance.
 *
 * Created eagerly with placeholder Firecrawl options. Production code should
 * call `createAdapterRegistry()` with real options; this default exists so the
 * contract tests can resolve `adapterRegistry.byTier(n)` without constructing
 * their own registry (FA-2, FA-3). To avoid accidental live network calls, this
 * singleton does NOT include an API key.
 *
 * **WARNING:** Do not call `.fetch()` on this default registry in production
 * or tests without first constructing a registry with `fetchImpl`/`apiKey`.
 */
export const adapterRegistry: AdapterRegistry = createAdapterRegistry({
  endpoint: 'https://api.firecrawl.dev',
});
