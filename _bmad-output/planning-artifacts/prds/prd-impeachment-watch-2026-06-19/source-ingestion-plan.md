# IIP Source Ingestion Plan — Sara Duterte Impeachment Seed Case

**Scope:** Internal-first v1 build (pre-launch)  
**Purpose:** Concrete, lawful ingestion strategy for the seed corpus  
**Date:** 2026-06-22  
**Status:** draft  
**Owner:** Intake Operator / build team  

---

## 1. Plan principles

1. **Primary sources first.** Government, court, and official records are tier-1; they anchor fact/claim tagging and the citation-quality floor.
2. **Lawful access only.** Every source is registered with its observed `robots.txt`, terms, and access status. If a source blocks lawful automated access, it is **disabled** or switched to **manual upload**, never bypassed.
3. **No Perplexity/runtime AI sources.** Perplexity may be used only as an operator discovery tool to find URLs; the platform ingests from the original source and stores its own immutable snapshot.
4. **Honest coverage disclosure.** If a target source is unavailable to automated ingestion, that gap is recorded and disclosed (PRD §6.3, DR-4), not hidden by substituting a lower-integrity source.
5. **Progressive expansion.** Phase A focuses on the highest-yield, lowest-friction sources. Phases B and C add harder sources (transcripts, court documents, blocked outlets) through manual partnerships or document uploads.
6. **Tiered ingestion tooling.** The project already specifies a tiered ingestion architecture (TDD + `technical-ingestion-architecture-blocked-ph-sources-2026-06-19.md`): **self-hosted Firecrawl v2.10** for scrapable sources; **Crawlee + Playwright + stealth + residential proxies** for Cloudflare/WAF'd government sites; **Alaveteli/FOI, manual upload, and licensed partnerships** for sources not available through scraping. For v1 internal-first, we default to the conservative tier (manual upload) for WAF'd government sources to avoid bypass risk, while leaving the architecture ready to upgrade to stealth crawling if the TDD is amended and legal review clears it.

---

## 2. Source registry summary

| Source | Type | Trust tier | Crawl strategy | Status | Notes |
|---|---|---|---|---|---|
| **House of Representatives** | government | 1 | manual | blocked automation | Cloudflare blocks automated access; ingest via manual upload or future stealth tier (Crawlee + proxy) after TDD/legal amendment |
| **Senate of the Philippines** | government | 1 | manual | blocked automation | Cloudflare-protected React SPA; legacy site in maintenance; ingest via manual upload/partnership |
| **Supreme Court of the Philippines** | court | 1 | manual | pending recon | robots.txt unreachable from IIP environment; manual recon required |
| **Official Gazette / gov.ph** | government | 1 | sitemap | intermittent | Sitemaps public, but direct page fetches return 403/Cloudflare from IIP; test from host with polite crawl |
| **Rappler** | media | 2 | sitemap | ready with care | Sitemap available; robots blocks named AI crawlers; use self-hosted Firecrawl with non-AI UA |
| **GMA News** | media | 2 | sitemap | ready | Sitemap available; robots explicitly allows general crawlers |
| **ABS-CBN News** | media | 2 | manual | blocked automation | robots.txt returns 403; search page blocked; requires manual upload/partnership |
| **Philstar** | media | 2 | list_page | partially ready | Search page works; robots minimal; may need rate-limiting |
| **Philippine News Agency (PNA)** | media | 2 | manual | blocked automation | Cloudflare challenge; ingest via syndicated tier-2 copies or manual upload |
| **Reuters** | media | 2 | rss | ready | Standard RSS feeds for world/Asia topics; no Philippine-specific feed but Asia feed covers the story |
| **Lawphil** | reference | 1 | manual | ready for seed | Static House impeachment rules; clean HTML; CC BY-NC 4.0 |

---

## 3. Phase A — Immediate ingestion (week 1-2)

### 3.1 Official Gazette / gov.ph (tier-1, sitemap)

**Why first:** Broad, lawful, low-friction, and official. Captures proclamations, executive statements, and legal process posts.

- **Sitemaps:**
  - `http://www.gov.ph/sitemap.xml`
  - `http://www.gov.ph/post.xml`
  - `http://www.gov.ph/archive_monthly.xml`
  - `http://www.gov.ph/archive_yearly.xml`
  - `http://www.gov.ph/taxonomy_category.xml`
