---
id: ADR-025
title: Filipino (Tagalog/Taglish) Salience Eval-Set Specification
status: Proposed
date: 2026-07-03
supersedes: null
superseded_by: null
deciders: [Winston (architect), Murat (test architect), Mary (analyst), Amelia (engineer), John (PM), anti lustay (interim Filipino annotator), user]
related: [AC-1, SC-1, VAL-2, VAL-10, G-3, OQ-9, DR-4, ADR-001, ADR-005, ADR-007, ADR-008, ADR-014, ADR-017, ADR-020]
evidence:
  - evidence pending procurement of 1 additional native-Filipino annotator + named adjudicator + Fleiss' κ ≥ 0.75 measurement (Story 2.6b blocker; headcount reduced from 2 to 1 by the §9 LLM-assisted protocol)
---

# ADR-025: Filipino (Tagalog/Taglish) Salience Eval-Set Specification

> **Status: Proposed.** Records the Filipino extraction-quality gate as a
> **salience** production target (VAL-10: highest defamation-risk subset),
> sequenced AFTER the English volume-production gate (Story 2.6c). This ADR
> cannot become `Accepted` until the corpus annotation provenance is real:
> ≥3 native-Filipino annotators, a named adjudicator, and a measured
> Fleiss' κ ≥ 0.75 (AC #3). As of 2026-07-03, **one** interim annotator
> (anti lustay) is committed; under the §9 LLM-assisted protocol, **one**
> additional human + an adjudicator are pending procurement. The protocol
> below is complete and binding; only the human-label provenance is incomplete.

## Context

VAL-10 corrects G-3's original premise. The platform's source corpus is
**English-majority** (project-owner ground truth): most articles are English.
"Filipino is the production case" conflated two axes that diverge:

- **Volume** — English is the majority serving path. The **English**
  extraction-quality gate (Story 2.6c) is the volume-critical path.
- **Defamation salience / risk** — Filipino/Taglish sources carry the
  **highest-risk subset** (specialized Philippine legal/political register:
  *kasong libelo*, *pinagbintangan*, *nagsampa*, *paglabag*, *hukuman*).
  General LLMs (incl. the local Qwen3-14B per ADR-005) fail on this register.
  A fabricated or mistranslated allegation in Tagalog/Taglish is no less
  defamatory than one in English; under PH cyberlibel (*Disini*) it may be
  *more* exposed (jurisdictional nexus).

So Filipino is **NOT** a secondary internationalization (i18n) layer. It is a
first-class **salience** production target with its own gate, scored and
reported separately. A blended English+Filipino mean is **forbidden** — it
would let a strong English stratum mask a failing Filipino stratum, exactly
the libel-relevant failure mode.

Taglish code-switching (bilingual English-Tagalog within a single span)
compounds the difficulty: a per-span language classifier is required, and a
mixed span must default to the **stricter** (Filipino) path so a defamatory
Tagalog clause embedded in English prose is not silently held to the English
threshold.

If the Filipino gate is not met, v1 must fall back to the **English-only
coverage gap** (DR-4): Filipino sources are ingested and searchable, but
claims and relationships are not extracted, and the UI/demo explicitly
discloses the limitation.

## Decision

### 1. Filipino is a salience gate, sequenced after the English volume gate

Story 2.6c (English extraction-quality eval gate) is the volume-critical path
and ships first. The Filipino salience gate (this ADR, Story 2.6b) is
sequenced after it. Both are real production gates; neither is i18n.

### 2. Golden Filipino corpus — content + provenance manifest

- A frozen, version-controlled golden Filipino corpus lives in-repo at
  `packages/eval/corpus/golden/filipino/v0/` (mirrors the ADR-0011
  content-addressed store discipline: a `manifest.json` enumerates items with
  per-item SHA-256; the manifest hash IS the corpus-version identity).
- Items are clearly-fictional entities (no real-subject defamation exposure in
  fixtures — fixtures containing allegedly-defamatory quotations may
  constitute republication under PH cyberlibel even as test data). Each item
  carries a `FIXTURE_USE_ONLY` watermark + a manifest SHA-256 asserted at test
  startup so fixture drift is caught.
- **The SHA-256 covers the provenance manifest (the labels + annotator
  attestations), NOT the source text.** Hashing only the source text is the
  F5 defect: it proves bytes didn't drift but nothing about *who vouches the
  labels*. An LLM-generated Filipino ground truth used to evaluate an LLM is
  circular — it always "passes."

### 3. Annotation provenance (the part that blocks `Accepted`)

- **≥3 native-Filipino (L1) annotators** per document, plus a **named
  adjudicator** who resolves disagreements. *Under the §9 LLM-assisted
  protocol, the human headcount can reduce to ≥2 humans on the high-risk
  stratum (Gemini pre-annotates + acts as a calibrated co-rater), but the
  human-cultural-judgment requirement means humans can never drop to zero.*
