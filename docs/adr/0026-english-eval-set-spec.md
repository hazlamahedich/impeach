---
id: ADR-026
title: "English Extraction-Quality Eval-Set Instance (OQ-9-EN) — the source-corpus volume path"
status: Accepted
date: 2026-07-03
supersedes: null
superseded_by: null
deciders: [Winston (architect), Murat (test architect), Mary (analyst), Amelia (engineer), John (PM), user]
related: [AC-1, SC-1, VAL-2, VAL-10, G-3, OQ-9, DR-4, ADR-001, ADR-011, ADR-014, ADR-025]
evidence:
  # Spec-completeness evidence (Story 2.6c, 2026-07-03). ADR-0026 is a THIN
  # INSTANCE RECORD: it inherits the protocol spine from ADR-0025 (Part I) by
  # reference and carries ONLY the English measurement-design decisions (English
  # strata, the Conversational/Social-English justification, the pointer to the
  # shared MECE disambiguation rule, and the rationale for each English-specific
  # decision). It does NOT re-state the pass rule, the metric definitions, the
  # sidedness, the freeze semantics, or the LLM-assisted protocol — those live
  # in ADR-0025 Part I once ("fix once where it lives" — Winston). Per the
  # party-mode panel (Winston decider-of-record), ADR-0026 promotes to Accepted
  # on SPEC-COMPLETENESS: the English instance is fully specified + the gate
  # machinery is inherited + the corpus manifest is reshaped to the
  # CorpusManifest schema. The κ ≥ 0.75 MEASUREMENT on real annotated English
  # data is RELEASE evidence (Story 2.6c-measure, procurement-blocked),
  # distinct from this design-gate acceptance — it gates release, not citation.
  # G-3 closes ONLY when BOTH gates are specified (epics.md L682): ADR-0025
  # (Filipino, Accepted) + ADR-0026 (English, this ADR, Accepted).
  - docs/adr/0025-filipino-eval-set-spec.md
  - docs/adr/0011-golden-corpus-versioning.md
  - docs/adr/0014-polyglot-eval-invocation-subprocess.md
  - docs/adr/0001-defamation-grade-operational-definition.md
  - packages/eval/src/oq9.ts
  - packages/eval/src/freeze.ts
  - packages/eval/src/manifest.ts
  - packages/eval/src/__tests__/english-oq9.spec.ts
  - eval/corpus/golden/v0/manifest.json
  - packages/render/src/gate-dr4-fallback.mutation.test.ts
  - docs/ci/eval-tiers.md
  - _bmad-output/planning-artifacts/architecture.md
  - _bmad-output/planning-artifacts/epics.md
---

# ADR-026: English Extraction-Quality Eval-Set Instance (OQ-9-EN) — the source-corpus volume path

> **Status: Accepted (2026-07-03, on spec-completeness — Story 2.6c).**
>
> This is a **thin instance record**: it inherits the **protocol spine**
> (ADR-0025 Part I — metric definitions, the recalibrated pass rule,
> sidedness, the n_min/INCONCLUSIVE contract, freeze semantics, the MECE
> stratum-disambiguation rule, uniform annotator eligibility, the two-tier CI
> enforcement, the LLM-assisted annotation protocol, the DR-4 fallback shape,
> threshold provenance, and metric+judge provenance) **by reference** and
> carries ONLY the English measurement design. Everything normative about how
> the gate works lives in ADR-0025 Part I once; this ADR does not re-state it
> (re-stating it would manufacture drift — Winston split-the-difference,
> Story 2.6c party-mode panel).
>
> **G-3 closes here.** `epics.md` L682: *"G-3 closes only when BOTH the English
> and Filipino gates are specified."* ADR-0025 (Filipino, Accepted) +
> ADR-0026 (English, this ADR, Accepted) together close the G-3 *design* gate.
> The κ ≥ 0.75 measurement on real annotated English data is RELEASE evidence
> (Story 2.6c-measure, procurement-blocked), distinct from this design-gate
> acceptance — it gates release, not citation.

## Context

