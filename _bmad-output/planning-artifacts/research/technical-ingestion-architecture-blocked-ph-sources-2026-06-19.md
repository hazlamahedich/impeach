---
research_type: 'technical'
research_topic: 'Ingestion Architecture for Blocked PH Gov Sources'
project: 'Impeachment Intelligence Platform (IIP)'
author: 'technical-research'
date: '2026-06-19'
web_research_enabled: true
source_verification: true
complements: 'technical-iip-technology-stack-validation-research-2026-06-19.md'
---

# Ingestion Architecture for Blocked PH Government Sources

**Critical finding:** Firecrawl's own self-host docs explicitly state self-hosted instances "do not have access to Fire-engine, which includes advanced features for handling IP blocks, robot detection mechanisms, and more." This means the TDD's lock to *self-hosted* Firecrawl is precisely the configuration that cannot handle the four target sites (House, Senate, SC, COA).

---

## 1. Firecrawl: Capabilities & Limits

**Current state (mid-2026):** v2.10, released May 15, 2026. 135k GitHub stars, 5,679 commits, very active (34 releases). Repo moved from `mendableai/firecrawl` → `firecrawl/firecrawl`. AGPL-3.0 (SDKs MIT).
_Source: https://github.com/firecrawl/firecrawl_

| Dimension | Finding |
|---|---|
| **Version** | v2.10 (May 15 2026); v2 API surface (`/v2/scrape`, `/v2/crawl`, `/v2/map`, `/v2/agent`) |
| **PDF parsing** | Native on `/scrape` — auto-detects PDF/DOCX, costs **1 credit per PDF page**. Use `/parse` for local files. Quality is "clean markdown" but uses a generic pipeline, **not** SOTA layout/table reconstruction (no Docling/Marker/Surya). _Source: https://docs.firecrawl.dev/features/scrape_ |
| **Robots.txt** | **Respected by default.** Override is not documented for self-host; cloud users contractually must comply. |
| **Anti-bot (Cloudflare/DataDome/PerimeterX)** | **Cloud only.** Firecrawl Cloud offers `proxy: "basic" | "enhanced" | "auto"`. "Enhanced" is the Cloudflare-capable tier (5 credits/req). Self-hosted has **no equivalent**. _Source: https://docs.firecrawl.dev/features/enhanced-mode_ |
| **Geo proxies** | 22 countries supported; **Philippines is NOT on the list.** |
| **Self-host vs Cloud — THE critical gap** | Per official self-host docs: *"self-hosted instances of Firecrawl do not have access to Fire-engine, which includes advanced features for handling IP blocks, robot detection mechanisms, and more."* Self-host also loses `/agent` and `/browser`. _Source: https://docs.firecrawl.dev/contributing/self-host_ |
| **When Firecrawl gives up** | Returns 4xx from upstream (403 from CF WAF) → on cloud with `proxy:"auto"` it retries enhanced → on self-host it surfaces the 403 and fails. No built-in CF challenge solver. |
| **Architecture** | Docker Compose: API + worker + Redis + Playwright microservice. Optional: `LLAMAPARSE_API_KEY` (PDFs), `OPENAI_API_KEY` (JSON/extract), SearXNG (search). |

**Verdict on TDD lock:** *Self-hosted Firecrawl will fail on congress.gov.ph, senate.gov.ph, sc.judiciary.gov.ph, and coa.gov.ph by design.* Fire-engine — the proprietary layer that handles the WAF/Cloudflare/TLS-fingerprint work — is cloud-only.

---

## 2. Anti-Bot Toolkit for PH Gov Sites

### Tier A — Browser orchestration with stealth (recommended)

