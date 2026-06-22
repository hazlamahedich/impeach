---
date: '2026-06-22'
status: complete
stepsCompleted:
- document_discovery
- prd_analysis
- epic_coverage_validation
- ux_alignment
- epic_quality_review
- final_assessment
selected_prd: /Volumes/One Touch/impeach/_bmad-output/planning-artifacts/prds/prd-impeachment-watch-2026-06-19/prd.md
selected_prd_addendum: /Volumes/One Touch/impeach/_bmad-output/planning-artifacts/prds/prd-impeachment-watch-2026-06-19/addendum.md
selected_architecture: /Volumes/One Touch/impeach/_bmad-output/planning-artifacts/architecture.md
selected_epics: /Volumes/One Touch/impeach/_bmad-output/planning-artifacts/epics.md
selected_ux_design: /Volumes/One Touch/impeach/_bmad-output/planning-artifacts/ux-designs/ux-impeachment-watch-2026-06-19/DESIGN.md
selected_ux_experience: /Volumes/One Touch/impeach/_bmad-output/planning-artifacts/ux-designs/ux-impeachment-watch-2026-06-19/EXPERIENCE.md
missing_documents:
- ux-designs/ux-impeachment-watch-2026-06-19/index.md (using DESIGN.md + EXPERIENCE.md
  instead)
duplicate_issues:
- No whole-vs-sharded duplicates detected.
notes:
- Stories are not a separate artifact; user confirmed epics.md is the source.
last_updated: '2026-06-22'
---
# Implementation Readiness Assessment Report

**Date:** {{date}}
**Project:** {{project_name}}

## PRD Analysis

### Functional Requirements (27 FRs)

- **FR-1.1**: Source registry — register/configure sources by type and crawl strategy with confirmed trust tier
- **FR-1.2**: Lawful-access gate — public/lawful sources only; disable never bypass
- **FR-1.3**: Discover, fetch, deduplicate by content checksum
- **FR-1.4**: Immutable raw snapshots
- **FR-1.5**: Per-artifact provenance (source doc + character span)
- **FR-1.6**: Idempotent, observable, resilient ingestion jobs
- **FR-1.7**: Operator triage surface
- **FR-2.1**: Schema-validated extraction with extraction-time substring validation
- **FR-2.2**: Claim & evidence modeling with active refutes/contextualizes extraction
- **FR-2.3**: Conservative entity resolution
- **FR-2.4**: Deterministic graph projection (derived from canonical relational data)
- **FR-2.5**: Fact-vs-claim tagging & source-verb preservation
- **FR-3.1**: Natural-language Q&A with citation-or-silence
- **FR-3.2**: Anti-hallucination gate (substring validation at extraction and serving)
- **FR-3.3**: Intent-aware retrieval with ≥80% intent accuracy
- **FR-3.4**: Evidence explorer (honest split)
- **FR-3.5**: Interactive graph explorer (hop-capped, performant)
- **FR-4.1**: Timeline explorer (day/week/month/year)
- **FR-4.2**: Senator/entity dashboard early view
- **FR-5.1**: Inline citation rendering
- **FR-5.2**: Visual claim distinction
- **FR-5.3**: No-evidence empty state
- **FR-5.4**: Honest non-claims
- **FR-5.5**: Pre-external editorial & legal gate
- **FR-5.6**: Citation-quality display
- **FR-5.7**: Retraction / correction hook

Total FRs extracted: 26

### Non-Functional Requirements (groups)

- Editorial integrity (NFR-EI-1..8): citation coverage, allegation-as-fact, merge error, provenance, refutes recall, over-silence guard, fact/claim coverage/correctness, citation-quality floor.
- Performance (NFR-P-1..3): p95 <10s, ingestion throughput, hop-count caps.
- Security & access (NFR-S-1..5): read-only public API, parameterized queries, rate limiting, env secrets, private raw store.
- Legal/ethical/compliance (NFR-L-1..5): lawful ingestion, PH DPA posture, cyberlibel hard gate, retention policy TBD, retraction workflow.
- Provenance/auditability (NFR-A-1..3): raw-snapshot trace, deterministic re-extraction, idempotent upserts.
- Reliability (NFR-R-1..3): single-node best-effort, per-agent queues/backoff/DLQ, resume-after-crash.
- Local-first/deployment (NFR-D-1..3): single workstation, local models default, open-source stack.
- Observability (NFR-O-1..2): structured logs/metrics/traces; groundedness eval harness with hard/soft gates.