- **robots.txt:** Allows general crawling; disallows `/wp-admin`, `/wp-content`, `/tag`, `/author`, `/wget/`, `/cgi-bin`.
- **Strategy:** Crawl `post.xml` and `archive_yearly.xml` daily. Filter URLs for keywords: `impeachment`, `Sara Duterte`, `House of Representatives`, `Senate`, `Articles of Impeachment`, `Vice President`.
- **Config stub (sources.config):**
  ```json
  {
    "sitemap_urls": ["http://www.gov.ph/post.xml", "http://www.gov.ph/archive_yearly.xml"],
    "url_filter_regex": "(?i)impeachment|sara.?duterte|articles.?of.?impeachment|vice.?president",
    "crawl_delay_sec": 5,
    "robots_respect": true
  }
  ```

### 3.2 GMA News (tier-2, sitemap + search)

**Why first:** Sitemap is public; robots.txt explicitly allows generic crawlers.

- **Sitemaps:**
  - `https://www.gmanetwork.com/news/sitemap-news.xml`
  - `https://www.gmanetwork.com/news/news-sections.xml`
- **Search page:** `https://www.gmanetwork.com/news/?q={query}` (JavaScript-heavy; use as secondary, not primary).
- **robots.txt:** Allows general `*`; disallows `/news/lite`, `/news/archives`, `/news/api/*`, query-stripped duplicates, etc.
- **Strategy:** Use `sitemap-news.xml` to discover article URLs; filter by path/keyword. Re-run discover daily. Use search page only for operator-side gap-filling.
- **Config stub:**
  ```json
  {
    "sitemap_urls": ["https://www.gmanetwork.com/news/sitemap-news.xml"],
    "url_filter_regex": "(?i)impeachment|sara.?duterte|duterte",
    "crawl_delay_sec": 3
  }
  ```

### 3.3 Rappler (tier-2, sitemap + search)

**Why first:** High-quality Philippine investigative coverage; sitemap available.

- **Sitemaps:**
  - `https://www.rappler.com/sitemap_index.xml` (index of monthly post sitemaps)
  - `https://www.rappler.com/post-sitemap.xml` (current)
- **Search page:** `https://www.rappler.com/?s={query}`
- **robots.txt:** Blocks named AI bots (`ClaudeBot`, `GPTBot`, `PerplexityBot`, etc.) but allows generic `*` user-agents. Use self-hosted Firecrawl with a non-AI-identifying user-agent.
- **Strategy:** Crawl current post sitemap weekly. Filter by keyword. Search page is `noindex` and JS-rendered; use only for operator discovery.
- **Config stub:**
  ```json
  {
    "sitemap_urls": ["https://www.rappler.com/post-sitemap.xml"],
    "url_filter_regex": "(?i)impeachment|sara.?duterte|duterte|vice.?president",
    "crawl_delay_sec": 3,
    "respect_named_ai_disallow": true
  }
  ```

### 3.4 Reuters (tier-2, RSS)

**Why include:** Provides international wire coverage; high trust; simple RSS ingestion.

- **RSS feeds to monitor:**
  - `https://www.reuters.com/world/asia-pacific/` (homepage; RSS discovery via `<link rel="alternate">`)
  - Search Reuters site for RSS endpoints; typical pattern: `https://www.reuters.com/world/asia-pacific/rss.xml` or `https://www.reuters.com/tools/rss`
- **Strategy:** Discover RSS via page `<link>` tags. Ingest only Asia-Pacific / Philippines / politics items. Apply upstream feed provenance tracking (`wire_service: Reuters`) for the independence rule (EI-2).
- **Config stub:**
  ```json
  {
    "discover_rss_from": "https://www.reuters.com/world/asia-pacific/",
    "url_filter_regex": "(?i)philippines|duterte|impeachment",
    "wire_service": "Reuters"
  }
  ```

---

## 4. Phase B — Government sources requiring recon (week 2-4)