The platform's source corpus is **English-majority** (project-owner ground
truth, VAL-10): most articles, court pleadings, Senate records, and the
broadsheet record are English. English allegations are surfaced and cited
regardless of the end-user's language — so the English extraction-quality gate
is the **volume-critical source-corpus path**, audience-independent. The
defamation risk on an English-dominant corpus holds under any audience or
serving scenario (VAL-10, re-read by John PM round 3 of the Story 2.6c
adversarial review): English allegations carry defamation risk under any
audience, so 2.6c is NOT blocked on the audience / serving-language question
(routed to a PM-owned item — Open Item O-4 of Story 2.6c).

**Premise correction (John, round 3).** The original Story 2.6c framing
conflated the *source-corpus* claim (English documents dominate what we ingest
— empirically true, audience-independent) with the *serving-path* claim (the
language users query/receive in — audience-dependent, currently undocumented).
2.6c gates a defamation surface that exists under *any* audience scenario, so
the premise language is "*source-corpus* path," not "serving path." The
Taglish serving-layer quality gate is a Phase-2 successor (off the G-3 critical
path).

**Why a thin instance (not a peer ADR).** Carrying the full protocol in two
peer ADRs (0025 for Filipino, a parallel 0026 for English) would manufacture
drift: a future edit to the pass rule in one would silently diverge from the
other. The spine lives in ADR-0025 Part I once; this ADR inherits it by
reference and carries ONLY the English instance decisions. See Alternatives #1.

## Decision

This ADR records the English instance decisions. Each subsection is an
English-specific decision; everything else is inherited from ADR-0025 Part I.

### 1. Inheritance — ADR-0025 Part I is binding on this instance by reference

The English gate inherits the full ADR-0025 Part I protocol spine:

- **Metric definitions** (RAGAS Faithfulness, Citation Recall, Citation
  Precision, NLI entailment) — ADR-0025 §4.
- **Recalibrated pass rule** (Phase-1/Phase-2, per-stratum CP 95% LCB floor +
  point-estimate ≥ 0.95, AND-joined non-rescuing aggregate, error-count→n
  tolerance schedule, one-sided, n_min/INCONCLUSIVE contract) — ADR-0025 §4.
- **Freeze semantics** (CorpusManifest shape, flat-content corpusHash,
  `validateCorpusManifest()`) — ADR-0025 §2.
- **MECE stratum-disambiguation rule** (assign to the stratum that determines
  the serving context; mixed span defaults stricter) — ADR-0025 §5.
- **Uniform annotator eligibility** (PH-domiciled, English-C1+-proficient,
  PH-libel-trained, blind) — ADR-0025 §3. *The English-C1+ baseline in the
  spine IS the English-instance language requirement; no additional
  English-instance proficiency note is needed.*
- **Two-tier CI enforcement** (`eval:smoke` advisory + `eval:full`
  deploy-blocking, both auto-discover `src/**/*.spec.ts`) — ADR-0025 §6.
- **LLM-assisted annotation protocol** (Roles 1/2/3; Gemini 2.5 Pro;
  judge↔human κ ≥ 0.70) — ADR-0025 §9.
- **DR-4 fallback shape** (ingest + search, no extraction, explicit UI
  disclosure; render-gate fail-closed is the safety mechanism) — ADR-0025 §7.
- **Threshold provenance** (Phase-1 floor 0.90 interim with Phase-2 sunset
  toward 0.95; point-estimate ≥ 0.95 fixed by defamation-safety tolerance) —
  ADR-0025 §8.

This list is a navigation aid, not a re-statement; the binding text is in
ADR-0025 Part I.

### 2. English strata + the Conversational/Social-English justification

The English gate codifies three strata:

1. **Journalism / News** — broadsheet, news-site, and periodical English (the
   majority source-corpus register).
2. **Legal / Official** — court pleadings, Senate records, government
   releases, and the formal legal register (high defamation-salience: an
   allegation in a pleading or a Senate record carries specific legal weight).
3. **Conversational / Social English** — social-media and informal-register
   English.