Total NFRs (individual): 31

### Additional Requirements / Constraints

- Single-case v1 (Sara Duterte impeachment); multi-case deferred.
- Pre-External Presentation Gate mandatory before any external audience.
- Filipino-language coverage is a gated capability (OQ-9); if fails, v1 is English-only with stated gap.
- Local-model feasibility check required before claiming cloud is never needed (NFR-D-2 / RK-5a).
- Retraction/correction takedown workflow defined by legal review (OQ-10).

### PRD Completeness Assessment

The PRD is structurally complete for an internal-first v1. It defines binding editorial invariants (EI-1..8), explicit scope (in/out), success metrics, demo readiness requirements, legal gates, and an assumptions/open-questions register. The most material open items are pre-build gates (OQ-1 embedding/dimension lock, OQ-4 legal counsel assignment, OQ-10 takedown workflow) rather than missing requirements.

---

## Epic Coverage Validation

### Coverage Matrix

| FR | PRD Requirement | Epic Coverage | Status |
|---|---|---|---|
| FR-1.1 | Source registry — register/configure sources by type and crawl strategy with confirmed trust tier | Epic 3 / Story 3.1 | Covered |
| FR-1.2 | Lawful-access gate — public/lawful sources only; disable never bypass | Epic 3 / Story 3.2 | Covered |
| FR-1.3 | Discover, fetch, deduplicate by content checksum | Epic 3 / Story 3.3 | Covered |
| FR-1.4 | Immutable raw snapshots | Epic 3 / Story 3.4 | Covered |
| FR-1.5 | Per-artifact provenance (source doc + character span) | Epic 3 / Story 3.5 | Covered |
| FR-1.6 | Idempotent, observable, resilient ingestion jobs | Epic 3 / Story 3.6 | Covered |
| FR-1.7 | Operator triage surface | Epic 3 / Story 3.7 | Covered |
| FR-2.1 | Schema-validated extraction with extraction-time substring validation | Epic 4 / Story 4.2 & 4.3 | Covered |
| FR-2.2 | Claim & evidence modeling with active refutes/contextualizes extraction | Epic 4 / Story 4.4 | Covered |
| FR-2.3 | Conservative entity resolution | Epic 4 / Story 4.5 | Covered |
| FR-2.4 | Deterministic graph projection (derived from canonical relational data) | Epic 4 / Story 4.8 & 4.9 | Covered |
| FR-2.5 | Fact-vs-claim tagging & source-verb preservation | Epic 4 / Story 4.10 | Covered |
| FR-3.1 | Natural-language Q&A with citation-or-silence | Epic 5 / Story 5.3 | Covered |
| FR-3.2 | Anti-hallucination gate (substring validation at extraction and serving) | Epic 5 / Story 5.3 | Covered |
| FR-3.3 | Intent-aware retrieval with ≥80% intent accuracy | Epic 5 / Story 5.1 | Covered |
| FR-3.4 | Evidence explorer (honest split) | Epic 5 / Story 5.6 | Covered |
| FR-3.5 | Interactive graph explorer (hop-capped, performant) | Epic 6 / Story 6.1 & 6.2 | Covered |
| FR-4.1 | Timeline explorer (day/week/month/year) | Epic 7 / Story 7.1 | Covered |
| FR-4.2 | Senator/entity dashboard early view | Epic 7 / Story 7.2 | Covered |
| FR-5.1 | Inline citation rendering | Epic 5 / Story 5.4 | Covered |
| FR-5.2 | Visual claim distinction | Epic 5 / Story 5.4 | Covered |
| FR-5.3 | No-evidence empty state | Epic 5 / Story 5.3 & 5.4 | Covered |
| FR-5.4 | Honest non-claims | Epic 5 / Story 5.3 & 5.4 | Covered |
| FR-5.5 | Pre-external editorial & legal gate | Epic 8 / Story 8.2 | Covered |
| FR-5.6 | Citation-quality display | Epic 5 / Story 5.4 & 5.5 | Covered |
| FR-5.7 | Retraction / correction hook | Epic 8 / Story 8.3 | Covered |

