# Graph Report - .  (2026-06-22)

## Corpus Check
- 52 files · ~186,722 words
- Verdict: corpus is large enough that graph structure adds value.

## Summary
- 178 nodes · 197 edges · 37 communities (16 shown, 21 thin omitted)
- Extraction: 85% EXTRACTED · 15% INFERRED · 0% AMBIGUOUS · INFERRED: 30 edges (avg confidence: 0.79)
- Token cost: 0 input · 0 output

## Community Hubs (Navigation)
- [[_COMMUNITY_UX Experience & User Flows|UX Experience & User Flows]]
- [[_COMMUNITY_Market & Business Research|Market & Business Research]]
- [[_COMMUNITY_Evidence & Trust Framework|Evidence & Trust Framework]]
- [[_COMMUNITY_Ingestion & Deterministic Projection|Ingestion & Deterministic Projection]]
- [[_COMMUNITY_Core IIP & Citation Components|Core IIP & Citation Components]]
- [[_COMMUNITY_Epics & Sprint Planning|Epics & Sprint Planning]]
- [[_COMMUNITY_Security & Chaos Scenarios|Security & Chaos Scenarios]]
- [[_COMMUNITY_Legal Standards & Ontologies|Legal Standards & Ontologies]]
- [[_COMMUNITY_Trust Badges & Claims|Trust Badges & Claims]]
- [[_COMMUNITY_Cyberlibel & Editorial Control|Cyberlibel & Editorial Control]]
- [[_COMMUNITY_BMAD Modules & Tooling|BMAD Modules & Tooling]]
- [[_COMMUNITY_Local LLM Models|Local LLM Models]]
- [[_COMMUNITY_Citation Decoupling|Citation Decoupling]]
- [[_COMMUNITY_Evaluation Harness|Evaluation Harness]]
- [[_COMMUNITY_Adversary Threats & Security|Adversary Threats & Security]]
- [[_COMMUNITY_Citation Tools|Citation Tools]]
- [[_COMMUNITY_Source Verb UX|Source Verb UX]]
- [[_COMMUNITY_Citation Quality Boundaries|Citation Quality Boundaries]]
- [[_COMMUNITY_Queue & Orchestration Tech|Queue & Orchestration Tech]]
- [[_COMMUNITY_Runner Isolation|Runner Isolation]]
- [[_COMMUNITY_PD2 KPI Concept|PD2 KPI Concept]]
- [[_COMMUNITY_Continuous Gating|Continuous Gating]]
- [[_COMMUNITY_Fusion Router|Fusion Router]]
- [[_COMMUNITY_Corrective RAG|Corrective RAG]]
- [[_COMMUNITY_Idempotent Upsert|Idempotent Upsert]]
- [[_COMMUNITY_Turborepo|Turborepo]]
- [[_COMMUNITY_Cytoscape.js|Cytoscape.js]]
- [[_COMMUNITY_Caddy|Caddy]]
- [[_COMMUNITY_Ollama|Ollama]]
- [[_COMMUNITY_Redis|Redis]]
- [[_COMMUNITY_React Query|React Query]]
- [[_COMMUNITY_Zustand|Zustand]]
- [[_COMMUNITY_shadcnui|shadcn/ui]]
- [[_COMMUNITY_Qwen3-14B|Qwen3-14B]]
- [[_COMMUNITY_Docling OCR Pipeline|Docling OCR Pipeline]]
- [[_COMMUNITY_Tailwind CSS v4|Tailwind CSS v4]]
- [[_COMMUNITY_WCAG 2.1 AA|WCAG 2.1 AA]]

## God Nodes (most connected - your core abstractions)
1. `EXPERIENCE.md — Impeachment Watch Experience Spine` - 18 edges
2. `Internal-First PRD` - 17 edges
3. `DESIGN.md — Impeachment Watch Visual Identity Spine` - 14 edges
4. `Epic Breakdown` - 10 edges
5. `Architecture Decision Document` - 8 edges
6. `Domain Research: Knowledge Representation Standards` - 8 edges
7. `Project Context for AI Agents` - 8 edges
8. `Domain Research: PH Sources & Document Formats` - 7 edges
9. `AC-2 Fail-Closed Render Gate` - 6 edges
10. `Apache AGE (openCypher in Postgres)` - 6 edges

