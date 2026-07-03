---
stepsCompleted: [1, 2, 3, 4]
inputDocuments:
  - _bmad-output/planning-artifacts/prds/prd-impeachment-watch-2026-06-19/prd.md
  - _bmad-output/planning-artifacts/prds/prd-impeachment-watch-2026-06-19/addendum.md
  - _bmad-output/planning-artifacts/architecture.md
  - _bmad-output/planning-artifacts/ux-designs/ux-impeachment-watch-2026-06-19/DESIGN.md
  - _bmad-output/planning-artifacts/ux-designs/ux-impeachment-watch-2026-06-19/EXPERIENCE.md
---

# Impeachment Watch - Epic Breakdown

## Overview

This document provides the complete epic and story breakdown for Impeachment Watch, decomposing the requirements from the PRD, UX Design if it exists, and Architecture requirements into implementable stories.

## Requirements Inventory

### Functional Requirements

**FG1 — Intelligence ingestion & provenance (operator)**

- FR-1.1: Source registry — register and configure sources by type (government, court, media, press release, transcript) and crawl strategy (rss, sitemap, list page, api, manual), with a trust tier (1 primary → 3 aggregator) that is assigned and confirmed (source-authenticity validated) and that feeds evidence reliability and the citation-quality floor (EI-8).
- FR-1.2: Lawful-access gate — confirm a source is public and lawfully accessible before automating it. Sources behind paywalls/logins/CAPTCHAs or whose terms forbid scraping are disabled, never bypassed. Robots directives are respected.
- FR-1.3: Discover, fetch, deduplicate — discover URLs per strategy; fetch and clean HTML/PDF to text; deduplicate by content checksum so the same document ingested twice is processed once.
- FR-1.4: Immutable raw snapshots — store an immutable raw snapshot of every fetched document for provenance, replay, and audit.
- FR-1.5: Per-artifact provenance — every extracted entity, relationship, claim, and piece of evidence records its source document and character span. Nothing exists without a source pointer.
- FR-1.6: Idempotent, observable ingestion — ingestion jobs are idempotent (re-running is safe), observable (status, throughput), and resilient (per-job retry with capped backoff; dead-letter queue with typed errors for triage).
- FR-1.7: Operator triage surface — operators can view failed/dead-lettered jobs and reprocess after fix; can spot-check extraction output against source text.

**FG2 — Extraction & knowledge graph (operator)**

- FR-2.1: Schema-validated extraction — extract entities, relationships, claims, and evidence as versioned, schema-validated structured output. A change in extractor version is recorded for provenance. Every extracted quote is substring-validated at extraction time; hallucinated quotes are dropped before storage and counted (EI-6).
- FR-2.2: Claim & evidence modeling — capture claim type (allegation, counterclaim, denial, factual assertion), stance (pro/anti/neutral), and verification status. Actively extract evidence relations — supports, refutes, contextualizes — for each claim, with a refutes-recall floor (NFR-EI-5). The platform does not passively wait for refutation edges; it prompts for them.
- FR-2.3: Conservative entity resolution — resolve entities via normalized-key exact match, then fuzzy candidate matching, then disambiguation. When uncertain, do not merge (EI-5). Duplicates are acceptable; wrong merges are not.
- FR-2.4: Deterministic graph projection — project canonical entities and relationships into a navigable graph. The graph is a derived projection of the canonical relational data (not of raw extractions). Dropping the graph and replaying the relational tables reproduces an isomorphic graph.
- FR-2.5: Fact-vs-claim tagging & verb preservation — tag every assertion as fact or attributed claim per the EI-2 boundary rule (100% of served assertions); preserve source verbs verbatim (EI-3, within its v1 scope limit).

**FG3 — Investigative query & evidence (consumer)**

- FR-3.1: Natural-language Q&A with citation-or-silence — accept a natural-language question; return an answer where every factual assertion carries ≥1 citation, or return "no sourced answer" (EI-1). There is no uncited-answer path.
- FR-3.2: Anti-hallucination gate — mechanically substring-validate every cited quote against its source chunk at extraction and again at serving (EI-6). Quotes that cannot be located are discarded at either stage.
- FR-3.3: Intent-aware retrieval — detect question intent (factual lookup, entity listing, evidence-for-claim, timeline, comparison) and retrieve via a hybrid of graph traversal and semantic similarity. All 5 intent types detectable on the eval fixture with ≥80% accuracy; unrecognized intent falls back to factual lookup with a logged signal.
- FR-3.4: Evidence explorer (honest split) — for any claim, surface supporting, refuting, and contextualizing evidence together, each linking to its source at the exact passage, with each item's trust tier visible. When only one side was found, render the explicit one-sided empty-state. Never a silently empty refutes tab.
- FR-3.5: Interactive graph explorer — expand entity neighborhoods one hop at a time, filter by entity/relationship type, with capped, performant rendering for large subgraphs. Render bound: first paint < 2s for ≤500 nodes; web-worker layout for graphs exceeding 200 nodes.

**FG4 — Temporal & entity views (consumer)**

- FR-4.1: Timeline explorer — present dated events at day/week/month/year granularity, with date precision recorded (a "March 2026" event is not shown as "March 1, 2026").
- FR-4.2: Senator / entity dashboard (early view) — for a person/entity (e.g., a senator), surface statements, votes, and participation (all cited). v1 read-model fields: statements (with source + date), votes (with position + date), participation (hearings attended, roles held). Full dashboard deferred to Phase 2.

**FG5 — Editorial integrity surface (cross-cutting)**

- FR-5.1: Inline citation rendering — every factual assertion in any answer renders an inline, clickable citation linking to source.
- FR-5.2: Visual claim distinction — attributed claims are visually distinct from established facts everywhere they appear.
- FR-5.3: No-evidence empty state — when retrieval yields no sourced answer, render an explicit "No sourced answer found" state. Never a fabricated or hedged guess.
- FR-5.4: Honest non-claims — the platform must not imply consistency, verification, or truth where it has not established it.
- FR-5.5: Pre-external editorial & legal gate — no content may be shown to any audience outside the build team until a named human editorial owner has signed off on the demo corpus + curated answer samples AND a cyberlibel/republication-aware legal review has cleared them. The gate is recorded.
- FR-5.6: Citation-quality display — the trust tier of every citation is visible to the user; low-tier / single-source allegations about named persons carry an explicit marker (EI-8).
- FR-5.7: Retraction / correction hook — when a cited source is later corrected or retracted, the platform records the supersession against the stored snapshot and flags affected served answers. Flag renders as visible retraction badge, operator alert, and serving suppression for assertions whose only source has been retracted.

### NonFunctional Requirements

**Editorial integrity (cross-cutting quality bar)**

- NFR-EI-1: Citation coverage on served factual assertions: 100%.
- NFR-EI-2: Allegation-as-fact incidents in served answers: 0 (P0 on any occurrence).
- NFR-EI-3: Merge-error rate (incorrect entity merges): target ≈0, prioritized over duplicate rate. Measured on held-out entity-resolution eval set with ground-truth labels. Duplicate rate bounded.
- NFR-EI-4: Every served assertion resolves to a stored raw snapshot + character span: 100%.
- NFR-EI-5: Refutes-edge recall floor: extracted refuting/contextualizing evidence recalled on ≥70% of claims where such evidence exists. Fixture authored/double-annotated by independent reviewer. Stretch ≥80% on adversarial subset.
- NFR-EI-6: Answer rate on legitimate questions must not collapse to hit 100% citation. Maintain recall/answer-rate floor; "I don't know" must be correct, not convenient.
- NFR-EI-7: Fact/claim tag coverage on served assertions: 100% (hard gate before serving — ensures a tag exists).
- NFR-EI-7a: Fact/claim tag correctness on served assertions: sampled audit on non-curated live queries, with correctness floor and named owner.
- NFR-EI-8: Citation-quality floor (EI-8): lone tier-3 allegation about a named person never served as established; corroboration signal defined per EI-8.

**Performance**

- NFR-P-1: Query latency p95 < 10s end-to-end; p50 < 3s goal.
- NFR-P-2: Ingestion throughput ≥ a few hundred documents/hour on a single node (extraction-bound).
- NFR-P-3: Graph neighborhood queries return within hop/count caps to bound traversal cost.

**Security & access**

- NFR-S-1: v1 API is read-only public; no user write endpoints exposed. Ingestion is internal-only.
- NFR-S-2: All inputs validated; all database/graph queries parameterized; entity IDs from user input validated as UUIDs. No string-built queries.
- NFR-S-3: Per-IP rate limiting on query endpoints (429 with Retry-After); payload-size caps.
- NFR-S-4: Secrets via environment only, never committed; process refuses to start on invalid configuration.
- NFR-S-5: Raw object store is private; only derived public-sourced content is on the serving path.

**Legal, ethical & compliance**

- NFR-L-1: Ingest only public, lawfully accessible material. Respect robots directives and source terms; disable, never bypass.
- NFR-L-2: Philippine Data Privacy Act of 2012 posture: v1 ingests only already-public political/government material about public figures. DPA posture review part of Pre-External Presentation Gate.
- NFR-L-3: Libel / cyberlibel posture (hard gate): before any external presentation, a cyberlibel- and republication-aware legal review clears demo corpus + answer samples. Defines retraction/correction handling.
- NFR-L-4: Retention of raw snapshots and superseded extractor versions: policy TBD — affects storage sizing and right-to-be-forgotten boundary.
- NFR-L-5: Retraction/correction handling: when source corrected or retracted, supersession recorded and affected served answers flagged. Exact retention/takedown workflow defined by legal review.

**Provenance, auditability & reproducibility**

- NFR-A-1: Every served fact traces to a stored raw snapshot + span (auditability).
- NFR-A-2: Re-extraction and graph rebuild are deterministic and versioned (reproducibility). Model-weight pinning included in extractor_version stamp.
- NFR-A-3: Writers use idempotent upsert semantics on deduplication anchors. Never blind inserts.

**Reliability**

- NFR-R-1: v1 is single-node best-effort with graceful degradation. Query path remains live; ingestion pauses and resumes; operator notified.
- NFR-R-2: Per-agent queues with independent concurrency; capped exponential backoff; dead-letter queue with typed errors.
- NFR-R-3: Multi-step agent runs persist state per run for resume-after-crash.

**Local-first & deployment posture**

- NFR-D-1: Full stack runs on a single workstation with no proprietary cloud dependency required. Binding v1 constraint.
- NFR-D-2: Local models are the default; any cloud model use is an optional, pluggable tier, never required. Pre-build feasibility check required.
- NFR-D-3: Fully open-source software stack.

**Observability**

- NFR-O-1: Structured logs; metrics; traces across ingestion, extraction, query.
- NFR-O-2: Groundedness evaluation harness with explicit CI gates. Hard gates: quote-validity 100%, projection-determinism exact, groundedness ≥0.95, fact/claim tag coverage 100%. Soft gates: recall ≥0.75, entity-resolution ≥0.90, refutes-edge recall ≥0.70, tag-correctness ≥0.90. Human spot-checks by rotating independent reviewers (≥30% externally authored adversarial set).

### Additional Requirements

**From Architecture — Foundation & Scaffold (F1)**

- AR-1: Bespoke Turborepo scaffold with pnpm workspaces, TypeScript strict, Node 22. ~13 packages, 5 app processes.
- AR-2: Single PostgreSQL 16 instance — relational + pgvector (HNSW, vector(1024), bge-m3) + Apache AGE (openCypher). Extensions: pg_trgm, uuid-ossp.
- AR-3: 5 process boundaries: api (Fastify), ingest-worker (write-path, sole AGE writer), serve-worker (read-path), audit-worker (append-only), enqueuer (control-plane, Redis Streams).
- AR-4: AC-2 fail-closed render gate — structurally separate from rag (ESLint no-restricted-imports boundary). render imports ONLY @iip/contracts.
- AR-5: Citation provenance decoupled from embeddings (AC-4): citation = (source_doc_id, span_start, span_end, content_hash). Re-embedding preserves citation validity.
- AR-6: Polyglot eval harness (SC-1): packages/eval (TS orchestration) + tools/eval (Python, containerized, subprocess-invoked). zod → JSON Schema → pydantic in CI.
- AR-7: 19 ADRs to seed (ADR-001 through ADR-019, including VAL-4 ADR-019 for SEC-4↔NFR-D-1 contradiction).
- AR-8: Root infra/docker-compose.yml with full platform stack (api, workers, web, tools/eval, postgres+AGE+pgvector, redis, minio, ollama, caddy, otel/prometheus/grafana).
- AR-9: SEC-1 per-issued JWT auth (kid + exp ≤1h + jti + scope), validation in Fastify middleware. No shared bearer tokens.
- AR-10: SEC-2 code-enforced two-person intake state machine: staging → reviewed_once → approved → extracting → indexed. Two distinct principals sign Ed25519 over content_hash.
- AR-11: SEC-3 trust tier assigned at ingest, persisted on node, travels with every graph edge. Zero-tolerance Prometheus rules for lineage anomalies.
- AR-12: SEC-4 runner isolation — self-hosted runner NOT on corpus/GPU workstation. Secret-less ephemeral containers, OIDC ephemeral tokens.
- AR-13: SEC-5 continuous AC-2 gating — render gate fires on EVERY render, internal or external. Fail-closed under load.
- AR-14: SEC-6 hash-chained AC-11 editorial log — append-only, each entry signed by acting principal's key. Periodic root hash externally witnessed.
- AR-15: SEC-8 red-team + mutation suite — 100% mutation score on render/gate.ts + auth/verify.ts. ≥90% on citation/verify.ts, intake/state.ts, extract/worker.ts.
- AR-16: PD-3 Pre-External Presentation Gate (G1-G8): corpus freeze, adversarial pass, hard CI gates, recall split, independent spot-verification, editorial sign-off, legal clearance, honest-framing slide.
- AR-17: STR-7 /claim/[id] first-class addressable surface — PD-1 essence made URL-addressable and shareable.
- AR-18: STR-3 Enqueuer as durable control-plane process (Redis Streams). Event-driven handoff. No inline enqueue.
- AR-19: STR-4 render←rag cross-process handoff via render-queue (BullMQ). Output to MinIO object key.
- AR-20: D9 Caddy reverse proxy (auto-TLS, rate-limit). D7 sops+age for secrets at-rest. D14 GitHub Actions self-hosted runner. D15 GPU for Ollama (NVIDIA/MLX).
- AR-21: Chaos testing infrastructure (SC-6): k6 + Playwright fault injection. Citation-invariant assertion under 500 RPS.
- AR-22: Gate artifact store (SC-7): eval/gates/<corpus-hash>/ content-addressed artifacts. Supports gate-time re-run on frozen corpus.