### Missing Requirements

No PRD FRs are missing from the epic coverage map. All 27 FRs map to an epic/story.

### Additional Items in Epics Not Explicitly in PRD FRs

- Architecture requirements (AR-1..28) are folded into Epics 1, 2, and 8.
- UX design requirements (UX-DR1..56) are distributed across all epics.
- Foundation/invariant epics (Epic 1, Epic 2) have no direct FR ownership but are correctly framed as enabling/cross-cutting.

### Coverage Statistics

- Total PRD FRs: 26
- FRs covered in epics: 26
- Coverage percentage: 100%


## UX Alignment Assessment

### UX Document Status

Found. Two UX source documents used:
- `DESIGN.md` — visual tokens, typography, component anatomy, do's/don'ts.
- `EXPERIENCE.md` — behavioral spine, component patterns, state patterns, flows, accessibility floor, narrative beats, operator manual-upload flow.

### UX ↔ PRD Alignment

| PRD Requirement | UX Treatment | Alignment |
|---|---|---|
| EI-1 Citation-or-silence | `<Citation.Empty>` default; promotes to `<Citation.Chip>` only when provenance resolves; silence state as first-class trust signal. | Aligned |
| EI-2 Fact vs. attributed claim | `<Claim>` variants (fact/attributed/dashed) with border + italic + weight, not color alone. | Aligned |
| EI-3 Source-verb preservation | `source-verbs.ts` registry; `<SourceVerbTag>` renders verbs verbatim. | Aligned |
| EI-7 Honest evidence split | Evidence split three panels; one-sided empty state uses PRD §6.3 verbatim copy. | Aligned |
| FR-3.5 Graph explorer | One shell + tier-routed renderers (Cytoscape/Sigma/React Flow); hop-capped; temporal scrubber. | Aligned |
| FR-4.1 Timeline explorer | Day/week/month/year granularity; imprecise dates as ranges; 15 narrative beats as markers. | Aligned |
| FR-4.2 Senator dashboard | Lightweight v1 read-model (statements, votes, participation); full dashboard deferred to Phase 2. | Aligned |
| FR-5.3 No-evidence empty state | "No sourced answer found." verbatim; no "try rephrasing." | Aligned |
| FR-5.4 Honest non-claims | No "verified/confirmed/true"; no-prediction response as first-class state. | Aligned |
| FR-5.5 Pre-External Gate | Editorial review risk-tier badges (green/amber/red) and sign-off workflow surfaced. | Aligned |

### UX ↔ Architecture Alignment

| UX Need | Architecture Support | Alignment |
|---|---|---|
| Next.js 15 App Router + Tailwind 4 + shadcn | AR-1 F1 scaffold includes Next 15, React 19, Tailwind 4. | Aligned |
| RSC fetch to `/api/v1` + React Query + Zustand + nuqs | AR-1 web app; UX-DR28-31 explicitly map to these tools. | Aligned |
| `/claim/[id]` addressable | AR-17 / STR-7 first-class route. | Aligned |
| Graph tier-router (Cytoscape/Sigma/React Flow) | STR-9 decision matrix; `lib/graph/types.ts` shared model. | Aligned |
| Citation compound component boundary | AC-2 render gate structurally separate from RAG; `packages/render` imports only `@iip/contracts`. | Aligned |
| Accessibility WCAG 2.1 AA | EXPERIENCE.md accessibility floor matches architecture's regulated-leaning posture. | Aligned |
| Operator manual-upload surface | EXPERIENCE.md defines `/admin/upload` flow; architecture's two-person intake state machine (SEC-2) supports it. | Aligned |

### Alignment Issues

1. **Mobile graph "simplified radial" on `md` breakpoint** is labeled `[ASSUMPTION]` in EXPERIENCE.md (line 222). It is an approach, not a final spec, pending Google Stitch mock confirmation. This is a design-risk item, not a PRD mismatch.
2. **Operator surfaces behavioral spec is intentionally thin** ("out of external-presentation scope"). For a tool whose integrity depends on operator triage, this is acceptable for v1 if the core operator stories (Stories 3.1-3.7, 8.3-8.4) fully specify behavior. It is a scoping choice, not an alignment gap.
3. **No first-run/onboarding UX** is explicitly noted as intentional. v1 assumes trained operator and briefed presentation audience. This is consistent with internal-first scope.