## Surprising Connections (you probably didn't know these)
- `Internal-First PRD` --references--> `Enterprise PRD (North Star)`  [EXTRACTED]
  _bmad-output/planning-artifacts/prds/prd-impeachment-watch-2026-06-19/prd.md → Enterprise_PRD_Impeachment_Intelligence_Platform.md
- `Reconciliation: Enterprise PRD` --references--> `Enterprise PRD (North Star)`  [EXTRACTED]
  _bmad-output/planning-artifacts/prds/prd-impeachment-watch-2026-06-19/reconcile-enterprise-prd.md → Enterprise_PRD_Impeachment_Intelligence_Platform.md
- `VERA Files SEEK (closest competitor)` --semantically_similar_to--> `Impeachment Intelligence Platform (IIP)`  [INFERRED] [semantically similar]
  _bmad-output/planning-artifacts/research/market-competitive-landscape-2026-06-19.md → _bmad-output/planning-artifacts/prds/prd-impeachment-watch-2026-06-19/prd.md
- `Citation-or-Silence Invariant (EI-1)` --implements--> `AC-2 Fail-Closed Render Gate`  [INFERRED]
  _bmad-output/planning-artifacts/prds/prd-impeachment-watch-2026-06-19/prd.md → _bmad-output/planning-artifacts/architecture.md
- `Quote-Existence Validation (EI-6)` --semantically_similar_to--> `NLI Entailment Gate`  [INFERRED] [semantically similar]
  _bmad-output/planning-artifacts/prds/prd-impeachment-watch-2026-06-19/prd.md → _bmad-output/planning-artifacts/architecture.md

## Hyperedges (group relationships)
- **Citation-Provenance Chain (ingest→store→verify→render→UI)** — concept_citation_decoupled, concept_sc2_citation_pkg, concept_fail_closed_render, concept_hnsw_embedding_swap [EXTRACTED 1.00]
- **Pre-External Presentation Gate (corpus freeze + adversarial + legal)** — concept_pre_external_gate, concept_sc7_gate_artifact_store, concept_cyberlibel, concept_pd1_essence [EXTRACTED 0.95]
- **Single PostgreSQL System of Record (relational + vector + graph)** — tech_postgres16, tech_pgvector, tech_apache_age, tech_drizzle [EXTRACTED 0.95]
- **Editorial Integrity Surface — the regulated-leaning core (EI-1 through EI-8)** — ux_citation_or_silence, ux_fact_vs_claim, ux_source_verb_preservation, ux_trust_tiers, ux_no_oversell, ux_supersession, concept_provenance_chain [EXTRACTED 1.00]
- **Tiered Graph Rendering Architecture (one shell, three+ renderers via tier-router)** — tier_router, renderer_cytoscape, renderer_sigma, renderer_react_flow, renderer_cosmograph [EXTRACTED 1.00]
- **Citation Verification Pipeline (generate → span-model → NLI gate → render)** — tool_anthropic_citations_api, concept_akoma_ntoso_uris, tool_nli_deberta, component_citation_compound, concept_provenance_chain [INFERRED 0.90]

## Communities (37 total, 21 thin omitted)

### Community 0 - "UX Experience & User Flows"
Cohesion: 0.09
Nodes (32): Provenance drill-down (assertion → chip → modal → document → raw), DESIGN.md — Impeachment Watch Visual Identity Spine, EXPERIENCE.md — Impeachment Watch Experience Spine, Flow 1 — Maya Reyes, investigative journalist (case spine), Flow 2 — Renz Aquino, political-risk analyst (actor spine), Critical — three sources: paths broken in EXPERIENCE.md frontmatter, Critical — spacing.20/spacing.24 undefined in DESIGN.md frontmatter, Mockup — /chat Sourced Answer + Silence (+24 more)

