---
title: 'Sprint Change Proposal — VAL-10 Language-Premise Correction (English volume / Filipino salience)'
project: impeachment-watch
date: 2026-07-03
author: anti lustay
scope_classification: Major
triggered_by: 'Story 2.6 party-mode adversarial review (6 agents, 3 rounds) + project-owner ground truth'
status: 'Applied (pending ratification)'
input_artifacts:
  - _bmad-output/implementation-artifacts/2-6-retention-takedown-schema-filipino-eval-spec.md
  - _bmad-output/implementation-artifacts/story-2-6-review-report.md
  - _bmad-output/planning-artifacts/architecture.md (VAL-2 G-3 premise)
  - _bmad-output/planning-artifacts/epics.md (Story 2.6 AC)
output_actions:
  - 'Append VAL-10 amendment to architecture.md Party-Mode Consensus block'
  - 'Amend Story 2.6 AC in epics.md (premise + split)'
  - 'File Story 2.6c (English eval gate — volume-critical path)'
  - 'Re-sequence backlog: English eval gate ahead of Filipino salience gate'
  - 'Ratify via review (human + architect)'
---

# Sprint Change Proposal — VAL-10 Language-Premise Correction

**Date:** 2026-07-03
**Author:** anti lustay
**Project:** Impeachment Watch (IIP)
**Scope:** Major (premise-level; affects backlog priorities + G-3 closure definition)
**Mode:** Targeted amendment

---

## Section 1: Issue Summary

### 1.1 Triggering Event

A party-mode adversarial review of Story 2.6 (6 agents — Winston, Murat, Mary, Amelia, John PM — across 3 rounds) surfaced that the architecture's foundational language premise is contradicted by the project owner's ground truth: **most source articles/documents are in English.**

### 1.2 Core Problem

VAL-2 G-3 states: *"Filipino is the PRODUCTION case, not a secondary i18n localization target."* This premise **conflated two axes that diverge**:

| Axis | English | Filipino/Taglish |
|---|---|---|
| **Volume** (documents processed) | **Majority** — the bulk serving path | Minority subset |
| **Defamation salience/risk** | High (Art. 353–362, Cybercrime §4(c)(4)) | **Highest** — vernacular political content, peak reputational stakes + cultural-context nuance |

Calling Filipino "the production case" because it is *highest-salience* while it is *minority-volume* is a category error. The premise used "production" to mean both "cannot be deprioritized" (true) and "is the main path" (false, by volume). Left uncorrected, this misroutes every downstream decision referencing G-3 and has already produced a **missing work item**: an English extraction-quality eval gate that is the *actual* volume-critical path.

### 1.3 Evidence
- Project-owner statement (ground truth): most source articles are English.
- `architecture.md` VAL-2 (line ~564): the original G-3 wording.
- Story 2.6 review report (`story-2-6-review-report.md`, finding F1): the volume/salience divergence analysis.
- Defamation-grade standard applies regardless of language (Revised Penal Code Art. 353–362; Cybercrime Prevention Act §4(c)(4)).

---

## Section 2: Impact Analysis

### 2.1 Architecture Impact
- **One new amendment: VAL-10** (appended to the Party-Mode Consensus block, after VAL-9). Corrects the volume implication of G-3 while preserving its anti-deprioritization intent.
- VAL-1's split verdict is unaffected. VAL-2's *other* Critical gaps (G-2, G-6, defamation-threshold ADR, hash-chain concurrency, blast-radius matrix) are unaffected.

### 2.2 Backlog / Sequencing Impact

| Item | Before VAL-10 | After VAL-10 |
|---|---|---|
| **English extraction-quality eval gate** | (did not exist) | **NEW Story 2.6c** — the volume-critical path; unblocks the majority serving path first |
| **Filipino eval gate (Story 2.6b)** | "the production gate" / critical-path blocker | relabeled **salience gate**; required but no longer the critical-path blocker; still blocked on native-Filipino annotator sourcing |
| **G-3 closure definition** | "closed by the Filipino ADR" | "closed only when BOTH the English (2.6c) and Filipino (2.6b) gates are specified" |
| **Native-Filipino annotator sourcing** | critical-path blocker | de-prioritized to salience-gate enabler (still required, sequenced after the English gate) |

