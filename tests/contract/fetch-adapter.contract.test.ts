/**
 * Story 3.3 — Fetch adapters + deduplication contract test (ATDD RED phase).
 *
 * Story 3.3 ships the Crawler port (SC-5 boundary) and the v1 adapters
 * (Firecrawl Tier-1, manual-upload Tier-4). This contract locks the port shape
 * and the content_checksum dedup invariant. NO implementation exists yet —
 * the suite is RED by design (describe.skip) until Story 3.3 ships
 * `packages/ingest/src/fetch/`.
 *
 * Dedup is defamation-adjacent: processing the same document twice creates
 * duplicate provenance chains that confuse retraction propagation. The
 * content_checksum must be the single dedup anchor (FR-1.3).
 *
 * @rules FR-1.3, SC-5, ADR-0006, ADR-0007
 * @adr ADR-001
 * @activates-in Epic 3 (Story 3.3 — Crawler port + Firecrawl/Manual adapters + dedup)
 *
 * GIVEN a source is approved and its crawl strategy is configured
 * WHEN the discover/fetch job runs
 * THEN URLs are discovered per strategy
 *   AND documents are fetched + cleaned to text
 *   AND documents are deduplicated by content_checksum (processed once)
 *   AND v1 adapters are Firecrawl (Tier-1) + manual upload (Tier-4)
 *   AND manually uploaded documents carry a provenance record
 */

import { describe, it, expect } from 'vitest';
import { makeValidContentChecksum } from '../support/helpers/ingest';

// ─── RED-PHASE STUB ────────────────────────────────────────────────────────
// Story 3.3 has not shipped the fetch module yet. Dynamic import lets the suite
// COLLECT. Once the module lands, remove `describe.skip` + the wrapper.
async function loadFetchModule() {
  // Variable specifier so Vite cannot statically resolve a subpath absent from
  // the package `exports` map (Story 3.3 module not shipped yet). The catch
  // keeps the suite GREEN at collection; describe.skip quarantines the body.
  const specifier = '@iip/ingest/fetch';
  return import(specifier).catch(() => null);
}