- **Fleiss' κ ≥ 0.75** across **human** annotators (reject the corpus if
  κ < 0.60). *Fleiss' κ is mathematically undefined for fewer than 2 raters.
  At exactly 2 raters Fleiss' κ collapses to Cohen's κ (the two-rater case is
  the boundary where the multi-rater formula reduces to the pairwise one); this
  ADR therefore permits a 2-human κ **on the high-risk RED-severity / Taglish
  stratum only**, where (a) the §9 Role-2 calibrated Gemini co-rater provides a
  third rating as a cross-check and (b) the cost of procuring 3 humans on every
  stratum would itself block G-3 indefinitely. A single human annotator cannot
  satisfy this AC; the human count may not drop below 2.*
- **Circularity firewall:** an LLM may **never** generate or adjudicate gold
  labels as the sole source. LLM-as-judge is permitted ONLY when calibrated to
  human agreement (κ ≥ 0.70), and even then it annotates alongside humans,
  never as the sole source of truth. Full LLM-assistance taxonomy in §9.
- **Interim status (2026-07-03):** anti lustay is committed as annotator #1
  of (now) 2 required humans under §9. One additional native-Filipino
  annotator + optionally a named adjudicator are pending procurement (PM +
  human owner; review report Open Item #1, revised by §9). Until those land
  and κ is measured, this ADR stays `Proposed` and the Filipino extraction
  path is gated off via the DR-4 fallback.

### 4. OQ-9 measurement protocol — stratified floor + red-line, NEVER mean

Aggregation is a **stratified floor + red-line**, never a mean or p95. A
single aggregate can hit 0.95 while silently failing every libel-relevant
Tagalog document.

- **Thresholds:**
  - τ_red ≈ 0.50 — instant per-document fail (a doc this bad is unambiguously
    defamation-grade broken; do not let the stratum average absorb it).
  - τ_doc ≈ 0.90 — per-document pass floor.
  - τ_stratum = 0.95 applied to the **one-sided Clopper–Pearson 95% lower
    confidence bound** on the within-stratum pass rate. (Clopper–Pearson, not
    a normal approximation — at the small n and extreme pass rates we run,
    the normal interval undercovers and silently passes.)
- **Sample size:** n ≥ 100 libel-relevant documents minimum (1-failure
  tolerance), n ≥ 200 target; **each stratum ≥ 30**. Power note: n ≈ 250 for
  genuine 0.95-vs-0.90 discriminating power.
- **Metrics scored:** RAGAS Faithfulness, Citation Recall, Citation Precision,
  NLI entailment. (See architecture.md Regression Thresholds: Citation
  Recall/Precision 0% absolute regression; Faithfulness absolute floor ≥0.85.)
- **Pass/fail rule:**
  `OQ9_PASS = (n≥100 ∧ every stratum≥30) ∧ (∀doc: metric≥τ_red) ∧
  (CP_LCB_95(k/n) ≥ 0.95 ∀ metric) ∧ (Fleiss' κ ≥ 0.75) ∧
  (LLM-judge↔human κ ≥ 0.70 where used) ∧ (provenance manifest SHA-256
  matches)`.
  *(Libel-injection detector recall is enforced separately by the SEC-8
  promptfoo red-team battery, not by this in-corpus pass rule — it is a
  distinct invariant with its own corpus and recall computation.)*
- **Filipino stratum scored and reported separately.** A blended
  English+Filipino mean is forbidden.

### 5. Two-tier CI enforcement

- **`eval:smoke`** — n=20, **merge-blocking per PR**. At n=20 the full OQ9_PASS
  rule (n≥100 ∧ stratum≥30) is structurally unsatisfiable, so smoke asserts a
  **relaxed subset** only: no τ_red violation on any sampled doc, no
  provenance-manifest SHA-256 mismatch, and schema-valid output. The stratified
  Clopper–Pearson floor and full κ measurement are deferred to `eval:full`.
  Smoke is a deterministic fast gate (<8 min per the PR lane); it is not a
  quality claim.
- **`eval:full`** — n≥200, **deploy-blocking on main/release**; invoked with
  `--force`, **never cached for releases** (a cached release eval is a
  non-eval).

### 6. Language detection

- Primary: **Lingua** (Tagalog model); fallback **fastText lid.176**.
- **Per-span classifier** for Taglish (code-switching within a span).
- A **mixed span defaults to Filipino** — fail toward the stricter DR-4 path.
- Confidence floor 0.85 → force the fallback classifier.
- **Misdetection on a RED-severity item counts against τ_red.**

### 7. DR-4 fallback (English-only coverage gap) when the gate is unmet

If the Filipino gate is unmet (today, because the corpus is unannotated; in
future, because a run regresses):

- Filipino sources are **ingested and searchable**, but **claims and
  relationships are not extracted**.
- The **UI/demo explicitly discloses** the limitation (locale-matched
  disclosure hashing to a canonical, lawyer-owned value).
- The fallback path is itself under test: property-based trigger + mutation
  testing (each mutation must still produce safe behavior) + 100% branch
  coverage on the fallback path.

### 8. Threshold provenance — τ_stratum = 0.95 is an interim floor, not a convention

At defamation grade a threshold is a legal argument, not a tuning knob.
"Industry uses 0.95" is not a defensible citation (review report F8). The
**τ_stratum = 0.95** Clopper–Pearson lower-bound floor here is an **interim
floor** with a **documented sunset** (one sprint). Separately, a calibration
task blocking G-3 release: derive **τ_doc** empirically from the RED-item
false-negative rate vs the legal team's "reckless disregard" tolerance. The
calibration result may raise (not lower) **τ_doc**; τ_stratum is fixed at
0.95 by the defamation-safety tolerance (Citation Recall/Precision: 0%
absolute regression per architecture.md), which is not subject to calibration.

### 9. LLM-assisted annotation protocol — what a cloud LLM (Gemini) may and may not do

A cloud LLM (e.g. **Gemini 2.5 Pro** — *not* Flash; annotation quality is
load-bearing, and the exact model version is recorded per the model-swap
protocol so a silent model bump can't drift the gold labels) is permitted in
**three** roles, and forbidden in one. This section makes the boundary
concrete so the procurement blocker shrinks from "≥3 humans + adjudicator"
to "≥2 humans" without compromising the circularity firewall (§3).

**The forbidden role — sole gold-label source / sole adjudicator.** Evaluating
an LLM (the extraction model, Qwen3-14B) against gold labels written by another
LLM (Gemini) measures LLM-vs-LLM agreement, not extraction quality. Two failure
modes ensue: (a) both models share a blind spot on a Tagalog legal register
(*kasong libelo*, *pinagbintangan*) so the gold is wrong the same way the
extraction is wrong and the gate "passes"; (b) Gemini is stronger than Qwen3,
so the score measures the gap between two models, not the gap between the model
and *truth*. There is also a Philippine-specific reason: under PH cyberlibel
(*Disini*) the legal test is *"how would a reasonable Filipino reader
understand this?"* — a human-cultural judgment, not a text-comprehension task.
A defamatory implication can live in an idiom or political dog-whistle that
even a fluent LLM misses. So "ground truth" for defamation is, by legal
definition, human. **An LLM may therefore never be the sole source of gold
labels or the sole adjudicator.**

**Role 1 — Pre-annotation (productivity; does NOT count toward κ).** Gemini
drafts labels for the whole corpus; a human reviews and corrects every
document. Standard NLP practice — 3–10× faster. Fleiss' κ is computed over
human raters only; pre-annotation is invisible to κ. *Exposure-discipline
requirement:* the human ideally writes their rating *before* seeing Gemini's
draft (or, at minimum, marks any rating changed after seeing the draft as
`llm-exposed`). The provenance manifest records the `llm-exposed` flag per
rating so a future audit can see where LLM draft may have biased a human.

**Role 2 — Calibrated co-rater (counts toward κ, with a gate).** On a
calibration subset, measure Gemini↔human κ; **if ≥ 0.70**, Gemini may annotate
*alongside* humans as one rater in the Fleiss' κ pool. The κ ≥ 0.70 calibration
is re-proven on every model swap (Gemini version drift breaks the calibration
silently). Below 0.70, Gemini is demoted to Role 1 only.

**Role 3 — Adjudication assistant (does not count toward κ).** Gemini surfaces
disagreements for a human adjudicator to resolve. It cannot be the tiebreaker
itself; the adjudicator's decision is recorded with the adjudicator's name.

**Reduced-headcount path to κ.** With Roles 1 + 2 combined, the procurement
blocker shrinks: anti lustay (annotator #1, human) reviews Gemini's
pre-annotation drafts (Role 1) for the full corpus, then **one** additional
native-Filipino human (annotator #2) independently rates the
RED-severity / Taglish-code-switched stratum (the high-risk subset where κ
actually needs to hold — full-corpus rating by #2 is optional). Human–human
Fleiss' κ is now computable on that stratum (2 human raters) and gated at
≥ 0.75; separately, Gemini↔human κ ≥ 0.70 is proven as the Role-2 calibration
gate. **Net: one additional human, not two** (plus the optional adjudicator
for Role 3 disagreement surfacing). The procurement Open Question #1 is
revised accordingly.

## Alternatives

1. **Treat Filipino as a secondary i18n layer under the English gate.**
   - Rejected (VAL-10). Conflates volume with salience; the English stratum
     would mask a failing Filipino stratum in any blended metric. Filipino is
     a first-class salience gate with its own threshold, scored separately.
2. **Aggregate mean / p95 instead of a stratified floor.**
   - Rejected (Murat F4). An aggregate can hit 0.95 while failing every
     libel-relevant Tagalog document. The Clopper–Pearson lower bound on the
     within-stratum pass rate is the minimum defamation-safe aggregation.
3. **LLM-generated Filipino gold labels (fast to produce).**
   - Rejected as a *sole* source (Murat + John F5). Circular: an LLM evaluating
     an LLM always "passes," and the *Disini* "reasonable Filipino reader" test
     is human-cultural by legal definition. Annotation provenance (native
     speakers, κ ≥ 0.75) is load-bearing; the hash must cover the provenance
     manifest. *LLM-assisted* annotation IS permitted within the firewall — see
     §9 for the three legitimate roles and the reduced-headcount path.
4. **Permit Filipino extraction in v1 with no gate ("ship and see").**
   - Rejected. Unverified local-model extraction on the highest-salience
     subset is the defamation-exposure scenario this gate exists to prevent.
     DR-4 fallback (ingest + search, no extraction, explicit disclosure) is
     the safe default.
5. **Defer the Filipino gate to post-v1 entirely.**
   - Rejected for the *model* (this ADR). The Taglish salience case is
     legally load-bearing; the spec must exist from the start even if the
     `Accepted` evidence (annotators + κ) lands later. The DR-4 fallback is
     the honest v1 behavior until the gate is met.
6. **Gemini as the sole annotator + adjudicator (maximal automation).**
   - Rejected. This is Alternative 3 dressed up as a productivity win. It
     collapses the circularity firewall (§3, §9 forbidden role): with no human
     in the loop there is no human-cultural judgment and no meaningful κ (κ
     measures *inter-human* agreement). The §9 protocol exists precisely to
     let Gemini do the heavy lifting *without* becoming the ground truth —
     pre-annotation (Role 1) + calibrated co-rater (Role 2) + adjudication
     assistant (Role 3), never sole source.

## Consequences

- Filipino extraction is **gated off in v1** via DR-4 (ingest + search, no
  claim extraction, explicit UI disclosure) until this ADR reaches `Accepted`
  — i.e. until ≥2 native-Filipino human annotators (under the §9
  LLM-assisted protocol) + optionally an adjudicator are procured, human–human
  Fleiss' κ ≥ 0.75 is measured on the high-risk stratum, and the OQ-9 protocol
  passes on the frozen corpus.
- `eval:smoke` (n=20, per PR) and `eval:full` (n≥200, deploy-blocking) are
  the two CI enforcement tiers; release runs are never cached.
- The Filipino stratum is scored and reported separately from English; no
  blended mean is produced or relied upon.
- 0.95 is an interim floor with a one-sprint sunset; τ_doc is re-derived from
  RED-item false-negative calibration before G-3 release.
- **A cloud LLM (Gemini 2.5 Pro) may carry most of the annotation labor** via
  §9 (pre-annotation + calibrated co-rater + adjudication assistant), reducing
  the procurement blocker from ≥3 humans to ≥2 — but it can never be the sole
  gold-label source or adjudicator, and every LLM-exposed human rating is
  flagged in the provenance manifest. The Gemini↔human κ ≥ 0.70 calibration is
  re-proven on every model swap.
- This ADR stays `Proposed` (with the single interim annotator noted) until
  procurement closes; the spec is binding, the evidence is not yet.

## Open questions

| # | Question | Owner | Trigger |
|---|----------|-------|---------|
| 1 | Source **1** additional native-Filipino annotator (down from 2 under the §9 LLM-assisted protocol) + optionally a named adjudicator. | PM + human | Story 2.6b-close unblock |
| 2 | Derive τ_doc empirically from RED-item false-negative rate vs legal "reckless disregard" tolerance (0.95 sunset). | Legal + Test architect | Pre-G-3 release |
| 3 | At what corpus size does in-repo storage (ADR-0011) hurt git performance enough to revisit for the Filipino corpus specifically? | Architect | When Filipino corpus exceeds ~10k items |
| 4 | Does the §9 Role-2 Gemini↔human κ ≥ 0.70 gate hold specifically on Taglish code-switched spans, or does calibration need to be stratified by language-mix ratio? | Test architect | First §9 calibration run |

*Note: an earlier draft listed "should the LLM-judge↔human κ calibration be
re-run on every model swap?" as an open question — that is now a settled
decision (§9 Role 2: the κ ≥ 0.70 calibration is re-proven on every model
swap; Gemini version drift breaks it silently), so it is removed from the
open-questions table.*
