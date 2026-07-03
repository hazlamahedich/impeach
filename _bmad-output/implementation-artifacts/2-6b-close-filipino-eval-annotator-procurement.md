---
story_id: '2.6b-measure'
story_key: '2-6b-close-filipino-eval-annotator-procurement'
epic: 'Epic 2: Provenance & Invariants'
status: blocked
last_updated: '2026-07-03'
split_from: '2-6b-close-filipino-eval-annotator-procurement (party-mode adversarial review 2026-07-03 — measurement slice)'
depends_on: ['2-6b-code-filipino-eval-gate-scaffolding (the gate machinery must exist before measuring)']
blocks: ['Filipino salience RELEASE gate (NOT the G-3 design gate — G-3 closes on specification via 2.6b-code + 2.6c)']
g3_status: release-gate-downstream-of-G-3
sibling: '2-6b-code (the code/design slice — ready-for-dev; G-3 design-gate-trackable)'
external_blockers:
  - 'Native-Filipino (L1) annotator procurement (owner: PM + human)'
  - 'Legal team τ_doc "reckless disregard" tolerance calibration (AC #5, F8; owner: Legal + Test architect)'
---

# Story 2.6b-measure: Filipino Eval — Corpus Annotation, κ Measurement, τ_doc Calibration, DR-4 Retirement (RELEASE gate)

Status: blocked (on two external dependencies — see front matter)

