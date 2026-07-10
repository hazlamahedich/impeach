/**
 * Unit tests for the FirecrawlAdapter, ManualUploadAdapter, and dedup logic.
 *
 * @rules FR-1.3, AC-1, AC-2, AC-3, AC-4, AC-5, AC-7, FA-4, FA-5, FA-7, FA-8
 * @adr ADR-007
 */
import { describe, it, expect } from 'vitest';
import { createHash, randomUUID } from 'node:crypto';
import {
  FirecrawlAdapter,
  ManualUploadAdapter,
  adapterRegistry,
  createAdapterRegistry,
} from '@iip/ingest/fetch';
import { deduplicateDocuments } from '@iip/ingest/dedupe';

/** Local helper: valid 64-char hex SHA-256 digest (mirrors tests/support/helpers/ingest.ts). */
function makeValidContentChecksum(seed?: string): string {
  return createHash('sha256').update(seed ?? randomUUID()).digest('hex');
}

describe('FirecrawlAdapter', () => {
  it('has name "firecrawl"', () => {
    const adapter = new FirecrawlAdapter({ endpoint: 'https://api.firecrawl.dev' });
    expect(adapter.name).toBe('firecrawl');
  });

  it('clean() strips HTML tags and preserves load-bearing verbs', async () => {
    const adapter = new FirecrawlAdapter({ endpoint: 'https://api.firecrawl.dev' });
    const rawHtml = '<html><body><p>Senator testified under oath.</p></body></html>';
    const cleaned = await adapter.clean({
      url: 'https://example.com/doc',
      rawBytes: new TextEncoder().encode(rawHtml),
      contentType: 'text/html',
    });
    expect(cleaned.text).toContain('testified');
    expect(cleaned.text).not.toContain('<p>');
    expect(cleaned.text).not.toContain('</p>');
    // contentChecksum is the SHA-256 of the cleaned text
    const expectedChecksum = createHash('sha256').update(cleaned.text).digest('hex');
    expect(cleaned.contentChecksum).toBe(expectedChecksum);
  });

  it('clean() strips script and style blocks', async () => {
    const adapter = new FirecrawlAdapter({ endpoint: 'https://api.firecrawl.dev' });
    const rawHtml = '<script>alert("xss")</script><style>.x{color:red}</style><p>content</p>';
    const cleaned = await adapter.clean({
      url: 'https://example.com/doc',
      rawBytes: new TextEncoder().encode(rawHtml),
      contentType: 'text/html',
    });
    expect(cleaned.text).not.toContain('alert');
    expect(cleaned.text).not.toContain('color');
    expect(cleaned.text).toContain('content');
  });

  it('fetch() propagates AbortSignal to the HTTP call (FA-8)', async () => {
    const capturedSignals: (AbortSignal | undefined)[] = [];
    const fakeFetch = async (_url: string, init?: { signal?: AbortSignal }) => {
      capturedSignals.push(init?.signal);
      return new Response('ok', { status: 200, headers: { 'content-type': 'text/plain' } });
    };
    const adapter = new FirecrawlAdapter({ fetchImpl: fakeFetch, endpoint: 'https://api.firecrawl.dev' });
    await adapter.fetch('https://example.com/page');
    expect(capturedSignals).toHaveLength(1);
    expect(capturedSignals[0]).toBeInstanceOf(AbortSignal);
  });

  it('fetch() throws on non-OK response', async () => {
    const fakeFetch = async () => new Response('error', { status: 500 });
    const adapter = new FirecrawlAdapter({ fetchImpl: fakeFetch, endpoint: 'https://api.firecrawl.dev' });
    await expect(adapter.fetch('https://example.com/page')).rejects.toThrow(/Firecrawl.*failed/);
  });

  it('discover() returns URLs from the Firecrawl /map endpoint', async () => {
    const fakeFetch = async () =>
      new Response(
        JSON.stringify({ links: ['https://example.com/a', 'https://example.com/b'] }),
        { status: 200, headers: { 'content-type': 'application/json' } },
      );
    const adapter = new FirecrawlAdapter({ fetchImpl: fakeFetch, endpoint: 'https://api.firecrawl.dev' });
    const urls = await adapter.discover({ url: 'https://example.com', crawlStrategy: 'sitemap', crawlingDisabled: false });
    expect(urls).toHaveLength(2);
    expect(urls[0]?.url).toBe('https://example.com/a');
    expect(urls[0]?.discovered_at).toBeDefined();
  });
});