### Community 1 - "Market & Business Research"
Cohesion: 0.11
Nodes (20): Impeachment Intelligence Platform (IIP), Market Research: Business Models & Funding, Market Research: Competitive Landscape, Industry Research: Civic-Tech Legal Platforms, Domain Research: Political Knowledge Graphs, Domain Research: PH Impeachment Mechanics, Domain Research: PH Sources & Document Formats, PH Constitution Article XI (Accountability of Public Officers) (+12 more)

### Community 2 - "Evidence & Trust Framework"
Cohesion: 0.18
Nodes (17): Citation-or-Silence Invariant (EI-1), Conservative Entity Merge (EI-5), Honest Evidence Split (EI-7 / D-015), PD-1 Essence Sentence, Source Trust Tiers (1 primary → 3 aggregator), PRD Addendum, Architecture Decision Document, PRD Decision Log (+9 more)

### Community 3 - "Ingestion & Deterministic Projection"
Cohesion: 0.14
Nodes (16): Deterministic Graph Projection (FR-2.4), NPC Advisory 2026-01 (Data Scraping Guidelines, PH), Tiered Ingestion Pipeline (5 tiers with provenance tags), Open Item — bge-m3 serving path unspecified (TEI/vLLM/sidecar), bge-m3 (dense-only embeddings, 1024-dim), CRAG correction node (correct/incorrect/ambiguous), HippoRAG (multi-hop personalized PageRank memory), Reciprocal Rank Fusion (default retriever fusion) (+8 more)

### Community 4 - "Core IIP & Citation Components"
Cohesion: 0.24
Nodes (11): <Citation> compound component (Chip/Modal/Empty), Sara Duterte Impeachment (single-case v1), Impeachment Watch (IIP — Impeachment Intelligence Platform), Project Context for AI Agents, Cosmograph (millions of nodes, WebGPU), Cytoscape.js 3.34 (default graph renderer, Canvas 2D), React Flow v12 (argument editor, <2K nodes), Sigma.js + graphology (5K–100K nodes, WebGL) (+3 more)

### Community 5 - "Epics & Sprint Planning"
Cohesion: 0.38
Nodes (10): Epic Breakdown, Sprint Status YAML, Epic 1: Foundation, Epic 2: Provenance & Invariants, Epic 3: Source Onboarding & Ingestion, Epic 4: Extraction & Knowledge Graph, Epic 5: Investigative Query & Evidence, Epic 6: Graph Exploration (+2 more)

### Community 6 - "Security & Chaos Scenarios"
Cohesion: 0.29
Nodes (8): AC-2 Fail-Closed Render Gate, NLI Entailment Gate, SC-3 Render ESLint Boundary, SC-6 Chaos Suite (500 RPS Citation Invariant), SEC-1 Per-Issued JWT Auth, SEC-8 Red-Team + Mutation Suite, Quote-Existence Validation (EI-6), Fastify 5.x API

### Community 7 - "Legal Standards & Ontologies"
Cohesion: 0.32
Nodes (8): Domain Research: Knowledge Representation Standards, Akoma Ntoso (LegalDocML OASIS standard), ECLI (European Case Law Identifier), ELI (European Legislation Identifier), EuroVoc (multilingual legal/political thesaurus), LKIF Core (Legal Knowledge Interchange Format), Popolo (legislative data interchange spec), Wikidata (political schema seed/reconciliation)

### Community 8 - "Trust Badges & Claims"
Cohesion: 0.40
Nodes (5): <Claim> component (fact/attributed/dashed variants), Trust Badge (verified/contradicted/caution — icon+label+color), High — fact-vs-claim distinction not programmatically conveyed, Fact-vs-Claim distinction (EI-2 — P0 defect if allegation stated as fact), Trust Tiers (verified/contradicted/caution — structural graph property)

### Community 9 - "Cyberlibel & Editorial Control"
Cohesion: 0.40
Nodes (5): Cyberlibel/Republication Liability (RA 10175 §4(c)(4), Disini), AC-11 Editorial Workflow as Control Plane, Pre-External Presentation Gate (PD-3), SC-7 Gate Artifact Store, SEC-6 Hash-Chained Externally-Witnessed Editorial Log