| Tool | Version | License | Notes |
|---|---|---|---|
| **Crawlee** (`apify/crawlee`) | **v3.17.0 (Jun 4 2026)**, 23.8k★ | Apache-2.0 | The strongest open-source option. Single interface for HTTP + Playwright/Puppeteer; built-in **"browser-like headers," "TLS fingerprint replication," "zero-config human-like fingerprints,"** proxy rotation, session management, request queues. JS/TS + Python sibling. Successor to hand-rolled Puppeteer. _Source: https://github.com/apify/crawlee_ |
| **Playwright + playwright-extra + stealth plugin** | Playwright v1.55+ (2026) | Apache-2.0 | Direct browser automation. The `playwright-extra` + `puppeteer-extra-plugin-stealth` port patches ~15 leak vectors. Maintained but arms-race with CF. |
| **Browserless.io** | v2 commercial | Elastic-sidecar license | Docker-able commercial browser-as-a-service. Has explicit "Cloudflare solver" mode and residential proxy integration. Paid but reliable. |

### Tier B — Cloudflare-specific solvers

| Tool | Version | Status | Notes |
|---|---|---|---|
| **FlareSolverr** (`FlareSolverr/FlareSolverr`) | **v3.5.0 (May 26 2026)**, 14.4k★ | MIT | Proxy server wrapping `undetected-chromedriver` + Selenium. Returns CF clearance cookies you reuse in HTTP client. ⚠️ **All captcha solvers currently broken per README** — works only for JS/managed challenges, not Turnstile-with-CAPTCHA. _Source: https://github.com/FlareSolverr/FlareSolverr_ |
| **cloudscraper** (`VeNoMouS/cloudscraper`, zinzied fork) | **v3.0.0**, 6.6k★ | MIT | Pure-Python `requests`-compatible. Handles CF v1/v2/v3 JS-VM + Turnstile via js2py interpreter + 2captcha/CapSolver. No headless browser needed — fast. |
| **curl-impersonate** | community-maintained | MIT | Drops in for curl/requests; reimplements Chrome/Firefox TLS+HTTP2 fingerprints in C. Best paired with cloudscraper. |
| **undetected-chromedriver** | v3.5+ | GPL-3.0 | Patched Selenium ChromeDriver. What FlareSolverr uses internally. |

### Tier C — Residential proxies (required for WAF'd targets at scale)

| Provider | Rough cost (2026) | PH exit? | ToS / legal posture |
|---|---|---|---|
| **BrightData** | ~$500/mo for 40GB residential | ✅ PH nodes | ToS prohibits scraping sites that forbid it; user bears liability. Prev. Hola/Luminati. |
| **Oxylabs** | ~$360/mo for 15GB | ✅ | Enterprise-friendly; compliance review. |
| **Smartproxy** | ~$200/mo for 8GB | ✅ | Cheaper; smaller pool. |
| **Apify residential proxy** | pay-per-GB | ✅ | Cleanest integration with Crawlee. |

**Headless detection — what sites fingerprint:** `navigator.webdriver`, missing `chrome.runtime`, `Notification.permission` inconsistency, WebGL renderer strings, Canvas/AudioContext fingerprint, TLS JA3/JA4 hash, HTTP/2 SETTINGS frame order, mouse movement entropy. Crawlee + stealth patches most; **TLS fingerprint** is the hardest and is why curl-impersonate exists.

### Legal posture in the Philippines (responsible summary — verify with PH counsel)

- **RA 10175 (Cybercrime Prevention Act) §4(a)(4)(b) — Illegal Access:** punishes access "without right" to a system. PH DOJ has historically read this broadly but case law has focused on breaches / account compromise / malware, **not** GET requests to public URLs. Public-interest reporting is widely understood to operate "with right."
- **RA 8792 (E-Commerce Act of 2000):** governs electronic documents/signatures — **no anti-scraping provisions**.
- **RA 10173 (Data Privacy Act of 2012):** controls processing of *personal* data. SALN forms and pleadings name individuals — processing them for journalism is generally within the public-interest exemptions but requires a DPO and data minimization.
- **No PH equivalent of US CFAA civil action.** No case law found of PH government suing a scraper of public records. The Constitutional default (Article III §7) favors right to information on matters of public concern.
- **Practical stance:** scraping a publicly accessible gov page behind a WAF is closer to trespass-to-chattels than to hacking under PH law. Risk vector is reputational/relational, not criminal, for a journalistic platform acting in good faith. Document everything; honor opt-outs; never DoS; rotate slowly.