**Conversational/Social-English justification (Mary F2 — pressure-tested by
the per-stratum floor).** PH social-media defamation is
**Filipino/Taglish-dominant**; the social-English stratum is thinly motivated.
This ADR does NOT silently carve out the stratum (a carve-out would weaken the
gate). Instead the stratum is **pressure-tested by the per-stratum floor**
(ADR-0025 §4): the gate requires the stratum to independently clear the CP 95%
LCB floor at the Phase-1 tolerance-schedule n (n=36 @ 0 errors — ADR-0025 §4
schedule). If **n ≈ 36 real defamatory English social-media items cannot be
populated**, the stratum is
**exiled** from the gate (it cannot meet the floor), NOT carved-out — the
remaining strata still pass independently (AND-join: a missing stratum is
reported as INCONCLUSIVE, never silently passed). The measurement slice
(Story 2.6c-measure) makes the call: populate-or-exile, decided by real
annotation, not by assertion.

**MECE disambiguation (pointer to the shared rule).** A document that could
belong to two English strata is assigned to the stratum that determines its
serving context (ADR-0025 §5). A mixed Taglish-English document defaults to the
**Filipino** path when the defamation risk rides on the Tagalog clause (the
stricter path) — see ADR-0025 §5 + Part II §13.

### 3. Annotator eligibility (inherited — no English-instance addition)

The English gate uses the **uniform spine eligibility** (ADR-0025 §3):
PH-domiciled, English-C1+-proficient, PH-libel-trained, blind to model output.
The original "L1 native English speakers" requirement is **dropped** (Mary F3,
ADR-0025 §3 amendment): it imports US/UK defamation community standards into a
PH-libel-law corpus and excludes the correct annotators (PH-domiciled
professionals who are not L1-English but are the legally-relevant audience).
κ validates inter-rater consistency, NOT fidelity to the legal standard —
eligibility (PH-domiciled, PH-libel-trained) is what protects calibration to
PH law.

### 4. Metric + judge provenance (inherited — English-specific notes only)

