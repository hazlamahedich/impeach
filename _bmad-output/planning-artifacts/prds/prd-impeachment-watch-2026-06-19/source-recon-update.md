# IIP Source Ingestion Recon Update — Deeper Government Source Recon

**Date:** 2026-06-22  
**Scope:** Philippine government sources for Sara Duterte impeachment seed case  
**Status:** recon update — materially changes Phase B assumptions  

---

## 1. Executive summary

Deeper reconnaissance confirms that **automated ingestion of most Philippine government sites is currently blocked or heavily protected by Cloudflare** from the IIP operating environment. This materially affects the Phase B plan. The realistic v1 strategy must shift from automated government crawling to **manual operator uploads + syndicated media coverage of government events**, while continuing automated ingestion only of sources that remain crawlable (Official Gazette when not throttled, GMA, Rappler, Reuters, Lawphil).

This is **not** a recommendation to bypass Cloudflare. Bypassing would violate FR-1.2 (lawful access) and NFR-L-1. Instead, the plan records the blocks honestly and substitutes manual/partner workflows.

---

## 2. Source-by-source recon findings

### 2.1 House of Representatives — `congress.gov.ph`

| Item | Finding |
|---|---|
| robots.txt | Blocks named AI bots (`ClaudeBot`, `GPTBot`, etc.); allows generic `*` user-agents for `search` indexing |
| Press release index | `https://www.congress.gov.ph/media/press-releases/` — Cloudflare challenge/block from our fetchers and browser |
| Sample press release | `https://www.congress.gov.ph/media/press-releases/view/?content=9753&title=House+panel+unanimously+approves+VP+Sara+impeachment+report%2C+articles%3B+elevates+case+to+plenary` — blocked by Cloudflare |
| Second sample | `https://www.congress.gov.ph/media/press-releases/view/?content=9692` — blocked |
| PDF/document repository | `https://www.congress.gov.ph/legisdocs/` — blocked; no discoverable direct PDF URLs for impeachment committee report or articles found in public search |
| Conclusion | Automated crawling is not viable from the IIP environment. Press releases must be ingested manually or via syndicated media copies (PNA, tier-2 outlets) that quote the House. |

**Revised recommendation:**
- Register the House as a `manual` source for now.
- Operator browses the press-release index from a normal browser, downloads public HTML/PDFs, and uploads them into IIP with provenance.
- If a stable, public API or document portal is later found, re-evaluate `list_page` crawling.

---

### 2.2 Senate of the Philippines — `senate.gov.ph`

| Item | Finding |
|---|---|
| Current site | Single-page React app served via Cloudflare; `/media/news-release` returns Cloudflare block |
| Legacy site | `legacy.senate.gov.ph/press_release/` returns HTTP 403 maintenance page |
| Legacy journals | `legacy.senate.gov.ph/journals/` returns 403 |
| LIS | `senate.gov.ph/lis/legisys.aspx` returns 404; no stable LIS URL pattern confirmed |
| Press release pattern | Old `.asp` pattern (`/press_release/YYYY/MMDD_authorX.asp`) no longer exposed; new site generates dynamic URLs via JS app |
| Conclusion | No automated crawl entry point exists. Senate content must be manual or partnership-based in v1. |

**Revised recommendation:**
- Register Senate as `manual` source, initially disabled.
- Operator manually collects Senate press statements, session transcripts/journals, and committee hearing notices when published.
- Investigate whether the Senate provides a public document portal or RSS feed through direct inquiry; do not attempt to reverse-engineer the JS app or bypass Cloudflare.

---

### 2.3 Supreme Court of the Philippines — `sc.judiciary.gov.ph`

| Item | Finding |
|---|---|
| robots.txt | Could not be fetched — connection-level issue or block |
| `/category/news/` | Not tested directly due to robots.txt failure; likely same infrastructure |
| `/decisions/` | Not tested directly |
| Conclusion | Needs manual recon from a different network/location. Do not enable automated crawling until access status and robots policy are confirmed. |

**Revised recommendation:**
- Keep Supreme Court as `pending_recon` and disabled.
- Operator tests access from a residential/business IP and documents working URLs + robots policy.
- If public decisions/orders on impeachment are released, upload PDFs manually as tier-1 court documents.

