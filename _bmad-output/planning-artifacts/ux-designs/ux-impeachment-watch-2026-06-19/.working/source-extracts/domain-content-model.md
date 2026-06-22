# Source Extract — Domain Content Model (Philippine Impeachment)

> Source: 3 domain research docs
> Extracted: 2026-06-19 by subagent

## 1. What is Philippine impeachment?

Philippine impeachment is the constitutional process for removing high public officers — the President, Vice-President, Supreme Court Justices, Members of the Constitutional Commissions (CSC, COMELEC, COA), and the Ombudsman — for six enumerated grounds (culpable violation of the Constitution, treason, bribery, graft and corruption, other high crimes, betrayal of public trust), anchored in **Article XI, Sections 2–8 and 17 of the 1987 Constitution**. It is a two-chamber process: the **House of Representatives** initiates (filing a verified complaint, committee determination, plenary vote by at least 1/3 of all Members to adopt Articles of Impeachment) and the **Senate** tries (convening as an Impeachment Court, hearing evidence, and convicting by a 2/3 vote of all Senators). The judgment is limited to removal and perpetual disqualification from office; criminal/civil liability remains. The process is partly political (no motion for reconsideration; conviction is a roll-call vote) but subject to limited Supreme Court *certiorari* review for grave abuse of discretion.

## 2. Procedural stages

The canonical sequence, drawn from Art. XI §3, House Rules, and Senate Rules §85–96:

| # | Stage | Who acts | Document / event marker | Typical duration |
|---|---|---|---|---|
| 1 | **Filing of verified complaint** | Complainant (House Member, citizen endorsed by a Member, or ≥1/3 of all House Members) | Verified Complaint (sworn under oath); filed with Secretary-General, transmitted to Speaker | Filing date |
| 2 | **Referral** | Speaker → House Committee on Justice | Order of Business inclusion within **10 session days**; referral within **3 session days** thereafter | ~13 session days |
| 3 | **Committee determinations** | House Committee on Justice | Three sequential tests: (1) sufficiency in form, (2) sufficiency in substance, (3) sufficiency of grounds; pleading sequence: Answer (10 days) → Reply (3 days) → Rejoinder (3 days) | Up to **60 session days** to report |
| 4 | **Hearing proper (probable cause)** | Committee (vote by majority of ALL members) | Subpoenas; Committee report + resolution (favorable → Articles; unfavorable → dismissal recommendation) | Within 60 session days of referral |
| 5 | **Plenary vote** | House plenary (roll-call) | Calendared within **10 session days** of committee report; threshold **≥1/3 of all Members** (~102 of 306 in 20th Congress); Articles adopted OR committee dismissal overridden | ~10 session days |
| 6 | **Service / transmittal to Senate** | House prosecution delegation | Articles of Impeachment physically served on Senate | "Forthwith" |
| 7 | **Senate convenes as Impeachment Court** | Senate President (or Chief Justice if President on trial); senators sworn | Senate Impeachment Rules (current: March 2026) | Upon receipt |
| 8 | **Summons & pleadings** | Senate → respondent | Writ of summons incorporating Articles; respondent Answer in **non-extendible 10 days**; prosecution Reply in **5 days**; default = "not guilty" plea | ~15 days |
| 9 | **Conduct of trial** | Presiding officer, House prosecution panel (11 Members), defense, senator-judges | Trial at 2:00 p.m.; opening statements (1/side); witness oath; direct/cross-examination; senator-judge questions (2 min each); closing arguments (2/side); Senate Journal is canonical record | Variable |
| 10 | **Voting & judgment** | Senate (roll-call per article) | Each senator rises and declares "guilty"/"not guilty" (up to 2 min explanation); conviction threshold **2/3 of all Senators** (16 of 24); conviction on any single article → immediate removal + perpetual disqualification; no motion for reconsideration | After all articles tried |
| 11 | **Judicial review (limited)** | Supreme Court | *Certiorari* for grave abuse of discretion (e.g., *Francisco Jr.* 2003, *Gutierrez* 2011, Duterte 2025–2026 rulings) | As needed |