### Community 10 - "BMAD Modules & Tooling"
Cohesion: 0.40
Nodes (5): BMad Module — bmb (BMad Builder, v2.0.0), BMad Module — core (v6.8.0, built-in), BMad Module — tea (Test Architecture Enterprise, v1.19.0), BMad Module — wds (WDS Expansion, v0.4.3), BMad Module Manifest (v6.8.0)

### Community 11 - "Local LLM Models"
Cohesion: 0.50
Nodes (4): Claude Sonnet (cloud verification, high-stakes), Qwen3-14B (local primary LLM, thinking mode), Qwen3-30B-A3B (bulk throughput MoE), GLiNER + RelEx (schema-constrained extraction)

### Community 12 - "Citation Decoupling"
Cohesion: 0.67
Nodes (3): AC-4 Citation-Provenance-Decoupled Schema, D4 HNSW Maintenance + Embedding Swap, SC-2 packages/citation

### Community 13 - "Evaluation Harness"
Cohesion: 0.67
Nodes (3): Evaluation Harness (8th Architectural Plane, AC-1), SC-1 Polyglot Eval (subprocess), Vitest 2.x + Testcontainers + Playwright

### Community 14 - "Adversary Threats & Security"
Cohesion: 0.67
Nodes (3): AC-10 Adversary Threat Model (Subject/Surrogate), SEC-2 Two-Person Intake State Machine, SEC-3 Provenance at Ingest

### Community 15 - "Citation Tools"
Cohesion: 0.67
Nodes (3): Akoma Ntoso fragment URIs (durable legal citation layer), Anthropic Citations API (custom-content documents), DeBERTa-v3-mnli-fever NLI gate (≥0.6 entailment)

## Knowledge Gaps
- **86 isolated node(s):** `AC-11 Editorial Workflow as Control Plane`, `AC-10 Adversary Threat Model (Subject/Surrogate)`, `Conservative Entity Merge (EI-5)`, `Fact-vs-Claim Boundary (EI-2)`, `Honest Evidence Split (EI-7 / D-015)` (+81 more)
  These have ≤1 connection - possible missing edges or undocumented components.
- **21 thin communities (<3 nodes) omitted from report** — run `graphify query` to explore isolated nodes.

## Suggested Questions
_Questions this graph is uniquely positioned to answer:_

- **Why does `Apache AGE (openCypher in Postgres)` connect `Ingestion & Deterministic Projection` to `Evidence & Trust Framework`, `Core IIP & Citation Components`?**
  _High betweenness centrality (0.273) - this node is a cross-community bridge._
- **Why does `Internal-First PRD` connect `Evidence & Trust Framework` to `Market & Business Research`, `Ingestion & Deterministic Projection`, `Epics & Sprint Planning`, `Cyberlibel & Editorial Control`?**
  _High betweenness centrality (0.271) - this node is a cross-community bridge._
- **Why does `Project Context for AI Agents` connect `Core IIP & Citation Components` to `Ingestion & Deterministic Projection`?**
  _High betweenness centrality (0.260) - this node is a cross-community bridge._
- **What connects `AC-11 Editorial Workflow as Control Plane`, `AC-10 Adversary Threat Model (Subject/Surrogate)`, `Conservative Entity Merge (EI-5)` to the rest of the system?**
  _86 weakly-connected nodes found - possible documentation gaps or missing edges._
- **Should `UX Experience & User Flows` be split into smaller, more focused modules?**
  _Cohesion score 0.09475806451612903 - nodes in this community are weakly interconnected._
- **Should `Market & Business Research` be split into smaller, more focused modules?**
  _Cohesion score 0.10526315789473684 - nodes in this community are weakly interconnected._
- **Should `Ingestion & Deterministic Projection` be split into smaller, more focused modules?**
  _Cohesion score 0.14166666666666666 - nodes in this community are weakly interconnected._