---

### 2.4 Official Gazette / `gov.ph`

| Item | Finding |
|---|---|
| Sitemaps | Confirmed public earlier: `gov.ph/post.xml`, `archive_yearly.xml`, etc. |
| Direct page fetch | Now returns 403/Cloudflare from our environment (high-traffic throttling or bot detection) |
| robots.txt | Direct fetch returns 403 due to Cloudflare fronting |
| Conclusion | Intermittent access. Sitemaps are the best path, but crawling may be unstable. Worth testing from the IIP host with polite delays and non-AI user-agent. |

**Revised recommendation:**
- Keep Official Gazette as `sitemap` source, but mark `access_status: intermittent`.
- Run small, polite dry-runs from the actual IIP host. If Cloudflare blocks persist, switch to manual uploads or lower-frequency crawl.
- The Gazette is still high-value because it is WordPress/sitemap-based and does not require JavaScript execution.

---

### 2.5 Philippine News Agency (PNA)

| Item | Finding |
|---|---|
| robots.txt | Returns 403 |
| Direct article fetch | `https://www.pna.gov.ph/articles/1274214` returns Cloudflare challenge |
| Earlier sample | `https://www.pna.gov.ph/articles/1272927` also blocked |
| Conclusion | Automated access blocked. PNA articles are often syndicated verbatim by tier-2 outlets; those copies can be ingested with upstream attribution. |

**Revised recommendation:**
- Keep PNA as `manual` source.
- Ingest PNA content indirectly through syndicated copies on crawlable tier-2 outlets, tagging `upstream_feed.wire_service: PNA`.
- Operator may manually upload high-value PNA originals if needed.

---

### 2.6 Presidential Communications Office (PCO)

| Item | Finding |
|---|---|
| `pco.gov.ph/news-releases/` | Cloudflare waiting room + Turnstile CAPTCHA challenge |
| robots.txt | Cloudflare-fronted; blocks named AI bots |
| Conclusion | Fully automated access blocked by CAPTCHA. Cannot be used as an automated source in v1. |

**Revised recommendation:**
- **Do not register PCO as an automated source.** If a specific PCO release is relevant, the operator uploads it manually.
- PCO is not in the original source registry; this recon confirms it should stay out unless a feed or partnership is established.

---

### 2.7 Lawphil — `lawphil.net`

| Item | Finding |
|---|---|
| `lawphil.net/congress/house/impeachment_2010.html` | Loads cleanly as static HTML; no Cloudflare |
| License | Creative Commons Attribution-NonCommercial 4.0 |
| Conclusion | Ready for manual seed as a tier-1 reference document. |

**Revised recommendation:**
- Keep Lawphil House Impeachment Rules as a `manual` seed document.
- Useful for the graph (procedural context) and for testing extraction on a clean, long-form document.

---

## 3. Impact on the source ingestion plan

The original plan assumed Phase B government sources could be automated after recon. That assumption is **no longer valid** for House, Senate, PNA, and PCO from the IIP environment. The updated strategy is:

| Original plan | Updated reality |
|---|---|
| Phase A: Gazette, GMA, Rappler, Reuters | Unchanged — these remain automated |
| Phase B: House, Senate, SC automated after recon | House/Senate/SC now **manual or partnership**; Official Gazette remains automated but intermittent |
| Phase C: ABS-CBN, PNA, Philstar | PNA already manual; ABS-CBN manual; Philstar may still be partially crawlable via search page |
| Government PDFs discovered via automated crawl | Operator must locate and upload PDFs manually or via syndicated media |

---

## 4. Revised source registry recommendations

The following sources should be **disabled for automated crawl** in the seed registry and switched to `manual` or `pending_recon`:

1. **House of Representatives** — change `crawl_strategy` from `list_page` to `manual`; keep `enabled: false`
2. **Senate of the Philippines** — change `crawl_strategy` from `list_page` to `manual`; keep `enabled: false`
3. **Supreme Court** — keep `pending_recon`; `enabled: false`
4. **Philippine News Agency** — keep `manual`; `enabled: false`
5. **Official Gazette** — keep `sitemap` but update `access_status` to `intermittent`
6. **PCO.gov.ph** — do not add to registry as automated source

