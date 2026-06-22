---
research_type: 'domain'
research_topic: 'Knowledge Representation Standards for Legal & Political Domains'
project: 'Philippine Impeachment Intelligence Platform (IIP)'
author: 'research'
date: '2026-06-19'
web_research_enabled: true
source_verification: true
complements: 'domain-philippine-impeachment-intelligence-political-knowledge-graphs-research-2026-06-19.md'
---

# Research Report: Knowledge Representation Standards for Legal & Political Domains

**Purpose:** Map existing ontologies, schemas, and standards to IIP's proposed domain model (Person/Org/Event/Document/Claim/Evidence + relationships FILED, VOTED_FOR, OPPOSED, TESTIFIED_IN, SUPPORTED_BY, REFUTED_BY). Identify what to reuse, where IIP's primitives are insufficient, and what properties/patterns IIP must adopt.

All findings web-verified 2026-06-19. Confidence noted where sources conflict or projects are dormant.

---

## 1. Legal Core Ontologies

### LKIF Core (Legal Knowledge Interchange Format)
**Status:** Developed 2007 in EU ESTRELLA project. Implemented in OWL-DL + SWRL. Source maintained at `github.com/RinkeHoekstra/lkif-core`. Academic maturity high; production adoption low (research-vehicle).
**What it offers:** A reusable basic ontology of legal concepts (Legal Role, Norm, Act, Document, Expression, Obligation, Permission, Prohibition, Normatively_Qualified). Separates *expression* (the text) from *work* (the abstract legal act) — a pattern IIP needs.
**Applicability to IIP:** ★★★ Medium-high. LKIF's deontic primitives (Obligation/Permission/Prohibition) map cleanly onto impeachment charges (an Article of Impeachment *alleges a violation of a constitutional norm*). IIP should borrow the **norm-violation pattern**: a Claim is linked to a Norm it alleges was breached. Avoid importing full OWL-DL complexity; treat LKIF as conceptual reference, not runtime schema.
**URL:** https://github.com/RinkeHoekstra/lkif-core · https://en.wikipedia.org/wiki/Legal_Knowledge_Interchange_Format

### LRI Core / "Legal Research Incognito"
**Status:** LRI Core is frequently conflated with LKIF. The well-documented, citable artifact is the **LKIF Core Ontology of Basic Legal Concepts** (Hoekstra, Breuker, Di Bello, Boer, 2007, LOAIT 321:43–63). There is no separate maintained "LRI Core" standard. **Do not cite LRI Core as a distinct deliverable** — this is a recurring literature confusion.
**Applicability to IIP:** ★☆☆ Low. No actionable separate standard.

### EuroVoc
**Status:** Actively maintained by EU Publications Office. Multilingual thesaurus in 24 EU languages + Albanian/Macedonian/Serbian. SKOS-formalized (Simple Knowledge Organization System). Used by EU Parliament, national/regional parliaments, and as the domain backbone of the EU's IATE terminology database.
**What it offers:** A controlled hierarchical vocabulary (~7,000 concepts across 21 domains) for indexing legal/political documents — e.g., concepts for *constitutional law, parliament, impeachment (recall/removal), criminal liability, public office, corruption*.
**Applicability to IIP:** ★★★ Medium-high — **as a tagging taxonomy, not a node schema**. IIP needs a controlled vocabulary to classify Documents, Claims, and Evidence (is this allegation about *bribery*, *betrayal of public trust*, *graft*, *culpable violation of the Constitution*?). EuroVoc's SKOS structure (skos:Concept, skos:broader, skos:related) is the model to copy. IIP should build a **PH-localized subset** mirroring EuroVoc's structure but keyed to PH constitutional categories (Art. XI §2 grounds: culpable violation of Constitution, treason, bribery, graft & corruption, betrayal of public trust, other high crimes).
**URL:** https://op.europa.eu/en/web/eu-vocabularies/dataset/-/resource?uri=http://publications.europa.eu/resource/dataset/eurovoc

### ELI (European Legislation Identifier)
**Status:** Highly active. Council Conclusions 2012 & 2017. Ontology v1.5 (2024); plus ELI-DL (Draft Legislation) v3.0 and ELI Impact Ontology v1.0 released 2024. Implemented by 21 national gazettes (Albania, Austria, Belgium, ... Spain, UK). Based on FRBRoo / CIDOC CRM. schema.org/Legislation extension published; ELI↔schema.org converter exists.
**What it offers:** Four pillars: (I) URI template `/eli/{jurisdiction}/{agent}/{year}/{type}/{number}/{version}/{language}`; (II) ontology for legal-resource metadata (jurisdiction, date_document, type_document, first_date_entry_into_force, date_no_longer_in_force, is_realized_by, relates_to, changes, repeals); (III) RDFa/JSON-LD embedding rules; (IV) Atom-feed sync protocol.
**Applicability to IIP:** ★★★★ High. **The identifier-pattern is directly portable.** IIP should adopt an ELI-inspired URI scheme for PH documents, e.g. `/iip/ph/{body}/{doc-type}/{congress}/{number}/{version}` (e.g. `/iip/ph/house/articles-of-impeachment/19th/001/r1`). The ELI *versioning model* (LegalResource → LegalExpression → Format) solves IIP's need to track amended complaints, redacted filings, and consolidated resolutions as the same *work*. Reuse `changes / repeals / amends / cites` relation vocabulary verbatim.
**URL:** https://eur-lex.europa.eu/eli-register/ · https://en.wikipedia.org/wiki/European_Legislation_Identifier