A special **fast path**: a verified complaint endorsed by ≥1/3 of all House Members "bypasses the Committee and is automatically constituted as the Articles of Impeachment, transmitted directly to the Senate."

## 3. Entity types

The product must represent the following kinds of things:

- **Respondent** — the impeachable officer charged (President, VP, SC Justice, Constitutional Commissioner, Ombudsman).
- **Complainant** — the party filing the verified complaint: a House Member, a private citizen (with House endorsement), or ≥1/3 of all House Members.
- **Endorsing Member** — a House Member who endorses a citizen complaint by resolution.
- **House Member / Representative** — Member of the House of Representatives; voters in committee and plenary.
- **Senator / Senator-judge** — Member of the Senate; serves as a judge in the Impeachment Court.
- **Presiding officer** — Senate President (non-presidential trials; votes) or Chief Justice (presidential trials; does not vote).
- **Justice** — Supreme Court Justice (ponente, concurring/dissenting); also a possible respondent.
- **Committee** — principally the House Committee on Justice; also other committees referenced.
- **House prosecution panel** — 11 House Members who prosecute before the Senate; assisted by private prosecutors under their supervision.
- **Witness** — person testifying at committee or Senate trial; sworn under oath.
- **Article (of Impeachment)** — a numbered charge, each citing a constitutional ground; structured as factual narrative + legal ground + closing formula.
- **Pleading** — Verified Complaint, Answer, Reply, Rejoinder, Senate summons.
- **Evidence / Exhibit** — documentary or testimonial support; exhibits numbered (Prosecution Exh. "A", "B"…; Defense Exh. "1", "2"…; sub-markings "A-1").
- **Vote / VoteEvent** — a roll-call vote (committee, plenary, or Senate verdict); individual senator's "guilty"/"not guilty" declaration.
- **Ruling / Decision** — committee report, Senate verdict (roll-call tally per article + order), Supreme Court decision/resolution.
- **Date / Timeline event** — filing, referral, hearing, vote, promulgation dates; "session day" is a defined unit.
- **Document** — the primary-source artifact (complaint, Articles, transcript, SALN, SC decision, COA AAR, journal).
- **Source** — the publisher/repository (House, Senate, SC, Ombudsman, COA, LawPhil, ChanRobles, media outlet).
- **SALN** — Statement of Assets, Liabilities, and Net Worth; a standardized disclosure form.
- **Norm / Ground** — one of the six constitutional impeachment grounds (culpable violation, treason, bribery, graft and corruption, other high crimes, betrayal of public trust).
- **Claim** — an assertion made in a document or testimony (per the KR research, model with Toulmin anatomy + AIF relations).
- **Provenance / Agent** — the actor (human or NLP pipeline) and activity that asserted a fact (PROV-O model).
- **Place / Area** — geographic jurisdiction (OCD-ID), e.g., district, province, region.
- **Family / Dynasty** — kinship relations, a PH-specific dimension.
- **Ownership** — beneficial ownership / asset relationships (BODS model).

## 4. Relationship types

