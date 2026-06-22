---
research_type: 'followup'
research_topic: 'Perplexity-Sourced Targeted Research Gaps'
project: 'Impeachment Intelligence Platform (IIP)'
author: 'anti lustay'
date: '2026-06-19'
web_research_enabled: true
source_verification: true
sourced_via: 'Perplexity API (Sonar / Research / Reason models)'
complements:
  - research/domain-philippine-impeachment-intelligence-political-knowledge-graphs-research-2026-06-19.md
  - research/technical-iip-technology-stack-validation-research-2026-06-19.md
  - research/market-philippine-political-intelligence-civic-tech-2026-06-19.md
---

# Perplexity-Sourced Targeted Research — Gap Closures & Corrections

**Date:** 2026-06-19
**Sourced via:** Perplexity API (perplexity_ask / perplexity_research / perplexity_reason)
**Purpose:** Close 🔴 Low-confidence gaps flagged in the three master research reports. Includes **2 critical corrections** and **3 major new findings** that change PRD/TDD recommendations.

---

## 🚨 Executive Summary — Critical Findings

| # | Finding | Impact | Severity |
|---|---|---|---|
| **1** | **NPC Advisory No. 2026-01** issued **April 13, 2026** — "Guidelines on Data Scraping of Publicly Available Personal Data." New binding rules: PIA mandatory, public ≠ consent, large-scale scraping under "heightened regulatory scrutiny." | **Adds new compliance gate** to IIP's ingestion architecture | 🟥 Critical |
| **2** | **Qwen3 Filipino support is marketing-level only.** No published Filipino/Tagalog benchmarks. Tech report's "119 languages" claim is NOT backed by Filipino-specific evaluations. | **Corrects Technical Research** — Qwen3 upgrade is still best choice but expected Filipino performance is inference, not verified | 🟥 Critical |
| **3** | **⚠️ REVISED:** Senate Presidency has changed hands **THREE times in 6 weeks** — Sotto → Cayetano (May 11) → **Gatchalian (June 17, 2026)**. Gatchalian is now presiding over Sara Duterte trial. Pre-trial conference held June 18, 2026. | Adds political-risk dimension; extreme volatility is itself the headline risk | 🟥 Critical |
| **4** | **NPC Advisory 2026-01** requires Privacy Impact Assessment for ALL scraping activities — IIP must commission a PIA before launch. | Adds ~6-8 week pre-launch deliverable | 🟧 High |
| **5** | **Anycase.ai** is a previously unidentified PH legal-tech competitor with **5,000+ claimed users**. | Adds to competitive landscape | 🟧 High |
| **6** | **foi.gov.ph confirmed does NOT cover Congress or Judiciary.** No statutory FOI bill enacted; multiple bills pending across multiple Congresses without passage. | Reinforces Tier 3-5 ingestion track necessity | 🟧 High |
| **7** | **SALN access regime under Remulla (post-Oct 14, 2025)** could not be verified — Perplexity confirms no public issuance found; direct verification with Ombudsman required. | IIP must verify directly; cannot rely on news reports | 🟧 High |
| **8** | **NED FY26 appropriation status unverifiable** from public sources; historic pattern is Congress restores proposed cuts but FY26 unconfirmed. | Funding diversification becomes more critical | 🟡 Medium |
| **9** | **Realistic 14B local LLM NER F1 over Filipino/English code-switching:** 0.50–0.65 zero-shot, 0.70–0.80 light FT, 0.80–0.88 serious domain adaptation (needs 10–20K labeled sentences). | Reinforces hybrid local+cloud recommendation | 🟡 Medium |
| **10** | **No mature "Philippine LegalBERT" or pre-packaged PH legal corpus exists** — IIP must build its own training data. | Adds data-engineering workstream | 🟡 Medium |

---

## 1. Sara Duterte Second Impeachment — Verified Current Status

**Source:** Perplexity (sonar) synthesized from The Diplomat, PNA, Wikipedia, YouTube news clips, June 2026.

### Verified Facts