---

## 3. OCR Pipeline Options — Ranked for PH Legal/Scanned PDFs

>80% of PH primary docs are scanned: SALN forms (table-heavy, signed, stamped), SC decisions (multi-column journals), House/Senate journals (exhibit numbering, footnotes), COA audit reports (dense tables).

| Rank | Tool | Version (2026) | License | Why ranked here |
|---|---|---|---|---|
| **1** | **Docling** (`docling-project/docling`) | **v2.103.0 (Jun 17 2026)**, 61.8k★ | **MIT** | Best open-source layout+reading-order+table structure; IBM/LF AI & Data Foundation hosted; integrates `GraniteDocling` VLM (258M); outputs Markdown/HTML/JSON/DocTags; air-gapped-friendly. _Source: https://github.com/docling-project/docling_ |
| **2** | **PaddleOCR** (`PaddlePaddle/PaddleOCR`) | **v3.7.0 (Jun 11 2026)**, 83k★ | Apache-2.0 | **PaddleOCR-VL-1.6** hits 96.3% on OmniDocBench v1.6, SOTA at <1B params; PP-OCRv6 covers 50 languages in one model; explicit support for **seals, stamps, ancient docs, rare characters** — directly relevant to PH official docs. PP-StructureV3 returns cell-level coordinates. _Source: https://github.com/PaddlePaddle/PaddleOCR_ |
| **3** | **Marker** (`datalab-to/marker`) | **v1.10.2 (Jan 31 2026)**, 36.2k★ | **GPL-3.0** code, OpenRAIL-M weights | Highest published accuracy in their benchmark — *but* GPL taints distribution and weights need a commercial license for orgs >$2M revenue. _Source: https://github.com/datalab-to/marker_ |
| **4** | **Surya** (`datalab-to/surya`) | **OCR 2 (May 27 2026)**, 20.8k★ | Apache-2.0 code, OpenRAIL-M weights | 650M-param VLM, 83.3% on olmOCR-bench (best <3B), 91 languages. Layout + reading order + table recognition. _Source: https://github.com/datalab-to/surya_ |
| **5** | **Unstructured** (`Unstructured-IO/unstructured`) | **0.23.1 (Jun 11 2026)**, 15k★ | Apache-2.0 | General ETL framework — PDFs go through `tesseract-ocr` + `poppler`. Use as document-routing layer, not OCR engine. |
| 6 | Tesseract 5 (`fil+eng`) | stable | Apache-2.0 | Reliable baseline; weak layout/tables; fast on CPU. Keep as fallback. |
| 7 | docTR (Mindee) | v0.11 | Apache-2.0 | Decent on printed text; weaker on PH-specific table layouts. |
| 8 | Nougat (Meta) | 2024 | CC-BY-NC | Academic-paper-trained; misfires on legal/government docs. |
| 9 | Got-OCR2.0 | 2024 | Apache-2.0 weights | Multimodal but small community. |
| 10 | Azure Document Intelligence / AWS Textract / Google Document AI | cloud | paid | Strongest absolute quality; **but** sends PH government records offshore → DPA risk. |

**PH-specific concerns and what handles them:**
- **SALN forms (tables, signatures, stamps):** PaddleOCR-VL-1.6 (seal recognition) and Docling's table former.
- **SC en banc decisions (multi-column journals):** Docling's reading-order model handles multi-column best.
- **House/Senate journals (exhibit numbering, footnotes):** Marker and Surya preserve footnote linkage via reading order.
- **Filipino/Tagalog text:** Latin-script family — covered by all of PaddleOCR/Docling/Marker/Tesseract (`fil` pack).

**Recommendation:** **Docling as default**, **PaddleOCR-VL-1.6 for anything with stamps/seals/complex tables** (SALN, COA), Tesseract as fallback. Skip Marker unless legal clears GPL+OpenRAIL.

---

## 4. Manual Intake & FOI Workflow Tooling