---

## 5. How to still hit corpus targets

The PRD hard floor is **≥300 documents, ≥2 tier-1 sources, ≥2 tier-2 sources**. Even with government automation blocked, v1 can still meet this by:

1. **Official Gazette** (tier-1) — if crawlable intermittently, seed with Gazette posts about the VP, House, Senate, and legal process.
2. **Lawphil** (tier-1 reference) — one or more procedural documents.
3. **Manual House/Senate uploads** (tier-1) — operator collects and uploads public press releases, transcripts, hearing notices.
4. **GMA + Rappler + Reuters** (tier-2) — automated, high-volume coverage.
5. **Philstar** (tier-2) — if search-page crawl works.
6. **Syndicated PNA content** (tier-2, upstream PNA) — ingested through outlets that syndicate PNA.

The **quality** of the corpus matters more than the count. A smaller corpus with clean provenance and the citation-or-silence invariant is preferable to a larger corpus sourced through blocked or bypassed channels.

---

## 6. Operational workflow changes

### 6.1 Manual upload workflow

For each disabled government source, the operator will:

1. Browse source from a normal browser (residential/business IP).
2. Save public HTML/PDF documents.
3. Register a `manual` ingestion job with:
   - `source_id`
   - original URL
   - `retrieved_at`
   - `raw_snapshot` uploaded to MinIO
   - `content_checksum`
4. Run extraction through the normal Analyst pipeline.

### 6.2 Partnership outreach

For v1 credibility, consider reaching out to:
- PNA for a public feed or API access
- Senate Public Information Office for press-release distribution list
- House Committee on Justice for document publication list

These are **operational**, not technical, solutions.

### 6.3 Syndicated content handling

When a tier-2 outlet republishes a PNA/House/Senate release verbatim:
- Ingest from the tier-2 outlet.
- Mark `upstream_feed.wire_service` and `upstream_feed.original_publisher`.
- Use this for fact/claim tagging independence rules (EI-2).

---

## 7. Risks introduced by this recon

| Risk | Impact | Mitigation |
|---|---|---|
| Government automation blocked | Harder to hit corpus targets; slower ingestion | Manual uploads + partnerships + syndicated tier-2 coverage |
| Operator manual work scales poorly | Corpus growth depends on human bandwidth | Prioritize high-value documents; accept lower coverage honestly |
| Citation provenance for manual docs | Must still store raw snapshot + URL + retrieved date | Enforce manual upload metadata schema |
| Legal exposure of manual surfacing | Same as automated; pre-external gate still applies | Legal review of demo corpus + answer samples before any external presentation |
| Demo corpus may be media-heavy, gov-light | Could weaken pitch to legal/civil-society users | Disclose honestly; emphasize that every item is lawfully sourced and cited |

---

## 8. Decision recommendation

**D-050 | 2026-06-22 | proposed** — Philippine government automated crawling is **not viable** for House, Senate, PNA, or PCO from the IIP operating environment due to Cloudflare blocks and JS-only frontends. Revise the source ingestion plan: keep Official Gazette as intermittent automated, switch House/Senate/SC/PNA to manual or partnership ingestion, and rely on syndicated tier-2 media coverage of government events. The PRD corpus targets are still reachable through a combination of automated media, manual government uploads, and honest disclosure of coverage gaps.

**Cross-references:** D-049 (Perplexity not a runtime source), FR-1.2, NFR-L-1, EI-4, SM-6 hard floor.

---

## 9. Next actions

1. Update `source-registry-seed.json` and `source-registry-seed.yaml` to reflect revised strategies.
2. Implement a manual upload ingestion job type for government documents.
3. Run a pilot from the actual IIP host to confirm Official Gazette crawl stability.
4. Begin operator collection of House/Senate public press releases and hearing notices.
5. Draft a source-access legal memo for the Pre-External Gate documenting Cloudflare blocks and manual workflow.

---

*This is a recon update, not a final source plan. Conditions may change if sites remove Cloudflare protection or publish feeds.*