### Warnings

- UX documents are rich and well-aligned. No missing-UX warning required.
- The `[ASSUMPTION]` on mobile graph simplified radial should be resolved before final mobile acceptance tests, but it does not block F1 implementation.


## Epic Quality Review

### Review Method

Applied `create-epics-and-stories` standards: epics must deliver user value, be independently completable (Epic N does not require Epic N+1), stories must be appropriately sized with clear BDD acceptance criteria, and no forward dependencies are permitted.

### Per-Epic Quality Assessment

| Epic | Title | User Value | Independence | Story Sizing | Notes |
|---|---|---|---|---|---|
| Epic 1 | Foundation | Developer/team value (scaffold, toolchain, design tokens, CI). Justifiable because the integrity spine (render-gate ESLint boundary, RED contract test, ADRs) is user-value-aligned. | Yes — no dependency on later epics. | 12 stories; Story 1.1 is scaffold-only (acceptable for greenfield). Story 1.12 is a RED contract test, intentionally skipped in Epic 1. | Acceptable |
| Epic 2 | Provenance & Invariants | System-level value: citation-or-silence invariant goes GREEN. Cross-cutting but necessary before any claim can be served. | Yes — depends only on Epic 1. | 9 stories. Some are ADR-heavy (2.5, 2.6, 2.7) — these are design-gate stories, not user stories, but they resolve VAL-2 critical gaps required before claim-touching milestones. | Acceptable with note |
| Epic 3 | Source Onboarding & Intelligence Ingestion | Operator value: register sources, confirm lawful access, ingest, triage. | Yes — depends on Epic 1 + 2. | 7 stories; each maps to one FR and has BDD ACs. Story 3.3 includes deferred adapter scaffolding (acceptable). | Acceptable |
| Epic 4 | Extraction & Knowledge Graph Construction | Operator/team value: extract entities/claims/evidence, build graph. | Yes — depends on Epics 1-3. | 11 stories; includes eval-harness scaffold (4.1) and mid-epic checkpoint (4.11). Stories are sized to observable outcomes. | Acceptable |
| Epic 5 | Investigative Query & Evidence | Future-user value: ask questions, get cited answers, explore evidence. | Yes — depends on Epics 1-4. | 6 stories; covers chat, claim surface, evidence explorer, RAG pipeline. | Acceptable |
| Epic 6 | Graph Exploration | Future-user value: explore knowledge graph. | Yes — depends on Epics 1-4 (does not require Epic 5). | 5 stories; tier-router, renderers, modes, scrubber, accessibility. | Acceptable |
| Epic 7 | Temporal Views & Entity Dashboards | Future-user value: timeline, senator dashboard, document viewer. | Yes — depends on Epic 1-4 (does not require Epic 5 or 6). | 5 stories; includes narrative beats (7.4) and responsive degradation (7.5). | Acceptable |
| Epic 8 | Editorial Governance | Editorial owner/legal counsel value: Pre-External Gate, retraction, audit trail, demo readiness. | Yes — depends on Epics 1-7. | 5 stories; G1-G8 gate prefix/suffix, retraction, editorial workflow, demo readiness. | Acceptable |

### Dependency Analysis

- **No forward dependencies detected.** Every epic only depends on earlier epics.
- **Within-epic dependencies are logical:** e.g., Story 4.11 checkpoint depends on 4.2-4.10; Story 5.3 depends on 5.1/5.2; Story 8.2 human suffix depends on 8.1 machine prefix. These are intra-epic sequencing, not forward references.
- **No Epic N requires Epic N+1.** Verified.
- **Database/schema creation is story-local:** Stories 3.1-3.7 introduce `sources`/`documents` tables; Story 4.2 introduces `staging_extractions`; Story 2.6 introduces retention/takedown fields. No "create all tables upfront" story exists.

### Story Structure / Acceptance Criteria Review