describe('ManualUploadAdapter', () => {
  it('has name "manual-upload"', () => {
    const adapter = new ManualUploadAdapter();
    expect(adapter.name).toBe('manual-upload');
  });

  it('discover() returns an empty list (no automated discovery)', async () => {
    const adapter = new ManualUploadAdapter();
    const urls = await adapter.discover({ url: 'https://example.com', crawlStrategy: 'manual', crawlingDisabled: false });
    expect(urls).toHaveLength(0);
  });

  it('fetch() + clean() preserves full provenance (FA-6)', async () => {
    const adapter = new ManualUploadAdapter();
    const upload = {
      sourceId: 'src-001',
      fileName: 'doc.pdf',
      bytes: Buffer.from('test content'),
      provenance: {
        source_url: 'https://example.com/download',
        obtained_via: 'manual_download',
        retrieved_at: '2026-07-08T10:00:00Z',
        uploader_id: 'op-001',
        reviewer_id: 'op-002',
        content_hash: makeValidContentChecksum('raw-bytes') as never,
        legal_basis: 'public_record',
      },
    };
    const fetched = await adapter.fetch(upload.sourceId, upload);
    expect(fetched.provenance).toMatchObject({
      obtained_via: 'manual_download',
      uploader_id: 'op-001',
      reviewer_id: 'op-002',
      legal_basis: 'public_record',
    });
    const cleaned = await adapter.clean(fetched);
    expect(cleaned.provenance).toMatchObject({
      obtained_via: 'manual_download',
      uploader_id: 'op-001',
      reviewer_id: 'op-002',
      legal_basis: 'public_record',
    });
    // contentChecksum is the SHA-256 of the cleaned text
    const expectedChecksum = createHash('sha256').update(cleaned.text).digest('hex');
    expect(cleaned.contentChecksum).toBe(expectedChecksum);
  });

  it('inferContentType from file extension', async () => {
    const adapter = new ManualUploadAdapter();
    const upload = {
      sourceId: 'src-001',
      fileName: 'doc.html',
      bytes: Buffer.from('<p>hello</p>'),
      provenance: {
        source_url: 'https://example.com/download',
        obtained_via: 'manual_download',
        retrieved_at: '2026-07-08T10:00:00Z',
        uploader_id: 'op-001',
        reviewer_id: 'op-002',
        content_hash: makeValidContentChecksum('raw-bytes') as never,
        legal_basis: 'public_record',
      },
    };
    const fetched = await adapter.fetch(upload.sourceId, upload);
    expect(fetched.contentType).toBe('text/html');
    const cleaned = await adapter.clean(fetched);
    expect(cleaned.text).toBe('hello');
  });
});

describe('deduplicateDocuments', () => {
  it('deduplicates documents with the same contentChecksum (FA-4)', () => {
    const checksum = makeValidContentChecksum('identical');
    const docA = { url: 'https://a.example.com/doc', contentChecksum: checksum };
    const docB = { url: 'https://b.example.com/mirror', contentChecksum: checksum };
    const result = deduplicateDocuments([docA, docB]);
    expect(result.unique).toHaveLength(1);
    expect(result.duplicates).toHaveLength(1);
    expect(result.duplicates[0]?.duplicateOf).toBe(docA.url);
  });

  it('keeps documents with different contentChecksums (FA-5)', () => {
    const docA = { url: 'https://a.example.com/1', contentChecksum: makeValidContentChecksum('a') };
    const docB = { url: 'https://b.example.com/2', contentChecksum: makeValidContentChecksum('b') };
    const result = deduplicateDocuments([docA, docB]);
    expect(result.unique).toHaveLength(2);
    expect(result.duplicates).toHaveLength(0);
  });

  it('handles empty input', () => {
    const result = deduplicateDocuments([]);
    expect(result.unique).toHaveLength(0);
    expect(result.duplicates).toHaveLength(0);
  });

  it('handles three docs with same checksum — first wins, rest are duplicates', () => {
    const checksum = makeValidContentChecksum('triple');
    const docA = { url: 'https://a.example.com/1', contentChecksum: checksum };
    const docB = { url: 'https://b.example.com/2', contentChecksum: checksum };
    const docC = { url: 'https://c.example.com/3', contentChecksum: checksum };
    const result = deduplicateDocuments([docA, docB, docC]);
    expect(result.unique).toHaveLength(1);
    expect(result.duplicates).toHaveLength(2);
    expect(result.duplicates[0]?.duplicateOf).toBe(docA.url);
    expect(result.duplicates[1]?.duplicateOf).toBe(docA.url);
  });

  it('preserves order of unique documents', () => {
    const docA = { url: 'https://a.example.com/1', contentChecksum: makeValidContentChecksum('a') };
    const docB = { url: 'https://b.example.com/2', contentChecksum: makeValidContentChecksum('b') };
    const docC = { url: 'https://c.example.com/3', contentChecksum: makeValidContentChecksum('c') };
    const result = deduplicateDocuments([docA, docB, docC]);
    expect(result.unique[0]?.url).toBe(docA.url);
    expect(result.unique[1]?.url).toBe(docB.url);
    expect(result.unique[2]?.url).toBe(docC.url);
  });
});

describe('adapterRegistry', () => {
  it('resolves Tier-1 to FirecrawlAdapter', () => {
    const entry = adapterRegistry.byTier(1);
    expect(entry?.name).toBe('firecrawl');
    expect(entry?.tier).toBe(1);
  });

  it('resolves Tier-4 to ManualUploadAdapter', () => {
    const entry = adapterRegistry.byTier(4);
    expect(entry?.name).toBe('manual-upload');
    expect(entry?.tier).toBe(4);
  });

  it('resolves Tier-2 to CrawleeAdapter (deferred stub)', () => {
    const entry = adapterRegistry.byTier(2);
    expect(entry?.name).toBe('crawlee');
  });

  it('resolves Tier-3 to AlaveteliAdapter (deferred stub)', () => {
    const entry = adapterRegistry.byTier(3);
    expect(entry?.name).toBe('alaveteli');
  });

  it('resolves Tier-5 to SftpAdapter (deferred stub)', () => {
    const entry = adapterRegistry.byTier(5);
    expect(entry?.name).toBe('sftp');
  });

  it('returns undefined for unknown tier', () => {
    const entry = adapterRegistry.byTier(99);
    expect(entry).toBeUndefined();
  });

  it('deferred adapters throw NOT_IMPLEMENTED on discover()', async () => {
    const entry = adapterRegistry.byTier(2);
    await expect(
      entry?.adapter.discover({ url: 'https://example.com', crawlStrategy: 'list_page', crawlingDisabled: false }),
    ).rejects.toThrow(/NOT_IMPLEMENTED/);
  });

  it('createAdapterRegistry accepts custom Firecrawl options', () => {
    const registry = createAdapterRegistry({ endpoint: 'https://custom.firecrawl.dev' });
    const entry = registry.byTier(1);
    expect(entry?.name).toBe('firecrawl');
  });
});