The judge model (Gemini 2.5 Pro), the frozen judge prompt, the judge↔human
calibration floor (Cohen's κ ≥ 0.70), and the extraction-model-under-test
(Qwen3-14B, disjoint from the Gemini judge) are inherited from ADR-0025 §9.
The only English-specific note: English strata do NOT add a
language-proficiency requirement beyond the spine baseline (English-C1+), so
the annotator pool is the spine-eligible pool (no additional procurement
filter for English-language proficiency beyond the baseline).

### 5. The gate is a scaffold against an empty corpus (honesty clause)

**This ADR specifies the gate; it does NOT validate English extraction
quality.** The English v0 corpus is a target-state empty manifest
(`eval/corpus/golden/v0/manifest.json`, `files: []`, `corpusHash =
sha256:e3b0c44…` — the empty-input sentinel `freeze.ts` produces). The gate is
**inert** (no quality claim) until Story 2.6c-measure populates the corpus and
measures κ. The ACs of Story 2.6c say so explicitly so no one mistakes a green
scaffold test for English-language coverage.

The runtime `INCONCLUSIVE`/`n_min` guard that operationalizes "inert" inside
`oq9.ts` is **out of 2.6c scope** (Open Item O-3, sibling story — `oq9.ts` is
shipped deploy-blocking logic; a behavior change is production logic in a
scaffold costume). The empty-corpus AC prose is the interim control:
`english-oq9.spec.ts` asserts INCONCLUSIVE on `n < n_min`, NOT a vacuous green
on `files.length === 0`.

### 6. AND-joined, non-rescuing structure (inherited)

The gate passes iff *(every stratum floor passes) AND (aggregate head passes)*
— ADR-0025 §4. The aggregate may **veto** but can **never rescue** a failing
stratum (defamation harm does not average across strata). The English strata
are scored and reported separately from Filipino; a blended cross-language mean
is forbidden.

### 7. DR-4 fallback for English (inherited shape, English-unique framing)

If the English gate is unmet (today, because the corpus is unannotated): English
sources are ingested and searchable, but English claims are not extracted, and
the UI/demo explicitly discloses the limitation. The DR-4 fallback path is
mutation-tested in `packages/render/src/gate-dr4-fallback.mutation.test.ts`,
which carries English-unique regression-anchor assertions (Story 2.6c Task 6).
The defamation-safety of DR-4 rests on the render gate's fail-closed behavior
(ADR-0025 §7): under DR-4 no claims are extracted, so the gate sees no cited
claims and emits structured silence, NEVER an uncited allegation.

### 8. Link classification (load-bearing vs context-only)

Per AC #2 of Story 2.6c, the candidate 9-link set is classified; only the
load-bearing subset is enforced bidirectionally by `adr-lint`. Context-only
links are one-way references that `adr-lint` does NOT enforce.

| ADR | Relationship | Load-bearing? | Rationale |
|-----|--------------|---------------|-----------|
| **ADR-0025** | `instance-of` (inherits Part I protocol spine by reference) | **YES** (bidirectional) | This ADR IS an instance of the 0025 spine; the spine is binding on this instance. |
| **ADR-0011** | `extends` (golden-corpus path + freeze semantics) | **YES** (bidirectional) | The English manifest path + CorpusManifest shape + freeze semantics are load-bearing for this gate. |
| **ADR-0014** | `extends` (polyglot eval bridge invokes RAGAS/DeepEval) | **YES** (bidirectional) | The RAGAS metrics this gate scores are invoked via the 0014 subprocess bridge. |
| **ADR-0001** | `instance-of` (defamation-grade operational definition this gate enforces) | **YES** (bidirectional) | The defamation-grade bar this gate enforces is defined in 0001; 0001's evidence includes the eval plane. This is load-bearing (not context-only): the eval plane's relationship to the defamation-grade definition is bidirectionally enforced. |
| ADR-0005 | `context-only` (LLM model tier — Qwen3-14B under test, Gemini judge) | no (one-way) | The model choices are recorded in 0025 §9 provenance; 0005 does not depend on 0026. |
| ADR-0007 | `context-only` (tiered ingestion) | no (one-way) | Ingestion tiering is upstream of the eval gate; referenced for context only. |
| ADR-0008 | `context-only` (NLI entailment gate in the citation engine) | no (one-way) | NLI is one of the four metrics; the citation-engine gate is upstream. |
| ADR-0017 | `context-only` (supersession orchestration) | no (one-way) | Supersession affects corpus versioning; referenced for context only. |
| ADR-0020 | `context-only` (embedding serving runtime) | no (one-way) | Embeddings are upstream of retrieval; referenced for context only. |

The `related` frontmatter array lists the load-bearing subset (ADR-001,
ADR-0011, ADR-0014, ADR-0025) — these get bidirectional enforcement. The
context-only links (ADR-0005, ADR-0007, ADR-0008, ADR-0017, ADR-0020) are
referenced in this section's prose but are NOT in the `related` array, so
`adr-lint` does not enforce them (per AC #2: context-only links are downgraded
to one-way references).

## Alternatives

1. **A full peer ADR-0026 that re-states the protocol spine.**
   - Rejected (Winston split-the-difference — Story 2.6c party-mode panel). A
     full peer ADR would manufacture drift between the English and Filipino
     pass rules: a future edit to the pass rule in one would silently diverge
     from the other. The spine lives in ADR-0025 Part I once; this ADR
     inherits it by reference and carries only the English instance decisions.
     A peer ADR would be "documentation theater manufacturing drift" — full
     duplication with no marginal information.
2. **Drop the Conversational/Social-English stratum entirely (pre-emptive
   exile).**
   - Rejected (Mary F2 — Story 2.6c panel). Pre-emptive exile by assertion is
     a carve-out in disguise; the stratum is **pressure-tested by the
     per-stratum floor** instead. If n ≈ 36 real defamatory English social
     items cannot be populated (Phase-1 tolerance schedule, ADR-0025 §4), the
     stratum is exiled by the floor (reported
     INCONCLUSIVE), NOT by an a-priori assertion. This keeps the gate honest:
     the decision is made by real annotation, not by a documentation claim.
3. **Require L1 native English annotators.**
   - Rejected (Mary F3 — Story 2.6c panel; ADR-0025 §3 amendment). Imports
     US/UK defamation community standards (actual-malice / serious-harm) into a
     PH-libel-law corpus and excludes the correct annotators. The spine
     eligibility (PH-domiciled, English-C1+, PH-libel-trained, blind) is what
     protects calibration to PH law; κ validates consistency, not legal
     fidelity.
4. **Introduce a Jeffreys interval family for the English gate (second
   interval).**
   - Rejected (Murat/Mary convergence — Story 2.6c panel). At the operative
   n ≈ 59 (Phase-2 rule-of-thumb), CP/Wilson/Jeffreys agree to ~0.002 — but
   interval-family convergence is not a floor-clearance argument (see ADR-0025
   §4 footnote); a second family = transcription
   + mutation risk in a deploy-blocking defamation gate, for zero marginal
   benefit. The audited `decimal.js` CP machinery in `oq9.ts` is reused
   unchanged (ADR-0025 §4).
5. **Add the INCONCLUSIVE/n_min runtime guard inside `oq9.ts` in this story.**
   - Rejected (Amelia scope-gate — Story 2.6c panel). `oq9.ts` is shipped
     deploy-blocking logic; an n=0 behavior change is production logic wearing
     a scaffold costume. Filed as Open Item O-3 (sibling story) with its own
     regression coverage. The empty-corpus AC prose is the interim control.

## Consequences

- The English extraction-quality gate is **specified** (this ADR, Accepted on
  spec-completeness). Together with ADR-0025 (Filipino, Accepted), this
  **closes the G-3 *design* gate** (epics.md L682: G-3 closes only when BOTH
  gates are specified).
- The English gate is **inert** until Story 2.6c-measure populates the corpus
  and measures κ ≥ 0.75 on real annotated English data. Until then, English
  extraction falls back to DR-4 (ingest + search, no extraction, explicit UI
  disclosure).
- The Conversational/Social-English stratum is **pressure-tested by the
  per-stratum floor**: populate-or-exile is decided by real annotation in
  Story 2.6c-measure, not by assertion here.
- The gate machinery (κ function, OQ-9 module, Decimal CP-LCB, corpus-freeze,
  manifest validator, two-tier CI) is inherited unchanged from Story
  2.6b-code / ADR-0025; no new interval family, no new gate logic.
- The runtime INCONCLUSIVE/n_min guard inside `oq9.ts` is filed as Open Item
  O-3 (sibling story); the empty-corpus AC prose + `english-oq9.spec.ts`
  INCONCLUSIVE assertion is the interim control.

## Open questions

| # | Question | Owner | Trigger |
|---|----------|-------|---------|
| 1 | Source ≥2 human annotators (PH-domiciled, English-C1+, PH-libel-trained, blind) for the English gate under the §9 LLM-assisted protocol + optionally a named adjudicator. | PM + human | Story 2.6c-measure unblock (the measurement slice; off the G-3 design-gate critical path) |
| 2 | **Populate-or-exile the Conversational/Social-English stratum:** can n ≈ 36 real defamatory English social-media items be populated (Phase-1 tolerance schedule, ADR-0025 §4), or is the stratum exiled by the per-stratum floor? | Test architect + PM | Story 2.6c-measure annotation |
| 3 | **(pointer)** Phase-2 floor re-tightening (ADR-0025 Open questions #5): date + migration commitment to raise the Phase-1 LCB floor (0.90) toward 0.95 before broad public launch. Inherited from the spine. | PM + Test architect | Before broad public launch (Phase-2 gate) |
| 4 | **(pointer)** The runtime INCONCLUSIVE/n_min guard inside `oq9.ts` (ADR-0025 Open questions #6 / Story 2.6c Open Item O-3): operationalize the recalibrated tolerance schedule + Phase-1 floor in the deploy-blocking gate code. Sibling story. | Engineer | Story 2.6c O-3 sibling |
| 5 | **(pointer, resolved)** Audience & serving language (Story 2.6c Open Item O-4 — resolved by John PM round 4): source corpus is English-dominant; serving/query language is trilingual-aspirational. Taglish serving-gate is a Phase-2 successor sequenced after 2.6c + 2.6b. 2.6c NOT blocked. | PM | Phase-2 successor (post 2.6c + 2.6b) |