### 2.3 Scope/Risk Impact
- **Net risk reduction.** The defamation-grade standard *strengthens* under the corrected frame: dual gates prove both majority-volume (English) and highest-salience (Filipino) extraction quality. A single Filipino-only gate would have left the majority serving path unproven — the larger silent exposure.
- No demotion of Filipino; the amendment is explicit that both languages are production, neither is i18n, and the binary was false.

---

## Section 3: The Amendment (VAL-10)

> **VAL-10 (Language-premise correction — English is the volume-production case).** The G-3 premise — *"Filipino is the PRODUCTION case, not i18n"* — is **contradicted by the project owner's ground truth: most source articles are in English.** "Production case" conflated two axes that diverge: **volume** (English = the majority serving path) vs **defamation salience/risk** (Filipino/Taglish = the highest-risk subset). This is a category error that, left uncorrected, misroutes every downstream decision referencing G-3. **Amended premise:** *English is the **volume** production case — the majority serving path requiring the **first** extraction-quality gate. Filipino is the **salience** production case — the highest-defamation-risk subset requiring its own dedicated gate, sequenced after (not instead of) English. Both are production. Neither is i18n. The binary was false.* **Consequences:** (a) an English extraction-quality eval gate (OQ-9-EN) is a missing work item and the actual volume-critical path (Story 2.6c); (b) the Filipino eval (2.6b) is relabeled from "production eval" to "salience gate" and remains required, but is no longer the critical-path blocker; (c) the defamation-grade standard strengthens under this frame — dual gates prove both majority-volume and highest-salience quality; (d) G-3 is NOT closed by the Filipino ADR alone; it closes when both the English (2.6c) and Filipino (2.6b) gates are specified. **This amendment supersedes the volume implication of the original G-3 wording while preserving its anti-deprioritization intent.**

---

## Section 4: Required Actions

### Already applied (2026-07-03)
- [x] VAL-10 appended to `architecture.md` (Party-Mode Consensus block, after VAL-9).
- [x] Story 2.6 AC amended in `epics.md` (premise correction + split into 2.6a/2.6b).
- [x] Story 2.6c (English eval gate) filed as a proposed story.
- [x] Story 2.6 story file updated (VAL-10 references, English-majority note).
- [x] `sprint-status.yaml` updated (2.6a ready-for-dev; 2.6c + 2.10 backlog; changelog).

### Pending (human / ratification)
- [ ] **Ratify VAL-10** — architect + human sign-off (premise change warrants explicit approval, not silent adoption).
- [ ] **Source the native-Filipino annotator** for Story 2.6b (procurement; de-prioritized but still required).
- [ ] **Obtain the legal team's "reckless disregard" tolerance** to calibrate the 0.95 OQ-9 thresholds (English and Filipino gates both need this).
- [ ] Decide whether the English gate (2.6c) authors ADR-0025 and the Filipino gate (2.6b) authors ADR-0026, or vice versa (adr-lint count implications).

---

## Section 5: Open Items for the Human

1. **Ratify or reject VAL-10.** It is applied but not yet ratified. If rejected, the original G-3 wording stands and Story 2.6c is withdrawn.
2. **Confirm the English-majority volume split** (e.g., ~60/40? 80/20?) — a rough ratio sharpens the corpus-composition specs for both gates.
3. **Annotator sourcing path** — internal, contractor, or academic partnership? This sets the 2.6b calendar.

---

## References
- [Architecture: VAL-10 (appended)](file:///Users/sherwingorechomante/impeach/_bmad-output/planning-artifacts/architecture.md)
- [Story 2.6 Review Report (finding F1)](file:///Users/sherwingorechomante/impeach/_bmad-output/implementation-artifacts/story-2-6-review-report.md)
- [Proposed Story 2.6c (English eval gate)](file:///Users/sherwingorechomante/impeach/_bmad-output/implementation-artifacts/2-6c-english-extraction-quality-eval-gate.md)
- [Precedent: Sprint Change Proposal 2026-06-19](file:///Users/sherwingorechomante/impeach/_bmad-output/planning-artifacts/sprint-change-proposal-2026-06-19.md)
