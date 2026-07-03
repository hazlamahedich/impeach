---
story_id: '2.6b-close'
story_key: '2-6b-close-filipino-eval-annotator-procurement'
epic: 'Epic 2: Provenance & Invariants'
status: backlog
last_updated: '2026-07-03'
split_from: '2-6-retention-takedown-schema-filipino-eval-spec (2.6b ACs #2/#3 — uncloseable in code without human annotators)'
depends_on: ['2-6-retention-takedown-schema-filipino-eval-spec']
blocks: ['G-3 release']
g3_status: OPEN-until-annotators-sourced
---

# Story 2.6b-close: Filipino Eval — Annotator Procurement, κ Measurement, ADR-0025 → Accepted

Status: backlog

> **Filed 2026-07-03** as a split from Story 2.6. Story 2.6 shipped its 2.6a slice
> (retention schema on `intake_documents`) to `review` and authored ADR-0025 as
> `Proposed`. The two ACs that could NOT be closed in code — AC #2 (ADR must be
> `Accepted` with real evidence) and AC #3 (Fleiss' κ ≥ 0.75) — live here.
> Fleiss' κ is mathematically undefined for fewer than 3 raters, so no amount of
> dev work on a single-annotator interim can satisfy AC #3. This story is the
> procurement + corpus-annotation + measurement + promotion work that closes G-3.

## Story

As a **compliance officer and test architect**,
I want the Filipino golden corpus annotated by ≥3 native-Filipino speakers with a measured Fleiss' κ ≥ 0.75, and ADR-0025 promoted `Proposed → Accepted`,
so that the Filipino salience extraction-quality gate (OQ-9, G-3) is real and the DR-4 fallback can be retired for Filipino.

## Context (carried from Story 2.6 + ADR-0025)

- **VAL-10:** Filipino is the **salience** production case (highest defamation-risk subset), NOT the volume case. English (Story 2.6c) is the volume case.
- **AC #2 / AC #3 blockers (from Story 2.6):** ADR-0025 is `Proposed` because (a) the golden Filipino corpus is not yet annotated by a real annotator team and (b) Fleiss' κ is undefined for <3 raters.
- **Interim annotator:** the project owner (anti lustay) is committed as annotator #1 of 3 (recorded in ADR-0025's `deciders` + Open Questions).
- **ADR-0025 is complete** (full OQ-9 protocol, DR-4 fallback, bidirectional links, adr-lint 24→25 GREEN) — this story does NOT re-author the spec, it produces the *evidence* the spec requires and flips the status.
- **Circularity firewall (load-bearing):** an LLM may NEVER generate or adjudicate gold labels. LLM-as-judge is permitted ONLY when calibrated to human agreement (κ ≥ 0.70), annotating alongside humans, never as the sole source.

## Acceptance Criteria

### Behavioral (stakeholder-verifiable)