### ECLI (European Case Law Identifier)
**Status:** Active. Council Conclusions 2011. Implemented by ~16 EU members + CJEU, ECHR (HUDOC), EPO. ECLI Search Engine live since 2016 at e-justice.europa.eu. Resolver at `e-justice.europa.eu/ecli/{ECLI}`.
**What it offers:** 5-part identifier `ECLI:{country}:{court}:{year}:{serial}` + 9 mandatory Dublin Core metadata fields (identifier, isVersionOf, creator=court, coverage, date, language, publisher, accessRights, type) and 8 optional (title, subject, abstract, description, contributor=judges, issued, references, isReplacedBy).
**Applicability to IIP:** ★★★★ High. **Mirror this for PH Supreme Court / Sandiganbayan / Senate impeachment decisions.** Proposed: `IIPCLI:PH:{court-or-body}:{year}:{serial}` (e.g. `IIPCLI:PH:SC:2026:123456` for a G.R. No.). The 9 mandatory ECLI metadata fields are a *minimum-viable provenance contract* — IIP's `documents` table (id, title, url, source, publish_date, content, checksum) is **too thin**: it lacks creator/author, accessRights, language, type-of-decision, and reference-links to cited cases. **Gap: add these.**
**URL:** https://en.wikipedia.org/wiki/European_Case_Law_Identifier · https://e-justice.europa.eu/content_european_case_law_identifier_ecli-175-en.do