- **BDD Given/When/Then format** is consistently used.
- **Specific, testable ACs** are present (e.g., "pgvector 0.8.x, Apache AGE >=1.7.0 enabled" in Story 1.2).
- **Error/degraded states** are frequently included (e.g., Story 2.9 chaos failure-injection matrix; Story 5.3 `noEvidence: true`).
- **One concern:** Story 1.2 acceptance criterion cites "Apache AGE >=1.7.0", but `project-context.md` flags AGE 1.7.0 as unverified (latest GA appears to be 1.5.0). This is a **data-quality defect in the story**, not an epic-structural defect. It must be reconciled with ADR-002 before implementation.
- **Another concern:** Story 1.2 lists packages "contracts, db, graph, llm, ingest, rag, citation, render, eval, editorial, config, auth" — that's 12 packages. Story 1.2 of Epic 1 lists "12 packages" but earlier architecture language mentions ~13 packages and "packages/eval" plus "tools/eval". The exact package list is not a structural epic defect, but it should be reconciled before F1.

### Best Practices Compliance Checklist

| Criterion | Status | Notes |
|---|---|---|
| Epics deliver user value | ✅ | All epics name an actor and outcome. |
| Epics are independent (no forward deps) | ✅ | Verified. |
| Stories appropriately sized | ✅ | Generally single-FR or single-cross-cutting concern. |
| No forward dependencies | ✅ | None found. |
| DB tables created when needed | ✅ | Schema is story-local. |
| Clear acceptance criteria | ✅ | BDD format, specific outcomes. |
| Traceability to FRs maintained | ✅ | Coverage map + per-epic FR lists. |

### Quality Violations

No critical or major structural violations of `create-epics-and-stories` best practices were found.

#### Minor Concerns

1. **Story 1.2 AGE version mismatch** — cites AGE >=1.7.0, but project-context flags this as unverified. Fix by aligning with ADR-002 / project-context open item.
2. **Package count wording** — "12 packages" vs "~13 packages" / architecture. Reconcile exact list in Story 1.1/1.2 before F1.
3. **Epic 2 is design/ADR-heavy** — Stories 2.5-2.7 are not classic user stories. They are acceptable because they explicitly resolve VAL-2 critical gaps (G-2/G-3/G-6) before claim-touching milestones, but a purist would flag them. Document as intentional design-gate stories.
4. **Story 1.12 RED contract test** is intentionally skipped in Epic 1 and activated in Epic 2. This is correct pattern, but it creates a CI-policy dependency: CI must treat `skipped` ≠ `passing`. Ensure this is wired in branch protection.

### Recommendations

1. Resolve AGE version pin before any F1 scaffold work that depends on Story 1.2.
2. Publish the final package list in `project-context.md` and mirror it in Story 1.1 AC.
3. Add a one-line note in Epic 2 header explaining that Stories 2.5-2.7 are design-gate stories resolving VAL-2 critical gaps.
4. Confirm CI treats skipped contract tests as non-passing for Epic 2 merge gate.


## Summary and Recommendations

### Overall Readiness Status

**NEEDS WORK** — The PRD, epics, UX, and architecture are well-aligned and structurally complete, but several pre-build gates and data-quality defects must be resolved before F1 implementation should begin.

### Critical Issues Requiring Immediate Action

1. **Resolve AGE version pin discrepancy (Story 1.2).** The story cites "Apache AGE >=1.7.0", but `project-context.md` flags this as unverified (latest GA appears to be 1.5.0). This must be reconciled with ADR-002 before building the custom PostgreSQL image or the entire F1 scaffold is pinned to a non-existent version.
2. **Confirm bge-m3 serving path and lock embedding dimension (OQ-1 / project-context open item).** The PRD states bge-m3 1024-dim dense-only, but the runtime serving path (Ollama/TEI/vLLM/sentence-transformers) is unset. This is schema-affecting and must be decided before HNSW index creation.
3. **Retain cyberlibel/republication-aware counsel (OQ-4).** The Pre-External Presentation Gate (FR-5.5 / NFR-L-3) is mandatory before any external audience. Counsel retention is a pre-build scheduling gate, not a last-minute assignment.
4. **Define retraction/correction takedown workflow (OQ-10 / NFR-L-5).** The PRD defers exact retention/takedown steps to legal review. This is blocking for the Pre-External Gate, especially if retracted defamatory material is retained in raw snapshots.
5. **Resolve mobile graph "simplified radial" assumption (EXPERIENCE.md line 222).** Pending Google Stitch mock confirmation. Not F1-blocking, but must be resolved before final mobile acceptance.