- **Respondent → CHARGED_IN → Case** (one respondent per case; one-to-many cases historically)
- **Complainant → FILED → Complaint** (many complainants may co-file; many-to-many)
- **Endorsing Member → ENDORSED → Complaint** (many endorsers per complaint; many-to-one complaint, many-to-many across cases)
- **Article → PART_OF → Articles of Impeachment** (many articles per set; one-to-many)
- **Article → ALLEGES VIOLATION OF → Norm/Ground** (each article cites one or more of the six grounds; many-to-many)
- **Evidence → SUPPORTS / REFUTES → Article/Claim** (the KR research argues these should be **reified AIF RA-nodes / CA-nodes** with scheme + strength, not bare edges; many-to-many)
- **Witness → TESTIFIED_IN → Hearing/Trial** (many witnesses per hearing; many-to-many across cases)
- **Senator → VOTED_ON → Article** ("guilty" or "not guilty"; many senators × many articles; many-to-many)
- **House Member → VOTED_IN → VoteEvent** (plenary/committee; many-to-many)
- **Committee → PRODUCED → Committee report** (one-to-many over time)
- **Document → DERIVED FROM / QUOTED FROM → Document** (PROV-O `wasDerivedFrom`, `wasQuotedFrom`; many-to-many for citations and quotations)
- **Document → CITES → Document/Case** (SC decisions cite prior G.R. numbers; many-to-many)
- **Person → MEMBER_OF → Organization** (the KR research mandates a **reified Membership node** with role, start_date, end_date, on_behalf_of=party, area, legislative_period — not a bare edge; many-to-many with temporal qualification)
- **Person → HELD → Post** (e.g., "Senator, 19th Congress"; one Person → many Posts over time)
- **Person → OWNS/CONTROLS → Entity** (BODS Ownership with interests[]; many-to-many)
- **Person → RELATED TO (family) → Person** (parent/child/sibling/spouse; many-to-many)
- **Presiding officer → PRESIDED OVER → Trial** (one-to-one per trial)
- **Ruling → RESULTED IN → Outcome** (conviction, acquittal, dismissal, resignation, voided)
- **Claim → ADDRESSED TO → Issue** (IBIS model; many positions answer one issue)
- **Agent → ASSERTED → Relationship** (PROV-O provenance; every triple gets qualified attribution)

## 5. Document formats

Primary sources the product ingests:

| Document | Format | Typical length | Citation convention |
|---|---|---|---|
| **Verified Complaint / Articles of Impeachment** | Scanned PDF (image-only, requires OCR); structure: Caption → numbered WHEREAS clauses → numbered Articles (Roman numerals) citing constitutional ground verbatim → Prayer → notarized Verification | Multi-page to tens of pages (Corona: 8 Articles) | "Articles of Impeachment against [Name], [Office]" |
| **House Resolution (endorsement)** | Scanned PDF / HTML | Pages | `H.R. No. <n>` |
| **House Committee Report** | Scanned PDF; structure: caption, committee name, bill/resolution referred, numbered WHEREAS/section clauses, signatures, "and the Chair/Members voting as follows:" + yeas/nays/abstentions roll | Pages | "CTR / House C.R. No." |
| **House Journal (session day)** | Scanned PDF, per-congress per-session-day | Per session | "Journal of the <NN>th Congress, <session day>" |
| **Senate Impeachment Rules** | Published PDF (revised per Congress; current: March 2026) | Document | "Senate Rules of Procedure in Impeachment Trials (March 2026)" |
| **Senate Transcript of Session (TS)** | Sanitized stenographic record, scanned PDF behind Cloudflare; exhibit numbering (Exh. "A", "A-1"; Defense "1", "2"); witness testimony format Direct→Cross→Re-direct→Re-cross | Per session day, can be very long | "Transcript of Session, <date>" |
| **Senate Verdict** | Roll-call tally per article + short order signed by presiding officer; senator 2-minute explanations appended to Journal; *not* a unified reasoned opinion | Short order + explanations | Recorded in Senate Journal |
| **Supreme Court Decision** | HTML text (sc.judiciary.gov.ph) / mirrors (lawphil.net, chanrobles.com); anatomy: Court, En Banc/Division, Case title, G.R. No., Promulgated date, DECISION, ponente, Facts→Issues→Ruling→fallo ("SO ORDERED."), separate/dissenting opinions | Typically thousands of words | `<Parties>, G.R. No. <docket>, <DD Month YYYY>`; SCRA pin-cite: `<Vol> SCRA <page>` |
| **SALN** | Standardized CSC template (OCA-SALC-Form No. 98) + Confidential List attachment (OCA-CL-Form No. 98); scanned PDF; sections: Personal info, Assets (real/personal, assessed/FMV, acquisition cost), Liabilities, Net Worth, Sources of Income, Business Interests, Relatives in Government, spouse section, sworn statement + notary | Form-driven | "<Official>, SALN for CY <YYYY>, filed <date>, Ombudsman repository" |
| **COA Annual Audit Report / Audit Observation Memorandum** | Scanned PDF; AOM is the citable unit | Variable | "COA Annual Audit Report, <Agency>, FY <YYYY>, Audit Observation Memorandum No. <n>" |
| **COMELEC SOCE** | Mixed HTML/PDF | Form | "SOCE, <Candidate>, <Position>, <Election>, COMELEC" |
| **Republic Act / Executive Order** | HTML full text (Official Gazette, WordPress, crawlable) | Variable | "Republic Act No. 11968 (2022)" / "R.A. 11968"; "E.O. No. 116, s. 2026" |

