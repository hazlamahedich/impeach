---
id: ADR-007
title: Tiered Ingestion Architecture — Firecrawl Tier-1 Only for v1
status: Accepted
date: 2026-06-26
supersedes: null
superseded_by: null
deciders: [Winston (architect), John (PM), user]
related: [D6, FR-1.1, FR-1.2, NFR-L-1, NFR-L-2, NFR-L-5, ADR-001, ADR-006, ADR-025]
evidence:
  - _bmad-output/planning-artifacts/architecture.md (§ingest tiered adapters; v1 ships Tier-1 + Tier-4 only; Tier-2 deferred)
  - _bmad-output/planning-artifacts/research/technical-ingestion-architecture-blocked-ph-sources-2026-06-19.md
  - _bmad-output/planning-artifacts/research/domain-philippine-sources-and-document-formats-research-2026-06-19.md
---

# ADR-007: Tiered Ingestion Architecture — Firecrawl Tier-1 Only for v1

## Context

Philippine impeachment sources split into access tiers with very different
legal and technical profiles: scrapable news sites (Rappler, GMA, Reuters),
WAF-protected government sites (Senate, House, SC, COMELEC), FOI-gated
records, manual uploads, and partnership SFTP drops. D6 modeled these as a
single "Collector." The architecture refines this into a **tiered adapter set
behind a `Crawler` port** so each tier's legal/technical posture is explicit
rather than smuggled into one fetcher.

The binding legal constraints (NFR-L-1/2/5, RA 10175, NPC Advisory 2026-01 on
scraping): public + lawfully-accessible only, robots respected, no
credential/circumvention of access controls. Tier-2 (stealth + residential
proxy to bypass WAFs) is a **circumvention-adjacent** technique whose
public-interest-reporting justification needs legal sign-off before
implementation — it cannot be silently built.

## Decision

1. **v1 ships Tier-1 (Firecrawl, scrapable) + Tier-4 (manual upload) only.**
   Firecrawl is the Tier-1 fetch adapter for sources whose `robots.txt` and
   terms permit scraping. Manual upload covers blocked primary sources (House,
   Senate, SC, PNA, ABS-CBN) until/unless a higher tier clears legal review.
2. **Tier-2 (Crawlee + Playwright + stealth + residential proxy) is
   scaffolded as an adapter interface but DEFERRED from v1 implementation**
   pending (a) a TDD amendment and (b) cyberlibel/public-interest legal review
   of the scraping justification + approval of proxy/residential-IP
   infrastructure.
3. **Tier-3 (FOI via Alaveteli) and Tier-5 (partnership SFTP drops, which add
   a partner provenance signature per SEC-2 / ADR-018) are v1.x/v2.**
4. Every adapter implements the `Crawler` port (SC-5); adding a tier is a new
   adapter, not a change to the dedupe/immutable-snapshot pipeline downstream.
   All tiers write to the same immutable MinIO raw-snapshot path + `documents`
   row; the tier is recorded as provenance, not a separate pipeline.

## Alternatives

1. **Ship Tier-2 stealth crawling in v1.**
   - Rejected for v1. Circumvention-adjacent techniques (WAF evasion,
     residential-proxy IP rotation) without legal sign-off create personal
     criminal exposure for the team under RA 10175 and the NPC scraping
     advisory. The defamation-grade posture requires the legal gate before the
     code, not after.
2. **Single Firecrawl fetcher for all sources (no port).**
   - Rejected. Collapses distinct legal postures into one code path and makes
     a future Tier-2/3/5 addition a retrofit of the core fetcher rather than a
     new adapter. The `Crawler` port exists precisely so tiers are additive.
3. **Cloud scraping APIs (ScrapingBee, Bright Data) for blocked sites.**
   - Rejected for v1. External dependency (NFR-D-1/D-2), ships source URLs +
     fetched content through a third party, and the residential-proxy services
     are the same circumvention-adjacent legal question as self-hosted Tier-2.
4. **Manual upload only (no automated Tier-1).**
   - Rejected. Scrapable news sources are the bulk of the v1 corpus volume and
     are lawfully accessible; automating them is the point of the platform.

## Consequences

- v1 ingestion scope is explicit and legally defensible: Tier-1 scrapable +
  Tier-4 manual. Blocked primary sources enter via manual upload with provenance.
- The `Crawler` port makes Tier-2/3/5 additive adapters; when Tier-2 clears
  legal review, it is a new adapter + this ADR amended, not an architecture
  change.
- Each tier records its tier + fetch provenance on the document row; trust-tier
  display (ADR-001 §5) reflects the source, not the fetch mechanism.
- Tier-2 deferral is a **tracked** decision, not an omission — the adapter
  interface is scaffolded so the gap is visible and the legal gate is the only
  blocker.

## Open questions

| # | Question | Owner | Trigger |
|---|----------|-------|---------|
| 1 | Does the public-interest-reporting justification for Tier-2 stealth crawling clear legal review (G7)? | Legal/PM | Pre-Tier-2 implementation ADR |
| 2 | Is Firecrawl's TOU + robots compliance sufficient for the Tier-1 source allowlist, audited per source? | Analyst/Legal | Source registry milestone (Story 3-1) |
| 3 | Should Tier-4 manual uploads require the two-person intake gate (SEC-2) before snapshot, or at snapshot? | Architect | Story 2-3 (two-person intake) |