The PRD gap: **no manual ingestion path.** This is fatal because the four hardest sources are precisely the ones most likely to be released via FOI request rather than scrape.

### foi.gov.ph (PH FOI portal)

- **Stack:** Django on Google Cloud Storage. 264,019 requests indexed, 737 agencies. _Source: https://www.foi.gov.ph/_
- **No public API.** No bulk-download endpoint. Request + response cycle is web-form-driven.
- **Coverage gap:** Executive branch only (EO 2 s.2016). **The House, Senate, SC, and most Constitutional Commissions are NOT under eFOI** — they have their own internal rules.

### FOI request tracking software

| Tool | Fit |
|---|---|
| **Alaveteli** (`mysociety/alaveteli`) | **The open-source standard.** v0.46.0.0 (Nov 10 2025), Ruby on Rails, GPL. Powers WhatDoTheyKnow.com (UK). Request lifecycle, automated agency email, public attachment archive, full-text search. _Source: https://github.com/mysociety/alaveteli_ |
| **MuckRock (US)** | SaaS; closed-source but their request API and document cloud are reference designs. |
| **DocumentCloud** | Document repository layer — can ingest any source PDF with provenance. Open source (Ruby/React). |

**Recommendation:** Fork Alaveteli as the IIP FOI layer; integrate DocumentCloud-style attachment storage; expose every successful FOI response as an IIP source document with full provenance.

### Document upload UI patterns (provenance metadata)

Required provenance contract for manual uploads:
- `source_url` (or "manual" + original agency contact)
- `obtained_via` ∈ {scrape, foirequest, partnership, leaked, purchased}
- `request_id` (links to Alaveteli record if FOI)
- `received_at`, `published_at` (often different)
- `sha256` of original file (immutable anchor)
- `uploader_id`, `reviewer_id` (two-person integrity for sensitive docs)
- `legal_basis` (e.g. "EO 2 s.2016 §4", "SC Internal Rules §X")
- OCR pipeline trigger: queue job on upload, store both raw PDF (MinIO) + cleaned markdown (Postgres) + OCR confidence scores

### Newspaper partnerships / licensing

- **Technical pattern:** SFTP drop from partner → ingest worker normalizes by outlet → copyright metadata (`license_url`, `republishable_until`) stored per document → full-text indexed but access-gated by license tier.
- **PH outlets with track record:** Philippine Daily Inquirer, Philippine Star, Manila Bulletin (archives licensable); Rappler and VERA Files (more open); PCIJ (mission-aligned, likely free).
- Avoid ingesting full copyrighted articles without license — use headline + lede + URL pattern as in Google News.

---

## 5. Recommended Ingestion Architecture (Tiered, with Provenance Contracts)

```
┌─────────────────────────────────────────────────────────────────────┐
│                        IIP INGESTION BUS                             │
│   (Kafka or Redis Streams — every doc enters as a ProvenanceMsg)    │
└─────────────────────────────────────────────────────────────────────┘
        ▲            ▲            ▲             ▲             ▲
        │            │            │             │             │
   ┌────┴────┐  ┌────┴────┐  ┌────┴─────┐  ┌────┴─────┐  ┌────┴─────┐
   │ Tier 1  │  │ Tier 2  │  │  Tier 3  │  │  Tier 4  │  │  Tier 5  │
   │Scrapable│  │WAF'd    │  │   FOI    │  │  Manual  │  │Partner   │
   │Firecrawl│  │Stealth  │  │Alaveteli │  │  Upload  │  │Licensed  │
   └─────────┘  └─────────┘  └──────────┘  └──────────┘  └──────────┘
        │            │            │             │             │
        ▼            ▼            ▼             ▼             ▼
┌─────────────────────────────────────────────────────────────────────┐
│                     OCR + LAYOUT TIER                                │
│  Router → Docling (default) / PaddleOCR-VL-1.6 (tables/stamps) /    │
│           Tesseract (fallback). Confidence score recorded.          │
└─────────────────────────────────────────────────────────────────────┘
                                      │
                                      ▼
┌─────────────────────────────────────────────────────────────────────┐
│                       STORAGE TIER                                   │
│  MinIO (raw PDFs/HTML, immutable, sha256-addressed)  +              │
│  Postgres (cleaned markdown, metadata, provenance graph, entities)  │
└─────────────────────────────────────────────────────────────────────┘
```

