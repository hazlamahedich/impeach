---
story_id: '2.6c'
story_key: '2-6c-english-extraction-quality-eval-gate'
epic: 'Epic 2: Provenance & Invariants'
status: proposed
last_updated: '2026-07-03'
depends_on: []
---

# Story 2.6c: English Extraction-Quality Eval Gate (the volume-critical path) (OQ-9-EN, VAL-10)

Status: proposed

> **This story was MISSING from the backlog.** It was surfaced by the Story 2.6 party-mode review (finding F1) and codified by the **VAL-10** architecture amendment: the project owner's ground truth is that **most source articles are in English.** The original G-3 premise ("Filipino is the production case") conflated *volume* (English = majority serving path) with *defamation salience* (Filipino = highest-risk subset). Under the corrected premise, the **English extraction-quality gate is the volume-critical path** — the first gate required to unblock defamation-grade serving of the majority corpus. There is currently no English eval spec anywhere in the backlog.

## Story

As a **developer and compliance officer**,
I want an English extraction-quality eval gate with a frozen, version-controlled English corpus and a defamation-grade measurement protocol,
so that the majority serving path (English) can extract claims with proven, citation-faithful quality before any claim of English coverage.

## Acceptance Criteria

### Behavioral (stakeholder-verifiable)

1. **English eval-set ADR accepted (OQ-9-EN, VAL-10):**
   - **Given** the ADR folder at `docs/adr/`,
   - **When** the new ADR (proposed `0026-english-eval-set-spec.md`) is reviewed,
   - **Then** it is accepted with evidence defining: the English corpus as the *volume-production* eval; defamation-relevant English registers (formal, journalistic, legal) codified; a frozen, version-controlled English fixture set with SHA-256 startup verification covering the **annotations**, not just source text.

2. **English quality gate enforced (OQ-9-EN):**
   - **Given** the English eval spec ADR,
   - **When** claims/relationships are extracted from English sources,
   - **Then** the ADR defines a strict quality gate — **same measurement protocol as OQ-9 (Filipino)**: stratified floor + red-line (never mean); Clopper–Pearson 95% LCB ≥ 0.95 on the within-stratum pass rate; τ_red ≈ 0.50, τ_doc ≈ 0.90; n ≥ 100 with each stratum ≥ 30.
   - **And** if the gate is not met, the system falls back to a documented **coverage gap**: English sources ingested/searchable but claims not extracted, UI discloses the limitation.

3. **Measurement protocol + CI enforcement (mirrors OQ-9):**
   - **Given** the gate,
   - **When** evaluated in CI,
   - **Then** two-tier enforcement applies: `eval:smoke` (n=20 regression subset, merge-blocking per PR) + `eval:full` (n≥200, deploy-blocking on main/release; `--force`, never cached for releases).

4. **Annotation provenance (anti-circular):**
   - **Given** the English corpus,
   - **When** labels are created,
   - **Then** annotation provenance is specified (annotator eligibility, ≥3 annotators/doc, adjudication, Fleiss' κ ≥ 0.75), the hash covers the provenance manifest, and an LLM may never generate/adjudicate gold labels (LLM-as-judge permitted only when calibrated to human, κ ≥ 0.70).

## Tasks / Subtasks

- [ ] **Task 1: Author ADR-0026 (English eval-set spec)** following PC-3, bidirectionally linked to ADR-0001/0005/0008/0011 (golden corpus versioning).
- [ ] **Task 2: Define the measurement protocol** — reuse the OQ-9 protocol structure (see Story 2.6 review report appendix); justify/calibrate the 0.95 threshold via the RED/YELLOW/GREEN calibration procedure (legal "reckless disregard" tolerance).
- [ ] **Task 3: Build/freeze the English corpus** — n ≥ 100, stratified across claim types + registers, with annotation provenance.
- [ ] **Task 4: Wire the eval:smoke / eval:full gates** into the Turborepo `eval` pipeline (cache key includes model/prompt/corpus/detector/disclosure hashes).
- [ ] **Task 5: Implement the DR-4-style fallback** for gate-failure (ingested/searchable, no extraction, disclosed).

## Dev Notes

- **This is the volume-critical path, not 2.6b (Filipino).** Under VAL-10, English is unblocked first; Filipino (2.6b) is the salience gate sequenced after.
- The protocol is deliberately identical in shape to OQ-9 (Filipino) so the two gates compose; only the corpus + registers differ.
- Annotation provenance for English is lower-friction than Filipino (native English annotators are easier to source) — this gate can land before the Filipino annotator is procured.
- **Threshold provenance (F8):** do not ship 0.95 without the calibration report; an unjustified threshold is a legal vulnerability.

## References
- [Story 2.6 Review Report (F1, F4, F8 + OQ-9 protocol appendix)](file:///Users/sherwingorechomante/impeach/_bmad-output/implementation-artifacts/story-2-6-review-report.md)
- [Architecture: VAL-10 (language premise amendment)](file:///Users/sherwingorechomante/impeach/_bmad-output/planning-artifacts/architecture.md)
- [ADR-0011: golden corpus versioning](file:///Users/sherwingorechomante/impeach/docs/adr/0011-golden-corpus-versioning.md)

## Dev Agent Record
### Agent Model Used
(Pending)
### Completion Notes List
- Story 2.6c proposed 2026-07-03 from the Story 2.6 party-mode adversarial review (finding F1) + VAL-10.
## QA Results
*(Pending implementation)*