**Ingestion reality:** All four major government sites (House, Senate, SC, COA) **block automated ingestion** (403 / Cloudflare). Documents are predominantly **image-only scanned PDFs requiring OCR** (Tesseract `fil+eng`, layout-aware). No official API exists for any body; FOI portal (foi.gov.ph) is the only programmatic channel for blocked agencies. LawPhil and ChanRobles serve as mirrors for SC jurisprudence.

## 6. Status / state machine

A case can occupy these states (derivable from the procedural lifecycle):

- **Filed** — verified complaint filed with Secretary-General; not yet referred.
- **In Order of Business** — Speaker has included it (within 10 session days).
- **Referred to Committee** — before the House Committee on Justice.
- **Sufficiency in form — passed / failed** (failed → returned to Secretary-General within 3 session days, dismissal).
- **Sufficiency in substance — passed / failed** (failed → dismissed).
- **Sufficiency of grounds — under evaluation** (pleadings exchanged: Answer → Reply → Rejoinder).
- **In hearing** — committee conducting probable-cause hearings (subpoenas, testimony).
- **Committee report — favorable / unfavorable** (favorable → Articles; unfavorable → dismissal recommendation to plenary).
- **Plenary — pending vote** (calendared within 10 session days of committee report).
- **Articles adopted** (≥1/3 affirms favorable report) **OR dismissal overridden** (≥1/3 overrides unfavorable report) **OR dismissed** (fails 1/3 either way).
- **Transmitted to Senate / served**.
- **Senate convened / summons issued** — respondent in 10-day Answer window.
- **On trial** — evidence being heard.
- **Voting held** — verdict per article.
- **Convicted** — 2/3 of all Senators guilty on any article → immediate removal + perpetual disqualification.
- **Acquitted** — no article reaches 2/3.
- **Resigned** (mid-process; mooting the proceeding — e.g., Gutierrez 2011).
- **Voided by SC** — *certiorari* for grave abuse of discretion (e.g., Duterte 2025–2026; Davide 2003 enjoined).
- **One-year-bar active** — no new proceedings against the same official for one year from initiation.

**On "alleged" vs "proven" vs "dismissed":**

- **Alleged** — an assertion contained in a verified complaint or Article of Impeachment, **unproven**. The mechanics research stresses that a complaint's allegations are taken as true only for "sufficiency in substance" testing; they remain unproven until Senate conviction. The KR research (Gap 4, proof-standard metadata) explicitly distinguishes impeachment's standard: *"impeachment = 'preponderance supported by 2/3 Senate vote' — neither criminal beyond-reasonable-doubt nor civil preponderance."* An allegation may be **sufficient to proceed** without being **proven**.
- **Proven (for impeachment purposes)** — 2/3 Senate vote to convict on an article. This is a **political judgment**, not a criminal conviction. Sanction scope is explicitly limited: "judgment does not extend beyond removal + disqualification; the convicted party remains liable to criminal/civil prosecution in regular courts." A claim "proven" for impeachment is therefore **not** proven to criminal standard.
- **Dismissed** — terminated without conviction: by committee insufficiency, plenary failure to reach 1/3, SC voiding, or resignation mooting the proceeding.