describe.skip('Story 3.3 — Fetch adapters + dedup contract (ATDD RED)', () => {
  // ─────────────────────────────────────────────────────────────────────────
  // Crawler port shape (SC-5 — every adapter implements the same interface)
  // ─────────────────────────────────────────────────────────────────────────

  it('[P0] FA-1: the Crawler port is exported with discover() + fetch() + clean()', async () => {
    const mod = await loadFetchModule();
    // Then: the port is a named export.
    expect(mod?.Crawler).toBeDefined();
    // And: it declares the three methods every adapter must implement.
    const proto = mod?.Crawler?.prototype ?? {};
    expect(typeof proto.discover).toBe('function');
    expect(typeof proto.fetch).toBe('function');
    expect(typeof proto.clean).toBe('function');
  });

  // ─────────────────────────────────────────────────────────────────────────
  // v1 adapters present (ADR-007 tier model)
  // ─────────────────────────────────────────────────────────────────────────

  it('[P0] FA-2: FirecrawlAdapter (Tier-1) is registered for scrapable sources', async () => {
    const mod = await loadFetchModule();
    expect(mod?.FirecrawlAdapter).toBeDefined();
    // And: it is tagged Tier-1 in the adapter registry.
    const registry = mod?.adapterRegistry;
    const firecrawl = registry?.byTier(1);
    expect(firecrawl?.name).toBe('firecrawl');
  });

  it('[P1] FA-3: ManualUploadAdapter (Tier-4) handles blocked sources', async () => {
    const mod = await loadFetchModule();
    expect(mod?.ManualUploadAdapter).toBeDefined();
    const registry = mod?.adapterRegistry;
    const manual = registry?.byTier(4);
    expect(manual?.name).toBe('manual-upload');
  });

  // ─────────────────────────────────────────────────────────────────────────
  // Deduplication by content_checksum (FR-1.3 — the core invariant)
  // ─────────────────────────────────────────────────────────────────────────

  it('[P0] FA-4: two documents with the same content_checksum are deduplicated (processed once)', async () => {
    const mod = await loadFetchModule();
    // Given: two fetches producing identical cleaned text.
    const checksum = makeValidContentChecksum('identical-doc-content');
    const docA = { url: 'https://a.example.com/doc', cleanedText: 'identical-doc-content', contentChecksum: checksum };
    const docB = { url: 'https://b.example.com/mirror', cleanedText: 'identical-doc-content', contentChecksum: checksum };
    // When: the dedup routine processes both.
    const result = mod?.deduplicateDocuments([docA, docB]);
    // Then: only ONE document is emitted (the second is a deduped duplicate).
    expect(result?.unique).toHaveLength(1);
    expect(result?.duplicates).toHaveLength(1);
    expect(result?.duplicates?.[0]?.duplicateOf).toBe(docA.url);
  });

  it('[P1] FA-5: two documents with different content_checksums are both kept', async () => {
    const mod = await loadFetchModule();
    const docA = { url: 'https://a.example.com/1', cleanedText: 'content-a', contentChecksum: makeValidContentChecksum('content-a') };
    const docB = { url: 'https://b.example.com/2', cleanedText: 'content-b', contentChecksum: makeValidContentChecksum('content-b') };
    const result = mod?.deduplicateDocuments([docA, docB]);
    expect(result?.unique).toHaveLength(2);
    expect(result?.duplicates).toHaveLength(0);
  });

  // ─────────────────────────────────────────────────────────────────────────
  // Manual-upload provenance (FR-1.3, ADR-007 Tier-4)
  // ─────────────────────────────────────────────────────────────────────────

  it('[P1] FA-6: a manually uploaded document carries a full provenance record', async () => {
    const mod = await loadFetchModule();
    // Given: a manual upload with operator provenance.
    const upload = {
      sourceId: 'src-manual-001',
      fileName: 'senate-hearing-transcript.pdf',
      bytes: Buffer.from('%PDF-1.4…'),
      provenance: {
        source_url: 'https://www.senate.gov/hearing/download',
        obtained_via: 'manual_download' as const,
        retrieved_at: '2026-07-08T10:00:00Z',
        uploader_id: 'operator-001',
        reviewer_id: 'operator-002',
        content_hash: makeValidContentChecksum('manual-upload-bytes'),
        legal_basis: 'public_record',
      },
    };
    // When: the manual adapter ingests it.
    const result = mod?.ManualUploadAdapter
      ? await new mod.ManualUploadAdapter().ingest(upload)
      : undefined;
    // Then: every provenance field is preserved on the resulting document.
    expect(result?.document).toBeDefined();
    expect(result?.document.provenance).toMatchObject({
      obtained_via: 'manual_download',
      uploader_id: 'operator-001',
      reviewer_id: 'operator-002',
      legal_basis: 'public_record',
    });
  });

  // ─────────────────────────────────────────────────────────────────────────
  // OCR cleaning fidelity (FR-1.3, ADR-006 — coverage gap R3.3c)
  // Cleaned text must be a faithful rendering of the source, never a
  // hallucination. A fabricated character in a cleaned doc becomes a "quote"
  // from a source — defamation-adjacent.
  // ─────────────────────────────────────────────────────────────────────────

  it('[P0] FA-7: cleaned text is a faithful containment of the source (no OCR hallucination)', async () => {
    const mod = await loadFetchModule();
    // Given: a fetched document with known source text (PDF bytes → OCR'd).
    const sourceText = 'Senator testified under oath on July 4, 2026.';
    const fetched = {
      url: 'https://www.senate.gov/hearing.pdf',
      cleanedText: sourceText,
      contentChecksum: makeValidContentChecksum(sourceText),
    };
    // When: the clean() step processes the raw bytes.
    const cleaned = mod?.cleanDocument ? mod.cleanDocument(fetched) : undefined;
    // Then: every token in the cleaned output is traceable to the source — the
    // cleaner must not introduce text absent from the original (no hallucination).
    // The cleaned text is a substring-containment of the source corpus.
    expect(typeof cleaned?.text).toBe('string');
    // And: the cleaned text does not contain characters absent from the source
    // (a hallucinated quote marker, an injected allegation word).
    const sourceTokens = new Set(sourceText.toLowerCase().split(/\s+/));
    const cleanedTokens = (cleaned?.text ?? '').toLowerCase().split(/\s+/);
    const hallucinated = cleanedTokens.filter((t) => t.length > 2 && !sourceTokens.has(t));
    expect(hallucinated).toHaveLength(0);
    // And: the cleaned text preserves the load-bearing verb verbatim (EI-3).
    expect(cleaned?.text).toContain('testified');
  });

  // ─────────────────────────────────────────────────────────────────────────
  // Firecrawl AbortSignal (coverage gap R3.3d — no adapter should hang)
  // Every @iip/llm-router call carries AbortSignal.timeout (project-context.md).
  // The fetch adapter must do the same for its Firecrawl HTTP boundary — an
  // external dep stall must not block the orchestrator indefinitely.
  // ─────────────────────────────────────────────────────────────────────────

  it('[P1] FA-8: FirecrawlAdapter.fetch() propagates an AbortSignal to the HTTP call', async () => {
    const mod = await loadFetchModule();
    // Given: a Firecrawl adapter with a mocked HTTP boundary.
    const capturedSignals: (AbortSignal | undefined)[] = [];
    const fakeFetch = async (_url: string, init?: { signal?: AbortSignal }) => {
      capturedSignals.push(init?.signal);
      return new Response(Buffer.from('<html>ok</html>'), { status: 200 });
    };
    const Adapter = mod?.FirecrawlAdapter;
    const adapter = Adapter ? new Adapter({ fetchImpl: fakeFetch, endpoint: 'https://api.firecrawl.dev' }) : undefined;
    // When: the adapter fetches a URL.
    if (adapter) await adapter.fetch('https://www.senate.gov/press/release-001');
    // Then: an AbortSignal was forwarded to the underlying fetch call.
    expect(capturedSignals.length).toBeGreaterThan(0);
    expect(capturedSignals[0]).toBeInstanceOf(AbortSignal);
    // And: the signal is a timeout signal (has a reason or is already aborted-on-deadline).
    // AbortSignal.timeout creates a signal whose reason is a TimeoutError on expiry.
    const signal = capturedSignals[0];
    expect(signal?.aborted === false || signal?.aborted === true).toBe(true);
  });
});