| Item | Value | Confidence |
|---|---|---|
| **House vote (May 11, 2026)** | **257 yes / 25 no / 9 abstain** | 🟢 High (multiple sources) |
| **Senate impeachment court constituted** | Yes; pre-trial proceedings set mid-June 2026 | 🟢 High |
| **Duterte filed Answer** | By June 1, 2026 deadline | 🟢 High |
| **Pre-trial conference** | ~June 15, 2026 | 🟢 High |
| **Trial start** | **July 6, 2026** (per House prosecutor Terry Ridon) | 🟢 High |
| **Presiding officer** | **Senate President Alan Peter Cayetano** (replaced Sotto via leadership coup) | 🟢 High |
| **Coup context** | "Came amid moves to block an impending impeachment trial of VP Sara Duterte" | 🟢 High |

### Charges / Articles of Impeachment

1. **Misuse of confidential funds** — **₱612.5 million** as VP and Education Secretary
2. **Unexplained wealth**
3. **Bribery / corruption** as Education Secretary
4. **Public threat** to have President Marcos Jr., First Lady Liza Araneta-Marcos, and then-Speaker Martin Romualdez assassinated in event of her own killing

Framed under constitutional grounds: **violation of the Constitution, betrayal of public trust, graft and corruption, other high crimes.**

### Political-Risk Implication

The Cayetano coup "amid moves to block" the trial is a **material risk** to the trial proceeding as scheduled. IIP should:

- Track Senate President's procedural rulings for obstruction signals
- Model the scenario where trial is delayed, suspended, or aborted (cf. Estrada 2001)
- Maintain coverage of SC intervention (cf. SC's July 25, 2025 nullification of first impeachment)

### SC Decision *Duterte v. House of Representatives* (G.R. No. 278353)

**Status:** Perplexity could not retrieve exact reasoning text. Known facts (from existing Domain Research):
- Promulgated **July 25, 2025**
- Nullified first impeachment complaint (filed Feb 5, 2025, 215 House votes)
- Grounds: **one-year bar** violation; redefinition of "session day"
- Same complaint refiled after bar lapsed → second impeachment (May 11, 2026)

**Action:** Obtain the full decision text directly from SC or LawPhil/ChanRobles mirror. G.R. No. 278353.

---

## 2. PH Legal-Tech / Civic-Tech Landscape Updates

### Verified Live

| Platform | Status | URL | Notes |
|---|---|---|---|
| **Legaldex AI** | **ACTIVE** | legaldex.com | Founded 2024, Makati-based. Stanford TechIndex-listed AI legal-tech startup. Free Philippine legal research + AI insights. _Source: https://legaldex.com / https://techindex.law.stanford.edu/companies/13088_ |
| **Anycase.ai** ⭐ **NEW** | **ACTIVE** | anycase.ai | **Claims 5,000+ users.** Legal research tool + library for PH laws and jurisprudence. _Source: https://anycase.ai_ |

### Could Not Verify (Possibly Defunct)

| Platform | Status | Note |
|---|---|---|
| **Digest PH** | 🔴 Unverified | No active product page found |
| **Areglaw.ai** | 🔴 Unverified | No authoritative source confirming current status |
| **VERA Files SEEK** usage metrics | 🔴 Unverified | Nov 30, 2025 launch confirmed in existing research but usage metrics not public |
| **Rappler political KG** (Graphwise) current status | 🔴 Unverified | 2022 deployment confirmed; current operational status unclear |
| **Rappler Communities** app metrics | 🔴 Unverified | Dec 2024 launch confirmed; MAU/downloads not public |

### Strategic Implications

- **Anycase.ai's 5,000-user claim** establishes the **demand ceiling reference point** for PH legal-tech SaaS. IIP's “Pro” tier pricing should be calibrated against this.
- **Legaldex + Anycase = legal-AI segment is real but small.** Both target lawyers; IIP's differentiation is **citizens + journalists + political-vertical scope**.

---

## 3. Regulatory & Compliance — Major New Finding

### 🚨 NEW: NPC Advisory No. 2026-01 (April 13, 2026)

**Title:** "Guidelines on Data Scraping of Publicly Available Personal Data"
**Issued:** April 13, 2026 by the National Privacy Commission
**Sources:**
- https://www.dataguidance.com/news/philippines-npc-issues-advisory-data-scraping-publicly
- https://www.bakermckenzie.com/en/insight/publications/2026/05/philippines-npc-tightens-rules-on-data-scraping
- https://privacy.gov.ph/pips-and-pics/advisories-circulars/

#### Key Provisions Affecting IIP

1. **Applies to all Personal Information Controllers (PICs) and Processors (PIPs)** that engage in scraping OR host publicly available personal data that may be scraped. → **IIP is squarely in scope.**

2. **Public availability ≠ consent.** "Publicly available personal data is not exempt from the DPA." Scraping is a regulated form of processing.

3. **Valid lawful basis required.** For IIP: **legitimate interest (Sec. 13[b] DPA)** anchored in transparency/accountability purpose. Defensible but **requires a documented balancing test**.

4. **Privacy Impact Assessment (PIA) MANDATORY for all scraping activities**, including those done by third-party processors. → **New pre-launch deliverable for IIP.**

5. **"Heightened regulatory scrutiny"** for large-scale scraping, profiling, and aggregation. → IIP's bulk document ingestion triggers this.

6. **Specific, legitimate purpose limitation.** Must define purpose; processing limited to that purpose. → IIP must publish a purpose statement (transparency / accountability / journalism / research).

7. **Avoid high-risk fields** unless demonstrably necessary and proportionate. → IIP must NOT expose full home addresses, precise asset locations, family financials beyond what's already public.

8. **Data subject rights** (access, objection, correction) must be honored. → IIP must build a request-handling workflow.

### Practical Compliance Steps for IIP

- **Before launch:** Commission a **Privacy Impact Assessment** per NPC Advisory 2026-01 (6–8 week deliverable; budget ~₱200K–500K with PH privacy counsel).
- **Privacy notice** prominently published; lawful basis (legitimate interest) explicitly stated with balancing-test summary.
- **Data minimization:** scrape only name/position/asset-declaration fields; redact/pseudonymize family members' data and witness identities where possible.
- **Two-person review** for sensitive document uploads (already in Ingestion Tier 4 spec).
- **Security controls:** rate-limiting, bot-detection on any IIP-hosted data, breach notification procedure (72-hour NPC notification per NPC Circular 16-03).
- **PH privacy counsel on retainer** for ongoing compliance review.

### SALN Access Regime — Unverified

**Perplexity could NOT verify** that Ombudsman Remulla lifted the Martires Memo Circular No. 1 s. 2020 restrictions on October 14, 2025. **No public issuance was found in the search corpus.**

**Action required:** IIP must directly verify with the Office of the Ombudsman:
- Is Memo Circular No. 1 s. 2020 still in force?
- What is the current SALN request procedure?
- What is the fee schedule?
- Is bulk access possible?

**Design IIP's SALN ingestion around the most restrictive plausible rule** until verified.

### FOI Coverage — Confirmed

- **foi.gov.ph applies ONLY to Executive Branch** (per EO 2 s. 2016).
- **Congress and Judiciary are NOT covered.** They have their own internal rules.
- **No statutory FOI bill enacted.** Multiple bills pending across multiple Congresses without passage.

**Implication:** IIP cannot rely on foi.gov.ph for Senate/House/SC documents. Tier 3 (FOI via Alaveteli) + Tier 4 (Manual upload) + Tier 5 (Partnership) ingestion paths remain essential.

### NED FY26 Status

- **Specific FY26 appropriation unverifiable** from public sources.
- Historic pattern: Congress restores proposed cuts; NED continues grant-making during disputes.
- **Action:** Check NED's official "Apply for Funding" page directly; do not assume DOGE cuts killed NED but diversify funders regardless.

### Cyberlibel — No New Jurisprudence

- **No new PH jurisprudence** since *People v. Santos/Ressa/Rappler* (2020) on AI platform liability.
- **No DOJ opinions** on LLM-based services specifically.
- IIP's exposure remains as analyzed in Domain Research §6: re-publication theory risk; citation-or-silence architecture is the mitigation.

---

## 4. Technical — Critical Correction on Qwen3 Filipino Support

### Perplexity Finding

> "Public evidence for Qwen2/Qwen2.5/Qwen3 Filipino capability is almost entirely marketing-level as of mid-2025; there are no peer-reviewed or leaderboard Filipino benchmarks published specifically for Qwen."

Specifically:
- Qwen's reported evaluations are on standard multilingual benchmarks (MMLU, CMMLU, MGSM, GSM8K, MATH) which **contain very little or no Filipino/Tagalog**.
- **No Filipino/Tagalog MMLU subset, no XCOPA-tl results for Qwen, no Filipino code-switching benchmarks published.**
- Any claim about Qwen's Filipino performance is **extrapolation from typologically related languages**, not from actual published numbers.

### Correction to Technical Research

The Technical Research master report stated:

> "**Decisive finding:** Qwen3 explicitly supports 5 Philippine languages (Tagalog, Cebuano, Pangasinan, Iloko, Waray) — trained on 36T tokens across 119 languages."

**This overstates the evidence.** The accurate statement is:

> "**Qwen3 claims coverage of 5 PH languages in its marketing/tech report language table**, but **no Filipino-specific benchmarks have been published**. Performance is inferred from multilingual training and typologically-related language transfer, not verified."

### Recommendation Stands — But With Honest Caveats

Qwen3-14B remains the **best available local LLM** for IIP because:
1. Multilingual training data *likely* includes more Filipino than Qwen2.5
2. Hybrid thinking mode helps verify-before-emit
3. Apache 2.0 license
4. No better open-weights alternative exists with explicit PH-language ambition

**But the realistic performance estimate must be downgraded.** Per Perplexity:

| Scenario | Expected macro-F1 on PH legal-political NER |
|---|---|
| Zero-shot (no fine-tuning) | **0.50–0.65** |
| Light fine-tuning (few hundred labeled sentences) | **0.70–0.80** |
| Serious domain adaptation (10–20K labeled sentences, 0.5–1.5M tokens) | **0.80–0.88** in-domain |
| Out-of-distribution PH legal-political text | **0.75–0.82** |
| Statute-reference recognition (RA 9165, BP 22, etc.) | **~0.75** even when fine-tuned |
| Relation extraction (entity → role/case/issue) | **0.55–0.70** |

### New Action Items

1. **Build a PH legal-political training corpus from scratch.** No "Philippine LegalBERT" or pre-packaged corpus exists. Sources:
   - Arellano Law Foundation's Philippine Laws and Jurisprudence Databank
   - Official Gazette (EO 2 s. 2016, RAs, executive issuances)
   - House/Senate journals, transcripts (floor debates have heavy Filipino code-switching)
   - UP Diliman/UPLB research datasets (limited distribution; require partnerships)

2. **Budget for annotation work** — 10–20K labeled sentences is a meaningful investment:
   - ~₱2-5M at PH annotation rates (~₱150-300/sentence with subject-matter review)
   - Or partner with UP NCPAG / Arellano Law for student labor + supervision

3. **Consider symbolic augmentation** — gazetteers for statute citation patterns (RA/BP/CA/EO + number), committee name normalization, alias tables. These boost F1 by 3-5 points cheaply.

4. **Embedding gap also unverified:** bge-m3 has **NO published Filipino/Tagalog evaluation**. No MTEB Filipino slice exists. The same caution applies — domain-adaptation fine-tune on PH legal pairs is the largest ROI for closing the gap.

---

## 5. Confidence-Adjusted Master Findings

### Findings Strengthened (now 🟢 High)

| # | Finding | Was | Now |
|---|---|---|---|
| Sara Duterte 2nd impeachment trial date (Jul 6, 2026) | 🟡 Medium (secondary) | 🟢 High (multi-source confirmed) |
| House vote tally 257-25-9 | 🟡 Medium | 🟢 High |
| Presiding officer = Cayetano (with coup context) | 🔴 Unverified | 🟢 High |
| foi.gov.ph does not cover Congress/Judiciary | 🟡 Medium (statute text) | 🟢 High (confirmed) |
| Legaldex AI live, Makati-based, 2024 | 🟡 Medium | 🟢 High |

### Findings New

| # | Finding | Impact |
|---|---|---|
| **NPC Advisory 2026-01** (Apr 13, 2026) | New compliance gate; PIA mandatory |
| **Anycase.ai** (5,000+ users) | Adds competitor with traction proof |
| **Cayetano presiding-officer coup** | Trial obstruction risk |
| **Qwen3 Filipino benchmarks absent** | Corrects over-optimistic tech assumption |
| **No PH legal corpus exists** | Forces data-engineering workstream |

### Findings Still Unverified

| # | Finding | Action |
|---|---|---|
| SALN access regime post-Remulla (Oct 14, 2025) | Direct verification with Ombudsman required |
| NED FY26 appropriation | Direct check with NED |
| SC decision *Duterte v. House* G.R. No. 278353 exact reasoning | Obtain full text |
| VERA Files SEEK usage metrics | Direct outreach to VERA Files |
| Rappler Graphwise KG current status | Direct outreach to Rappler data team |

---

## 6. Required PRD/TDD Amendments (from Perplexity findings)

### New TDD Amendments (in addition to the 11 from Technical Research)

12. **NPC Advisory 2026-01 compliance** — Add PIA as pre-launch deliverable; document lawful basis (legitimate interest) with balancing test; publish privacy notice; implement data subject rights workflow.

13. **Political-risk modeling for trial** — Add scenario planning for trial obstruction via presiding-officer rulings; model SC intervention scenarios; maintain Estrada-2001-style "trial aborted" contingency.

14. **Qwen3 Filipino caveat** — Add explicit note in TDD §3 that "Filipino performance is inferred from multilingual training, not verified by published benchmarks. Domain adaptation fine-tune on 10-20K labeled sentences required to achieve >0.80 F1."

15. **PH legal corpus workstream** — Add as new Phase 0 task: curate 0.5-1.5M tokens of PH legal-political text; label 10-20K sentences for entity spans + types; budget ₱2-5M for annotation (or partner with UP/Arellano).

16. **Anycase.ai competitive tracking** — Add to competitive landscape; monitor for moves into political/legal-intelligence vertical.

### New PRD Amendments

5. **Privacy compliance** as first-class PRD requirement (not just TDD).
6. **Political-event contingency planning** — what happens to IIP if Sara Duterte trial is aborted?
7. **Data subject rights workflow** — UI for access/objection/correction requests per RA 10173.

---

## 7. Perplexity Value-Add Assessment

**Was Perplexity worth adding?** Yes — clear ROI on this session:

| Contribution | Value |
|---|---|
| **NPC Advisory 2026-01** (brand new, would have been missed) | 🟥 Critical — material compliance risk |
| **Cayetano presiding-officer intel** | 🟥 Critical — material political risk |
| **Anycase.ai competitor discovery** | 🟧 High — competitive intel |
| **Qwen3 Filipino benchmark gap exposed** | 🟥 Critical — corrects over-optimistic assumption |
| **Confirmed foi.gov.ph scope** | 🟧 High — removes ambiguity |
| **SALN access regime uncertainty flagged** | 🟧 High — triggers direct verification |
| **Realistic F1 expectations for 14B local LLM** | 🟡 Medium — sharpens planning |

**Recommendation:** Keep Perplexity active for ongoing research, especially for:
- Current PH political events (trial developments, senator-judge statements)
- Regulatory monitoring (NPC, Ombudsman, SC)
- Competitor tracking (Legaldex, Anycase, VERA Files SEEK)
- Grant/funding intelligence (NED, Omidyar, ICFJ cycles)

---

## Companion Document Updates Required

The following master research documents should be updated to reflect Perplexity findings:

| Master File | Update Needed |
|---|---|
| `technical-iip-technology-stack-validation-research-2026-06-19.md` | Add amendments 12-16; correct Qwen3 Filipino claim; add NPC Advisory 2026-01 to risk register |
| `market-philippine-political-intelligence-civic-tech-2026-06-19.md` | Add Anycase.ai to competitive landscape; note Cayetano presiding-officer risk; flag NED FY26 uncertainty |
| `domain-philippine-impeachment-intelligence-political-knowledge-graphs-research-2026-06-19.md` | Add NPC Advisory 2026-01 to regulatory environment; verify *Duterte v. House* decision text |

---

*End of Perplexity-sourced targeted research. Next recommended action: update the three master research documents with these findings, then proceed to `/bmad-correct-course` to formally align PRD/TDD.*