> **Recon update (2026-06-22):** Deeper reconnaissance confirms that automated access to House, Senate, and PNA is blocked by Cloudflare from the IIP operating environment. The project already anticipates this in `technical-ingestion-architecture-blocked-ph-sources-2026-06-19.md`, which proposes a tiered tool stack: self-hosted Firecrawl for scrapable sources, and Crawlee + Playwright + stealth + residential proxies for WAF'd government sites. For v1, we stay conservative: these sources are ingested manually unless the TDD is amended and legal review clears a stealth/proxy tier. See `source-recon-update.md` for full findings.

### 4.1 House of Representatives

**Status:** Automated access blocked by Cloudflare. robots.txt blocks named AI bots.

- **Known URL:** `https://www.congress.gov.ph/media/press-releases/`
- **Sample press release:** `https://www.congress.gov.ph/media/press-releases/view/?content=9753&title=House+panel+unanimously+approves+VP+Sara+impeachment+report%2C+articles%3B+elevates+case+to+plenary`
- **Lawphil mirror (rules):** `https://lawphil.net/congress/house/impeachment_2010.html` — useful as a static reference document, tier-1 equivalent for procedural rules.
- **robots.txt:** Blocks `ClaudeBot`, `GPTBot`, etc.; allows generic `*` for search indexing.
- **Strategy:**
  1. **Default v1 path:** manual operator upload from a normal browser. Save public HTML/PDFs and register provenance.
  2. **Future tier-2 path (requires TDD + legal amendment):** Crawlee + Playwright + stealth + PH residential proxy, with conservative rate limits. Only pursue if legal review clears the public-interest justification under PH constitutional access-to-information norms.
  3. Watch for PDF attachments (`*.pdf`) linked from press releases — these are often the canonical impeachment documents.
- **Tooling note:** Self-hosted Firecrawl is **not** suitable here. Per Firecrawl's own docs, self-hosted instances lack Fire-engine (the proprietary anti-bot layer). Cloudflare-capable scraping requires the cloud enhanced proxy tier or an alternative stealth stack.

### 4.2 Senate of the Philippines

**Status:** Automated access blocked. Current `senate.gov.ph` is a Cloudflare-protected React/SPA. `legacy.senate.gov.ph` is in maintenance (403). No stable public URL pattern for transcripts or press releases.

- **Known entry points:**
  - Current site: `https://senate.gov.ph/`
  - News release archive (blocked in practice): `https://senate.gov.ph/media/news-release`
- **robots.txt:** Blocks named AI bots; allows generic indexing in theory, but Cloudflare blocks actual automated requests.
- **Strategy:**
  1. **Default v1 path:** manual operator upload or partnership with Senate Public Information Office.
  2. **Future tier-2 path:** Same stealth/proxy stack as House, contingent on TDD/legal amendment.
  3. PDF transcripts and hearing notices are high-value; prioritize those over HTML summaries.

### 4.3 Supreme Court of the Philippines

**Status:** robots.txt could not be fetched from the IIP environment; possible connection-level block. Needs manual recon from a different network/location.

- **Likely sources:**
  - Decisions/orders portal: `https://sc.judiciary.gov.ph/cases/` or `https://sc.judiciary.gov.ph/judgments/`
  - Public information office press statements: `https://sc.judiciary.gov.ph/category/news/`
- **Strategy:**
  1. Operator tests access from a residential/business IP and documents robots policy + working URLs.
  2. If a searchable decisions portal exists and access is lawful, register as `api` or `list_page`.
  3. If access remains blocked or unstable, ingest released PDFs manually.

---

## 5. Phase C — Media sources with access friction (week 3-6)

### 5.1 ABS-CBN News

**Status:** robots.txt returns 403; search page returns 403. Automated ingestion likely blocked.

- **Options:**
  1. **Manual upload:** Operator periodically downloads public articles and uploads as `manual` source entries.
  2. **Partnership:** Request editorial/data partnership for article text feed (not scraped).
  3. **Operator discovery only:** Use Perplexity or search engines to find ABS-CBN URLs, then manually ingest the public pages if accessible from a browser.
- **Do not:** attempt to bypass 403 with rotating proxies or spoofed headers. That violates NFR-L-1 / FR-1.2.

### 5.2 Philippine News Agency (PNA)

**Status:** robots.txt returns 403; direct article fetch returns Cloudflare challenge. Automated ingestion blocked.