**From Architecture — Critical Gaps (VAL-2, must be addressed before claim-touching milestones)**

- AR-23: Retention/takedown fields in data model (G-2 Critical). Schema must encode retention metadata + takedown trigger fields.
- AR-24: Filipino eval-set spec locked in an ADR (G-3 Critical-design-gate). Filipino is production case, not i18n.
- AR-25: PD-2 KPI observation mechanism (G-6 Critical). 30/60/90 cascade events in editorial log.
- AR-26: Numeric defamation-threshold ADR — define max acceptable hallucination rate per language per citation class.
- AR-27: AC-11 hash-chain concurrency-model ADR — multi-writer needs single-writer consumer-group serialization OR CRDT merge.
- AR-28: 5-process blast-radius matrix — which N-of-5 failure combos are acceptable vs chargeable. "No uncited path" must hold under partial failure.

### UX Design Requirements

**Design Token System**

- UX-DR1: Brand color layer — primary navy (#1E3A5F), accent ochre (#B8761E), warm parchment surface base (#FBF8F2), border (#E3DED1). Dark mode pairs for all tokens. Replaces shadcn primary/accent/destructive only.
- UX-DR2: Trust-tier semantic tokens — trust-tier-verified (#2A6B5E teal-green), trust-tier-contradicted (#9B3A2E muted brick), trust-tier-caution (#8F5A12 darker ochre). Never raw colors — always semantic by meaning. Both light/dark mode pairs.
- UX-DR3: Claim tokens — claim-fact (#1B1C19 near-black, solid border), claim-attributed (#6B6258 muted gray, dashed border, italic), claim-dashed (#736B5E strikethrough, superseded). Visual EI-2 enforcement at token level.
- UX-DR4: Defamation-risk-caution token (#8B2C1F) — distinct from trust-tier-contradicted. Used on editorial review risk-tier badge and assertions flagged for pre-external legal review.
- UX-DR5: Typography system — Source Serif 4 (display, at most once per surface), Geist Sans (body, inherited shadcn), IBM Plex Mono (legal citations, document text). Label-caps (11px, 600, 0.12em tracking).
- UX-DR6: Tighter rounded corners (3/5/8 px vs shadcn 6/8/12) — reads "investigative tool" not "consumer app." Exceptions: graph nodes rounded.full, citation chips rounded.full, evidence panels rounded.lg.
- UX-DR7: Spacing overrides — editorial-gap (56px), graph-panel (320px), evidence-split-gap (48px). Tailwind 4 scale inherited for rest.
- UX-DR8: Semantic CSS tokens in app/styles/iip-tokens.css — named by meaning (--trust-tier-verified, --claim-dashed, --defamation-risk-caution), never raw color names.

**Compound & Domain Components**

- UX-DR9: Citation compound component (`<Citation><Citation.Chip/><Citation.Modal/></Citation>`) — inline pill in answer text, superscript numeral + source-verb on hover, active state in accent. Click → modal (one level deep): document title, trust-tier badge, source-verb tag, verbatim quoted passage in mono, "View full document" link. `<Citation.Empty>` renders by default; promotes to `<Citation.Chip>` only when provenance resolves (AC-2 at component boundary). CitationContext provider at root layout.
- UX-DR10: Claim component (`<Claim>`) — three variants: claim-fact (solid border, full ink), claim-attributed (dashed border, italic, muted), claim-dashed (strikethrough, faded, superseded). EI-2 gate at render layer. Renders visually-hidden aria-label prefix for screen readers.
- UX-DR11: Trust badge component — three variants: verified (teal), contradicted (brick), caution (ochre outline). Always paired with icon (check/split/eye) + label. Never color alone.
- UX-DR12: Source-verb tag component — label-caps in primary, no background/border. Renders preserved verb verbatim ("ALLEGED", "TESTIFIED", "VOTED", "DENIED", "CLAIMED"). Risk variant uses defamation-risk-caution. Source-verb registry in lib/citation/source-verbs.ts (one-line edit to add verb).
- UX-DR13: Graph node visual encoding — circular for persons, rounded rectangle for documents, small rounded square for claims/evidence. Respondent node accent-colored and larger. Selected node 3px accent ring. Size scales by degree within bounded range. Labels 1:1 with entity_type.
- UX-DR14: Graph edge visual encoding — solid default, solid teal for AIF support, dashed red for AIF attack, bold navy for AIF premise. Temporal-faded edges outside scrubber window fade to border at 0.4 opacity. Edge labels in mono-sm UPPERCASE.
- UX-DR15: Timeline scrubber component — surface-sunken track (6px), accent handle, accent window at 0.15 opacity. Narrative-beat markers (8px navy dots). Imprecise dates render as ranges not points. Persistent on graph surface, primary on timeline surface.
- UX-DR16: Evidence split panel — three panels (supporting/refuting/contextualizing), three-column grid on xl, stacked on lg. Each: surface-raised, 2px semantic top border, label-caps header. One-sided empty panel uses dashed border + verbatim copy: "Only supporting evidence detected in v1; refuting evidence was not surfaced — v1 does not detect contradictions."
- UX-DR17: Senator dashboard card — surface-raised, 1px border, rounded.lg, 24px padding. Header in headline serif. Stat labels in label-caps muted, stat values in body-lg ink. Lightweight v1: statements on record, past votes, committee participation, personal timeline entries.
- UX-DR18: Answer block (chat) — surface-raised, 3px primary left border, 20px padding, rounded.md. Answer text in body-md. Inline citation chips. Essence sentence below every answer in caption italic muted: "Every claim IIP shows you cites a source you can open — or IIP shows you nothing." Silence state: surface-sunken, muted-foreground border, display-sm headline: "No sourced answer found."
- UX-DR19: Document viewer — centered reading column, surface-raised, mono body text. Anchored citation span highlighted in accent at 0.25 opacity. Superseded passages 3px claim-dashed left border + "Superseded" flag. No radius (raw record).
- UX-DR20: Empty state component — display-sm muted headline + body-md muted body + at most one primary action. "No sourced answer found" and "No evidence" states are first-class with no suggested next steps that tempt invention.

**Surfaces & Information Architecture**

- UX-DR21: Chat surface (/chat) — NL Q&A with citation-or-silence. Answer-block with inline citation chips. Essence sentence. Silence state. No "try rephrasing." No-prediction response state: "IIP does not make predictions. Here is what is on record: [sourced statements, voting history, relationships]. Draw your own inference."
- UX-DR22: Claim surface (/claim/[id]) — addressable, shareable. Full claim, provenance, source document, URL-shareable. Links to evidence/compare?ids=.
- UX-DR23: Graph surface (/graph) — one shell, renderer swaps by node count: Cytoscape default, Sigma >10K nodes, React Flow <2K curated. tier-router.ts pure function. Four modes: Trace (default), Explore, Query, Temporal. Hop-capped (NFR-P-3). Temporal scrubber bottom-pinned. Side panel 320px.
- UX-DR24: Timeline surface (/timeline) — dated events at day/week/month/year granularity. Narrative-beat markers (15 domain beats). date_precision renders as ranges for imprecise dates.
- UX-DR25: Evidence compare surface (/evidence/compare?ids=…) — honest split three-column (xl) / stacked tabbed (lg). Supporting/refuting/contextualizing panels with citation chips + trust badges. One-sided empty panel verbatim copy.
- UX-DR26: Senator dashboard (/senators/[id]) — lightweight v1 read-model. Statements (attributed claims with citation chips), past votes (roll-call, per-article), committee participation, personal timeline entries. Thin dashboard shows what it has, honest about what it doesn't.
- UX-DR27: Document viewer surface (/documents/[id]) — span-anchored. Arrived via citation modal. Focus moves to anchored passage (tabindex="-1"). "Skip to cited passage" skip-link. Superseded passages flagged.

**State Management & Data Fetching**

- UX-DR28: React Query 5.x for server state (query answers, graph neighborhoods, timeline, evidence, senator read-model, document).
- UX-DR29: Zustand 5.x for ephemeral interaction: graph-store (node selection), timeline-store (filters), chat-store (draft), citation-store (modal state). Cross-cutting citation-store.
- UX-DR30: nuqs 2.x for URL-shareable state: ?seed=, ?renderer=, ?active=, ?mode=, ?from=, ?to=, ?q=. lib/state/url-keys.ts = single URL-key registry (no drift). URL is a public API for journalists.
- UX-DR31: Rendering model — RSC fetch to /api/v1 in server components for initial payload on heavy pages. React Query for client-side mutations/refetches. One HTTP wrapper (lib/api.ts, AbortController + retry, lint bans raw fetch). No SSE streaming in v1.

**Navigation & Layout**

- UX-DR32: Navigation model — left sidebar on xl (icons + labels), collapses to icon-rail on lg, becomes Sheet on md/below. Top bar holds essence sentence (truncated), dark-mode toggle, persistent search/command entry (⌘K → /chat?q=). No case selector.
- UX-DR33: Bidirectional interlinking — graph node click → citation modal → document viewer; timeline event click → graph ?seed=; senator dashboard → graph ?seed=senator-x; claim surface → evidence ?ids=.
- UX-DR34: Keyboard shortcuts — ⌘K command palette, g c/g g/g t/g e/g s navigation, Enter open focused node, Esc close modal, ? help, / focus search.

**Accessibility (WCAG 2.1 AA)**

- UX-DR35: Color never the only signal — trust badges pair color with icon + label. Fact-vs-claim uses border style (solid/dashed) + text style (roman/italic) + weight. Source-verb tags are text.
- UX-DR36: Fact-vs-claim programmatically conveyed — `<Claim>` renders aria-label="Fact: …" / "Attributed claim: …" / "Superseded: …". aria-live="polite" announces claim-type changes.
- UX-DR37: Graph accessibility — list-view alternative (table with Node/Type/Trust Tier/Relationships columns). Tab cycles nodes in reading order. Arrow keys pan. aria-live announces selection and mode changes. List view is functional a11y alternative.
- UX-DR38: Screen reader announcements for all 7 consumer surfaces — Chat, Graph, Timeline, Evidence, Senator, Document, Claim each announced on navigation.
- UX-DR39: Keyboard operability — Tab order matches reading order. Esc closes topmost modal. Graph nodes tabbable. Command palette fully keyboard-operable. No keyboard trap.
- UX-DR40: Focus management — modal open → focus to title, close → return to trigger. Graph select → focus to side-panel. Mode switch → focus to canvas or first node.
- UX-DR41: Document-viewer anchored span focusable — tabindex="-1", focus moves on load via route effect. "Skip to cited passage" skip-link first focusable element.
- UX-DR42: Dynamic states aria-live — answer-block region aria-live="polite" (assertive for silence/no-prediction). Fail-closed + timeout surfaces aria-live="assertive".
- UX-DR43: Skip-to-content link — visually-hidden-until-focused, first focusable element on every surface.
- UX-DR44: Contrast — all load-bearing text/background pairs verified AA 4.5:1 (text), 3:1 (UI components). Both modes verified.
- UX-DR45: Motion — temporal scrub respects prefers-reduced-motion (fade not slide). No autoplay. prefers-contrast:more darkens tokens and thickens borders.
- UX-DR46: Touch targets — mobile-degraded surfaces (md/sm) maintain ≥44×44 CSS px per WCAG 2.5.5/2.5.8.
- UX-DR47: Plain-language layer — legal terms (fallo, certiorari, Articles of Impeachment, G.R. No., SO ORDERED) with glossary-tooltip on first use. Plain-language summary on case overview for citizen persona.

**Responsive Design**

- UX-DR48: Desktop-first responsive. xl (1280+): full graph + side panel + scrubber, 3-col evidence, reading column + citation rail, 12-col senator, sidebar expanded. lg (1024-1279): narrower side panel, stacked evidence, reading column only, 2-col senator, icon rail. md (768-1023): simplified radial or filtered list graph, stacked tabbed evidence, bottom sheet citation, 1-col senator, Sheet sidebar. sm (<768): filtered list graph only, chat/timeline/senator/claim full, mobile reading column, fullscreen command palette.
- UX-DR49: No native app in v1. Responsive web only. Touch users on md/sm get read-optimized experience. Graph exploration is desktop-first.

**Voice & Tone**

- UX-DR50: Microcopy rules — "No sourced answer found." (verbatim, FR-5.3). "Only supporting evidence detected in v1; refuting evidence was not surfaced — v1 does not detect contradictions." (verbatim). Source verbs preserved ("ALLEGED", "TESTIFIED"). No "verified/confirmed/true." Distinguish "acquitted/resigned/voided by SC" as separate outcomes. Preserve official titles verbatim.

**Banned Interactions**

- UX-DR51: Banned — drag-to-reorder, infinite scroll (pagination only), hover-only affordances on md/below, modal stacks >1 level, predictive/suggestive autocomplete in chat bar, paraphrasing source verbs, labeling attributed claims as "verified."

**Narrative Beats (15 domain beats mapped to UX)**

- UX-DR52: 15 narrative beats surfaced as timeline markers, graph highlights, and case-overview beats (not generated prose): (1) filing, (2) endorsement threshold, (3) three sufficiency tests, (4) pleading duel, (5) committee vote, (6) plenary override, (7) service on Senate, (8) swearing-in, (9) summons and Answer, (10) trial, (11) 2-minute senator explanations, (12) verdict roll-call, (13) fallo, (14) SC intervention, (15) one-year bar expiry. Each has specific UX treatment per EXPERIENCE.md.

**Operator Surface Patterns**

- UX-DR53: Operator surface empty/loading/error states — queue empty (no failed jobs, show health), extraction loading (skeleton + progress), fetch error (typed error category + reprocess action), fail-closed degraded (same fail-closed language as consumer surfaces — "IIP cannot reach its backing services"). Operator surfaces inherit the same state-pattern discipline as consumer surfaces.
- UX-DR54: Operator triage decision affordances — approve, reject, escalate, reprocess actions on dead-lettered jobs. Each action is a single button with a confirmation step. Escalation creates an editorial log entry. Reprocess re-enqueues to the appropriate queue. Actions are keyboard-accessible.
- UX-DR55: Operator-to-editorial handoff surface — the moment an operator flags an artifact for editorial review (e.g., a potential allegation-as-fact caught during spot-check). The handoff creates an editorial review queue item with the artifact, the operator's flag reason, and a link to the source text. The editorial owner sees it in their review queue.

**Global State Patterns**

- UX-DR56: Global empty/loading/error/fail-closed state patterns — graph resolving (skeleton canvas + side panel), citation failed to fetch ("This source could not be reached. The citation is preserved for reproducibility."), backing service degraded (fail-closed: "IIP cannot reach its backing services right now. No answer is safer than a wrong one."), query timeout ("This query did not complete within the time limit. No answer was generated."). All fail-closed states use aria-live="assertive". No cached stale answers. No retry-loop.

**Scoping Note:** No first-run or onboarding UX-DR exists. This is intentional — v1 assumes a trained Intake Operator and a briefed presentation audience. Onboarding is deferred to post-v1.

### FR Coverage Map

| FR | Epic | Description |
|---|---|---|
| FR-1.1 | Epic 3 | Source registry with confirmed trust tiers |
| FR-1.2 | Epic 3 | Lawful-access gate (disable-not-bypass) |
| FR-1.3 | Epic 3 | Discover, fetch, deduplicate by content checksum |
| FR-1.4 | Epic 3 | Immutable raw snapshots in MinIO |
| FR-1.5 | Epic 3 | Per-artifact provenance (source doc + char span) |
| FR-1.6 | Epic 3 | Idempotent, observable, resilient ingestion |
| FR-1.7 | Epic 3 | Operator triage surface (failed jobs, spot-check) |
| FR-2.1 | Epic 4 | Schema-validated extraction with substring prefilter |
| FR-2.2 | Epic 4 | Claim & evidence modeling with active refutes extraction |
| FR-2.3 | Epic 4 | Conservative entity resolution |
| FR-2.4 | Epic 4 | Deterministic graph projection (rebuildable) |
| FR-2.5 | Epic 4 | Fact-vs-claim tagging & source-verb preservation |
| FR-3.1 | Epic 5 | NL Q&A with citation-or-silence |
| FR-3.2 | Epic 5 | Anti-hallucination gate (serving-time substring) |
| FR-3.3 | Epic 5 | Intent-aware hybrid retrieval |
| FR-3.4 | Epic 5 | Evidence explorer (honest split) |
| FR-3.5 | Epic 6 | Interactive graph explorer (hop-capped) |
| FR-4.1 | Epic 7 | Timeline explorer (day/week/month/year) |
| FR-4.2 | Epic 7 | Senator/entity dashboard (early view) |
| FR-5.1 | Epic 5 | Inline citation rendering |
| FR-5.2 | Epic 5 | Visual claim distinction (fact vs attributed) |
| FR-5.3 | Epic 5 | No-evidence empty state ("No sourced answer found") |
| FR-5.4 | Epic 5 | Honest non-claims (no "verified/consistent") |
| FR-5.5 | Epic 8 | Pre-external editorial & legal gate |
| FR-5.6 | Epic 5 | Citation-quality display (trust tiers visible) |
| FR-5.7 | Epic 8 | Retraction / correction supersession hook |

## Epic List

### Epic 1: Foundation
The build team can stand up the full Docker Compose stack, develop against a reproducible Turborepo scaffold, and verify the platform's integrity spine exists — with design tokens, stubbed editorial-integrity components (the demoable spine where a human first sees the invariant surface), navigation shell, state management foundation, accessibility baseline, the render-gate ESLint boundary, the polyglot eval seam, 19 seeded ADRs, and a contract test (positive AND negative assertions) for the citation-or-silence invariant.
**FRs covered:** (foundation — enables all)
**ARs covered:** AR-1 through AR-8, AR-20, AR-21, AR-22
**UX-DRs covered:** UX-DR1-8 (design tokens), UX-DR9-12/18/20 (stubbed compound components), UX-DR28-31 (state foundation), UX-DR32-34 (navigation shell), UX-DR35-43 (accessibility baseline), UX-DR56 (empty/loading/error/fail-closed state patterns)

### Epic 2: Provenance & Invariants
The citation-or-silence invariant is mechanically enforced and testable end-to-end — the render gate is a live call site (the contract test goes GREEN with bidirectional assertions), per-issued JWT auth gates every request, the two-person intake state machine hard-refuses unapproved documents, the hash-chained editorial log records every action with concurrency-safe append, mutation tests enforce 100% coverage on the gate and auth, all VAL-2 critical gaps are resolved, and a unified chaos suite proves the citation invariant holds at 500 RPS sustained with failure injection.
**FRs covered:** (invariant infrastructure — no direct FRs, but the citation-or-silence spine is GREEN)
**ARs covered:** AR-9, AR-10, AR-11, AR-13, AR-14, AR-15, AR-23 through AR-28

### Epic 3: Source Onboarding & Intelligence Ingestion
The Intake Operator (v1 primary user) can register sources with confirmed trust tiers, confirm lawful access, discover/fetch/deduplicate documents, store immutable raw snapshots, run idempotent observable ingestion jobs with dead-letter triage, spot-check extraction output, and see the citation-or-silence invariant on real ingested content. Operator surfaces are first-class with dedicated UX-DRs.
**FRs covered:** FR-1.1, FR-1.2, FR-1.3, FR-1.4, FR-1.5, FR-1.6, FR-1.7
**UX-DRs covered:** UX-DR53-55 (operator surface patterns)

### Epic 4: Extraction & Knowledge Graph Construction
The system extracts entities, relationships, claims, and evidence as versioned schema-validated output — with extraction-time substring validation, active refutes/contextualizes extraction, conservative entity resolution, HNSW vector index with shadow re-index capability, deterministic AGE graph projection with a separate determinism hard gate, fact-vs-claim tagging, source-verb preservation, and a dedicated eval harness scaffold feeding a mid-epic quality checkpoint.
**FRs covered:** FR-2.1, FR-2.2, FR-2.3, FR-2.4, FR-2.5

### Epic 5: Investigative Query & Evidence
The future-user audience can ask questions in natural language and receive cited answers or honest "no sourced answer" silence, explore the honest-split evidence explorer, view addressable claim surfaces, and see every assertion visually distinguished as fact or attributed claim with trust tiers visible. This is the Q&A job — "answer my question with a citation I can trust."
**FRs covered:** FR-3.1, FR-3.2, FR-3.3, FR-3.4, FR-5.1, FR-5.2, FR-5.3, FR-5.4, FR-5.6
**UX-DRs covered:** UX-DR16 (evidence split), UX-DR18 (answer block), UX-DR21-22 (chat/claim surfaces), UX-DR44-45/47/50-52 (accessibility, contrast, plain-language, voice, beats)

### Epic 6: Graph Exploration
The future-user audience can navigate the interactive knowledge graph — expanding neighborhoods, filtering by type, tracing relationships across modes (Trace/Explore/Query/Temporal), with tier-routed renderers (Cytoscape/Sigma/React Flow), temporal scrubber, AIF edge encoding, accessibility list-view alternative, and responsive degradation. This is the exploration job — "let me wander the graph and see what connects to what."
**FRs covered:** FR-3.5
**UX-DRs covered:** UX-DR13-15 (graph nodes/edges/scrubber), UX-DR37 (graph list-view accessibility), UX-DR46/48-49 (touch targets, responsive degradation)

### Epic 7: Temporal Views & Entity Dashboards
The future-user audience can explore timelines of dated events at multiple granularities, view lightweight senator/entity dashboards, and read source documents with span-anchored citation drill-down. Reuses the web foundation from Epic 1. Depends on Epic 4 but not on Epic 5 or 6.
**FRs covered:** FR-4.1, FR-4.2
**UX-DRs covered:** UX-DR17 (senator card), UX-DR19 (document viewer), UX-DR24-27 (timeline/senator/document surfaces)

### Epic 8: Editorial Governance *(verification & governance milestone)*
The build team, named editorial owner, and cyberlibel-aware legal counsel can execute the Pre-External Presentation Gate and manage retraction/correction supersession with full audit trail. **Definition of Done (checkable):** all G1-G8 gates are machine-checkable, the Epic 2 defamation threshold is enforced on every render path, and the adversarial demo script passes on the frozen corpus at 100%.
**FRs covered:** FR-5.5, FR-5.7
**ARs covered:** PD-3 gate (G1-G8), SEC-6 hash-chained log external witnessing, STR-6b supersession orchestrator

## Epic 1: Foundation

The build team can stand up the full Docker Compose stack, develop against a reproducible Turborepo scaffold, and verify the platform's integrity spine exists — with design tokens, stubbed editorial-integrity components, navigation shell, state management foundation, accessibility baseline, the render-gate ESLint boundary, the polyglot eval seam, 19 seeded ADRs, and a RED contract test for the citation-or-silence invariant.

> **REORDER NOTICE 2026-06-23 (Foundation Action Plan P4):** The citation-or-silence
> invariant (Story 1.12) is the **product spine** — the first testable user-value
> artifact in Epic 1. It is now PARTIALLY IMPLEMENTED (RED contract test exists at
> `tests/contract/citation-or-silence.test.ts`, 6 tests failing by design). Stories
> should be read with 1.12 as the **anchor** that all other stories serve, not the
> capstone. The Docker proof (1.3) is support infrastructure for the invariant, not
> the invariant itself. Per ADR-021, the process topology is **6 processes** (not 5).
>
> **Traceability:** Each story enables specific FRs/NFRs. See the
> [Epic 1 Traceability Table](#epic-1-traceability-table) at the end of this epic.

### Story 1.1: Turborepo Scaffold & Process Stubs

As a developer,
I want a Turborepo monorepo scaffold with all packages and 5 app process stubs,
So that I can develop each package independently against a reproducible structure.

*(Scope: scaffolding-only — no business logic, only `console.log("alive")`-level smoke checks.)*

**Acceptance Criteria:**

**Given** the repository is cloned
**When** `pnpm install && pnpm build` is run
**Then** the build exits 0 with zero TS errors across all workspaces (AC-F1-01)
**And** `pnpm typecheck` passes everywhere (AC-F1-02)
**And** at least 1 vitest placeholder passes in every TS package (AC-F1-03)
**And** 12 packages exist: contracts, db, graph, llm, ingest, rag, citation, render, eval, editorial, config, auth
**And** 5 app stubs exist: api, ingest-worker, serve-worker, audit-worker, enqueuer
**And** turbo.json, pnpm-workspace.yaml (apps/* + packages/* only), tsconfig.base.json, .npmrc (node-linker=hoisted), .nvmrc exist

### Story 1.2: PostgreSQL + pgvector + AGE Compatibility Proof

As a developer,
I want to verify PostgreSQL 16 with pgvector and Apache AGE coexist in one instance,
So that I know the single-system-of-record architecture is viable before building on it.

**Acceptance Criteria:**

**Given** docker-compose.yml is configured with postgres:16
**When** the postgres container starts
**Then** pgvector 0.8.x, Apache AGE >=1.7.0, pg_trgm, and uuid-ossp extensions are enabled
**And** `SELECT * FROM cypher('iip_graph', $$ RETURN 1 $$) AS (a agtype)` succeeds
**And** a vector(1024) column is usable in the same schema
**And** Drizzle 0.35.x connects and runs a basic query
**And** ADR-002 documents that AGE is the openCypher path (SQL:PGQ non-existent in PG17/18)

### Story 1.3: Docker Compose Platform Stack

As a developer,
I want the full Docker Compose stack running locally,
So that I can develop and test against all platform services on a single workstation.

**Acceptance Criteria:**

**Given** infra/docker-compose.yml is configured
**When** `docker compose up` is run
**Then** all services reach healthy: postgres+AGE+pgvector, redis, minio, ollama, caddy, api, ingest-worker, serve-worker, audit-worker, enqueuer, web
**And** Caddyfile is configured with auto-TLS + rate-limit template (D9)
**And** Ollama pre-pulls models via infra/runner/ollama-pull.sh (D15)
**And** MinIO private bucket exists for raw snapshots
**And** Redis is configured for BullMQ + Streams (Enqueuer event store)
**And** OpenTelemetry + Prometheus + Grafana are wired (NFR-O-1)

### Story 1.4: Render Gate ESLint Boundary (AC-2)

As a developer,
I want a structurally separate render package with ESLint-enforced import boundaries,
So that the citation-or-silence invariant is mechanically unreachable by the generation code path.

**Acceptance Criteria:**

**Given** the render package exists
**When** ESLint runs
**Then** packages/render imports ONLY @iip/contracts (SC-3, AC-F1-08)
**And** packages/rag is banned from importing @iip/render
**And** packages/contracts/src/render.ts defines the RenderInput zod schema (the only shared symbol between rag and render)
**And** a render gate placeholder exists that throws RenderViolation on any claim lacking citation support
**And** the ESLint boundary is verified in CI

### Story 1.5: Polyglot Eval Seam (SC-1)

As a developer,
I want the polyglot evaluation harness seam wired,
So that TS orchestration can invoke Python eval tooling via subprocess and share schemas.

*(Scope: polyglot eval harness ONLY — nothing else bundled.)*

**Acceptance Criteria:**

**Given** packages/eval/ (TS) and tools/eval/ (Python) exist
**When** the polyglot round-trip is invoked
**Then** the Python eval workspace returns an EvalResult that passes the TS-side zod parse (AC-F1-05 KEYSTONE)
**And** packages/contracts/scripts/gen-pydantic.ts generates pydantic from zod to JSON Schema in CI
**And** tools/eval has pyproject.toml, uv config, Dockerfile (containerized)
**And** tools/eval/package.json is a shim (no JS, scripts shell to uv run)
**And** turbo.json declares py:* tasks (py:lint, py:test dependsOn py:lint)
**And** the invocation is subprocess/CLI, NOT HTTP (ADR-014)

### Story 1.6: Citation Package (SC-2/AC-4)

As a developer,
I want a citation package that owns the provenance tuple schema,
So that citation is decoupled from embeddings and survives re-indexing.

**Acceptance Criteria:**

**Given** the citation package exists
**When** a citation is emitted
**Then** the tuple is (source_doc_id, span_start, span_end, content_hash) per AC-4
**And** the hash algorithm is defined per ADR-010 (xxhash or sha256)
**And** emit(span, source) and verify(citation) APIs exist
**And** packages/citation is NOT coupled into packages/rag
**And** the CitationTuple zod schema lives in packages/contracts

### Story 1.7: Design Token System (UX-DR1-8)

As a developer,
I want the semantic design token system implemented,
So that all surfaces use trust-tier, claim, and brand tokens by meaning, not raw color.

**Acceptance Criteria:**

**Given** app/styles/iip-tokens.css is configured
**When** the web app loads
**Then** all semantic tokens are defined: --trust-tier-verified, --trust-tier-contradicted, --trust-tier-caution, --claim-fact, --claim-attributed, --claim-dashed, --defamation-risk-caution, --primary, --accent, --surface-base/raised/sunken (UX-DR1-8)
**And** both light and dark mode pairs are defined
**And** Tailwind 4 is configured to consume the tokens
**And** typography is loaded: Source Serif 4 (display), Geist Sans (body), IBM Plex Mono (citations) (UX-DR5)
**And** rounded scale is tightened: 3/5/8 px (UX-DR6)
**And** spacing overrides exist: editorial-gap (56px), graph-panel (320px), evidence-split-gap (48px) (UX-DR7)

### Story 1.8: Stubbed Compound Components (UX-DR9-12, 18, 20)

As a developer,
I want stubbed versions of the editorial-integrity compound components,
So that the citation-or-silence invariant has a rendering surface from day one.

*(This is the demoable spine of Epic 1 — a human can see the invariant surface for the first time.)*

**Acceptance Criteria:**

**Given** the compound components are implemented
**When** a stubbed answer is rendered
**Then** `<Citation>` renders `<Citation.Empty>` by default and promotes to `<Citation.Chip>` only when provenance resolves (UX-DR9, AC-2 at component boundary)
**And** `<Claim>` renders variant="fact" (solid border), variant="attributed" (dashed border, italic), variant="dashed" (strikethrough) with aria-label prefix for screen readers (UX-DR10, UX-DR36)
**And** `<TrustBadge>` renders verified/contradicted/caution variants, always paired with icon + label (UX-DR11)
**And** `<SourceVerbTag>` renders label-caps in primary, with source-verbs.ts registry (UX-DR12)
**And** `<AnswerBlock>` renders answer-block (3px primary border), answer-block-silence ("No sourced answer found"), answer-block-essence (PD-1 sentence) (UX-DR18)
**And** `<EmptyState>` renders display-sm headline + body-md body (UX-DR20)
**And** all components live in components/iip/ (separate from components/ui/ shadcn)
**And** CitationContext provider is at root layout (UX-DR9)

### Story 1.9: State Management Foundation & Navigation Shell (UX-DR28-34, 43)

As a developer,
I want the state management layer and navigation shell wired,
So that all future surfaces have URL-shareable state and ephemeral interaction patterns.

**Acceptance Criteria:**

**Given** the state management and navigation are configured
**When** a user navigates the app
**Then** React Query 5.x is configured with lib/api.ts (one HTTP wrapper, AbortController + retry, lint bans raw fetch) (UX-DR31)
**And** Zustand stores exist: graph-store, timeline-store, chat-store, citation-store (UX-DR29)
**And** nuqs is configured with lib/state/url-keys.ts (single registry: ?seed=, ?renderer=, ?active=, ?mode=, ?from=, ?to=, ?q=) (UX-DR30)
**And** left sidebar renders icons + labels on xl, icon-rail on lg, Sheet on md/below (UX-DR32)
**And** top bar holds essence sentence (truncated), dark-mode toggle, command palette entry (UX-DR32)
**And** skip-to-content link is the first focusable element on every surface (UX-DR43)

### Story 1.10: 19 ADRs Seeded (AR-7)

As a developer,
I want the 19 ADRs documented and linted,
So that every architectural divergence from the TDD is cited with research evidence.

**Acceptance Criteria:**

**Given** the ADR directory exists
**When** adr-lint runs in CI
**Then** docs/adr/ contains ADR-0001 through ADR-0019 (SC-9 + VAL-4)
**And** each ADR follows the PC-3 template (frontmatter: id, title, status, date, supersedes, deciders, related, evidence[]; sections: Context/Decision/Alternatives/Consequences/Open questions)
**And** adr-lint validates: evidence[] required for Accepted status, related[] bidirectional
**And** ADRs 013/016/017/018 have "evidence pending" markers (VAL-3.4)
**And** ADR-019 resolves the SEC-4 vs NFR-D-1 contradiction (VAL-4)

### Story 1.11: CI Pipeline & Gate Artifact Store (AR-20, AR-22)

As a developer,
I want the CI pipeline with eval and chaos gates plus the gate artifact store,
So that hard gates block merge and gate-time re-runs are content-addressed.

**Acceptance Criteria:**

**Given** the CI pipeline is configured
**When** a PR is opened
**Then** .github/workflows/ci.yml runs build/test/lint/typecheck/eval/chaos/adr-lint (AC-F1-07)
**And** branch protection blocks merge on red; hard gates non-relaxable
**And** the self-hosted runner is provisioned separately from the corpus workstation (SEC-4, infra/runner/provision.pkr.hcl)
**And** eval/gates/<corpus-hash>/ content-addressed structure exists (SC-7)
**And** corpus freeze primitive emits SHA-256 eval/corpus/<hash>/manifest.json (AC-F1-10)
**And** gate-time re-run emits eval/gates/<hash>/decision.json with pass/fail + per-metric values (AC-F1-10)
**And** sops 3.x + age 1.x configured for at-rest secrets; process refuses to start on invalid config (D7, NFR-S-4)

### Story 1.12: Citation-or-Silence Contract Test (RED) — The Invariant Spine

> **PARTIALLY IMPLEMENTED 2026-06-23 (Foundation Action Plan P1):**
> RED contract test exists at `tests/contract/citation-or-silence.test.ts` —
> 6 tests, all failing by design (renderGate throws "NOT IMPLEMENTED").
> Contract schemas in `packages/contracts/src/citation.ts` and `render.ts`.
> Render gate stub in `packages/render/src/gate.ts`. Invariant ledger seeded
> at `docs/invariant-ledger.yaml` (INV-001). The test goes GREEN when the
> render gate is wired in Epic 2 (Story 2.1).
> **Traces to:** EI-1, AC-2, SEC-5, PC-9, NFR-EI-1, NFR-EI-2, ADR-001

As a developer,
I want a contract test for the citation-or-silence invariant with both positive and negative assertions,
So that the invariant is documented, visible, bidirectionally tested, and ready to activate when the render gate is wired in Epic 2.

**Acceptance Criteria:**

**Given** the contract test exists in packages/eval/
**When** the test is run
**Then** POSITIVE assertion: given any rendered assertion, when citation is present and valid, then the assertion is served (EI-1)
**And** NEGATIVE assertion: given any rendered assertion, when citation is absent or invalid, then render output is suppressed — fail-closed, silence is a hard requirement, not a fallback (AC-2, EI-1 bidirectional)
**And** it fuzzes every render.* export and asserts every emitted span has non-null citation.source_id (positive) AND that no span without citation.source_id is emitted (negative) (PC-9 "no uncited path" property test)
**And** the test is marked as skipped/todo in Epic 1 (documenting the invariant, not blocking)
**And** CI treats `skipped` != `passing` — ship-blocking if 1.12 contract is still skipped at Epic 2 merge
**And** the test will be ACTIVATED (un-skipped) in Epic 2 when the render gate is wired as a live call site
**And** from Epic 2 onward, the test must stay GREEN or CI blocks
**And** any PR touching packages/render/ or packages/ingest/extract/ must re-run the contract as a merge gate (regression net)

### Epic 1 Traceability Table

| Story | Enables (FR) | Enables (EI/NFR) | Enables (AR) | Status |
|-------|-------------|-------------------|--------------|--------|
| 1.1 Scaffold | (foundation — enables all) | — | AR-1 | done-local-only |
| 1.2 PG+AGE+pgvector | (foundation — enables all) | — | AR-2 | done-local-only |
| 1.3 Docker Compose | (foundation — enables all) | NFR-D-1, NFR-O-1 | AR-8, AR-20 | draft-blocked |
| 1.4 Render Gate ESLint | FR-5.2, FR-5.4 | EI-1, EI-2, EI-7 | AR-4 | pending |
| 1.5 Polyglot Eval | — | NFR-O-2 | AR-6 | pending |
| 1.6 Citation Package | FR-1.5, FR-3.2 | EI-4, NFR-A-1 | AR-5 | pending |
| 1.7 Design Tokens | — | — | UX-DR1-8 | pending |
| 1.8 EI Components | FR-5.1, FR-5.2, FR-5.3 | EI-1, EI-2, EI-7 | UX-DR9-12/18/20 | pending |
| 1.9 State + Nav | — | — | UX-DR28-34/43 | pending |
| 1.10 19 ADRs | — | — | AR-7 | pending |
| 1.11 CI + Gate Store | — | NFR-O-2 | AR-20, AR-22 | pending |
| **1.12 Invariant Test** | **FR-3.1, FR-5.3** | **EI-1, EI-2, EI-7** | **AR-4** | **partial (RED)** |

> **ADR-021 correction:** Epic 1 enables a **6-process** topology, not 5.
> `web` (Next.js 15) is process #6 with its own failure domain.

## Epic 2: Provenance & Invariants

The citation-or-silence invariant is mechanically enforced and testable end-to-end — the render gate is a live call site, per-issued JWT auth gates every request, the two-person intake state machine hard-refuses unapproved documents, the hash-chained editorial log records every action, mutation tests enforce coverage on the gate and auth, and all VAL-2 critical gaps are resolved.

### Story 2.1: Render Gate Live (AC-2 / SEC-5) — The Invariant Goes GREEN

As a developer,
I want the render gate wired as a live call site that fails-closed on any uncited assertion,
So that the citation-or-silence contract test from Epic 1 goes GREEN and every served response is gated.

**Acceptance Criteria:**

**Given** the render gate placeholder exists from Epic 1
**When** a render request is processed
**Then** every claim-bearing clause is checked for an attached citation; uncited declarative clauses are stripped before serving (EI-1)
**And** the default action on citation support below threshold is WITHHOLD (AC-2, SEC-5)
**And** the citation-or-silence contract test (Story 1.12) is un-skipped and passes GREEN
**And** the gate fires on EVERY render, internal or external (SEC-5)
**And** substring validation runs as a fast-fail prefilter, backed by an NLI entailment gate
**And** if backing services degrade, the render refuses to serve — unavailable > wrong (SEC-5)
**And** 100% Stryker mutation score on packages/render/gate.ts (SEC-8)
**And** the contract test bidirectional assertions (Story 1.12) both pass: cited assertions served AND uncited assertions suppressed

### Story 2.2: Per-Issued JWT Authentication (SEC-1)

As a developer,
I want per-issued JWT authentication with revocation and replay detection,
So that every request is attributable to a named principal and collective liability is avoided.

**Acceptance Criteria:**

**Given** the auth middleware exists in packages/auth
**When** a request arrives at the API
**Then** a signed JWT (kid + exp <=1h + jti + scope) is validated in Fastify middleware (SEC-1)
**And** every authenticated request resolves to a principal {kid, sub, scope, jti, iat}
**And** jti revocation list + replay detection are active; revocation logs an AC-11 entry `auth.revoked`
**And** ESLint boundary: no handler reads req.auth directly — only req.principal populated by middleware
**And** 100% Stryker mutation score on packages/auth/verify.ts (SEC-8)

### Story 2.3: Two-Person Intake State Machine (SEC-2)

As a developer,
I want a code-enforced two-person intake state machine,
So that no document is extracted without two distinct principals approving it.

**Acceptance Criteria:**

**Given** the intake state machine exists in packages/ingest/src/gate/
**When** a document transitions through intake states
**Then** the state flow is: staging -> reviewed_once -> approved -> extracting -> indexed (SEC-2)
**And** two DISTINCT principals sign Ed25519 over content_hash (reviewer -> reviewed_once; different-sub approver -> approved)
**And** the extraction worker hard-refuses any document not in 'approved' state (throws + logs `intake.bypass_attempt` to AC-11)
**And** Tier-5 (partnership) sources additionally require a partner provenance signature verified against a pinned keyring (fail-closed on unknown key)
**And** mutation test: flipping the state check in extract/worker.ts causes every extract test to fail red (SEC-8, >=90% mutation score)

### Story 2.4: Hash-Chained Editorial Log (SEC-6)

As a developer,
I want an append-only hash-chained editorial log with external witnessing,
So that the team's affirmative defense in a defamation inquiry is cryptographic evidence.

**Acceptance Criteria:**

**Given** the editorial log exists in packages/editorial
**When** an editorial/auth/intake action is recorded
**Then** each entry includes the hash of the previous entry (hash-chained) (SEC-6)
**And** each entry is signed by the acting principal's key (NOT a team bearer token)
**And** events use dotted lowercase format: auth.revoked, intake.approved, editorial.signoff, etc. (PC-1)
**And** periodic root hash is published to an external tamper-evident location (RFC 3161 trusted timestamping OR read-only public mirror)
**And** the read path projects from the log (AC-11)

### Story 2.5: Hash-Chain Concurrency Model ADR (AR-27, VAL-3)

As a developer,
I want the hash-chain concurrency model designed and tested,
So that concurrent writers don't silently fork the chain.

**Acceptance Criteria:**

**Given** the hash-chain concurrency model ADR exists
**When** multiple BullMQ jobs write to the editorial log concurrently
**Then** single-writer consumer-group serialization OR CRDT merge prevents chain forking (VAL-3.7)
**And** the AC-11 hash-chain concurrent-writer test passes: N concurrent jobs, chain unbroken, no orphans (PC-9)
**And** the ADR documents the chosen model with evidence

### Story 2.6: Retention/Takedown Schema & Filipino Eval Spec (AR-23, AR-24, VAL-2)

> **AMENDED 2026-07-03** (party-mode adversarial review). This story is **SPLIT** into 2.6a (retention schema, intake-only) + 2.6b (Filipino salience eval gate). Two new stories filed: **2.10** (config_history build = the real G-2 close, since `config_history` is unbuilt) and **2.6c** (English extraction-quality eval gate = the volume-critical path per VAL-10). G-2 stays **OPEN** until 2.10 lands. See `_bmad-output/implementation-artifacts/story-2-6-review-report.md`.

As a developer,
I want retention/takedown fields in the data model and a Filipino eval-set spec locked in an ADR,
So that claim-touching milestones are unblocked and defamation-grade retention is encoded.

**Acceptance Criteria (amended):**

**Given** the Drizzle schema includes retention metadata
**When** a document is stored
**Then** retention metadata fields exist on `intake_documents` — `retention_class` (renamed from `retention_policy` to avoid the `legal_hold` vocabulary clash), `takedown_trigger` (the removal rationale: court_order/dmca/editor_retraction), and `legal_hold` (orthogonal litigation-freeze flag) (AR-23, G-2 — intake-surface only; full G-2 close deferred to Story 2.10)
**And** `superseded_at` is **moved to ADR-0017** (supersession-orchestration scope) — it is supersession lifecycle, not retention; a lone timestamp under-models what ADR-0017 must orchestrate (successor FK, reason, audit)
**And** the Filipino eval-set spec ADR is accepted with evidence — Filipino is a **salience** production case (VAL-10: highest-defamation-risk subset), sequenced after the English volume-production gate (AR-24, G-3)
**And** the ADR defines **how** Filipino extraction quality is gated (OQ-9) — a measurement protocol (Clopper–Pearson floor, n≥100, annotation provenance, CI enforcement), not thresholds alone
**And** an **English extraction-quality eval gate (Story 2.6c)** is scoped as the volume-critical path (VAL-10) — G-3 closes only when BOTH the English and Filipino gates are specified

### Story 2.7: Defamation Threshold & Blast-Radius ADRs (AR-26, AR-28, VAL-2)

As a developer,
I want the numeric defamation threshold defined and the 5-process blast-radius matrix documented,
So that the safety case reduces to a concrete number and partial-failure modes are enumerated.

**Acceptance Criteria:**

**Given** the defamation threshold ADR exists
**When** the CI gates evaluate served content
**Then** the ADR defines the max acceptable hallucination rate per language per citation class (AR-26, VAL-3.8)
**And** the 5-process blast-radius matrix documents which N-of-5 failure combos are acceptable vs chargeable (AR-28, VAL-3.5)
**And** the matrix proves "no uncited path" holds under partial failure (when api or audit-worker dies, not just happy-path)

### Story 2.8: PD-2 KPI Observation & Gate-Invocation Contract Test (AR-25, VAL-3, VAL-9)

As a developer,
I want the PD-2 KPI observation mechanism and the gate-invocation-per-served-response contract test,
So that the falsification instrument exists and the render gate is proven live under queue pressure.

**Acceptance Criteria:**

**Given** the PD-2 KPI mechanism is configured
**When** post-presentation events occur
**Then** the 30/60/90 cascade events are logged in the editorial log (external.verification.observed, etc.) (AR-25, G-6)
**And** the gate-invocation-per-served-response contract test skeleton exists (VAL-3.6, VAL-9)
**And** the test asserts the render gate is invoked on every served response under queue pressure (not just that the gate's internals are correct)
**And** the test runs under simulated queue pressure (BullMQ render-queue with backpressure)

### Story 2.9: Unified Chaos Suite — 500 RPS Citation Invariant (SC-6, AC-2, SEC-8)

As a developer,
I want a unified chaos testing suite that proves the citation-or-silence invariant holds under sustained load and failure injection,
So that silent citation-drop under load is caught before production, not after.

**Acceptance Criteria:**

**Given** the chaos testing infrastructure exists (tools/chaos/, k6 + Playwright)
**When** the chaos suite runs
**Then** under 500 RPS sustained mixed traffic on the golden corpus, zero claim-responses return without source attribution (AC-2, SC-6)
**And** zero ground-truth-cited responses return without citations (SC-6)
**And** the failure-injection matrix covers: partition (network split between api and serve-worker), node-loss (audit-worker dies — no silently dropped audit events), clock-skew (hash-chain ordering), partial-render (serve-worker degraded — fail-closed verified), and queue backpressure (render-queue saturated — gate still invoked per Story 2.8)
**And** load profile defines SLOs: p99 latency, error budget, citation-drop rate = 0
**And** chaos tests block PD-3 gate (G3 hard gates must pass under chaos conditions)
**And** SEC-8 red-team evals are mapped: libel-injection, slow-poisoning, republication-framing, adversarial-query, source-attribution, tamper — each mapped to a G1-G5 gate artifact with explicit traceability

## Epic 3: Source Onboarding & Intelligence Ingestion

The Intake Operator can register sources with confirmed trust tiers, confirm lawful access, discover/fetch/deduplicate documents, store immutable raw snapshots, run idempotent observable ingestion jobs with dead-letter triage, spot-check extraction output, and see the citation-or-silence invariant on real ingested content. Operator surfaces are first-class within this epic.

### Story 3.1: Source Registry with Confirmed Trust Tiers (FR-1.1)

As an Intake Operator,
I want to register and configure sources by type and crawl strategy with a confirmed trust tier,
So that evidence reliability and citation-quality floor are grounded in validated source authenticity.

**Acceptance Criteria:**

**Given** the operator accesses the source registry
**When** a new source is registered
**Then** source_type is set (government, court, media, press release, transcript) and crawl_strategy is configured (rss, sitemap, list page, api, manual)
**And** trust_tier (1 primary -> 3 aggregator) is assigned and confirmed (source-authenticity validated, not self-declared) (FR-1.1)
**And** trust tier feeds evidence reliability and the citation-quality floor (EI-8)
**And** the sources table exists in Drizzle schema (sources: id, name, url, source_type, crawl_strategy, trust_tier, confirmed, wire_service, original_publisher)
**And** upstream feed provenance is tracked (wire_service, original_publisher per source) for EI-2 independence definition
**And** SEC-3: trust tier is assigned AT INGEST and persisted as a structural graph property

### Story 3.2: Lawful-Access Gate (FR-1.2)

As an Intake Operator,
I want the system to confirm a source is public and lawfully accessible before automating it,
So that we never ingest material unlawfully or bypass access controls.

**Acceptance Criteria:**

**Given** a source is registered for automated crawling
**When** the lawful-access gate runs
**Then** the system confirms the source is public (no paywall, login, or CAPTCHA)
**And** robots.txt directives are respected (NFR-L-1)
**And** sources behind paywalls/logins/CAPTCHAs or whose terms forbid scraping are DISABLED, never bypassed (FR-1.2)
**And** the gate result is recorded with timestamp and operator confirmation
**And** a disabled source can be manually overridden only with operator justification logged to AC-11

### Story 3.3: Discover, Fetch & Deduplicate (FR-1.3)

As an Intake Operator,
I want the system to discover URLs, fetch documents, clean them to text, and deduplicate by content checksum,
So that the same document ingested twice is processed once.

**Acceptance Criteria:**

**Given** a source is approved and its crawl strategy is configured
**When** the ingestion discover/fetch job runs
**Then** URLs are discovered per strategy (rss feed, sitemap, list page, api, manual)
**And** HTML/PDF documents are fetched and cleaned to text
**And** documents are deduplicated by content_checksum so the same document ingested twice is processed once (FR-1.3)
**And** v1 fetch adapters are implemented and operational: Firecrawl (Tier-1 scrapable) and manual upload (Tier-4 blocked sources) (D6/ADR-007)
**And** Tier-2 (Crawlee+stealth for WAF'd government sites), Tier-3 (FOI Alaveteli), and Tier-5 (partnership SFTP drops) adapters are scaffolded as interfaces but explicitly deferred from v1
**And** PDF cleaning includes OCR via Docling+PaddleOCR-VL (ADR-006)
**And** manually uploaded documents carry a provenance record: source_url, obtained_via, retrieved_at, uploader_id, reviewer_id, content_hash, legal_basis

### Story 3.4: Immutable Raw Snapshots (FR-1.4)

As an Intake Operator,
I want immutable raw snapshots of every fetched document stored,
So that provenance, replay, and audit are always possible.

**Acceptance Criteria:**

**Given** a document is fetched and cleaned
**When** the raw snapshot is stored
**Then** an immutable raw snapshot is written to MinIO (private bucket, off serving path) (FR-1.4)
**And** the snapshot includes the original fetched content (HTML/PDF bytes) with fetch metadata (url, timestamp, headers)
**And** the snapshot is content-addressed (SHA-256 key)
**And** MinIO bucket is versioned append-only (NFR-S-5)
**And** the snapshot is never on the public serving path

### Story 3.5: Per-Artifact Provenance (FR-1.5)

As an Intake Operator,
I want every extracted artifact to record its source document and character span,
So that nothing exists without a source pointer.

**Acceptance Criteria:**

**Given** a document is ingested and stored
**When** the documents table record is created
**Then** every document records its source_id, content_checksum, raw_snapshot_key, and fetch metadata
**And** per-artifact provenance (source_doc_id + character span) is wired into the citation package from Story 1.6 (FR-1.5)
**And** the documents table uses idempotent upsert on content_checksum (upsertLastWriteWins via @iip/db/upsert, PC-1a)
**And** provenance is decoupled from embeddings (AC-4) — re-embedding preserves citation validity

### Story 3.6: Idempotent, Observable, Resilient Ingestion (FR-1.6)

As an Intake Operator,
I want ingestion jobs that are idempotent, observable, and resilient,
So that re-running is safe, status is visible, and failures are retried automatically.

**Acceptance Criteria:**

**Given** ingestion jobs are running
**When** a job is processed
**Then** jobs are idempotent (re-running is safe — content_checksum dedup) (FR-1.6)
**And** jobs are observable (status, throughput visible on ingestion dashboard) (FR-1.6)
**And** per-job retry with capped exponential backoff is active (NFR-R-2)
**And** dead-letter queue with typed errors exists for triage (dlq:ingest) (NFR-R-2)
**And** one queue per stage (ingest:queue), jobId = sha256(dedupe-anchor), backoff in config (PC-1d, PC-2.4)
**And** event-driven Enqueuer handoff: stages emit stage.completed, Enqueuer enqueues next (STR-3, no inline enqueue)
**And** LangGraph state checkpointed per node for resume-after-crash (NFR-R-3)

### Story 3.7: Operator Triage Surface (FR-1.7)

As an Intake Operator,
I want to view failed/dead-lettered jobs, reprocess after fix, and spot-check extraction output against source text,
So that I can maintain ingestion health and verify integrity.

**Acceptance Criteria:**

**Given** the operator accesses the ingestion dashboard
**When** viewing the triage surface
**Then** failed and dead-lettered jobs are displayed with typed error categories (FR-1.7)
**And** the operator can reprocess a failed job after fix (re-enqueue to ingest:queue)
**And** the operator can spot-check extraction output against source text (side-by-side view)
**And** the spot-check view shows the document text with extracted artifacts overlaid (entities highlighted, claims marked, citations linked)
**And** the stubbed AnswerBlock from Story 1.8 renders ingested content with the citation-or-silence invariant visible
**And** the dashboard shows ingestion health metrics: success rate, throughput, queue depth, DLQ depth (NFR-O-1)
**And** operator surface inherits shadcn admin patterns (EXPERIENCE.md operator surfaces)

## Epic 4: Extraction & Knowledge Graph Construction

The system extracts entities, relationships, claims, and evidence as versioned schema-validated output — with extraction-time substring validation, active refutes/contextualizes extraction, conservative entity resolution, HNSW vector index with shadow re-index capability, deterministic AGE graph projection with a separate determinism hard gate, fact-vs-claim tagging, source-verb preservation, and a dedicated eval harness scaffold feeding a mid-epic quality checkpoint.

### Story 4.1: Eval Harness Scaffold — Metrics, Collectors & Hooks (AC-1)

As a developer,
I want the evaluation harness scaffold with metric collectors and per-plane hooks,
So that extraction quality can be measured systematically rather than ad hoc.

**Acceptance Criteria:**

**Given** the eval harness scaffold exists in packages/eval/
**When** extraction metrics are collected
**Then** the harness owns: corpus loader, per-plane eval hooks (extract, resolve, project, render), runner, per-stratum reporting (AC-1)
**And** metric collectors are wired: groundedness scorer, citation-fidelity, entity-resolution precision/recall, refutes-recall per stratum (AC-7), coverage bias
**And** render-time metrics run inside packages/render (citation-or-silence compliance, render-time hallucination guard) (SC-1)
**And** inter-rater alpha via krippendorff is computed from ingested reviewer judgments (AC-8)
**And** the harness is a prerequisite for Story 4.11 (extraction eval checkpoint)

### Story 4.2: Schema-Validated Extraction Pipeline (FR-2.1)

As a developer,
I want a schema-validated extraction pipeline that produces versioned structured output from ingested documents,
So that entities, relationships, claims, and evidence are extracted with provenance and quality gates.

**Acceptance Criteria:**

**Given** an approved document is queued for extraction
**When** the extraction worker processes it
**Then** entities, relationships, claims, and evidence are extracted as versioned, schema-validated structured output (FR-2.1)
**And** every extraction is stamped with extractor_version (model ID + weight hash + prompt version + schema version) (NFR-A-2)
**And** extraction runs via @iip/llm-router with a Route<T> (PC-2.1); local models default (Qwen3-14B per ADR-005), cloud optional+pluggable+recorded
**And** LLM output is constrained via XGrammar (JSON mode)
**And** extraction output lands in staging_extractions table
**And** the contract test from Epic 1/2 stays GREEN (extraction output passes through render gate when served)

### Story 4.3: Extraction-Time Substring Validation (FR-2.1, EI-6)

As a developer,
I want every extracted quote substring-validated against its source chunk at extraction time,
So that hallucinated quotes are dropped before storage and counted.

**Acceptance Criteria:**

**Given** the extraction pipeline produces a quoted claim
**When** the substring validation runs
**Then** every cited quote is mechanically validated against its source chunk (EI-6)
**And** hallucinated quotes are dropped before they are stored (FR-2.1)
**And** drops are counted as a metric (quote_validation_drops_total) (NFR-O-1)
**And** the substring gate is a fast-fail prefilter, not the only check (EI-6 scope: catches fabricated quotes, not misattribution/context-stripping)
**And** quote-validity 100% is a hard CI gate (NFR-O-2)
**And** the 1.12 contract test must remain GREEN as a merge gate on any PR touching extraction code (regression net)

### Story 4.4: Claim & Evidence Modeling with Active Refutes (FR-2.2, EI-7)

As a developer,
I want the system to model claims with type/stance/verification and actively extract supporting, refuting, and contextualizing evidence,
So that misleading-by-omission is guarded against.

**Acceptance Criteria:**

**Given** a claim is extracted from a document
**When** evidence extraction runs
**Then** claim type is captured (allegation, counterclaim, denial, factual assertion) and stance (pro/anti/neutral) (FR-2.2)
**And** evidence relations are ACTIVELY extracted: supports, refutes, contextualizes (FR-2.2)
**And** the platform does not passively wait for refutation edges — it prompts for them (D-015)
**And** refutes-recall floor is >=70% on claims where refuting evidence exists (NFR-EI-5)
**And** the eval fixture includes claims with human-annotated refuting evidence, authored by an independent reviewer (NFR-EI-5)

### Story 4.5: Conservative Entity Resolution (FR-2.3, EI-5)

As a developer,
I want conservative entity resolution that prefers duplicates over wrong merges,
So that downstream answers are never corrupted by an incorrect merge.

**Acceptance Criteria:**

**Given** entities are extracted from staging
**When** the Resolver processes candidates
**Then** entities are resolved via normalized-key exact match, then fuzzy candidate matching, then LLM disambiguation (FR-2.3)
**And** the LLM is strictly advisory (emits {candidateId | null, score}); the Resolver owns the decision (PC-2.3)
**And** confidence_bar is 0.45 floor, raise-only, per-type-overridable (PC-2.3)
**And** score < confidence_bar causes a new entity to be created (when unsure, do not merge) (EI-5)
**And** merge-error rate target is ~0, measured on held-out entity-resolution eval set with ground-truth labels (NFR-EI-3)
**And** duplicate rate is bounded, not unbounded (NFR-EI-3)

### Story 4.6: HNSW Vector Index & bge-m3 Embedding (D4, OQ-1)

As a developer,
I want the HNSW vector index built with bge-m3 embeddings,
So that semantic similarity search supports intent-aware retrieval.

**Acceptance Criteria:**

**Given** document chunks are extracted
**When** embeddings are generated
**Then** chunks are embedded using bge-m3 (1024-dim) via @iip/llm-router (ADR-004 — bge-m3 only, drop nomic-embed)
**And** HNSW index is built after bulk load; incremental inserts thereafter (D4)
**And** citations remain valid because they bind to spans (content_hash), not vectors (AC-4)
**And** reproducible candidate set requires frozen index snapshot + fixed ef_search (AC-6)

### Story 4.7: Embedding Swap — Shadow Re-Index, Atomic Cutover & Rollback (D4, AC-4)

As a developer,
I want a safe embedding-model swap path with shadow re-index and rollback,
So that re-embedding the corpus doesn't break serving or lose citation validity.

**Acceptance Criteria:**

**Given** a new embedding model is configured
**When** the shadow re-index runs
**Then** a shadow index is built alongside the live index without affecting serving (D4)
**And** dual-write path activates: new chunks written to both indices during cutover
**And** atomic alias swap switches the active index (D4)
**And** rollback path exists: revert to previous index if verification fails
**And** verification gate compares shadow vs live results on eval fixture before swap
**And** citations remain valid throughout because they bind to spans (content_hash), not vectors (AC-4)

### Story 4.8: AGE Graph Projection (FR-2.4)

As a developer,
I want a deterministic AGE graph projection from canonical relational data,
So that the navigable graph is a derived projection rebuildable from relational tables.

**Acceptance Criteria:**

**Given** canonical entities and relationships exist in relational tables
**When** the graph builder projects to AGE
**Then** canonical entities and relationships are projected into a navigable graph (FR-2.4)
**And** the graph is a derived projection of canonical relational data, NOT of raw extractions (FR-2.4)
**And** labels are 1:1 with canonical entity_type/relation_type (UPPERCASE: PERSON, VOTED_AGAINST) (PC-2.5)
**And** AGE projection runs via @iip/graph/writer, restricted to apps/ingest-worker/src/graph-builder (STR-5)
**And** AGE DDL lives in parallel versioned infra/sql/age/ applied by a boot runner (D1)
**And** dropping the graph and replaying relational tables reproduces the graph structure

### Story 4.9: Projection-Determinism Hard Gate (AC-6, NFR-O-2)

As a developer,
I want the projection-determinism gate as a separate hard CI gate,
So that drop+replay is proven to reproduce an isomorphic graph every build.

**Acceptance Criteria:**

**Given** the AGE projection exists (Story 4.8)
**When** the determinism gate runs in CI
**Then** dropping the graph and replaying relational tables reproduces an isomorphic graph — exact match (AC-6)
**And** projection-determinism exact is a hard CI gate (NFR-O-2 — non-relaxable)
**And** the gate includes property-based assertions: stable node ordering, edge enumeration, property consistency
**And** weakening this gate to pass a build is rejected (NFR-O-2)
**And** a determinism fixture exists in eval/corpus/ with expected graph structure

### Story 4.10: Fact-vs-Claim Tagging & Verb Preservation (FR-2.5, EI-2, EI-3)

As a developer,
I want every assertion tagged as fact or attributed claim with source verbs preserved verbatim,
So that an allegation stated as fact is a P0 defect.

**Acceptance Criteria:**

**Given** an assertion is extracted
**When** the fact/claim tagger processes it
**Then** every assertion is tagged as fact or attributed claim per the EI-2 boundary rule (FR-2.5)
**And** fact = tier-1 primary OR >=2 independent sources (distinct original reporting, not wire republishing) (EI-2)
**And** tier-1 conflicts: when >=2 tier-1 sources conflict, neither is served as fact — both are attributed claims with conflict visible (EI-2)
**And** fact/claim tag coverage on served assertions is 100% (hard gate, NFR-EI-7)
**And** verbs with legal/epistemic weight (alleged, testified, voted, denied, claimed) are preserved verbatim from source, never paraphrased (EI-3)
**And** source-verb preservation is enforced by prompt contract + output-parser + render-time test (PC-1f)

### Story 4.11: Extraction Eval Checkpoint — Mid-Epic Quality Gate

As a developer,
I want a mid-epic extraction quality checkpoint using the eval harness scaffold (Story 4.1),
So that I can verify LLM extraction quality, vector index, AGE projection, and claim modeling are all producing demonstrable artifacts before proceeding to query work.

**Acceptance Criteria:**

**Given** Stories 4.2-4.10 are complete and the eval harness scaffold (4.1) is wired
**When** the extraction eval checkpoint runs
**Then** extraction accuracy on eval fixtures is >85% (SM-4)
**And** groundedness >=0.95 on the eval fixture (NFR-O-2 hard gate)
**And** entity-resolution >=0.90 on the eval fixture (NFR-O-2 soft gate)
**And** refutes-edge recall >=0.70 on the eval fixture (NFR-EI-5)
**And** projection-determinism exact on the eval fixture (NFR-O-2 hard gate)
**And** the contract test stays GREEN (no uncited path)
**And** a demonstrable artifact exists: a sample document fully extracted with entities, relationships, claims, evidence, citations, fact/claim tags, and source verbs — viewable in the operator spot-check UI from Story 3.7

## Epic 5: Investigative Query & Evidence

The future-user audience can ask questions in natural language and receive cited answers or honest "no sourced answer" silence, explore the honest-split evidence explorer, view addressable claim surfaces, and see every assertion visually distinguished as fact or attributed claim with trust tiers visible. This is the Q&A job — "answer my question with a citation I can trust."

### Story 5.1: RAG Fusion Router & Intent-Aware Retrieval (FR-3.3)

As a journalist,
I want the platform to understand my question's intent and retrieve relevant evidence from the graph and vector store,
So that I get the most relevant sourced material for my inquiry.

**Acceptance Criteria:**

**Given** a natural-language question is submitted
**When** the Query Planner processes it
**Then** question intent is detected (factual lookup, entity listing, evidence-for-claim, timeline, comparison) (FR-3.3)
**And** all 5 intent types are detectable on the eval fixture with >=80% accuracy (FR-3.3)
**And** retrieval uses a fusion router over 3 retrievers: pgvector ANN + AGE Cypher + BM25 (architecture D-strata)
**And** unrecognized intent falls back to factual lookup with a logged signal (not an error or empty response) (FR-3.3)
**And** CRAG correction runs as a post-fusion LangGraph node (the only ranking mutator, by replacement not in-place reorder) (PC-2.2)
**And** the Query Planner never imports retrievers directly; weights are config-keyed by intent (PC-2.2)
**And** retrieval filters by trust tier (defamation-grade retrieval without trust filtering is malpractice) (STR-6c)

### Story 5.2: CRAG Correction & Generation Pipeline

As a developer,
I want a CRAG (Corrective Retrieval-Augmented Generation) correction node as a separate stateful pipeline,
So that retrieval quality is assessed and corrected before generation, without bundling it into the fusion router.

**Acceptance Criteria:**

**Given** the fusion router returns candidate passages (Story 5.1)
**When** the CRAG correction node processes them
**Then** the CRAG pipeline runs: grade retrieved passages -> decide (correct/ambiguous/incorrect) -> trigger web-search/rewrite if needed -> re-grade (PC-2.2)
**And** CRAG is a post-fusion LangGraph node — the only ranking mutator, by replacement not in-place reorder (PC-2.2)
**And** CRAG has its own eval harness: retrieval quality pre-CRAG vs post-CRAG measured on eval fixture
**And** HippoRAG (if used) is a Query-Planner tool consuming the fused list, not a 4th retriever (PC-2.2)
**And** the CRAG pipeline output feeds into Story 5.3 (Q&A endpoint) as the retrieval context

### Story 5.3: NL Q&A Endpoint with Citation-or-Silence (FR-3.1, FR-3.2, FR-5.3, FR-5.4)

As a journalist,
I want to ask a question and receive a cited answer or honest "no sourced answer" silence,
So that I never receive a fabricated or uncited response.

**Acceptance Criteria:**

**Given** a question is submitted to POST /query
**When** the answer is generated and served
**Then** every factual assertion carries >=1 citation, or "no sourced answer" is returned (FR-3.1, EI-1)
**And** there is NO uncited-answer code path (FR-3.1)
**And** every cited quote is substring-validated against its source chunk at serving time (FR-3.2, EI-6)
**And** quotes that cannot be located are discarded at serving (FR-3.2)
**And** when retrieval yields no sourced answer, an explicit `noEvidence: true` state is returned — never fabricated or hedged (FR-5.3)
**And** the platform does not imply consistency, verification, or truth where not established (FR-5.4)
**And** the render gate (from Epic 2) fires on every served response — uncited clauses stripped before serving (EI-1)
**And** query latency p95 < 10s end-to-end; p50 < 3s goal (NFR-P-1)
**And** /query returns a complete QueryAnswer (no SSE streaming in v1) (D10)

### Story 5.4: Chat Surface with Full Editorial Integrity UX (UX-DR18, 21, 44-50)

As a journalist,
I want a chat interface where I can ask questions and see cited answers with inline citation chips, visual fact-vs-claim distinction, and honest silence,
So that I can investigate with confidence in every assertion.

**Acceptance Criteria:**

**Given** the user navigates to /chat
**When** an answer is displayed
**Then** the AnswerBlock renders with 3px primary left border, inline citation chips, and the essence sentence below every answer (UX-DR18)
**And** every factual assertion renders inline clickable <Citation.Chip> linking to source (FR-5.1, UX-DR9)
**And** attributed claims are visually distinct from established facts via <Claim> variants (dashed border, italic, muted vs. solid border, full ink) (FR-5.2, UX-DR10)
**And** the silence state renders answer-block-silence: "No sourced answer found." in display-sm — no "try rephrasing" (FR-5.3, UX-DR18)
**And** the no-prediction response renders: "IIP does not make predictions. Here is what is on record: [sourced data]. Draw your own inference." (UX-DR50)
**And** the answer-block region is aria-live="polite" (assertive for silence/no-prediction) (UX-DR42)
**And** screen reader announces: "Chat. Ask a question — every answer cites a source or shows nothing." (UX-DR38)
**And** source verbs preserved verbatim: "ALLEGED", "TESTIFIED", "VOTED" (UX-DR50, EI-3)
**And** no "verified", "confirmed", or "true" labels appear (FR-5.4, UX-DR50)
**And** the chat surface is a single centered column (max-w-2xl) (EXPERIENCE.md)
**And** /chat?q= is URL-addressable via nuqs (UX-DR30)

### Story 5.5: Claim Surface — Addressable & Shareable (UX-DR22, STR-7)

As a researcher,
I want each claim to have a shareable URL,
So that I can send a colleague the exact claim with its full provenance.

**Acceptance Criteria:**

**Given** the user navigates to /claim/[id]
**When** the claim surface renders
**Then** the full claim is displayed with provenance, source document link, and citation chips (UX-DR22)
**And** the URL is addressable and shareable (pasteable into a Slack thread) (STR-7)
**And** the claim renders through <Claim> with the fact-vs-attributed distinction visible (FR-5.2)
**And** trust tier is visible on every citation (FR-5.6)
**And** a link to /evidence/compare?ids=... is present for exploring supporting/refuting evidence
**And** screen reader announces: "Claim [id], [fact|attributed], [N] citations." (UX-DR38)
**And** citation drill-down works: click chip -> modal -> "View full document" -> /documents/[id] (deferred to Epic 6)

### Story 5.6: Evidence Explorer — Honest Split (FR-3.4, FR-5.6, UX-DR16)

As a legal analyst,
I want to see supporting, refuting, and contextualizing evidence for any claim side-by-side,
So that I am not misled by one-sided evidence presentation.

**Acceptance Criteria:**

**Given** the user navigates to /evidence/compare?ids=...
**When** the evidence explorer renders
**Then** three panels display: Supporting (trust-tier-verified top border), Refuting (trust-tier-contradicted top border), Contextualizing (muted-foreground top border) (FR-3.4, UX-DR16)
**And** each evidence item shows claim + citation chip + trust badge, linking to source at exact passage (FR-3.4)
**And** each item's trust tier is visible (FR-5.6)
**And** when only one side was found, the one-sided empty panel renders verbatim: "Only supporting evidence detected in v1; refuting evidence was not surfaced — v1 does not detect contradictions." (FR-3.4, PRD 6.3, UX-DR16)
**And** the refutes tab is never silently empty (EI-7)
**And** three-column grid on xl, stacked tabbed on lg (UX-DR16, UX-DR48)
**And** screen reader announces: "Supporting evidence, [N] items. Refuting evidence, [N] items or one-sided note." (UX-DR38)

## Epic 6: Graph Exploration

The future-user audience can navigate the interactive knowledge graph — expanding neighborhoods, filtering by type, tracing relationships across modes (Trace/Explore/Query/Temporal), with tier-routed renderers (Cytoscape/Sigma/React Flow), temporal scrubber, AIF edge encoding, accessibility list-view alternative, and responsive degradation. This is the exploration job — "let me wander the graph and see what connects to what."

### Story 6.1: Graph Explorer Shell & Cytoscape Renderer (FR-3.5, UX-DR13)

As a journalist,
I want to see the knowledge graph rendered with the default Cytoscape renderer,
So that I can visually explore entities and their relationships.

**Acceptance Criteria:**

**Given** the user navigates to /graph
**When** the graph explorer shell renders
**Then** one shell exists with renderer-swappable architecture (STR-9)
**And** Cytoscape.js 3.30.x is the default renderer (UX-DR13)
**And** tier-router.ts is a pure function (nodeCount, mode) -> renderer, URL-encodable ?renderer= (UX-DR13)
**And** the shared graph model exists: lib/graph/types.ts (GraphNode/GraphEdge/SelectionState — imported by Zustand store, renderers, citation modal) (STR-9)
**And** graph nodes are visually encoded: circular persons, rounded rectangle documents, rounded square claims/evidence; respondent accent-colored and larger (UX-DR13)
**And** selected node carries 3px accent ring (UX-DR13)
**And** node size scales by degree within bounded range (UX-DR13)
**And** hop-capped neighborhood expansion (double-click or Enter) (FR-3.5, NFR-P-3)
**And** filter by entity type, relationship type, trust tier via side panel (320px) (FR-3.5, UX-DR7)
**And** click node -> Zustand graph-store -> nuqs ?active= -> CitationContext -> citation modal (STR-9)
**And** first paint < 2s for <=500 nodes (FR-3.5)

### Story 6.2: Graph Tier-Routing — Sigma & React Flow Renderers (UX-DR13)

As a journalist exploring a large graph,
I want the renderer to automatically switch based on graph size,
So that exploration remains performant at any scale.

**Acceptance Criteria:**

**Given** the tier-router detects node count exceeding thresholds
**When** the renderer swaps
**Then** Sigma.js + graphology activates at >10K nodes (UX-DR13, EXPERIENCE.md)
**And** React Flow (@xyflow/react) activates for curated sub-views <2K nodes (UX-DR13)
**And** the swap is URL-encodable (?renderer=cytoscape|react-flow|sigma) (UX-DR13)
**And** each renderer consumes the same shared graph model (STR-9)
**And** web-worker layout for graphs exceeding 200 nodes (FR-3.5)
**And** degraded renderer fallback: if WebGPU unavailable -> precompute server-side or Sigma; if WebGL unavailable -> Cytoscape with warning (EXPERIENCE.md)
**And** when hop/count caps hit: non-blocking banner "Showing immediate neighbors. Explore mode for further expansion." (EXPERIENCE.md)

### Story 6.3: Graph Modes — Trace, Explore, Query, Temporal (EXPERIENCE.md)

As a journalist,
I want to switch between graph exploration modes,
So that I can trace from a person, explore freely, query structurally, or animate temporally.

**Acceptance Criteria:**

**Given** the graph explorer shell is active
**When** the user switches modes via side panel tabs
**Then** Trace mode (default): opens centered on respondent or ?seed= actor with immediate neighbors + persistent temporal scrubber (EXPERIENCE.md)
**And** Explore mode: free-form neighborhood expansion (EXPERIENCE.md)
**And** Query mode: structured Cypher-backed search (EXPERIENCE.md)
**And** Temporal mode: scrubber-driven animation (EXPERIENCE.md)
**And** mode updates ?mode= via nuqs (UX-DR30)
**And** on mode switch, focus moves to canvas container or first node in reading order (UX-DR40)
**And** aria-live announces: "Mode changed to [mode], [N] nodes visible." (UX-DR37)

### Story 6.4: Graph Temporal Scrubber & Edge Encoding (UX-DR14-15)

As a journalist,
I want to scrub the timeline and see graph edges fade in/out based on temporal window,
So that I can trace how relationships evolved over time.

**Acceptance Criteria:**

**Given** the temporal scrubber is active on the graph surface
**When** the user scrubs
**Then** the scrubber (surface-sunken track, accent handle, accent window at 0.15 opacity) is bottom-pinned (UX-DR15)
**And** dragging handles sets ?from= / ?to= via nuqs (UX-DR15)
**And** imprecise dates render as ranges, not points (UX-DR15)
**And** edges outside the temporal window fade to border at 0.4 opacity (UX-DR14)
**And** graph edges are encoded: solid default, solid teal AIF support, dashed red AIF attack, bold navy AIF premise (UX-DR14)
**And** edge labels render in mono-sm UPPERCASE (VOTED_AGAINST, FILED, TESTIFIED_IN) and truncate with ellipsis past length threshold (UX-DR14)
**And** Temporal mode animation respects prefers-reduced-motion (fade, not slide) (UX-DR45)
**And** narrative-beat markers (8px navy dots) sit on the track (UX-DR15)

### Story 6.5: Graph Accessibility, List View & Responsive (UX-DR37, 48-49)

As a journalist using a screen reader or mobile device,
I want the graph to be accessible and responsive,
So that I can navigate relationships regardless of device or ability.

**Acceptance Criteria:**

**Given** the user accesses the graph on any device or with assistive technology
**When** the graph surface renders
**Then** a list-view alternative exists: table with columns (Node, Type, Trust Tier, Relationships), operable by keyboard and screen reader (UX-DR37)
**And** Tab cycles nodes in graph-reading order; Arrow keys pan when canvas focused (UX-DR37)
**And** aria-live announces node selection (UX-DR37)
**And** on md breakpoint: simplified radial (immediate neighbors only) or filtered list view (toggle) (UX-DR48)
**And** on sm breakpoint: filtered list view only (no canvas) (UX-DR48)
**And** touch targets on mobile >=44x44 CSS px (UX-DR46)
**And** keyboard shortcuts: g g navigates to graph, ? opens help, Esc closes modal/panel (UX-DR34)

## Epic 7: Temporal Views & Entity Dashboards

The future-user audience can explore timelines of dated events at multiple granularities, view lightweight senator/entity dashboards with cited statements/votes/participation, and read source documents with span-anchored citation drill-down. Reuses the web foundation from Epic 1. Depends on Epic 4 but not on Epic 5.

### Story 7.1: Timeline Explorer (FR-4.1, UX-DR24)

As a researcher,
I want to explore dated events at day/week/month/year granularity with narrative-beat markers,
So that I can trace how the impeachment case evolved over time.

**Acceptance Criteria:**

**Given** the user navigates to /timeline
**When** the timeline renders
**Then** dated events are presented at day/week/month/year granularity (FR-4.1)
**And** date precision is recorded and respected: a "March 2026" event renders as a range band on the scrubber, not "March 1, 2026" (FR-4.1, UX-DR15)
**And** the 15 narrative-beat markers are surfaced as 8px navy dots on the track with display-sm labels (e.g., "Filed [date]", "Endorsement threshold reached") (UX-DR52)
**And** timeline_events table is populated by a worker agent (Timeline Builder), not SQL materialized views (D2)
**And** bi-temporal valid_from/valid_to supports as-of querying (D2)
**And** clicking a timeline event navigates to /graph?seed= for the related entity (EXPERIENCE.md)
**And** screen reader announces: "Timeline, [N] events, [M] narrative beats." (UX-DR38)
**And** the timeline surface uses the editorial-gap (56px) between major narrative sections (UX-DR7)

### Story 7.2: Senator / Entity Dashboard — Early View (FR-4.2, UX-DR17, 26)

As a political-risk analyst,
I want to view a senator's statements, votes, and participation in the case,
So that I can assess their position and involvement.

**Acceptance Criteria:**

**Given** the user navigates to /senators/[id]
**When** the senator dashboard renders
**Then** the dashboard shows: statements on record (attributed claims with citation chips + source + date), past votes (roll-call, per-article, with position + date), committee participation (hearings attended, roles held) (FR-4.2)
**And** all data is cited — no uncited assertions (the render gate from Epic 2 enforces)
**And** the senator card renders: surface-raised, 1px border, rounded.lg, 24px padding, headline serif header (UX-DR17)
**And** stat labels render in label-caps muted, stat values in body-lg ink (UX-DR17)
**And** a thin dashboard (publicly-undecided senator) shows what it has and is honest about what it doesn't — no "no data" apology, just absence (EXPERIENCE.md)
**And** clicking a senator navigates to /graph?seed=senator-x (EXPERIENCE.md)
**And** screen reader announces: "Senator [name], [N] statements on record, [N] past votes." (UX-DR38)
**And** the dashboard is a 12-col grid on xl, 2-col on lg, 1-col stack on md (UX-DR48)

### Story 7.3: Document Viewer — Span-Anchored (UX-DR19, 27)

As a journalist,
I want to read source documents with the cited passage highlighted and superseded passages flagged,
So that I can verify the exact text behind a citation.

**Acceptance Criteria:**

**Given** the user arrives at /documents/[id] via citation modal "View full document"
**When** the document viewer renders
**Then** the page scrolls to the anchored citation span, highlighted in accent at 0.25 opacity (UX-DR19)
**And** the anchored span receives tabindex="-1" and focus moves to it on load via a route effect (UX-DR41)
**And** a "Skip to cited passage" skip-link renders as the first focusable element when a citation anchor is present (UX-DR41)
**And** document body renders in mono — the raw record, unparaphrased (UX-DR19)
**And** superseded passages carry a 3px claim-dashed left border and a "Superseded" flag (UX-DR19)
**And** the viewer is a centered reading column (max-w-3xl) with no radius (the raw record) (UX-DR19)
**And** browser back returns to the originating surface with state preserved (nuqs URL) (EXPERIENCE.md)
**And** screen reader announces: "Document [title], arrived at cited passage." (UX-DR38)

### Story 7.4: Narrative Beats — Domain Events Mapped to UX (UX-DR52)

As a researcher,
I want the 15 domain narrative beats surfaced as timeline markers and graph highlights,
So that I can follow the impeachment's procedural story without generated prose.

**Acceptance Criteria:**

**Given** the timeline and graph surfaces are complete
**When** narrative beats are rendered
**Then** all 15 beats surface as markers and highlights, not generated narrative (UX-DR52)
**And** beat 1 (filing) renders as timeline-marker dot + display-sm "Filed [date]" (UX-DR52)
**And** beat 2 (endorsement threshold) renders as accent-colored marker + "Endorsement threshold reached — fast path to Senate" (UX-DR52)
**And** beat 3 (three sufficiency tests) renders as three sequential markers; each a gate that can dismiss (UX-DR52)
**And** beat 12 (verdict roll-call) renders as accent-colored climactic marker + per-article vote edge highlights (UX-DR52)
**And** beat 13 (fallo) renders with exact legal term verbatim: "judgment of conviction" or "acquittal" (UX-DR52)
**And** beat 14 (SC intervention) renders case state badge "Voided by SC" — distinct from "acquitted" (domain rule 12) (UX-DR52)
**And** beat 15 (one-year bar expiry) renders as future-dated marker + "One-year bar expires [date]" (UX-DR52)
**And** verdict language is formulaic and preserved verbatim — never editorialized (UX-DR52)

### Story 7.5: Responsive Degradation & Touch (UX-DR48-49)

As a user on a tablet or mobile device,
I want temporal views and entity dashboards to work gracefully,
So that I can access key information on any device.

**Acceptance Criteria:**

**Given** the user accesses timeline, senator dashboard, or document viewer on md/sm breakpoints
**When** the surfaces render on smaller viewports
**Then** timeline works full-functional on md and sm (EXPERIENCE.md)
**And** senator dashboard degrades: 2-col grid on lg, 1-col stack on md, 1-col stack on sm (UX-DR48)
**And** document viewer renders as mobile-optimized reading column on sm (UX-DR48)
**And** claim surface is full functional on sm (UX-DR48)
**And** all touch targets on md/sm maintain >=44x44 CSS px (UX-DR46)
**And** citation context appears in a bottom sheet on md (document viewer) (UX-DR48)
**And** no native app — responsive web only (UX-DR49)

## Epic 8: Editorial Governance *(verification & governance milestone)*

The build team, named editorial owner, and cyberlibel-aware legal counsel can execute the Pre-External Presentation Gate and manage retraction/correction supersession with full audit trail. **Definition of Done (checkable):** all G1-G8 gates are machine-checkable, the Epic 2 defamation threshold is enforced on every render path, and the adversarial demo script passes on the frozen corpus at 100%.

### Story 8.1: Pre-External Gate — Machine-Checkable Prefix (G1-G5, PD-3)

As a build team lead,
I want the machine-checkable gate prefix to run on a frozen corpus,
So that the invariant is proven at gate time — not from a stale result.

**Acceptance Criteria:**

**Given** the build team is preparing for external presentation
**When** the machine prefix runs
**Then** G1 — Corpus freeze: content hash of all presented claims + citations recorded in the AC-11 log (non-repudiable binding) (PD-3)
**And** G2 — Adversarial pass: SM-7 = 100% on the frozen corpus, re-run at gate time (not a stale result) (PD-3)
**And** G3 — Hard CI gates pass on the frozen corpus: citation 100%, quote-validity 100%, projection-determinism exact, fact/claim 100% (PD-3)
**And** G4 — Recall split reported (even where not gating): exculpatory >=0.75, inculpatory >=0.75, refutes-recall >=0.70 (PD-3, AC-7)
**And** G5 — Independent spot-verification: >=50% of sampled demo answers spot-verified by a reviewer not on the authoring team; sample drawn by the verifier (PD-3)
**And** all gate artifacts are content-addressed at eval/gates/<corpus-hash>/ (SC-7)
**And** the gate emits a decision.json with explicit pass/fail + per-metric values

### Story 8.2: Pre-External Gate — Human Sign-Off Suffix (G6-G8, FR-5.5, PD-3)

As a named editorial owner and cyberlibel-aware legal counsel,
I want to sign off on the demo corpus and curated answer samples,
So that the platform is cleared for external presentation with defamation risk assessed.

**Acceptance Criteria:**

**Given** the machine prefix (G1-G5) has passed
**When** the human suffix executes
**Then** G6 — Named editorial owner signs off: editorial.signoff event covering demo-corpus version hash + curated-sample-set hash + assertion each sample traces to a citation (PD-3, FR-5.5)
**And** G7 — Cyberlibel-aware legal clearance (blocking): named PH-licensed counsel produces per-answer risk tiers (green/amber/red) addressing RA 10175 section 4(c)(4) + Disini republication analysis (PD-3, NFR-L-3)
**And** all red-tier answers are removed before exposure; amber carry a written counsel note (PD-3)
**And** G8 — Honest-framing slide exists and is shown: v1's exclusions stated as clearly as capabilities (PD-3, DR-4)
**And** the gate record (reviewer, date, scope) is available on request (FR-5.5)
**And** DPA posture review runs alongside the cyberlibel review (NFR-L-2)
**And** absent any row = no go (FAIL is the default) (PD-3)

### Story 8.3: Retraction / Correction Supersession (FR-5.7, STR-6b)

As an Intake Operator,
I want to record source retractions/corrections and have the platform flag affected answers,
So that superseded defamatory content is suppressed, not frozen.

**Acceptance Criteria:**

**Given** a cited source is later corrected or retracted
**When** the supersession is recorded
**Then** the supersession is recorded against the stored snapshot (FR-5.7)
**And** affected served answers are flagged with a visible retraction badge (claim-dashed styling) (FR-5.7, UX-DR10)
**And** an operator alert fires in the ingestion dashboard (FR-5.7)
**And** serving suppression activates for assertions whose only source has been retracted — they are not served as established (FR-5.7)
**And** a multi-source assertion with one retracted source is re-evaluated: retracted source removed, assertion re-tagged based on remaining sources (FR-5.7)
**And** superseded nodes are never deleted, only marked (STR-6b/ADR-017)
**And** AGE rebuilds on supersession (PC-2.5); citation retains the historical reference + supersession flag (STR-6b)
**And** cache-bust fires on supersession event (D3)
**And** every render that cited the superseded node is reproducible-as-was and flagged-going-forward (STR-6b)

### Story 8.4: Editorial Review Workflow & Audit Trail (FR-5.5 policy layer, AC-11)

As an editorial owner,
I want a review queue and sign-off workflow on top of the hash-chained log,
So that editorial decisions are recorded, attributable, and auditable.

**Acceptance Criteria:**

**Given** the editorial review workflow exists in packages/editorial
**When** an editorial action is taken
**Then** the review queue surfaces answers for editorial review with per-answer risk tiers (green/amber/red) (PD-3 G7)
**And** editorial actions are events on the append-only hash-chained log (AC-11, SEC-6)
**And** each action is signed by the acting principal's key (SEC-6)
**And** the read path projects from the log (AC-11)
**And** the supersession orchestrator coordinates db + graph + citation (STR-6b)
**And** counsel review path is tiered: redacted summaries first, full content only on documented need-to-know (SEC-6)
**And** team-comms-as-republishers is documented as policy (SEC-7)

### Story 8.5: Demo Readiness & Adversarial Demo Script (DR-1 through DR-6, SM-6, SM-7)

As a build team lead,
I want the demo corpus and adversarial demo script ready,
So that the platform can be presented to external audiences with provenance-on-demand and honest framing.

**Acceptance Criteria:**

**Given** Epics 1-8 are complete and the Pre-External Gate has passed
**When** demo readiness is assessed
**Then** DR-1 — Demo corpus: Sara Duterte case is deep enough for credible demos across all v1 surfaces (chat, graph, timeline, evidence, senator dashboard) (DR-1)
**And** SM-6 — Corpus targets met: >=300 documents, >=800 entities, >=1,500 relationships (hard floor) (SM-6)
**And** DR-2 — Adversarial demo script: rehearsed demo deliberately includes questions the platform cannot answer to showcase citation-or-silence (DR-2)
**And** SM-7 — Adversarial demo passes: curated "unanswerable" questions all return "no sourced answer"; curated answerable questions all return cited, correctly-tagged answers; 100% on the curated set (SM-7)
**And** the adversarial set is authored/reviewed at least in part external to the build team (>=30% externally authored) (SM-7, NFR-O-2)
**And** DR-3 — Provenance-on-demand: every demo answer drills from assertion to citation to evidence to raw source passage, live (DR-3)
**And** DR-4 — Honest framing: the presentation states what v1 does not do as clearly as what it does (DR-4)
**And** DR-5 — Pre-External Gate executed and recorded (DR-5)
**And** DR-6 — Live retraction scenario: the demo shows what happens when a source is corrected/retracted (DR-6)