> **Filed 2026-07-03** as the **measurement slice** of the Story 2.6b-close split
> (party-mode adversarial review: 5 agents — Murat, Mary, Winston, Amelia, John — 3 rounds).
> This slice is the downstream **RELEASE gate** for the Filipino salience path — it gates whether Filipino
> extraction is safe to *serve*, NOT whether G-3 closes. The **code/design slice** (gate machinery, κ
> function, two-tier CI, ADR-0025 promotion on spec-completeness) is split to
> [Story 2.6b-code](file:///Users/sherwingorechomante/impeach/_bmad-output/implementation-artifacts/2-6b-code-filipino-eval-gate-scaffolding.md)
> (ready-for-dev). **This slice is OFF the G-3 critical path** under English-first launch.

## Story

As a **compliance officer and test architect**,
I want the Filipino golden corpus annotated by native-Filipino speakers with a measured κ ≥ 0.75, the OQ-9 gate passing on real data, the τ_doc threshold calibrated against the legal team's "reckless disregard" tolerance, and the DR-4 fallback retired for Filipino,
so that the Filipino salience extraction path is safe to serve (the release gate).

## Context (carried from the panel review + epic-AC verification)

- **This is a RELEASE gate, not the G-3 design gate.** epics.md L682: G-3 closes when both gates are **specified**; AR-24 calls G-3 a *Critical-DESIGN-gate*. G-3 closes in 2.6b-code (+ 2.6c) on specification. This slice gates the Filipino *release* — it requires the κ measurement to actually pass on real annotated data.
- **Two external blockers** (the prior story's `ready-for-dev` label was materially false — it carried these without flagging them):
  1. **Native-Filipino annotator procurement** (owner: PM + human). §9 reduced the additional-human headcount from 2 → 1 (anti lustay = annotator #1; +1 more human + optionally a named adjudicator). Under English-first launch, this is off the critical path — Filipino serving is a fast-follow, so the procurement lead time is a runway, not a release-date race.
  2. **Legal τ_doc calibration** (AC #5, F8; owner: Legal + Test architect). Deriving τ_doc from the RED-item false-negative rate vs the legal team's "reckless disregard" tolerance is an external legal judgment, not dev/annotator work. The 0.95 threshold is an *interim floor* with a documented sunset (Mary's F8: "industry uses 0.95" is not a defensible citation at defamation grade).
- **§9 Role-2 disjointness (orchestrator-verified):** Filipino *extraction* is measured against Qwen3-14B (local) — **disjoint** from the Gemini 2.5 Pro co-rater → Role-2 is safe for extraction. Render-path RAGAS metrics have a same-family (Gemini↔Gemini) overlap → measure the human-only baseline κ delta there (Winston guardrail). No circularity collapse.
- **§9 firewall guardrails (Winston — above-contract RECOMMENDATION, epic is silent on headcount/statistic so §9 is epic-compliant):** (1) held-out calibration partition for the Gemini↔human κ ≥ 0.70 admission; (2) **no Gemini tie-breaking on committed gold** — a human adjudicator resolves 1-1 splits (the 3→2 headcount relaxation is only "real" if a human still adjudicates; otherwise Gemini is the deciding vote on the load-bearing contested items); (3) report a human-only pairwise Cohen's κ baseline alongside the Gemini-inclusive Fleiss' κ.
- **Owner-as-annotator independence (Mary — above-contract RECOMMENDATION):** the owner (anti lustay) may serve as annotator #1 but must **not** be the sole arbiter of κ pass/fail; the measurement sign-off requires an independent counter-sign.
- **The κ-vs-α decision is made in 2.6b-code** (recorded in ADR-0025). This slice *runs* the chosen statistic on real data.

## Acceptance Criteria

### Behavioral (stakeholder-verifiable)

1. **Annotator team sourced.** Under ADR-0025 §9: **≥2 native-Filipino (L1) human annotators** (anti lustay = #1; one additional human) + optionally a named adjudicator, with a documented provenance record (names/roles, conflict-of-interest attestation, language-competency attestation). Gemini 2.5 Pro carries §9 Role-1 (pre-annotation) + Role-2 (calibrated co-rater, if Gemini↔human κ ≥ 0.70 on the held-out set) + Role-3 (adjudication assistant) — never the sole source. **A 3rd human is an above-contract RECOMMENDATION for audit robustness (Winston/Mary), not a requirement** — the epic mandates only "annotation provenance." If a 1-1 human split occurs, a human adjudicator (not Gemini) resolves it.
2. **Golden Filipino corpus annotated.** A frozen, version-controlled corpus at `eval/corpus/golden/filipino/v0/` (created as target-state in 2.6b-code AC #8) with ≥100 libel-relevant documents (target ≥200), each annotated by ≥2 human annotators (Gemini pre-annotates per §9 Role-1; humans review/correct every document, flagging `llm-exposed` ratings). Items are clearly-fictional entities with a `FIXTURE_USE_ONLY` watermark + manifest SHA-256 asserted at test startup (no real-subject defamation exposure in fixtures).
3. **κ measured on the real corpus.** License statistic: Gemini↔human **Cohen's** κ ≥ 0.70 on the **held-out calibration partition** (admits Role-2; re-proven on every model swap). Gate statistic: **Fleiss'** κ ≥ 0.75 (or α — per the 2.6b-code decision) on the full corpus. **Human-only pairwise Cohen's κ baseline reported alongside** (Winston guardrail — quantifies how much of the agreement number Gemini carries). Corpus **rejected if human-only κ < 0.60**. §9 Role-2 disjoint for extraction (Qwen3↔Gemini); the delta is measured on the render-path (Gemini↔Gemini overlap).
4. **OQ-9 gate passes on the frozen corpus.** `CP_LCB_95(k/n) ≥ 0.95` for every metric (RAGAS Faithfulness, Citation Recall, Citation Precision, NLI) on the Filipino stratum; every document ≥ τ_red (≈0.50); per-document floor ≥ τ_doc (calibrated in AC #5). The `libel-injection detector recall ≥ 0.99` metric was struck to SEC-8 (parent AC #5) — **SEC-8 must be a hard predecessor** with its own held-out set + identical ≥0.99 threshold, else the corpus is poisonable (Murat: an uncaught adversarial injection frozen as "gold non-libelous" silently corrupts every downstream κ).
5. **τ_doc threshold calibrated (F8; owner Legal + Test architect).** τ_doc derived empirically from the RED-item false-negative rate vs the legal team's "reckless disregard" tolerance; the 0.95 interim floor is sunset. A threshold with no provenance is a vibe, not a standard (Mary F8).
6. **DR-4 fallback retired for Filipino (conditional).** ONLY when ACs #1–#5 pass: Filipino extraction is un-gated and the DR-4 disclosure is removed for Filipino. If any AC fails, DR-4 stays and the failure is documented. The fallback path was mutation-tested in 2.6b-code (Stryker, TS, `packages/render`); the retirement flip happens here, **sequenced after OQ-9 green** (Winston: do not remove the fallback before the new gate holds).

## Tasks / Subtasks

- [ ] **Task 1: Procurement (owner: PM + human)**
  - [ ] Source 1 additional native-Filipino (L1) annotator + optionally a named adjudicator.
  - [ ] Record annotator provenance (names/roles, COI attestation, language-competency attestation) in the provenance manifest.
  - [ ] Record the owner-independence mitigation (owner = annotator #1 but not sole κ arbiter; independent counter-sign).
- [ ] **Task 2: Golden corpus annotation (§9 LLM-assisted)**
  - [ ] Populate `eval/corpus/golden/filipino/v0/` (≥100 libel-relevant docs, fictional entities, `FIXTURE_USE_ONLY` watermark, manifest SHA-256 over the provenance manifest, not source text).
  - [ ] Gemini 2.5 Pro pre-annotates (§9 Role-1); humans review/correct every document, flagging `llm-exposed` ratings.
  - [ ] Each high-risk-stratum document rated by ≥2 human annotators; **a human adjudicator (not Gemini) resolves 1-1 splits**.
  - [ ] Compute the license statistic (Gemini↔human Cohen's κ ≥ 0.70 on the held-out calibration partition) + the gate statistic (Fleiss' κ ≥ 0.75, or α per 2.6b-code) + the human-only baseline Cohen's κ; reject corpus if human-only κ < 0.60.
- [ ] **Task 3: OQ-9 gate run on the frozen corpus** (uses the `oq9.ts` module from 2.6b-code)
  - [ ] Confirm SEC-8 libel-injection detector recall ≥ 0.99 as a hard predecessor (held-out set).
  - [ ] Run `OQ9_PASS`; record the result.
- [ ] **Task 4: τ_doc calibration (F8; owner Legal + Test architect)**
  - [ ] Derive τ_doc from RED-item false-negative rate vs "reckless disregard" tolerance.
  - [ ] Sunset the 0.95 interim floor; update ADR-0025 with the calibrated value.
- [ ] **Task 5: DR-4 fallback retirement (conditional, only if ACs #1–#5 pass)**
  - [ ] Un-gate Filipino extraction; remove the DR-4 disclosure for Filipino.
  - [ ] The fallback path is already mutation-tested (2.6b-code); flip the retirement, sequenced after OQ-9 green.

## Dev Notes

- **This slice is the RELEASE gate, not G-3.** Do not gate G-3 on this work — G-3 closes on specification (2.6b-code + 2.6c). This slice gates whether Filipino is safe to serve.
- **Do NOT re-author ADR-0025's §9 protocol.** Run it. The §9 guardrails + owner-independence mitigation are recorded in the ADR by 2.6b-code.
- **Circularity firewall:** LLM-generated/adjudicated gold labels are forbidden. LLM-as-judge only with κ ≥ 0.70 human calibration (on a held-out partition), alongside humans, never the sole source — and a human adjudicates 1-1 splits.
- **Hash discipline:** SHA-256 covers the provenance manifest (labels + annotator attestations + `llm-exposed` flags), not the source text.
- **Legal exposure:** fixtures containing allegedly-defamatory quotations may constitute republication under PH cyberlibel — use clearly-fictional entities + the watermark + the manifest hash.

### Project Structure Notes

- **Golden Corpus Path:** `eval/corpus/golden/filipino/v0/` (root-anchored). Created as target-state by 2.6b-code AC #8; populated here.

### References

- [ADR-0025 (Filipino salience eval-set spec — Accepted by 2.6b-code Task 7)](file:///Users/sherwingorechomante/impeach/docs/adr/0025-filipino-eval-set-spec.md)
- [Story 2.6b-code (sibling — the code/design slice, ready-for-dev)](file:///Users/sherwingorechomante/impeach/_bmad-output/implementation-artifacts/2-6b-code-filipino-eval-gate-scaffolding.md)
- [Story 2.6 (parent — 2.6a shipped to review)](file:///Users/sherwingorechomante/impeach/_bmad-output/implementation-artifacts/2-6-retention-takedown-schema-filipino-eval-spec.md)
- [Story 2.6 Review Report (party-mode adversarial, parent)](file:///Users/sherwingorechomante/impeach/_bmad-output/implementation-artifacts/story-2-6-review-report.md)
- [ADR-0011 (Golden Corpus Versioning — amended for per-language chains by 2.6b-code)](file:///Users/sherwingorechomante/impeach/docs/adr/0011-golden-corpus-versioning.md)
- [Architecture: VAL-10 (English volume / Filipino salience); SEC-8; ADR-005](file:///Users/sherwingorechomante/impeach/_bmad-output/planning-artifacts/architecture.md)
- [Epic AC (epics.md L666–682 — G-3 = design gate; Filipino sequenced after English)](file:///Users/sherwingorechomante/impeach/_bmad-output/planning-artifacts/epics.md)

## Dev Agent Record

### Agent Model Used

*(Pending — blocked on procurement)*

### Debug Log References

N/A

### Completion Notes List

- **Filed 2026-07-03** as the measurement slice of the 2.6b-close split. Drafted by the party-mode orchestrator from the panel consensus (Murat/Mary/Winston/Amelia/John, 3 rounds). Status flipped from the prior `ready-for-dev` (materially false — procurement + Legal blockers) to `blocked`.

### File List

- `_bmad-output/implementation-artifacts/2-6b-close-filipino-eval-annotator-procurement.md` — **REWRITTEN** — this story (now the 2.6b-measure slice; was the unsplit 2.6b-close).

## QA Results

### Automated Test Results

*(Pending — blocked on native-Filipino annotator procurement AND Legal τ_doc calibration. Off the G-3 critical path under English-first launch.)*