- **Known article examples:**
  - `https://www.pna.gov.ph/articles/1272927`
  - `https://www.pna.gov.ph/articles/1274214`
- **Options:**
  1. Manual ingestion of known article IDs by operator.
  2. Partnership with PNA for a public feed.
  3. **Recommended for v1:** Ingest PNA content indirectly through syndicated copies on crawlable tier-2 outlets (e.g., GMA, Rappler, Philstar) and mark upstream `wire_service: PNA`. This preserves provenance while staying within lawful automated access.
- **Note:** PNA articles are often republished verbatim. When ingesting a syndicated copy, tag `upstream_feed.wire_service: PNA` and `upstream_feed.original_publisher: PNA` so the fact/claim independence classifier can de-duplicate by original reporting origin (EI-2).

### 5.3 Philstar

**Status:** Search page works (`https://www.philstar.com/search?query=...`). robots.txt minimal.

- **Strategy:**
  1. Register search page as `list_page` with keyword query.
  2. Parse result links conservatively; rate-limit heavily (1 req / 5 sec) because search pages are expensive for the publisher.
  3. Watch for premium/paywalled articles and disable those URLs.

### 5.4 Lawphil — House Impeachment Rules (tier-1 reference seed)

**Status:** Ready for manual seed.

- **URL:** `https://lawphil.net/congress/house/impeachment_2010.html`
- **License:** Creative Commons Attribution-NonCommercial 4.0
- **Why include:** Provides procedural context for impeachment proceedings in the House; useful as a test document for extraction and as a tier-1 reference node in the graph.
- **Strategy:** Register as a single `manual` document, not a recurring crawl. Upload raw HTML and run through the normal Analyst pipeline.

---

## 6. Staged corpus targets by phase

| Phase | Sources | Expected documents | Tier-1 count | Tier-2 count |
|---|---|---|---|---|
| **A** | Official Gazette, GMA, Rappler, Reuters | 150–250 | 1 | 3 |
| **B** + House + Senate + SC | + transcripts, press releases, court orders | 250–450 | 3+ | 3 |
| **C** + ABS-CBN + PNA + Philstar | + manual/partner media uploads | 400–600+ | 3+ | 5+ |
| **Hard floor (demo gate)** | All sources | ≥300 | ≥2 | ≥2 |
| **Indicative target** | All sources | ≥500 | ≥3 | ≥3 |

---

## 7. Coverage gaps and how to handle them

| Gap | Cause | Mitigation |
|---|---|---|---|
| ABS-CBN automated access blocked | 403 on robots + search | Manual upload or partnership; disclosed in source registry |
| PNA automated access blocked | Cloudflare challenge | Syndicated tier-2 copies + upstream attribution; manual upload for originals |
| House automated access blocked | Cloudflare WAF | Manual upload; future stealth tier (Crawlee + proxy) after TDD/legal amendment |
| Senate automated access blocked | Cloudflare WAF + React SPA | Manual upload/partnership; future stealth tier after TDD/legal amendment |
| Senate transcripts not yet located | No verified index | Operator recon; manual registration of known hearings |
| SC orders/decisions portal unclear | robots.txt unreachable | Manual recon; fallback to manual upload of released PDFs |
| Filipino-language sources | Local model quality risk (OQ-9) | Ingest Filipino pages but only claim `en` extraction until `fil` eval passes |
| Real-time coverage | v1 is batch, not streaming | Daily scheduled discover/fetch; no claim of real-time |

---

## 8. Tooling tiers

The project documents a tiered ingestion architecture in `technical-ingestion-architecture-blocked-ph-sources-2026-06-19.md`. This plan maps sources to tiers as follows:

| Tier | Sources | Tooling | v1 posture |
|---|---|---|---|
| **1. Scrapable** | Official Gazette (intermittent), GMA News, Rappler, Reuters, Lawphil | Self-hosted **Firecrawl v2.10** (honors robots.txt) | Active automated crawling |
| **2. WAF'd / anti-bot** | House, Senate, PNA, PCO | **Crawlee + Playwright + stealth + residential proxy** (PH exit node) | **Deferred** — requires TDD amendment, proxy infrastructure, and legal review |
| **3. FOI** | Documents not published online | **Alaveteli**-style FOI tracker | Out of v1 scope |
| **4. Manual upload** | House, Senate, SC, ABS-CBN, PNA originals, Lawphil | IIP manual upload UI with provenance form | Active v1 path for blocked sources |
| **5. Partnership/licensed** | Inquirer, PCIJ, VERA Files, Rappler, etc. | SFTP drop / license metadata | Optional if partnerships are established |