### Recommended Next Steps

1. **Run a pre-build feasibility check on local models** (NFR-D-2 / RK-5a). Verify whether Qwen3-14B (per ADR-005) can hit the hard CI gates (groundedness ≥0.95, quote-validity 100%) on a pilot slice of the Sara Duterte corpus. If not, decide whether to lower gates or acknowledge cloud is required.
2. **Reconcile package count** in Story 1.1/1.2 with the final architecture package list and update `project-context.md`.
3. **Verify Qwen3-14B exact Ollama pull string** (ADR-005) and bge-m3 serving runtime before any LLM/embedding client code is written.
4. **Schedule cyberlibel counsel** and define the legal-review scope for OQ-5 (retention of retracted snapshots) and OQ-10 (takedown workflow).
5. **Confirm CI policy** that skipped contract tests (Story 1.12) are treated as non-passing at Epic 2 merge.

### Final Note

This assessment identified **5 critical issues** and **4 minor concerns** across PRD/epic/UX/architecture alignment, data-quality, and legal-preparation categories. The underlying plan is strong: 100% FR coverage, coherent epic sequencing, rich UX alignment, and explicit editorial/legal guardrails. Address the critical issues above before proceeding to F1 scaffold implementation to avoid building against unresolved schema, legal, or runtime assumptions.

---

Assessor: bmad-check-implementation-readiness skill run  
Date: 2026-06-22  
Status: complete



## Follow-up: Local-Model Feasibility Pilot (2026-06-22)

The recommended next step was executed: a pilot feasibility check of Qwen3:14B + bge-m3 on a 5-document Philippine impeachment slice.

### Initial Run (Naive RAG Prompt)

| Gate | Result | Target | Pass |
|---|---|---|---|
| quote_validity_rate | 21.1% | 100% | ❌ |
| groundedness_mean | 16.7% | ≥0.95 | ❌ |
| fact_claim_coverage_rate | 100% | 100% | ✅ |
| no_answer_rate | 100% | — | ✅ |
| p95_latency_s | 268.8s | ≤10s | ❌ |

**Finding:** The naive prompt allowed the model to fabricate/stitch quotes that were not contiguous substrings of the source chunks, and latency was far above target.

### Remediation: Verbatim-Citation Pipeline

A two-stage pipeline was tested:
1. Extract verbatim claim spans from retrieved chunks with a dedicated LLM call.
2. Generate the answer constrained to use only those verbatim spans; non-verbatim citations are filtered.

### Re-test Result (3 Questions)

| Gate | Result | Target | Pass |
|---|---|---|---|
| quote_validity_rate | **100%** | 100% | ✅ |
| groundedness_mean | **100%** | ≥0.95 | ✅ |
| fact_claim_coverage_rate | **100%** | 100% | ✅ |
| no_answer_rate | **100%** | — | ✅ |
| p95_latency_s | **147.2s** | ≤10s | ❌ |

**Conclusion:** The hard integrity gates (quote-validity, groundedness, fact/claim coverage) are reachable with engineering (verbatim-span extraction + a hard substring filter), but **latency remains 15× over the ≤10s target on this Apple Silicon host**.

### Decisions Applied

1. **PRD NFR-D-2 updated** to state local models are the default for ingestion/extraction/embedding, while the high-fidelity Q&A render path may require a cloud/stronger model tier when hard gates cannot be met on local hardware.
2. ** Open Items Register updated** with item 3a: model-tier split for Q&A must be decided before F1.
3. **Feasibility reports saved** to `_bmad-output/eval-artifacts/`:
   - `iip-feasibility-report-2026-06-22.md`
   - `iip-feasibility-report-2026-06-22.json`
   - `iip-feasibility-report-v2-fast.json` (verbatim-citation pipeline re-test)

### Remaining Critical Items

- Resolve AGE version pin (Story 1.2 / ADR-002).
- Decide Q&A model tier: faster local hardware/quantized model vs. cloud/stronger model.
- Retain cyberlibel counsel (OQ-4) and define retraction/takedown workflow (OQ-10).