## 7. Critical UX-relevant domain rules

1. **The six impeachment grounds are a closed, exclusive list** (culpable violation of the Constitution, treason, bribery, graft and corruption, other high crimes, betrayal of public trust). Each Article must cite one or more of these verbatim. A claim that does not map to a named ground is not an impeachment allegation — the UI must enforce or surface this mapping.

2. **Only specific officers are impeachable** (President, VP, SC Justices, Constitutional Commission members, Ombudsman). Deputies are NOT on the list. The product must not present a complaint against a non-impeachable officer as an "impeachment case."

3. **The 1/3 and 2/3 thresholds are of ALL Members/Senators, not those present.** Plenary adoption requires ≥1/3 of all House Members (~102 of 306 in the 20th Congress); Senate conviction requires 2/3 of all Senators (16 of 24). The UI must compute against total seats, not votes cast.

4. **Conviction on any single article is sufficient** for removal and perpetual disqualification; acquittal requires no article to reach 2/3. The UI must vote per-article, not aggregate.

5. **The verdict is final; no motion for reconsideration is permitted.** The product must not present a conviction as "subject to appeal" within the Senate.

6. **Sanction is limited to removal + disqualification.** "The convicted party remains liable to criminal/civil prosecution in regular courts." The UI must not imply criminal guilt from an impeachment conviction.

7. **The one-year bar is jurisdictional and SC-enforced.** "No impeachment proceedings shall be initiated against the same official more than once within a period of one year." The Duterte (2025–2026) ruling expanded "initiation" to include inaction/failure-to-refer. The UI must track initiation dates and surface bar windows.

8. **"Session day" is a defined unit (post-2026 SC ruling):** any calendar day on which the House actually convenes — rejecting the old "one session day can span multiple calendar days" theory. Deadline counters in the UI must use this definition, not calendar days.

9. **Allegations are unproven until Senate conviction**; the standard is political (2/3 vote), not criminal (beyond reasonable doubt). The UI must label allegation fields as unproven, link to the charging document, and avoid generating derivative assertions (per the DPA risk vector table).

10. **The Senate verdict is a roll-call tally, not a reasoned opinion.** Substantive reasoning lives in the individual senators' 2-minute explanations and the trial transcript. The UI must represent the verdict as per-article tallies + optional per-senator explanations, not as a single judicial opinion.

11. **The Senate is "the sole judge" but SC *certiorari* review exists** for grave abuse of discretion. A "voided by SC" state must be representable and distinguished from acquittal.

12. **Resignation mooting is a real terminal state** (Gutierrez 2011) — the case does not reach a verdict. The UI must distinguish "acquitted," "resigned," and "voided" as separate outcomes.

## 8. Narrative beats

Natural "story" moments the UX could highlight:

1. **The filing** — a verified complaint is sworn and filed; the complainant's identity (citizen vs. House Member vs. 1/3 bloc) signals the path.
2. **The endorsement threshold** — when signatures cross 1/3 of all House Members, the complaint **bypasses committee and auto-becomes Articles** (the "fast path"). This is a dramatic moment of political will.
3. **The three sufficiency tests** — form → substance → grounds, each a gate that can dismiss.
4. **The pleading duel** — Answer (10 days) → Reply (3 days) → Rejoinder (3 days), with affidavits and evidence attached; the first structured exchange of the adversarial case.
5. **The committee vote** — majority of ALL committee members for probable cause; the report's direction (Articles vs. dismissal) sets up the plenary showdown.
6. **The plenary override** — when a committee recommends dismissal but 1/3 of the House overrides and forces Articles. A reversal beat.
7. **Service on the Senate** — physical transmittal by a House delegation; the Constitution mandates the Senate "forthwith proceed."
8. **The swearing-in** — presiding officer and senators take the oath of "impartial justice" and the political-neutrality duty; the trial formally opens.
9. **The summons and the Answer** — respondent's 10-day window; a guilty plea ends the trial instantly; silence defaults to "not guilty."
10. **The trial itself** — opening statements, witness testimony with senator-judge interruptions (2-minute questions), exhibit numbering, interlocutory disputes (1 hour/side).
11. **The 2-minute senator explanations** — each senator rises and declares "guilty"/"not guilty" with optional reasoning; rich individual-narrative material.
12. **The verdict roll-call per article** — the climactic tally; conviction on any single article is decisive.
13. **The fallo** — the short order read aloud by the presiding officer's clerk pronouncing "judgment of conviction" or "acquittal."
14. **The SC intervention** — a *certiorari* petition halts or voids the process (e.g., Duterte 2025–2026, Davide 2003); an external reversal beat.
15. **The one-year bar expiry** — the date the respondent becomes eligible to face new proceedings; a "watch this date" beat.

## 9. Tone / neutrality cues

- **Presumption of innocence / "alleged" framing.** The mechanics research (§6.4) is explicit: "A platform that *generates* summaries characterizing a person could be analogized to an author… Truth is NOT an absolute defense: under RPC Art. 361, truth is a defense only if shown to have been published with good motives and for a justifiable end. A platform must therefore preserve context, attribution, and the 'alleged' framing of unproven impeachment charges." The product must quote rather than paraphrase defamatory imputations and anchor every claim to a primary-source document.

- **"Fair-report privilege" depends on faithful quotation.** RPC Art. 354–355 recognize privileged communication for "fair and true reports of official proceedings." The KR research recommends `wasQuotedFrom` (PROV-O) and AKN `<quote>` to model verbatim quotation precisely. Loose paraphrasing forfeits the privilege.

- **Impeachment conviction ≠ criminal conviction.** The sanction is "removal + disqualification" only; the respondent "remains liable to criminal/civil prosecution in regular courts." The product must never present a convicted respondent as a criminal.

- **Official titles.** Philippine citations and documents use formal office titles (Chief Justice, Senate President, Ombudsman, Secretary-General, Presiding Officer) and case titles with party formatting (*Francisco Jr. v. House of Representatives*; *Republic v. Sereno*). SC decisions name the **ponente** at the top. The product should preserve these conventions verbatim.

- **Proof-standard distinctions.** The KR research (Carneades proof standards) requires tagging each claim with its applicable standard: impeachment is "preponderance supported by 2/3 Senate vote," distinct from criminal beyond-reasonable-doubt. The product must let users see "allegation X is *not* proven to criminal standard but *is* sufficient for impeachment" — a neutral, calibrated framing.

- **SALN and family data are sensitive.** SALNs contain spouse and minor children's financial data, relatives-in-government disclosures, bank accounts. The DPA risk vector table warns: "Restrict to the official's own data; minimize family data; rely on public-interest basis; honor Ombudsman access rules." Naming witnesses/whistleblowers carries "risk of harm" — "pseudonymize or redact non-public witnesses."

- **Cyberlibel exposure is durable (12-year prescription) and the penalty is harsher online** (6–12 years vs. 6 months–4 years for ordinary libel). There is no §230-equivalent safe harbor in PH law. The *Ressa* "re-publication" theory treats re-surfacing allegations as potential re-publication.

- **Verdict language is formulaic.** Senators declare "guilty" or "not guilty"; the presiding officer pronounces "judgment of conviction" or "acquittal"; SC fallos close with "SO ORDERED." The product should preserve these exact legal terms rather than editorial synonyms.

- **IFCN neutrality standards.** The product should align with the IFCN Code of Principles (non-partisanship, transparent methodology, sources for every fact check, open corrections policy) given that its tier-1 fact-check sources (Rappler, Vera Files) are IFCN signatories.