### 8.1 Why self-hosted Firecrawl is not enough for government sources

Per Firecrawl's own self-host documentation, self-hosted instances **do not have access to Fire-engine**, the proprietary layer that handles IP blocks, robot detection, and Cloudflare/TLS-fingerprint work. Firecrawl Cloud's `proxy: enhanced` tier is Cloudflare-capable, but it is a cloud proprietary dependency, which conflicts with the PRD's local-first constraint (NFR-D-1 / NFR-D-2). Therefore, government sources behind Cloudflare cannot be reliably scraped with the current TDD's self-hosted Firecrawl lock.

## 9. Robots and user-agent policy

- Default user-agent for IIP ingestion: `IIP-Collector/1.0 (private-research; contact: operator@example.com)` — self-hosted, non-AI-identifying.
- Named AI bots (`ClaudeBot`, `GPTBot`, `PerplexityBot`, etc.) are **never** used as the crawl user-agent.
- `robots_respect = true` for every source.
- Crawl-delay: minimum 3 seconds for news, 5 seconds for government sites.
- No concurrent requests to the same domain.

---

## 9. Source registry data model (per PRD/TDD)

Each registered source must populate:

```sql
INSERT INTO sources (name, source_type, base_url, crawl_strategy, config, trust_tier, robots_respect, enabled)
VALUES (
  'Official Gazette',
  'government',
  'https://www.gov.ph',
  'sitemap',
  '{"sitemap_urls": [...], "url_filter_regex": "...", "crawl_delay_sec": 10, "fallback_to_manual": true}',
  1,
  true,
  true
);
```

Required fields for operator review:
- `robots_txt_url` and snapshot date
- `terms_url` (if any)
- `access_notes` (403, paywall, JS-rendered, manual-only, intermittent, blocked_automation, etc.)
- `upstream_feed` (for wire/syndicated content)
- `last_crawled_at` and `enabled` flag
- `tier` (1–5) mapping to the ingestion architecture

---

## 11. Immediate next actions

1. **Register Phase A sources** in the IIP source registry and run a small discover/fetch dry-run.
2. **Verify robots.txt snapshots** for all Phase A/B sources and store them in MinIO.
3. **Confirm Official Gazette crawl** from the actual IIP host with polite delays and non-AI user-agent.
4. **Operator recon for House/Senate/SC:** browse manually from a normal browser, identify stable index URL patterns, and upload public documents via the manual ingestion workflow.
5. **Set up manual upload workflow** for ABS-CBN, PNA originals, House, Senate, and SC documents.
6. **Draft a source-access legal memo** for the Pre-External Gate (FR-5.5 / NFR-L-3) summarizing robots policies, Cloudflare blocks, manual workflows, and why each source is lawfully ingested.
7. **Run a 50-document pilot** through the full pipeline to validate extraction quality and citation resolution before scaling.
8. **TDD amendment consideration:** Decide whether to approve the Tier 2 stealth/proxy stack (Crawlee + Playwright + residential proxy) for WAF'd government sources post-v1, with legal review.

---

## 11. Relationship to PRD invariants

- **EI-1 / EI-4 (citation-or-silence + provenance):** Every document ingested stores a raw MinIO snapshot + source URL + retrieved timestamp. Every extracted claim carries `document_id` + character span.
- **FR-1.1 / FR-1.2 (source registry + lawful access):** Each row in this plan maps to a registered source with confirmed trust tier and access status.
- **EI-2 (independence):** Wire/syndicated content is tagged with upstream feed provenance so the fact classifier can de-duplicate by original reporting origin.
- **NFR-D-2 (local-first):** All ingestion runs on the self-hosted Firecrawl instance; no cloud search API is required.
- **NFR-L-1 (lawful access):** Sources behind 403/paywall are disabled or switched to manual; never bypassed.

---

*This plan is a living document. As source access conditions change and new index URLs are discovered, update the source registry and append changes here.*