### Akoma Ntoso (AKN)
**Status:** OASIS standard since Aug 2018 (LegalDocML TC). v3.0 has 500+ structural entities. MIME type `application/akn+xml`. Adopted by: UK National Archives (all legislation converted 2014, lifted UK to #1 on Global Open Data Index for legislation), Italian Senate (bulk bills since 2016), EU Parliament (AT4AM amendment editor), Germany (LegalDocML.de v1.0, 2020), UN system (HLCM 2017), Brazil LexML (2008), US USLM (2013, AKN-consistent).
**What it offers:** XML vocabulary + schema for *bills, acts, judgments, debate records, minutes, gazettes*. Multi-layer markup separates structure (hierarchical: chapter→section→article→paragraph) from ontology (FRBR Work/Expression/Manifestation/Item + references + temporal segments). Supports amendments, citations, quotations, speech records natively.
**Applicability to IIP:** ★★★★★ Critical. **This is the canonical document-representation standard IIP should target for source documents.** PH impeachment outputs — Articles of Impeachment, Senate trial transcripts (debateRecord), committee reports, Supreme Court resolutions (judgment) — all have direct AKN document types. IIP doesn't need to *author* in AKN; it should *parse to* AKN structures so that paragraphs, citations, and quoted testimony become addressable sub-entities (each with their own FRBR URN) that the knowledge graph can cite at sub-document granularity. **This solves the "which sentence in the transcript is the evidence?" problem.** AKN's `<debate><speech>` element natively models who-said-what — a direct fit for Popolo `Speech` (see §2).
**URL:** https://en.wikipedia.org/wiki/Akoma_Ntoso · https://www.oasis-open.org/committees/tc_home.php?wg_abbrev=legaldocml

### LegalRuleML
**Status:** OASIS standard, companion to LegalDocML. Represents norms, deontic logic (obligation, permission, prohibition, right), and constitutive rules.
**Applicability to IIP:** ★★ Low-medium. Overkill for v1. IIP's "did the respondent violate norm X?" question is answerable without formal deontic machinery. Revisit only if IIP adds automated norm-reasoning (likely out of scope).
**URL:** https://wiki.oasis-open.org/legalruleml/

### IRAC / CRACS (legal argument structure)
**Status:** Pedagogical convention, not a formal standard. IRAC = Issue, Rule, Application, Conclusion. CRACS = Conclusion, Rule, Application, Conclusion, Synthesis (variant).
**Applicability to IIP:** ★★★ Medium. Use **as an annotation schema on Claim nodes**, not as a data model. Each IIP Claim can carry an `argument_structure` field tagging its components (issue-stated, rule-invoked, facts-applied, conclusion-asserted). This makes the graph queryable by argument-role, mirroring how lawyers actually read impeachment briefs. Complements Toulmin (§3).

---

## 2. Political & Parliamentary Schemas

### Popolo (popoloproject.com)
**Status:** W3C Open Government Community Group spec. Stable. **Adopted by g0v (Taiwan — directly relevant to PH/Asia civic-tech context), mySociety, Open North, Sunlight Foundation, Openpolis (Italy), Sinar Project (Malaysia), KohoVolit (EU), Granicus, Texas Tribune, Open Civic Data.** This is *the* international standard for legislative data interchange.
**What it offers — the canonical classes IIP must learn from:**
- **Person** (name, sort_name, image, gender, birth_date, death_date, national_identity, contact_details, identifiers, other_names)
- **Organization** (classification: party / legislature / committee / government-body)
- **Membership** *(linking entity)* — Person ↔ Organization with `role`, `start_date`, `end_date`, `on_behalf_of` (party), `area`, `legislative_period`. **This is the pattern IIP's schema is missing.**
- **Post** (a defined position within an org, e.g. "Senator, 19th Congress")
- **Motion** (a proposal put to a vote — *directly maps to IIP's Articles of Impeachment as a motion*)
- **VoteEvent** (a roll-call or division — has start_date, organization, legislative_session, result)
- **Count** (aye/no/abstain/present/absent totals)
- **Vote** (individual: voter, option, group)
- **Area** (geographic jurisdiction)
- **Event** (any temporal occurrence: hearing, filing, vote, press-conference)
- **Speech** (text + speaker + start/end within an Event — for debate transcripts)
- **ContactDetail**

**Applicability to IIP:** ★★★★★ Critical — **adopt Popolo as the political-entity backbone.** Specifically:
1. IIP's flat `Person` node must become Popolo-Person + **Membership nodes** capturing *which org, which role, which dates, which party, which district* — without this, IIP cannot answer "was Senator X a member of the Justice Committee when the vote happened?" or "did the respondent's party affiliation change during the period covered by the allegations?"
2. IIP's `Event` conflates Hearings/Votes/Filings/Decisions — Popolo splits these into **Motion, VoteEvent, Speech, Event** with distinct properties. **A vote is not an event-with-metadata; it is a first-class node with a result and a set of individual Votes.** This is essential for senator-intelligence dashboards (roll-call analysis).
3. Popolo's design principle *"Plan for imprecise and uncertain data"* matches IIP's reality (conflicting news reports, undated leaks) — every property allows a confidence/uncertainty qualifier.
4. **Adopt `legislative_period` (e.g. "19th Congress") as a first-class dimension** — PH terms and congress-numbering must be explicit, not implicit.

**URL:** https://www.popoloproject.com/ · https://www.popoloproject.com/specs/

### Council Data Project (Seattle / municipal)
**Status:** Active open-source (GitHub `CouncilDataProject/cdp-backend`). Built on Popolo. Adds: transcripts ingestion (from YouTube/Granicus), full-text search, event-based organization. Strong tooling reference but US-municipal-scoped.
**Applicability to IIP:** ★★★ Medium. **Borrow the ingestion pipeline pattern** (video → transcript → speech-segmented Popolo Speech nodes). CDP's data model is essentially Popolo + transcript-search; IIP needs the same.
**URL:** https://councildataproject.org/

### Wikidata political schemas
**Status:** Massive, live, queryable via SPARQL. Properties highly relevant: P39 (position held), P102 (member of political party), P27 (country of citizenship), P463 (member of), P735/P734 (given/family name), P569/P570 (birth/death date), P19/P20 (birth/death place), P18 (image), P106 (occupation), P3602 (candidate for), P991 (candidacy in election), P1111 (votes received), P4350 (campaign), P1174 (electoral district), P541 (office contested), P1001 (applies to jurisdiction), P2623 (votes for/against in roll-call). Entities pre-modeled for many PH politicians.
**Applicability to IIP:** ★★★★ High. **Use as a seed and reconciliation layer.** Every IIP Person/Org should carry a `wikidata_id` (P-identifier) for cross-referencing and disambiguation (e.g. multiple "Juan Ponce Enrile" mentions resolve to one Q-item). IIP can pull structured biographical data (party history P102 with qualifiers P580/P582 start/end dates) instead of re-keying. **Caution:** Wikidata is editable by anyone — treat as a *hint source* requiring citation, not as ground truth. ECLI also has a Wikidata property (P3570) — useful for court-decision linking.
**URL:** https://www.wikidata.org/wiki/Wikidata:WikiProject_Politics

### Open Civic Data Division Identifier (OCD-ID)
**Status:** Maintained by opencivicdata.org (the same ecosystem as Popolo). Format `ocd-division/country:{cc}/...` hierarchically identifying jurisdictions (e.g. `ocd-division/country:ph/region:ncr/city:manila`).
**Applicability to IIP:** ★★★ Medium. **Adopt for geographic areas** (districts, provinces, regions) so that "senators from Mindanao" or "representatives from NCR" queries are tractable. IIP's current schema has no Place/Area node at all — **a gap**.
**URL:** https://opencivicdata.org/

### Google Civic Information API schemas
**Status:** Live Google API. Covers US primarily; limited PH coverage (addresses/geocoding). Representative/election/early-vote-location data.
**Applicability to IIP:** ★☆☆ Low for PH (sparse coverage). Note its schema patterns (Office, Official, Division) overlap Popolo and are less rich. Skip.
**URL:** https://developers.google.com/civic-information

### OpenGovernment.org / INCODE2040
**Status:** Older US-municipal open-data efforts; largely superseded by Popolo/OCD. Minimal current relevance.
**Applicability to IIP:** ★☆☆ Low. Reference only.

---

## 3. Argument & Claim Modeling

This is **the most strategically important category for IIP.** The PRD treats `Claim` and `Evidence` as simple node types with `SUPPORTED_BY` / `REFUTED_BY` edges. Real impeachment analysis is a *structured argument graph* where allegations decompose into sub-claims, evidence supports/undermines at varying strengths, and conclusions follow (or fail) from premises. Four mature models exist; IIP should adopt a hybrid.

### AIF (Argument Interchange Format)
**Status:** Originated 2005 Budapest colloquium, published 2006 (Chesnevar, Modgil, Rahwan, Reed et al., *Knowledge Engineering Review* 21:293–316). AIF-RDF ontology in RDFS. Backed by **AIFdb** (`aifdb.org`) — a live corpus of machine-readable argument graphs. Foundation of the "Argument Web" (Bex, Lawrence, Snaith, Reed, *CACM* 56(10):66–73, 2013).
**What it offers — the node typology IIP should study:**
- **I-nodes** (Information): premises, conclusions, plain claims — *the "atoms" of argument*
- **RA-nodes** (Rule Application): inference rules connecting premises → conclusion ("rule schemes")
- **CA-nodes** (Conflict Application): one node attacks another (the formal structure behind "REFUTED_BY")
- **PA-nodes** (Preference Application): one argument defeats another in cases of conflict
- **F-nodes** (Schematic Forms): patterns instantiating RA/CA/PA (e.g. "expert opinion", "position to know", "witness testimony" — *directly applicable to impeachment witness evaluation*)

**Applicability to IIP:** ★★★★★ Critical. **This is the formal backbone IIP's Claim/Evidence subgraph should follow.** Mapping:
- IIP `Claim` → AIF I-node
- IIP `Evidence` → AIF I-node (a kind of Claim whose premise is "this document/testimony exists and says X")
- IIP `SUPPORTED_BY` / `REFUTED_BY` → AIF RA-node (support) / CA-node (attack) — **but as reified nodes, not bare edges**, because support has a *scheme* (expert? documentary? hearsay-excluded?) and a *strength*
- **New primitive IIP lacks:** PA-node (Preference) — when two pieces of evidence conflict, which wins? Impeachment trials are *precisely* conflict-resolution over competing testimonies. AIF models this; bare `REFUTED_BY` does not.
- AIF's *conflict/scheme* typing lets IIP query "show me all allegations supported solely by hearsay" or "all claims attacked via witness-credibility" — essential analytical affordances.

**URL:** http://www.argumentinterchange.org/ · http://www.aifdb.org · https://en.wikipedia.org/wiki/Argument_Interchange_Format

### IBIS (Issue-Based Information System)
**Status:** Kunz & Rittel, 1970 (UC Berkeley). Mature, simple, widely re-implemented (Compendium software, gIBIS, D-Agree with AI facilitation, Glyma for SharePoint). Underpins dialogue-mapping facilitation method (Conklin, 2006).
**What it offers:** Three node types and a strict grammar:
- **Issue** (a question)
- **Position** (a proposed answer to an Issue)
- **Argument** (pro or con a Position)

Edges: Issue →responds-to→ (anything); Position →responds-to→ Issue; Argument →supports/objects-to→ Position. **Cannot connect Argument↔Issue directly** — forces clarity.

**Applicability to IIP:** ★★★★ High. **IBIS is the right structure for the *deliberation* layer** (what senators/committees/newsrooms are *arguing about*). Impeachment questions are quintessential IBIS Issues: *"Did the respondent commit bribery?"* Positions: *"Yes — proven by COA audit"* / *"No — audit was misinterpreted."* Arguments pro/con hang off Positions. This composes cleanly with AIF (IBIS = the question layer; AIF = the evidence-reasoning layer underneath). IIP should add an **Issue** node type (currently absent from PRD) — it captures *what is contested*, which is more analytically useful than a bare Claim.
**URL:** https://en.wikipedia.org/wiki/Issue-based_information_system

### Toulmin Model
**Status:** Stephen Toulmin, *The Uses of Argument* (1958). Six components:
- **Claim** (conclusion asserted)
- **Ground / Data** (the facts invoked)
- **Warrant** (the rule licensing Data→Claim)
- **Backing** (authority supporting the Warrant)
- **Rebuttal / Reservation** (exceptions)
- **Qualifier** (degree of certainty: "probably", "possibly", "certainly")

**Applicability to IIP:** ★★★★ High. **Originally designed for courtroom argument** — near-perfect domain fit. Map directly onto IIP's Claim nodes:
- IIP Claim.toulmin_claim = headline assertion
- IIP Claim.ground = pointer to Evidence node(s)
- IIP Claim.warrant = the *legal rule* invoked (e.g. "Art. XI §2: betrayal of public trust") — **this is the link to LKIF/EuroVoc norms**
- IIP Claim.backing = authority for the warrant (PH Constitution, jurisprudence ECLI)
- IIP Claim.rebuttal = counter-claim or defense argument (link to opposing IBIS Position)
- IIP Claim.qualifier = **a confidence/strength field — which IIP's PRD partially captures in `relationships.confidence` but not on claims themselves**

**Combine:** Toulmin gives the internal anatomy of one argument; AIF gives the network of arguments; IBIS gives the question they answer. **Adopt all three as layered schemas on a unified Claim node.**
**URL:** https://en.wikipedia.org/wiki/Toulmin_model

### Carneades Argumentation Engine
**Status:** `carneades.com` / GitHub. Implements Toulmin + argumentation schemes + proof standards (scintilla, preponderance, clear-and-convincing, beyond-reasonable-doubt). Defeasible reasoning with argument evaluation.
**Applicability to IIP:** ★★★ Medium. **The *proof-standard* concept is the missing piece for "has this claim been proven?"** IIP should tag each Claim with the applicable proof standard (impeachment is *not* criminal — it does not require "beyond reasonable doubt"; the Senate votes by 2/3 majority on political judgment). Carneades' model of proof standards maps onto this directly. Reuse the *concept*; the engine itself may be heavier than needed.
**URL:** http://carneades.com/

### OVA / Argkit / Argo
**Status:** OVA (Online Visualisation of Argument) and Argo are viewers/editors for AIF graphs. Argkit is a Java implementation. Largely research tools.
**Applicability to IIP:** ★★ Low for runtime; ★★★ Medium for **UI inspiration** — IIP's graph-exploration UI should let users *see* argument attack/support relations the way OVA renders them (color-coded RA/CA nodes).
**URL:** http://www.aifdb.org/argument VIEW OVA

---

## 4. Fact-Check & Provenance Models

### ClaimReview (schema.org)
**Status:** schema.org type, live, **1K–10K domains** using it (Google index, May 2026). Adopted by Google Fact Check, Snopes, PolitiFact, AFP Fact Check, and (critically for PH) **Rappler and Vera Files** — both IFCN-certified.
**What it offers — exact properties:**
- `claimReviewed` (Text — the short claim being checked)
- `itemReviewed` (Thing — usually a CreativeWork or Clip; carries the *original* claim's author, datePublished, and source)
- `reviewRating` (Rating: ratingValue, bestRating, alternateName=verdict-label, image)
- `reviewBody` (Text — the analysis)
- `author` / `publisher` (Organization doing the fact-check)
- `datePublished`, `url`
- `positiveNotes` / `negativeNotes` (recent addition)
- `associatedMediaReview` / `associatedClaimReview` (cross-link media vs claim reviews)

**Applicability to IIP:** ★★★★★ Critical. **This is the ready-made schema for IIP's Claim verdict layer.** When Rappler/Vera Files fact-check a statement by an impeachment actor, IIP should ingest that as a ClaimReview node attached (via `itemReviewed`) to the IIP Speech/Claim that contains the original statement. The `reviewRating.ratingValue` becomes IIP's machine-readable verdict ("False", "Misleading", "True"). **Directly enables:** "show me all statements by respondent that were rated False by IFCN signatories." This is a *first-class analytical signal* — adopting ClaimReview buys IIP instant interoperability with the global fact-check corpus.
**URL:** https://schema.org/ClaimReview

### MediaMeter / GDELT
**Status:** GDELT (`gdeltproject.org`) — massive open database of global news events, updated 15min, free. MediaMeter (MIT Center for Civic Media, Berfeld/Karimi/Narayanan/Halavais 2020) — independent credibility assessment by source/outlet. Both live.
**Applicability to IIP:** ★★★ Medium. **GDELT for ingest breadth** (signal of "who is being talked about and where"), MediaMeter for **outlet-level bias/credibility scoring** to weight sources. GDELT coverage of PH media is imperfect but useful for trend detection.
**URL:** https://www.gdeltproject.org/ · https://mediameter.org/

### PROV-O (W3C Provenance Ontology)
**Status:** W3C Recommendation 30 April 2013. Stable, mature, universally adopted in semantic-web/data-lineage work.
**What it offers — three classes and a small set of relations:**
- **Entity** (anything: a document, a claim, an extracted fact)
- **Activity** (something that occurred over time: an ingestion, a NLP extraction, a human edit)
- **Agent** (Person, Organization, SoftwareAgent — bears responsibility)

Relations: `wasGeneratedBy`, `wasDerivedFrom`, `wasAttributedTo`, `used`, `wasInformedBy`, `wasAssociatedWith`, `actedOnBehalfOf`, `startedAtTime`, `endedAtTime`. Plus **qualified forms** with `hadRole`, `hadPlan`, `atLocation` — these let you say *"Agent Derek, in role=fact-checker, under Plan=IIP-Review-v3, generated Entity E2 derived from Entity E1 at 2026-06-19T14:00+08:00"*. Sub-properties: `wasQuotedFrom`, `hadPrimarySource`, `wasRevisionOf`, `alternateOf`, `specializationOf`.

**Applicability to IIP:** ★★★★★ Critical. **PROV-O is mandatory infrastructure for IIP's central promise of "evidence-backed, explainable" claims.** Without provenance, every graph edge is an unaccountable assertion. Specific adoptions:
1. Every IIP relationship/triple should carry a PROV-style **qualified attribution** (which Activity, which Agent — human or NLP pipeline — asserted this, when, with what Plan). IIP's `relationships.confidence` field is **necessary but insufficient**: it lacks *who, when, how*.
2. Every IIP Document must trace `wasDerivedFrom` (e.g. a summary derived from a PDF derived from a scanned image of an official filing) — this is the chain that defeats "but where did you get that?" challenges.
3. `wasQuotedFrom` models quotation precisely (which document, which span, which timestamp) — **essential for testimony excerpts that IIP cites as Evidence**. Litigation-grade sourcing demands this.
4. `actedOnBehalfOf` models delegation (a law-firm associate filed on behalf of lead counsel; an NLP extractor ran on behalf of the IIP pipeline) — needed for accountability.

**Gap:** PRD's schema has no provenance layer at all. **Add `provenance` table: {id, entity_id, activity_id, agent_id, role, plan, at_time, used_entity_ids}** following PROV-O's qualification pattern. This is non-optional for a platform whose value proposition is *evidence*.

**URL:** https://www.w3.org/TR/prov-o/

### W3C Credibility / credibility-review specs
**Status:** No widely-adopted standalone W3C "credibility" spec exists beyond PROV-O + ClaimReview. The combination is the de facto standard.
**Applicability to IIP:** Use PROV-O + ClaimReview + IFCN (§7) as the credibility stack.

---

## 5. Civic Tech Knowledge Graph Projects (lessons learned)

### LittleSis (littlesis.org)
**Status:** **Very active.** Operated by Public Accountability Initiative (PAI), a US nonprofit. Free open-source database of "who-knows-who at the heights of business and government." Active research output (reports, news, Map the Power toolkit, trainings, Fossil Fuel Finance Hub). Code on GitHub (`public-accountability/littlesis`). Regular data updates through 2026.
**Entity/relationship model:** Person + Org + (rich) **Relationship** entity with `amount`, `start_date`, `end_date`, `is_current`, `notes`, **and provenance fields: source, source_detail** (URL + description). Relationship *categories*: Position, Education, Membership, Family, Donation, Transaction, Lobbying/Ownership/Professional, Social, Hierarchy, Generic. **Every relationship requires a source citation** — a hard constraint enforced by the platform.
**Lessons for IIP — COPY:**
1. **Relationships are first-class, source-cited entities, not edges.** IIP's `relationships` table (source_entity, target_entity, type, confidence) is too thin — copy LittleSis's `amount`, date-range, `is_current`, and **mandatory source URL + source description**.
2. **The relationship *taxonomy* is battle-tested.** LittleSis's Position/Membership/Ownership/Donation/Transaction categories are exactly what political-power mapping needs. Adopt this typology for IIP's political-financial subgraph (assets, business ties, campaign donations — all relevant to impeachment "betrayal of public trust" / graft grounds).
3. **Community-researcher hybrid model** — volunteer researchers augment staff. IIP's fact-base will benefit from curated volunteer contributions with provenance.

**Lessons — AVOID:** LittleSis's US-centric taxonomy misses parliamentary-vs-presidential distinctions; IIP must localize for PH (Commission on Appointments, Sanggunian, party-list system, dynastic family networks — a uniquely PH dimension that demands a *family-tree* subgraph LittleSis only lightly covers).
**URL:** https://littlesis.org/ · https://littlesis.org/about/

### OpenCorporates / OpenOwnership
**Status:** OpenCorporates (`opencorporates.com`) — largest open company database, active. OpenOwnership (`openownership.org`) — specifically for **beneficial ownership** registers; publishes the Beneficial Ownership Data Standard (BODS), a JSON-LD schema modeling Person→owns/controls→Entity relationships with provenance. The Open Ownership Register (`register.openownership.org`) aggregates beneficial-ownership disclosures.
**Applicability to IIP:** ★★★★ High for the *assets/conflict-of-interest* subgraph. Impeachment grounds often allege concealed assets, shell companies, beneficial ownership. BODS gives IIP a ready schema for "who really owns the company that received the suspicious contract." Adopt BODS as the model for an `Ownership` relationship with `interests[]`, `startDate`, `source`, and the Person/Org `entityType: legalPerson | naturalPerson`.
**URL:** https://www.openownership.org/ · https://standard.openownership.org/

### OCCRP Aleph
**Status:** Actively maintained by OCCRP for cross-border investigative journalism. Aleph is a document-indexing + entity-resolution platform; `ijra` is its entity/relationship layer. Used by hundreds of investigations. (Note: docs.aleph.occrp.org returned transport-error at fetch time — the platform is live at aleph.occrp.org; documentation is at docs.alephdata.org.)
**What it offers:** OCR + entity extraction over leaked/scraped document troves, with a schema for Person/Org/Address/Company/Asset/Document and cross-references. Designed for the *messy reality* of investigative document sets (multilingual, scanned, fragmented).
**Lessons for IIP:** ★★★ Medium. Borrow (a) the document-trove ingestion philosophy (everything is a Document first; entities are extracted and reconciled later), (b) entity-resolution as an explicit, reviewable process (two "Maria R. Santos" mentions may or may not be the same person — model the *match-confidence* explicitly), and (c) the cross-document cross-reference web. **Caution:** Aleph is investigation-centric (per-case silos); IIP needs a single shared graph, so adopt the *model* not the *deployment topology*.
**URL:** https://aleph.occrp.org/ · https://docs.alephdata.org/

### Reuters Connected China
**Status:** Defunct (launched ~2012, sunset). Was a landmark knowledge-graph product mapping China's political leadership transitions. Built on Neo4j, with rich entity/event/timeline visualizations.
**Applicability to IIP:** ★★ Low (product dead) / ★★★★ High (architectural inspiration). **The pattern to copy:** a *temporal* knowledge graph where relationships are dated and the UI lets users scrub through time watching coalitions form/dissolve. For impeachment, "who supported/opposed the respondent over 18 months as evidence accumulated" is exactly this kind of temporal-power-visualization. Document the design from secondary sources; do not depend on the original.

### Graphity / Synaptica (legal KM case studies)
**Status:** Synaptana is a commercial taxonomy/KG consultancy (active). Graphity is a semantic-web app framework. Legal-KM deployments tend to be proprietary and undocumented.
**Applicability to IIP:** ★☆☆ Low. Few public lessons; skip.

### Stanford Policy Visualization / Crow-Ledger
**Status:** Academic / experimental. Crow-Ledger and Stanford policy-viz efforts are research prototypes.
**Applicability to IIP:** ★★ Low. Reference for *visualization patterns* (e.g., adjacency-matrix roll-calls) but no reusable schema.

### Taiwan civic.tech / Audrey Tang (g0v)
**Status:** **Highly active and directly PH-relevant.** g0v.tw is a civic-tech community (audreyt et al.) that has built parliamentary-data tools on **Popolo** — including tools used to track Taiwan's legislature. Audrey Tang's subsequent government role (Minister of Digital Affairs) gave g0v tools real-world testing at national scale.
**Applicability to IIP:** ★★★★★ Critical — **g0v is the closest analog to what IIP wants to be, in Asia, on Popolo, for a legislature.** Study g0v's tools (gov.tw civic tech, the "vTaiwan" deliberation process, and the parliament-tracking projects on Popolo) for: (a) Popolo adaptation for an Asian legislature, (b) community contribution models, (c) deliberation/consensus tooling (vTaiwan's pol.is integration for crowd-sensing public positions). **Audrey Tang's published talks and g0v's open repos are required reading for the IIP team.**
**URL:** https://g0v.tw/ · https://audreyt.org/ · Popolo adoption noted at popoloproject.com

### Brazil Congresso em Foco / LexML Brasil
**Status:** LexML Brasil (2008) — national legal-document standard, **Akoma Ntoso-consistent**, active. Congresso em Foco — independent legislative-journalism outlet, active.
**Applicability to IIP:** ★★★★ High as a **Global-South precedent**. LexML Brazil proves a developing-country legislature can adopt AKN at national scale; Congresso em Foco proves non-government journalism can build an audience around structured legislative analysis. IIP's positioning (independent, structured, PH-focused) maps to Congresso em Foco's; IIP's *document model* should map to LexML's AKN profile. **Reach out / case-study both.**
**URL:** https://www.lexml.gov.br/ · https://www.congressoemfoco.com.br/

---

## 6. Source Credibility Frameworks

### Media Bias/Fact Check (MBFC)
**Status:** Active, widely cited (mbfc.net). Methodology: per-outlet scores on (a) factual reporting (Very High → Very Low → propaganda) and (b) political bias (Left → Right). Heavily used in PH media-literacy contexts.
**Applicability to IIP:** ★★★★ High. **Adopt as a per-source weight on Documents.** Each IIP `documents.source` should carry an `mbfc_factual` and `mbfc_bias` attribute (curated, periodically refreshed). Use these to (a) flag when a Claim's only support is a low-credibility source, (b) enable "bias-balanced" evidence presentation in the UI.
**URL:** https://mediabiasfactcheck.com/methodology/

### Ad Fontes Media
**Status:** Org active; site (adfontesmedia.com) under maintenance at fetch time but the **Media Bias Chart** is the established product. Proprietary methodology; reliability + bias scores per outlet, per article. Used as a complement to MBFC.
**Applicability to IIP:** ★★★ Medium. Alternative/complement to MBFC. Ad Fontes's *article-level* scoring (not just outlet-level) is more granular — useful if IIP can license/access. The bias-chart visualization (2D reliability × bias) is a good UI metaphor for IIP's source-overview dashboard.
**URL:** https://adfontesmedia.com/

### IFCN Code of Principles (International Fact-Checking Network)
**Status:** **Highly active, run by Poynter Institute.** The Code is the global standard for fact-checker credibility. **Crucially: Rappler and Vera Files are IFCN signatories** — both are PH fact-checkers, both publish ClaimReview-tagged articles, and both are directly relevant to impeachment-related claims (Rappler has extensively covered PH political cases).
**What the Code requires** (signatories commit to): non-partisanship, transparent ownership/funding, transparent methodology, sources for every fact check, open corrections policy, paid fact-checkers identified, etc.
**Applicability to IIP:** ★★★★★ Critical. **Treat IFCN signatories as a *tier-1* source class.** IIP should:
1. Maintain a curated list of IFCN-certified PH fact-checkers (Rappler, Vera Files) and ingest their ClaimReview-tagged content as first-class verdicts.
2. Adopt the Code's *transparency principles* in IIP's own methodology page (cite sources, open corrections, declare funders) — this is both ethically correct and strategically necessary for IIP's credibility with journalists/courts.
3. Use IFCN membership as a *trust signal* in PROV-O attribution: Claims sourced from IFCN signatories get a higher default weight.
**URL:** https://ifcncodeofprinciples.poynter.org/

---

## 7. Recommendations: Mapping Standards to IIP's Domain Model (Gap Analysis)

### 7.1 IIP PRD's current primitives (recap)
**Node types:** Person, Organization, Event, Document, Claim, Evidence.
**Relationship types:** FILED, VOTED_FOR, VOTED_AGAINST, SUPPORTED, OPPOSED, TESTIFIED_IN, PARTICIPATED_IN, REFERENCED, RESULTED_IN, SUPPORTED_BY, REFUTED_BY.
**DB schema:** `documents(id,title,url,source,publish_date,content,checksum)`, `entities(id,entity_type,name,metadata)`, `relationships(id,source_entity,target_entity,relationship_type,confidence)`, `ingestion_jobs(...)`.

### 7.2 What to reuse/extend — prioritized

| Priority | Standard | Action |
|---|---|---|
| P0 | **Popolo** | Adopt as Person/Org/Membership/Post/Motion/VoteEvent/Vote/Speech/Event/Area backbone. This is the highest-leverage decision. |
| P0 | **Akoma Ntoso** | Target document-parse structure. Source documents parse to AKN FRBR URNs so sub-document citation is possible. |
| P0 | **PROV-O** | Add provenance layer. Every relationship & extraction gets Activity/Agent/Role/Plan/atTime. Non-optional for "evidence-backed" promise. |
| P0 | **ClaimReview** | Adopt schema.org ClaimReview for fact-check verdict ingestion (Rappler, Vera Files, PolitiFact). |
| P0 | **AIF + Toulmin** | Restructure Claim/Evidence into an argument graph: Claim (I-node) ←RA-node← Evidence (I-node), with CA-nodes for REFUTED_BY, PA-nodes for conflict resolution, Toulmin anatomy (ground/warrant/backing/qualifier) on each Claim. |
| P1 | **ELI** | Adopt identifier-pattern for documents: `/iip/ph/{body}/{doctype}/{congress}/{num}/{ver}` + FRBR Work/Expression/Format split. |
| P1 | **ECLI** | Adopt identifier-pattern for court decisions: `IIPCLI:PH:{court}:{year}:{serial}` + 9 mandatory metadata fields (creator, accessRights, language, type, references…). Expand IIP's thin `documents` table. |
| P1 | **EuroVoc (SKOS)** | Build PH-localized concept taxonomy (keyed to Art. XI §2 grounds) for tagging Documents/Claims/Evidence. SKOS structure (broader/related/narrower). |
| P1 | **OCD-ID** | Add Place/Area node (`ocd-division/country:ph/...`) for geographic queries. |
| P1 | **BODS (OpenOwnership)** | Add Ownership relationship with interests[] for assets/conflict-of-interest subgraph. |
| P1 | **IFCN Code** | Tier-1 source class; ingest Rappler/Vera Files ClaimReview feeds; adopt transparency principles for IIP itself. |
| P2 | **LittleSis relationship taxonomy** | Borrow Position/Membership/Ownership/Donation/Transaction categories for political-financial subgraph. |
| P2 | **Wikidata** | Reconciliation layer (P39, P102, etc.); seed Person/Org data with `wikidata_id`. |
| P2 | **MBFC / Ad Fontes** | Per-source credibility/bias weights on Document nodes. |
| P2 | **IBIS** | Add Issue node for the *deliberation/question* layer (what's contested). |
| P3 | **LKIF Core** | Conceptual reference for norm-violation pattern (Claim ↔ breached Norm). Don't import full OWL-DL. |
| P3 | **Carneades proof standards** | Tag Claims with applicable proof standard (preponderance / clear-and-convincing / 2-3 Senate vote). |
| P3 | **LegalRuleML** | Defer; revisit only if adding automated norm-reasoning. |
| P3 | **g0v / LexML Brazil** | Study as Global-South/Asian Popolo & AKN precedents. |

### 7.3 Where IIP's primitives are insufficient — concrete gaps

**Gap 1 — `Event` is overloaded.** PRD lumps Hearings / Votes / Filings / Court Decisions into one `Event` type. **Fix:** split per Popolo into `Motion` (the Articles of Impeachment itself, as a proposal), `VoteEvent` (a roll-call — first-class, with `result`), `Speech` (who-said-what in a hearing, with text + time offsets), and `Event` (generic: filing, press-conference, court ruling). A `Vote` (individual senator's choice) is its own node linking Person↔VoteEvent. Without this split, senator roll-call analytics (an explicit IIP goal) cannot be expressed.

**Gap 2 — No `Membership`.** A bare Person↔Organization edge loses *which role, which dates, which party, which district, which Congress*. **Fix:** reified Membership node (Popolo): {person, organization, role, start_date, end_date, on_behalf_of=party, area, legislative_period}. Essential for "was Senator X in committee Y on date Z?" queries.

**Gap 3 — No `Issue`/`Question` node.** Claims without an Issue they answer lose analytical traction. **Fix:** add IBIS Issue node. An allegation ("respondent committed bribery") is a Position responding to an Issue ("did the respondent commit an impeachable offense?"). This makes the graph queryable by *what is contested*, not just *what is asserted*.

**Gap 4 — `Claim` and `Evidence` are too flat.** They need internal anatomy. **Fix:** adopt Toulmin on Claim (ground/warrant/backing/qualifier/rebuttal) and AIF for the support/attack network. `SUPPORTED_BY`/`REFUTED_BY` must become *reified relation nodes* (AIF RA-node / CA-node) carrying scheme + strength, not bare edges.

**Gap 5 — No provenance layer.** `relationships.confidence` is a number with no *who/how/when*. **Fix:** PROV-O qualified attribution on every triple. Add `provenance(id, entity_id, activity_id, agent_id, role, plan, at_time, used_entity_ids, source_url, source_description)`. **This is the single most important schema addition for IIP's credibility.**

**Gap 6 — No `Place`/`Area` node.** Geographic queries impossible. **Fix:** OCD-ID-addressed Area nodes.

**Gap 7 — No `Ownership` relationship.** Cannot represent assets/conflicts — central to graft/bribery impeachment grounds. **Fix:** BODS-modeled Ownership with interests[], dates, source.

**Gap 8 — No `Quotation` primitive.** PROV-O's `wasQuotedFrom` and AKN's `<quote>` element model "this sentence in this document is a verbatim quote of that sentence in that other document." Critical for testimony excerpts. **Fix:** Quotation as a reified relationship carrying source-document + source-span + extracted-text.

**Gap 9 — No `Time`/`Temporal` modeling beyond `publish_date`.** Impeachment is *deeply temporal*: when was the alleged act? when first reported? when charged? when voted? **Fix:** every node should support `valid_from`/`valid_to` (Popolo's date ranges) and `at_time` (PROV-O). Add a `Timeline` view keyed on these.

**Gap 10 — `documents` table too thin.** Missing creator/author, accessRights, language, doc-type, jurisdiction, references-to-other-docs. **Fix:** expand per ECLI mandatory metadata + ELI `type_document`/`jurisdiction`/`date_document`/`first_date_entry_into_force`/`changes`/`repeals`/`cites`.

**Gap 11 — No source-credibility attributes.** **Fix:** `documents.source` → expand to source entity with `mbfc_factual`, `mbfc_bias`, `ifcn_certified`, `ownership_transparency` fields.

**Gap 12 — No family/dynasty dimension.** PH politics is uniquely dynastic. **Fix:** add `family` relationships (parent/child/sibling/spouse) per Person, plus `Family` node for clan-level analysis. Not in Popolo/LittleSis core; this is a **PH-specific extension**.

### 7.4 Argumentation/claim-network patterns IIP should adopt

1. **Layered schema on a unified Claim node:** IBIS Issue (question) ← Position (answer) ← Toulmin anatomy (claim/ground/warrant/backing/qualifier/rebuttal) ← AIF network (I-nodes/RA-nodes/CA-nodes/PA-nodes). One node type, richly typed, queryable at every layer.
2. **Conflict-resolution is a node, not an edge.** When two testimonies contradict, the *contradiction* is a CA-node that can itself be resolved by a PA-node ("credibility of witness A established by prior perjury conviction"). This lets IIP answer *"which unresolved contradictions remain in the case?"* — a powerful investigative affordance.
3. **Evidence = Claim-with-source.** Don't separate Evidence from Claim. An Evidence node is just a Claim whose ground is "this primary document exists and contains text X" (PROV-O `hadPrimarySource` + AKN sub-document citation). This unifies the model.
4. **Proof standards are metadata.** Tag each top-level allegation with its Carneades proof standard (impeachment = "preponderance supported by 2/3 Senate vote" — neither criminal beyond-reasonable-doubt nor civil preponderance). Lets IIP honestly say "allegation X is *not* proven to criminal standard but *is* sufficient for impeachment."
5. **Verdict ingestion via ClaimReview.** Every Rappler/Vera Files fact-check becomes a ClaimReview node attached (via `itemReviewed`) to the IIP Speech/Claim containing the original statement. The `reviewRating.ratingValue` is the machine-readable verdict.

### 7.5 Minimal viable adoption for v1 (if forced to prioritize)

If IIP can adopt only five things for an MVP that still respects the standards landscape:
1. **Popolo** entity model (Person/Org/Membership/Post/Motion/VoteEvent/Vote/Speech/Event/Area).
2. **PROV-O** provenance layer on every assertion.
3. **ClaimReview** for fact-check verdicts + **IFCN tier-1 sources**.
4. **Toulmin anatomy** on Claim + **AIF RA/CA reified relations** (drop PA-nodes and IBIS Issues to v2 if needed).
5. **ECLI-style identifiers + expanded document metadata** (creator, accessRights, language, type, references).

Everything else (ELI URI scheme, AKN full parse, EuroVoc taxonomy, BODS ownership, Carneades proof standards, MBFC weights, Wikidata reconciliation) can layer on top without schema rewrites, *provided* the v1 schema uses reified-relationship + provenance-qualified patterns from day one.

---

## Appendix — Source URLs (verified 2026-06-19)

**Legal core:**
- LKIF Core: https://github.com/RinkeHoekstra/lkif-core
- EuroVoc: https://op.europa.eu/en/web/eu-vocabularies/dataset/-/resource?uri=http://publications.europa.eu/resource/dataset/eurovoc
- ELI: https://eur-lex.europa.eu/eli-register/ · ELI ontology: https://op.europa.eu/en/web/eu-vocabularies/eli
- ECLI: https://e-justice.europa.eu/content_european_case_law_identifier_ecli-175-en.do · Search: https://e-justice.europa.eu/content_ecli_search_engine-430-en.do
- Akoma Ntoso / LegalDocML: https://www.oasis-open.org/committees/tc_home.php?wg_abbrev=legaldocml
- LegalRuleML: https://wiki.oasis-open.org/legalruleml/

**Political/parliamentary:**
- Popolo: https://www.popoloproject.com/ · specs: https://www.popoloproject.com/specs/
- Open Civic Data / OCD-ID: https://opencivicdata.org/
- Council Data Project: https://councildataproject.org/
- Wikidata politics: https://www.wikidata.org/wiki/Wikidata:WikiProject_Politics

**Argumentation:**
- AIF: http://www.argumentinterchange.org/ · AIFdb: http://www.aifdb.org
- IBIS: https://en.wikipedia.org/wiki/Issue-based_information_system · Compendium: https://compendium.open.ac.uk/
- Toulmin: https://en.wikipedia.org/wiki/Toulmin_model
- Carneades: http://carneades.com/

**Fact-check & provenance:**
- ClaimReview: https://schema.org/ClaimReview
- PROV-O: https://www.w3.org/TR/prov-o/
- GDELT: https://www.gdeltproject.org/ · MediaMeter: https://mediameter.org/

**Civic tech KG:**
- LittleSis: https://littlesis.org/ · code: https://github.com/public-accountability/littlesis
- OpenCorporates: https://opencorporates.com/ · OpenOwnership/BODS: https://standard.openownership.org/ · Register: https://register.openownership.org/
- OCCRP Aleph: https://aleph.occrp.org/ · docs: https://docs.alephdata.org/
- g0v (Taiwan): https://g0v.tw/ · Audrey Tang: https://audreyt.org/
- LexML Brasil: https://www.lexml.gov.br/ · Congresso em Foco: https://www.congressoemfoco.com.br/

**Source credibility:**
- MBFC: https://mediabiasfactcheck.com/methodology/
- Ad Fontes Media: https://adfontesmedia.com/
- IFCN Code of Principles: https://ifcncodeofprinciples.poynter.org/ (signatories incl. Rappler, Vera Files)

---

*End of report. Complements the domain research in `domain-philippine-impeachment-intelligence-political-knowledge-graphs-research-2026-06-19.md` (which covers PH impeachment process, sources, and legal mechanics). This report focuses on representational standards for the knowledge graph itself.*