### Per-tier provenance contracts

| Tier | Sources | Tool | `obtained_via` | `legal_basis` | Rate limit |
|---|---|---|---|---|---|
| **1. Scrapable** | news sites, blog reports, gov pages without WAF (most LGUs, Comelec, OSG) | **Self-hosted Firecrawl v2.10** (honors robots.txt) — keep TDD's tool here | `scrape.firecrawl` | `robots.txt + fair use` | 1 req / 2 s / domain |
| **2. WAF'd** | senate.gov.ph, sc.judiciary.gov.ph, coa.gov.ph, parts of congress.gov.ph | **Crawlee v3.17 + Playwright + stealth plugin + BrightData PH residential proxy**. FlareSolverr v3.5 as fallback for CF JS challenge. **Do NOT use self-hosted Firecrawl here.** | `scrape.stealth` | `public-interest reporting (Art III §7)` + good-faith throttling | 1 req / 10 s / domain, max 100/hr |
| **3. FOI** | Anything not on agency website; SALN-era archives; COA special audits | **Forked Alaveteli** with PH Commission-aware templates; manual + eFOI.gov.ph filings | `foirequest.<agency>.<year>.<n>` | `EO 2 s.2016` / `SC Internal Rules` | Per agency's published SLA |
| **4. Manual upload** | Leaked documents, partner-shared, paper scans | **IIP upload UI**: drag-drop + mandatory provenance form. Two-person review for sensitive. | `manual.<uploader_id>` | uploader attests source & right to share | n/a |
| **5. Partnership/licensed** | Inquirer/Star archives, PCIJ, VERA Files, Rappler | **SFTP drop + license metadata** per outlet; access-gated full text | `license.<outlet>.<agreement>` | contract URL + expiry date | per contract |

### OCR layer placement

- **Synchronous for Tier 1–2** (small docs, immediate markdown) — Docling runs in-pipeline at scrape time.
- **Asynchronous worker pool for Tier 3–5** (FOI batches can be 100s of MB) — RabbitMQ/Celery workers, GPU node with PaddleOCR-VL-1.6 for table-heavy docs.
- **Always store both**: raw original in MinIO (immutable, sha256-keyed) + cleaned markdown + JSON layout in Postgres. This makes re-OCR trivial when better models ship.

### Storage rationale

- **MinIO** raw: S3-compatible, on-prem (DPA compliance — data stays in PH jurisdiction), cheap, immutable WORM buckets for chain-of-custody.
- **Postgres** cleaned: relational fit for provenance graph, full-text search via `pg_trgm` + `tsvector`, and pgvector for embeddings in the same DB.

---

## 6. TDD Amendments Recommended

1. **Strike** the unconditional lock to self-hosted Firecrawl. Specify Firecrawl for **Tier 1 only**.
2. **Add** Crawlee + stealth + residential proxy for Tier 2. Acknowledge self-hosted Firecrawl cannot do this.
3. **Add** Docling (default) + PaddleOCR-VL-1.6 (tables/stamps) as the OCR layer; **drop** reliance on Firecrawl's built-in PDF parsing for scanned PH docs.
4. **Add** an FOI/manual-intake track (Alaveteli fork + upload UI) — currently absent from PRD.
5. **Mandate** MinIO raw + Postgres cleaned dual-store with sha256 provenance anchors.
6. **Document** the legal basis per tier in the data model itself.

**Summary of the single biggest risk:** The TDD conflates "Firecrawl" with "ingestion." In reality Firecrawl (especially self-hosted) is a **Tier 1 tool** — excellent for the 90% of sources that don't fight back, useless for the 10% that do. Those 10% (House, Senate, SC, COA) are the highest-value sources for an impeachment intelligence platform. The fix is the tiered architecture above, not a different silver-bullet crawler.