1. **Annotator team sourced.** Under the ADR-0025 §9 LLM-assisted protocol, **≥2 native-Filipino (L1) human annotators** (anti lustay = #1; **one** additional human needed, down from two) + optionally a named adjudicator are onboarded, with a documented provenance record (names/roles, conflict-of-interest attestation, language-competency attestation). Gemini 2.5 Pro carries pre-annotation + calibrated co-rater + adjudication-assistant roles per §9 — never sole source.
2. **Golden Filipino corpus annotated.** A frozen, version-controlled golden corpus at `packages/eval/corpus/golden/filipino/v0/` (per ADR-0011 content-addressed discipline) with ≥100 libel-relevant documents (target ≥200), each annotated by ≥2 human annotators (Gemini pre-annotates per §9 Role 1; humans review/correct every document, flagging `llm-exposed` ratings). Items are clearly-fictional entities with a `FIXTURE_USE_ONLY` watermark + manifest SHA-256 asserted at test startup (no real-subject defamation exposure in fixtures).
3. **Fleiss' κ ≥ 0.75 measured (human–human) + Gemini↔human κ ≥ 0.70 (Role-2 calibration gate).** Inter-annotator agreement computed and recorded; corpus rejected if human κ < 0.60. The SHA-256 covers the **provenance manifest (labels + annotator attestations + `llm-exposed` flags), NOT the source text** (F5 fix).
4. **ADR-0025 promoted `Proposed → Accepted`.** The ADR's `status` flips to `Accepted`; the `evidence:` array carries real paths (the corpus manifest, the κ report, the annotator provenance record) — no "evidence pending" placeholders remain (adr-lint enforces this).
5. **OQ-9 gate passes on the frozen corpus.** `CP_LCB_95(k/n) ≥ 0.95` for every metric (RAGAS Faithfulness, Citation Recall, Citation Precision, NLI) on the Filipino stratum; every document ≥ τ_red (≈0.50); per-document floor ≥ τ_doc (≈0.90); libel-injection detector recall ≥ 0.99.
6. **Two-tier CI wired.** `eval:smoke` (n=20, merge-blocking per PR) + `eval:full` (n≥200, deploy-blocking on main/release; `--force`, never cached for releases) are implemented and passing.
7. **Filipino eval test location pinned.** The exact test file(s) + the artifact path(s) they parse are pinned (Task 3 deferred subtask from Story 2.6) — no "or" hand-wave.
8. **DR-4 fallback retired for Filipino (conditional).** ONLY when ACs #1–#5 pass: Filipino extraction is un-gated and the DR-4 disclosure is removed for Filipino. If any AC fails, DR-4 stays and the failure is documented.
9. **0.95 threshold calibration (F8).** τ_doc derived empirically from RED-item false-negative rate vs the legal team's "reckless disregard" tolerance; 0.95 interim floor sunset. Owner: Legal + Test architect.

## Tasks / Subtasks

- [ ] **Task 1: Procurement (owner: PM + human)**
  - [ ] Source **1** additional native-Filipino (L1) annotator (down from 2 under ADR-0025 §9) + optionally a named adjudicator.
  - [ ] Record annotator provenance (names/roles, COI attestation, language-competency attestation) in the provenance manifest.
- [ ] **Task 2: Golden corpus annotation (§9 LLM-assisted)**
  - [ ] Build/freeze `packages/eval/corpus/golden/filipino/v0/` (≥100 libel-relevant docs, fictional entities, `FIXTURE_USE_ONLY` watermark, manifest SHA-256).
  - [ ] Gemini 2.5 Pro pre-annotates the corpus (§9 Role 1); humans review/correct every document, flagging `llm-exposed` ratings.
  - [ ] Each high-risk-stratum document rated by ≥2 human annotators; adjudicator (or §9 Role-3 assistant) surfaces disagreements for human resolution.
  - [ ] Compute human–human Fleiss' κ + Gemini↔human κ (Role-2 calibration); record in the κ report; reject corpus if human κ < 0.60.
- [ ] **Task 3: ADR-0025 promotion**
  - [ ] Flip ADR-0025 `status: Proposed → Accepted`.
  - [ ] Replace `evidence:` placeholders with real paths (manifest, κ report, provenance record).
  - [ ] Re-run adr-lint (must stay GREEN; no "evidence pending" markers remain).
- [ ] **Task 4: OQ-9 gate implementation + two-tier CI**
  - [ ] Implement the OQ-9 pass/fail rule (`CP_LCB_95(k/n) ≥ 0.95 ∀ metric`, etc.).
  - [ ] Wire `eval:smoke` (n=20, per-PR) + `eval:full` (n≥200, deploy-blocking; `--force`, never cached for releases).
  - [ ] Pin the Filipino eval test file(s) + parsed artifact path(s) (Story 2.6 Task 3 deferred subtask).
- [ ] **Task 5: Threshold calibration (F8; owner: Legal + Test architect)**
  - [ ] Derive τ_doc from RED-item false-negative rate vs "reckless disregard" tolerance.
  - [ ] Sunset the 0.95 interim floor; update ADR-0025 with the calibrated value.
- [ ] **Task 6: DR-4 fallback retirement (conditional, only if ACs #1–#5 pass)**
  - [ ] Un-gate Filipino extraction; remove the DR-4 disclosure for Filipino.
  - [ ] Mutation-test the fallback path before retirement (each mutation must still produce safe behavior).

## Dev Notes

- **Do NOT re-author ADR-0025's protocol** — it is complete. This story produces the evidence and flips the status.
- **Circularity firewall:** LLM-generated/adjudicated gold labels are forbidden. LLM-as-judge only with κ ≥ 0.70 human calibration, alongside humans.
- **Hash discipline:** the SHA-256 covers the provenance manifest (labels + annotator attestations), not the source text.
- **Legal exposure:** fixtures containing allegedly-defamatory quotations may constitute republication under PH cyberlibel — use clearly-fictional entities + the watermark + the manifest hash.

### References

- [ADR-0025 (Filipino salience eval-set spec — Proposed)](file:///Users/sherwingorechomante/impeach/docs/adr/0025-filipino-eval-set-spec.md)
- [Story 2.6 (parent — 2.6a shipped to review)](file:///Users/sherwingorechomante/impeach/_bmad-output/implementation-artifacts/2-6-retention-takedown-schema-filipino-eval-spec.md)
- [Story 2.6 Review Report (party-mode adversarial)](file:///Users/sherwingorechomante/impeach/_bmad-output/implementation-artifacts/story-2-6-review-report.md)
- [ADR-0011 (Golden Corpus Versioning)](file:///Users/sherwingorechomante/impeach/docs/adr/0011-golden-corpus-versioning.md)
- [Architecture: VAL-10 (English volume / Filipino salience)](file:///Users/sherwingorechomante/impeach/_bmad-output/planning-artifacts/architecture.md)

## Dev Agent Record

### Agent Model Used

ZCode (builtin:zai-coding-plan/GLM-5.2) — story filing only, 2026-07-03.

### Debug Log References

N/A (story filed to backlog; no implementation yet).

### Completion Notes List

- **Filed 2026-07-03** as a split from Story 2.6 to carry the uncloseable-in-code 2.6b ACs (#2 ADR-Accepted, #3 Fleiss' κ). Story 2.6's 2.6a slice (retention schema) is unaffected and in `review`.
- This is primarily a **procurement + human-annotation** story, not a pure dev story. The dev work (OQ-9 gate wiring, two-tier CI, test-location pinning, ADR promotion) is small once the annotators land and κ is measured.

### File List

- `_bmad-output/implementation-artifacts/2-6b-close-filipino-eval-annotator-procurement.md` — **NEW** — this story.

## QA Results

### Automated Test Results

*(Pending implementation — blocked on annotator procurement.)*
