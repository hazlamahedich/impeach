---
id: ADR-025
title: "Extraction-Quality Eval-Set Protocol Spine + Filipino Reference Instance (OQ-9)"
status: Accepted
date: 2026-07-03
supersedes: null
superseded_by: null
deciders: [Winston (architect), Murat (test architect), Mary (analyst), Amelia (engineer), John (PM), anti lustay (interim Filipino annotator), user]
related: [AC-1, SC-1, VAL-2, VAL-10, G-3, OQ-9, DR-4, ADR-001, ADR-005, ADR-007, ADR-008, ADR-011, ADR-014, ADR-017, ADR-020, ADR-026, ADR-027]
evidence:
  # Spec-completeness evidence (Story 2.6b-code, 2026-07-03). Per the party-mode
  # panel (Winston, decider-of-record), ADR-0025 promotes to Accepted on
  # SPEC-COMPLETENESS — the methodology justification + a complete OQ-9 protocol
  # + VAL-10 salience — NOT on a κ number. The κ ≥ 0.75 MEASUREMENT is release
  # evidence (Story 2.6b-measure, procurement-blocked), distinct from the
  # design-gate evidence recorded here. This dissolves the prior PC-3 dependency
  # cycle (promotion ↔ citation): once Accepted on spec-completeness, PC-3
  # permits binding citation; the κ measurement gates release, not citation.
  # Each entry below is the path to a real artifact produced by this slice.
  # (The κ-vs-α decision, §9 firewall, guardrails, and owner-independence
  # counter-sign are recorded in the "Spec-completeness methodology
  # justification" subsection under Consequences. The two CI workflow files —
  # `.github/workflows/eval-smoke.yml` + `.github/workflows/eval-full.yml` —
  # are also produced by this slice; they are not listed as evidence entries
  # directly because the adr-lint path resolver does not match leading-dot
  # paths. They are documented in + referenced from docs/ci/eval-tiers.md,
  # which IS listed below.)
  #
  # Story 2.6c amendment (2026-07-03): this ADR was restructured into a
  # language-agnostic protocol spine (Part I) + Filipino reference instance
  # (Part II). The recalibrated pass rule (Phase-1/Phase-2, per-stratum floor,
  # AND-joined non-rescuing, tolerance schedule, one-sided), the annotator-
  # eligibility correction (drop L1-native → PH-domiciled C1+ libel-trained
  # blind), and the metric+judge provenance were recorded. This retroactively
  # fixes the portfolio-wide unreachable-threshold defect (Mary F1) that
  # 2.6b-code inherited. The English instance lives in ADR-0026 (thin instance
  # record inheriting this spine by reference). The Decimal CP-LCB machinery
  # in oq9.ts is UNCHANGED (no new interval family); the recalibration is a
  # structural change to how the CP result is APPLIED, not a numerical change
  # to the interval. The runtime INCONCLUSIVE/n_min guard that operationalizes
  # "Phase-1 LCB floor ≥0.90" inside oq9.ts is filed as Open Item O-3 (sibling
  # story — oq9.ts is shipped deploy-blocking logic; AC #6 of 2.6c records the
  # interim control).
  - packages/eval/src/kappa.ts
  - packages/eval/src/oq9.ts
  - packages/eval/src/freeze.ts
  - packages/eval/src/manifest.ts
  - packages/eval/src/__tests__/filipino-oq9.spec.ts
  - packages/eval/src/__tests__/english-oq9.spec.ts
  - eval/corpus/golden/filipino/v0/manifest.json
  - eval/corpus/golden/v0/manifest.json
  - docs/ci/eval-tiers.md
  - docs/adr/0011-golden-corpus-versioning.md
  - docs/adr/0026-english-eval-set-spec.md
  - _bmad-output/planning-artifacts/architecture.md
  - _bmad-output/planning-artifacts/epics.md
---

# ADR-025: Extraction-Quality Eval-Set Protocol Spine + Filipino Reference Instance (OQ-9)

> **Status: Accepted (2026-07-03, on spec-completeness — Story 2.6b-code;
> amended 2026-07-03 — Story 2.6c).**
>
> **Story 2.6c amendment (2026-07-03, party-mode panel: Winston, Murat, Mary,
> Amelia, John):** this ADR was restructured into **Part I — a language-agnostic
> protocol spine** (metric definitions, the recalibrated pass rule, sidedness,
> the n_min/INCONCLUSIVE contract, freeze semantics, MECE disambiguation rule,
> uniform annotator eligibility, the LLM-assisted protocol, metric+judge
> provenance) and **Part II — the Filipino reference instance** (Filipino
> strata, Taglish language detection, the Filipino DR-4 fallback). The
> amendment records three corrections discovered during the Story 2.6c
> adversarial review:
>
> 1. **Recalibrated pass rule (Mary F1, verified Murat — portfolio-wide
>    defect).** The original `CP 95% LCB ≥ 0.95 @ n≥30/stratum` is
>    **unreachable by construction**: zero errors at n=30 yields a 95% LCB of
>    ~0.886–0.905 (Wilson/CP/rule-of-three) — a *perfect* corpus fails the
>    gate. Replaced by a Phase-1/Phase-2 structure (see §4) agreed across
>    Murat, Mary, and John. The interval family (Clopper–Pearson, decimal.js)
>    is **unchanged**; the recalibration is structural (how the CP result is
>    applied), not numerical. This fix lives here once ("fix once where it
>    lives" — Winston) and is inherited by ADR-0026 (English) by reference; it
>    also retroactively fixes the Filipino gate (2.6b-code inherited the same
>    defect).
> 2. **Annotator-eligibility correction (Mary F3).** The "L1 native" clause is
>    **dropped**: it imports US/UK defamation community standards (actual-malice
>    / serious-harm) into a corpus governed by **PH libel law** (Revised Penal
>    Code Art. 353–362, Cybercrime Prevention Act §4(c)(4)) and *excludes* the
>    correct annotators. Correct eligibility is language-agnostic:
>    **PH-domiciled, English-C1+-proficient, PH-libel-trained, blind to model
>    output** (§3). Note: κ validates inter-rater *consistency*, NOT fidelity
>    to the legal standard — eligibility is what protects calibration to PH
>    law; κ is orthogonal and cannot rescue a wrong-standard pool.
> 3. **Metric + judge provenance (recorded in §9).** Judge model+version,
>    frozen judge prompt, judge↔human calibration floor, and English-specific
>    notes are now recorded so a silent model bump or prompt drift cannot move
>    the gold labels.
>
> The gate *machinery* (κ function `packages/eval/src/kappa.ts`, OQ-9 module
> `packages/eval/src/oq9.ts`, Decimal CP-LCB, corpus-freeze
> `packages/eval/src/freeze.ts`, manifest validator
> `packages/eval/src/manifest.ts`, two-tier CI) is live and tested. The
> **κ ≥ 0.75 measurement on real annotated data** is RELEASE evidence (Story
> 2.6b-measure for Filipino; Story 2.6c-measure for English), distinct from
> this design-gate acceptance — it gates release, not citation. As of
> 2026-07-03, **one** interim annotator (anti lustay) is committed for the
> Filipino gate; under the §9 LLM-assisted protocol, **one** additional human
> + optionally an adjudicator are pending procurement (off the G-3 critical
> path). The protocol below is complete and binding; the design gate is
> closed; the release gate is procurement-blocked.

## Context

VAL-10 corrects G-3's original premise. The platform's source corpus is
**English-majority** (project-owner ground truth): most articles, court
pleadings, and Senate records are English. "Filipino is the production case"
conflated two axes that diverge:

- **Volume** — English is the majority *source-corpus* path (and the majority
  *serving* path under any documented audience scenario). The **English**
  extraction-quality gate (Story 2.6c / ADR-0026) is the volume-critical path.
- **Defamation salience / risk** — Filipino/Taglish sources carry the
  **highest-risk subset** (specialized Philippine legal/political register:
  *kasong libelo*, *pinagbintangan*, *nagsampa*, *paglabag*, *hukuman*).
  General LLMs (incl. the local Qwen3-14B per ADR-005) fail on this register.
  A fabricated or mistranslated allegation in Tagalog/Taglish is no less
  defamatory than one in English; under PH cyberlibel (*Disini*) it may be
  *more* exposed (jurisdictional nexus).

So neither gate is a secondary internationalization (i18n) layer. Both are
first-class production targets with their own gates, scored and reported
separately. A blended English+Filipino mean is **forbidden** — it would let a
strong English stratum mask a failing Filipino stratum (or vice versa),
exactly the libel-relevant failure mode. G-3 closes only when **both** gates
are **specified** (epics.md L682); the κ measurement gates release, not
design.

**Why a shared protocol spine (Story 2.6c restructure).** The English and
Filipino gates share the same metric definitions, the same pass rule, the same
sidedness, the same freeze semantics, the same annotator-eligibility baseline,
and the same LLM-assisted protocol. Carrying these in two peer ADRs
manufactures drift: a future edit to the pass rule in one would silently
diverge from the other. The spine lives here once (Part I); each language
instance (Part II for Filipino; ADR-0026 for English) carries ONLY its
strata, its instance-specific annotator notes, and a pointer to the shared
MECE disambiguation rule.

## Decision

The Decision is split into **Part I — the language-agnostic protocol spine**
(inherited by every language instance, including the English ADR-0026) and
**Part II — the Filipino reference instance** (the first concrete instance;
the English ADR-0026 is the second).

---

### Part I — Language-agnostic protocol spine (inherited by every language instance)

#### §1. Scope of the spine

The spine carries: metric definitions (§4), the recalibrated pass rule (§4),
sample-size + sidedness (§4), the n_min/INCONCLUSIVE contract (§4), freeze
semantics (§2), the MECE stratum-disambiguation rule (§5), uniform annotator
eligibility (§3), the two-tier CI enforcement (§6), the LLM-assisted
annotation protocol (§9), the DR-4 fallback shape (§7), threshold provenance
(§8), and metric+judge provenance (§9). A language instance (Filipino in
Part II; English in ADR-0026) carries ONLY: its strata manifest, its
instance-specific annotator-proficiency note, and rationale for each
instance-specific decision.

#### §2. Golden corpus — content + provenance manifest (freeze semantics)

- A frozen, version-controlled golden corpus lives in-repo at
  `eval/corpus/golden/<lang>/v0/` (root-anchored — ADR-0011 Amendment 1
  path-correction; the `packages/eval/corpus/...` form in earlier drafts was a
  spec/text variance from the active convention). The default/English chain
  lives at `eval/corpus/golden/v0/` (ADR-0011 Amendment 2 root-anchoring).
  Each language chain versions independently (ADR-0011 Amendment 2 — N
  parallel per-language manifest chains).
- The manifest shape is the `CorpusManifest` that `packages/eval/src/freeze.ts`
  produces: `{schemaVersion: "1.0.0", corpusHash: "sha256:<64-hex>", files:
  [{path, sha256}]}`. The aggregate `corpusHash` is the SHA-256 over the sorted
  concatenation of `${path}\0${sha256}\n` entries (flat-content hash); the
  empty-corpus sentinel is `sha256:e3b0c44…` (SHA-256 of empty input — a
  deterministic sentinel, NOT a magic constant). The manifest IS the
  corpus-version identity (ADR-0011); the OQ-9 gate requires the manifest SHA
  to match.
- **On-disk manifests MUST pass the shared-harness validator
  `validateCorpusManifest()`** (`packages/eval/src/manifest.ts`). The manifest
  shape defect (English manifest shipped as `{version, entries}` vs
  `CorpusManifest`) survived because nothing asserted conformance — caught by
  eyeball, not by test. The validator is defined once; every language instance
  + future languages consume it.
- Items are clearly-fictional entities (no real-subject defamation exposure in
  fixtures — fixtures containing allegedly-defamatory quotations may constitute
  republication under PH cyberlibel even as test data). Each item carries a
  `FIXTURE_USE_ONLY` watermark + a manifest SHA-256 asserted at test startup so
  fixture drift is caught.
- **The SHA-256 covers the provenance manifest (the labels + annotator
  attestations), NOT the source text alone.** Hashing only the source text is
  the F5 defect: it proves bytes didn't drift but nothing about *who vouches
  the labels*. An LLM-generated ground truth used to evaluate an LLM is
  circular — it always "passes."

#### §3. Annotation provenance — uniform annotator eligibility (corrected — Mary F3)

> **Amendment (Story 2.6c, 2026-07-03):** the "L1 native" clause is **dropped**.
> It imports US/UK defamation community standards (actual-malice /
> serious-harm) into a corpus governed by **PH libel law** and *excludes* the
> correct annotators (PH-domiciled professionals who are not L1-English but
> are the legally-relevant audience). Correct eligibility is language-agnostic
> and lives in the spine.

- **≥3 annotators** per document, plus a **named adjudicator** who resolves
  disagreements. *Under the §9 LLM-assisted protocol, the human headcount can
  reduce to ≥2 humans on the high-risk stratum (Gemini pre-annotates + acts as
  a calibrated co-rater), but the human-cultural-judgment requirement means
  humans can never drop to zero.*
- **Uniform eligibility (the spine rule — applies to EVERY language instance,
  including English):**
  1. **PH-domiciled** — the defamation legal standard is PH (Revised Penal
     Code Art. 353–362, Cybercrime Prevention Act §4(c)(4)); the
     "reasonable reader" test under *Disini* is a PH-cultural judgment. A
     non-PH annotator imports foreign defamation standards.
  2. **English-C1+-proficient** (CEFR C1 or above) — the platform's working
     language and the majority source-corpus language is English; this is a
     baseline for ALL annotators (English-gate and Filipino-gate alike), NOT
     an English-gate-only rule. Court pleadings, Senate records, and the
     broadsheet record are English.
  3. **PH-libel-trained** — calibrated to the PH defamation standard
     (incl. the *Disini* "reasonable Filipino reader" test), not US/UK
     actual-malice / serious-harm. This is what protects calibration to PH
     law.
  4. **Blind to model output** — annotates the *source* against the legal
     standard, never the model's extraction (else the annotation measures
     model-vs-annotator agreement, not extraction quality).
- **Instance-level language proficiency** — each language instance specifies
  the additional proficiency its strata require. The Filipino instance (Part
  II §12) requires Filipino/Taglish professional fluency; the English instance
  (ADR-0026) requires English-C1+ (already in the baseline). This keeps the
  spine language-agnostic while allowing instance-level language demands.
- **Fleiss' κ ≥ 0.75** across **human** annotators (reject the corpus if
  κ < 0.60). *Fleiss' κ is mathematically undefined for fewer than 2 raters.
  At exactly 2 raters Fleiss' κ collapses to Cohen's κ (the two-rater case is
  the boundary where the multi-rater formula reduces to the pairwise one); this
  ADR therefore permits a 2-human κ **on the high-risk RED-severity stratum
  only**, where (a) the §9 Role-2 calibrated Gemini co-rater provides a third
  rating as a cross-check and (b) the cost of procuring 3 humans on every
  stratum would itself block G-3 indefinitely. A single human annotator cannot
  satisfy this AC; the human count may not drop below 2.*
- **κ validates inter-rater consistency, NOT fidelity to the legal standard
  (Mary/Murat note).** A pool of annotators who agree on the wrong standard
  produces a high κ and a wrong corpus. Eligibility (PH-domiciled,
  PH-libel-trained) is what protects calibration to PH law; κ is orthogonal
  and cannot rescue a wrong-standard pool. This is why the eligibility
  correction is load-bearing, not cosmetic.
- **Circularity firewall:** an LLM may **never** generate or adjudicate gold
  labels as the sole source. LLM-as-judge is permitted ONLY when calibrated to
  human agreement (κ ≥ 0.70), and even then it annotates alongside humans,
  never as the sole source of truth. Full LLM-assistance taxonomy in §9.

#### §4. OQ-9 measurement protocol — recalibrated pass rule (stratified floor + red-line, NEVER mean)

> **Amendment (Story 2.6c, 2026-07-03 — Mary F1, verified Murat; recalibration
> by Murat/Mary/John consensus).** The original `CP 95% LCB ≥ 0.95 @
> n≥30/stratum` is **unreachable by construction**: at n=30, even a perfect
> k=30 yields a 95% LCB of ~0.887 (Wilson/CP/rule-of-three) — a *perfect*
> corpus fails the gate. This defect is portfolio-wide (0025 + `oq9.ts` both
> carry `TAU_STRATUM_LCB=0.95` @ n≥30/stratum). The recalibration below is
> **structural** (how the CP result is applied), NOT numerical — the
> Clopper–Pearson interval family and the audited `decimal.js` machinery in
> `packages/eval/src/oq9.ts` are **unchanged**. No new interval family is
> introduced (a second family = transcription + mutation risk in a
> deploy-blocking defamation gate, for zero marginal benefit; the exact-CP
> tolerance schedule in §4 is the single source of truth — see §4 footnote
> on why the prior "CP/Wilson/Jeffreys agree to ~0.002" convergence claim is
> not a floor-clearance argument).

Aggregation is a **stratified floor + red-line**, never a mean or p95. A
single aggregate can hit 0.95 while silently failing every libel-relevant
document in a stratum.

- **Thresholds:**
  - τ_red ≈ 0.50 — instant per-document fail (a doc this bad is unambiguously
    defamation-grade broken; do not let the stratum average absorb it).
  - τ_doc ≈ 0.90 — per-document pass floor.
  - **Recalibrated stratum floor** (see Phase-1/Phase-2 below) applied to the
    **one-sided Clopper–Pearson 95% lower confidence bound** on the
    within-stratum pass rate. (Clopper–Pearson, not a normal approximation — at
    the small n and extreme pass rates we run, the normal interval undercovers
    and silently passes.)

- **Recalibrated pass rule (the panel consensus — Murat/Mary/John, 2026-07-03):**

  The gate passes iff **(every stratum floor passes) AND (aggregate head
  passes)** — the **AND-joined, non-rescuing** structure. The aggregate may
  **veto** but can **never rescue** a failing stratum (defamation harm does
  not average across strata).

  - **Interval:** Clopper–Pearson, **unchanged** (reuse the audited
    `decimal.js` machinery in `oq9.ts`). No new interval family.
  - **Per-stratum floor (PRIMARY):** every stratum must independently clear
    the CP 95% LCB floor, **uniform across strata** (no carve-outs — a
    stratum that cannot meet the floor is **exiled** from the gate, not
    silently carved-out), with a published **error-count→required-n tolerance
    schedule** so the floor is a band, not a knife-edge:

    > **Code-review patch (2026-07-03, P8 — panel consensus D1):** the original
    > single-row schedule (`n≈59 @ 0 errors, ~115 @ 1 error`) was calibrated to
    > the ~0.95 (Phase-2) target via the rule-of-three (`3/0.05=60≈59`), NOT the
    > Phase-1 0.90 floor it was labeled under (exact CP: n=59 yields LCB 0.9394;
    > the 0.90 floor needs only n≈36 @ 0 errors). The schedule is restructured
    > as a two-phase side-by-side table with every cell recomputed by exact
    > one-sided Clopper–Pearson (the method `oq9.ts` uses). The rule-of-three
    > is a rule-of-thumb, NOT a certification instrument, and is exiled to the
    > footnote below.

    **Tolerance schedule (exact one-sided CP 95% LCB; `n` is the smallest
    integer satisfying the stated floor at the stated error count — Mary
    invariant):**

    | errors in stratum | Phase-1 floor (0.90) — required n | Phase-2 floor (0.95) — required n |
    |-------------------|-----------------------------------|-----------------------------------|
    | 0                 | n = 36 (LCB 0.9026)               | n = 72 (LCB 0.9501)               |
    | 1                 | n = 54 (LCB 0.9011)               | n = 110 (LCB 0.9504)              |
    | 2                 | n = 72 (LCB 0.9007)               | n = 147 (LCB 0.9502)              |

    *Phase-1 is the operative floor now (reachable, stringent); Phase-2 is the
    pre-broad-public-launch re-tightening target (Open questions #5). The
    schedule *is* the graceful degradation within each phase. A stratum with
    insufficient n for its error count is **INCONCLUSIVE** (see
    n_min/INCONCLUSIVE contract below), not a pass.*

    *Footnote (rule-of-three, NOT binding): the heuristic `3/n ≈ 1 − LCB`
    gives n≈60 for LCB 0.95 and n≈30 for LCB 0.90 — a loose approximation that
    underestimates the exact CP requirement (n≈72 / n≈36). It is useful for
    back-of-envelope annotation budgeting; it is NOT the value the gate
    enforces. The "CP/Wilson/Jeffreys agree to ~0.002" convergence claim is a
    statement about interval-family agreement at a fixed n, NOT about clearing
    a floor — it is irrelevant to the schedule and struck from the binding
    text.*
  - **Aggregate head (AND-joined, non-rescuing):** at defused n≈200–300
    one-sided the head tolerates 1–2 errors — not the single-error cliff at
    n=100. The head may veto but never rescue.
  - **Phase-1 / Phase-2 (John, PM-owned):**
    - **Phase 1 (now — reachable, stringent):** hard **point-estimate ≥ 0.95**
      pass + **LCB floor ≥ 0.90** (NOT the unreachable 0.95) + INCONCLUSIVE
      escalation → *targeted* raise-n (annotate the stratum that trips, not all
      of them). Reachable. Stringent. The one tolerated error at small n is
      not given a free pass — the LCB floor keeps small-sample pessimism. The
      point-estimate stays ≥ 0.95 throughout (no phase relaxes it).
    - **Phase 2 (before broad public launch):** raise n toward
      LCB≥0.95-reachable; re-tighten the floor toward 0.95. Date + migration
      commitment written into the ADR in daylight (see Open questions #5).
  - **Sidedness:** **one-sided** (testing against a lower bound, NOT two-sided
    equivalence). This must be explicit — the original ADR left it unspecified,
    and two compliant implementations could disagree.
  - **n_min / INCONCLUSIVE contract:** a stratum with `n < n_min` (per the
    tolerance schedule for its error count) is **INCONCLUSIVE** — the gate
    fails-closed pending more data (escalate to targeted raise-n), NOT a pass
    and NOT a hard fail. This is the mechanism that makes "the gate is inert
    on an empty corpus" literally true. The runtime guard that operationalizes
    this inside `oq9.ts` is filed as Open Item O-3 of Story 2.6c (sibling
    story — `oq9.ts` is shipped deploy-blocking logic; the empty-corpus AC
    prose is the interim control).

- **Why not pure-reframe / pure-raise-n (John):** pure-reframe (demote LCB to
  transparency-only) loses the only voice saying "we haven't measured enough"
  at exactly the n where the one tolerated error *is* the defamatory
  hallucination; pure-raise-n buys statistical form at 3–5× annotation cost
  past diminishing harm-prevention returns. The Phase-1/Phase-2 path spends
  the next annotation peso on finding real libel, not padding an interval.

- **Metrics scored:** RAGAS Faithfulness, Citation Recall, Citation Precision,
  NLI entailment. (See architecture.md Regression Thresholds: Citation
  Recall/Precision 0% absolute regression; Faithfulness absolute floor ≥0.85.)
- **Sample size:** per the tolerance schedule above (Phase-1: n=36 @ 0
  errors/stratum, n=54 @ 1 error; Phase-2: n=72 @ 0 errors, n=110 @ 1 error);
  aggregate target n≥200–300. Power note: n ≈ 250 for genuine 0.95-vs-0.90
  discriminating power (Phase-2 target).
- **Pass/fail rule (recalibrated):**
  `OQ9_PASS = (every stratum meets its tolerance-schedule n_min) ∧
  (∀doc: metric ≥ τ_red) ∧ (point-estimate ≥ 0.95 ∀ stratum ∀ metric) ∧
  (CP_LCB_95(k/n) ≥ Phase-1 floor (0.90) ∀ stratum ∀ metric) ∧
  (aggregate head passes, AND-joined) ∧ (Fleiss' κ ≥ 0.75) ∧
  (LLM-judge↔human κ ≥ 0.70 where used) ∧ (provenance manifest SHA-256 matches
  ∧ passes validateCorpusManifest())`.

  > **⚠ CODE-CATCH-UP BANNER (code-review patch 2026-07-03, P9 — panel consensus
  > D2):** this `OQ9_PASS` formula is the **binding design target**. The
  > shipped deploy-blocking gate code (`packages/eval/src/oq9.ts`) does NOT yet
  > enforce four pieces of it — it still enforces the legacy single-conjunct
  > `CP_LCB_95(k/n) ≥ TAU_STRATUM_LCB (0.95)` rule. The catch-up is tracked
  > under **Open Item O-3 of Story 2.6c** (sibling story), widened by this
  > review to an enumerated four-part scope: **(i)** LCB floor 0.95→0.90,
  > **(ii)** point-estimate ≥ 0.95 conjunct, **(iii)** AND-joined non-rescuing
  > aggregate-head, **(iv)** n_min/INCONCLUSIVE guard. **The old and new rules
  > are non-monotone** (Murat): old is stricter on the LCB axis (0.95>0.90),
  > new is stricter on point-estimate + aggregate axes — neither subsumes the
  > other, and the AND-vs-OR aggregate gap is the swing risk (aggregate-rescue
  > could convert a stratum-level FAIL into an aggregate-level PASS). The code
  > catch-up (all four pieces) **lands before broad public launch** (John PM
  > commitment; Open questions #5). The gate is inert on the empty corpus today
  > (no quality claim), so the drift is acceptable for this design-gate slice —
  > but the gap is named here, in daylight, so no reader mistakes the formula
  > above for the currently-enforced rule.
  *(Libel-injection detector recall is enforced separately by the SEC-8
  promptfoo red-team battery, not by this in-corpus pass rule — it is a
  distinct invariant with its own corpus and recall computation.)*
- **Each language stratum scored and reported separately.** A blended
  cross-language mean is forbidden.

#### §5. MECE stratum-disambiguation rule (language-agnostic)

A document that could belong to two strata is assigned to the stratum that
determines the document's **serving context** (the stratum whose threshold is
binding for the defamation risk that document carries). The rule is MECE
(mutually exclusive, collectively exhaustive) — every document lands in
exactly one stratum. Each language instance records its own strata + the
instance-specific disambiguation examples (Filipino: Part II §11; English:
ADR-0026 §2). A mixed-language span defaults to the **stricter** path (a
defamatory clause embedded in a less-strict-language document is not silently
held to the less-strict threshold).

#### §6. Two-tier CI enforcement (language-agnostic)

- **`eval:smoke`** — n=20, **merge-blocking per PR** (advisory / non-gating).
  At n=20 the full `OQ9_PASS` rule is structurally unsatisfiable, so smoke
  asserts a **relaxed subset** only: no τ_red violation on any sampled doc, no
  provenance-manifest SHA-256 mismatch, schema-valid output, and the manifest
  passes `validateCorpusManifest()`. The stratified Clopper–Pearson floor and
  full κ measurement are deferred to `eval:full`. Smoke is a deterministic fast
  gate (<8 min per the PR lane); it is not a quality claim.
- **`eval:full`** — n≥200, **deploy-blocking on main/release**; invoked with
  `--force`, **never cached for releases** (a cached release eval is a
  non-eval).
- Both tiers auto-discover `src/**/*.spec.ts` under `packages/eval` via the
  vitest config; each language instance's `*-oq9.spec.ts` is picked up with
  zero per-language CI wiring (the `eval:smoke`/`eval:full` scripts glob the
  `__tests__` directory, not a hardcoded language path).

#### §7. DR-4 fallback shape (language-agnostic)

If a language gate is unmet (today, because the corpus is unannotated; in
future, because a run regresses):

- That language's sources are **ingested and searchable**, but **claims and
  relationships are not extracted**.
- The **UI/demo explicitly discloses** the limitation (locale-matched
  disclosure hashing to a canonical, lawyer-owned value).
- The fallback path is itself under test: property-based trigger + mutation
  testing (each mutation must still produce safe behavior) + 100% branch
  coverage on the fallback path. The defamation-safety of DR-4 rests on the
  **render gate's fail-closed behavior** (`packages/render/gate.ts`): under
  DR-4 no claims are extracted, so the gate sees no cited claims and emits
  structured silence, NEVER an uncited allegation.

#### §8. Threshold provenance — the recalibrated floor is interim, not a convention

At defamation grade a threshold is a legal argument, not a tuning knob.
"Industry uses 0.95" is not a defensible citation (review report F8). The
**Phase-1 LCB floor = 0.90** is an **interim floor** with a **documented
Phase-2 sunset** (raise toward 0.95 before broad public launch — Open
questions #5). The **point-estimate ≥ 0.95** is NOT interim — it is fixed by
the defamation-safety tolerance (Citation Recall/Precision: 0% absolute
regression per architecture.md), which is not subject to calibration.
Separately, a calibration task blocking G-3 release: derive **τ_doc**
empirically from the RED-item false-negative rate vs the legal team's
"reckless disregard" tolerance. The calibration result may raise (not lower)
**τ_doc**.

#### §9. LLM-assisted annotation protocol + metric/judge provenance

**The forbidden role — sole gold-label source / sole adjudicator.** Evaluating
an LLM (the extraction model, Qwen3-14B) against gold labels written by another
LLM (Gemini) measures LLM-vs-LLM agreement, not extraction quality. Two failure
modes ensue: (a) both models share a blind spot on a Tagalog legal register
so the gold is wrong the same way the extraction is wrong and the gate
"passes"; (b) Gemini is stronger than Qwen3, so the score measures the gap
between two models, not the gap between the model and *truth*. There is also a
Philippine-specific reason: under PH cyberlibel (*Disini*) the legal test is
*"how would a reasonable Filipino reader understand this?"* — a
human-cultural judgment, not a text-comprehension task. A defamatory
implication can live in an idiom or political dog-whistle that even a fluent
LLM misses. So "ground truth" for defamation is, by legal definition, human.
**An LLM may therefore never be the sole source of gold labels or the sole
adjudicator.**

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

**Metric + judge provenance (recorded per the Story 2.6c amendment):**

| Provenance field | Value |
|------------------|-------|
| Judge model (§9 Role-2 co-rater; RAGAS faithfulness/NLI where a judge is used) | **Gemini 2.5 Pro** (NOT Flash — annotation/judge quality is load-bearing). Exact version pinned per-run; recorded in the eval result triple `(corpus_version, model_version, gate_version)` (architecture.md Eval Drift Detection). A silent model bump breaks the §9 Role-2 κ ≥ 0.70 calibration — re-proven on every swap. |
| Judge prompt | **Frozen**, content-addressed (SHA-256 of the prompt recorded in the provenance manifest). A prompt edit without a corpus re-version is a defect — the gold labels would silently drift. |
| Judge↔human calibration floor | **Cohen's κ ≥ 0.70** (§9 Role-2 admission gate; re-proven on every model swap). Below 0.70 the judge is demoted to Role 1 (pre-annotation only). |
| Extraction model under test | **Qwen3-14B (local, ADR-005)** — disjoint from the Gemini judge (§9 Role-2 disjointness verified: no LLM-vs-LLM circularity on the extraction path). |
| English-specific notes | English strata do NOT add a language-proficiency requirement beyond the spine baseline (English-C1+). Court pleadings / Senate records / broadsheet English are the majority source-corpus; the defamation risk holds under any audience scenario (VAL-10). |
| Filipino-specific notes | Filipino strata ADD Filipino/Taglish professional fluency (Part II §12). Taglish code-switching requires a per-span language classifier (Part II §13). |

**Reduced-headcount path to κ.** With Roles 1 + 2 combined, the procurement
blocker shrinks: anti lustay (annotator #1, human) reviews Gemini's
pre-annotation drafts (Role 1) for the full corpus, then **one** additional
human (annotator #2) independently rates the RED-severity / high-risk stratum.
Human–human Fleiss' κ is now computable on that stratum (2 human raters) and
gated at ≥ 0.75; separately, Gemini↔human κ ≥ 0.70 is proven as the Role-2
calibration gate. **Net: one additional human, not two** (plus the optional
adjudicator for Role 3 disagreement surfacing).

---

### Part II — Filipino reference instance

> The Filipino instance is the **reference instance** of the protocol spine —
> the first concrete language instance, carrying ONLY its strata, its
> instance-specific annotator-proficiency note, its Taglish language-detection
> requirement, and its DR-4 fallback framing. The English instance (ADR-0026)
> is the second. Everything else is inherited from Part I by reference.

#### §10. Filipino is a salience gate, sequenced after the English volume gate

Story 2.6c (English extraction-quality eval gate / ADR-0026) is the
volume-critical path and ships first. The Filipino salience gate (this Part
II) is sequenced after it. Both are real production gates; neither is i18n.
A blended English+Filipino mean is forbidden.

#### §11. Filipino strata + disambiguation

The Filipino gate codifies its libel-relevant strata (the specialized
Philippine legal/political register — *kasong libelo*, *pinagbintangan*,
*nagsampa*, *paglabag*, *hukuman* — where general LLMs fail). The MECE
disambiguation rule (§5) assigns a mixed Taglish-English document to the
**Filipino** stratum when the defamation risk rides on the Tagalog clause
(the stricter path). The exact stratum labels live in the Story 2.6b-measure
annotation spec (procurement-blocked); the spine's per-stratum floor (§4)
applies uniformly.

#### §12. Filipino annotator proficiency (instance-level)

Filipino-gate annotators ADD **Filipino/Taglish professional fluency** to the
spine baseline (PH-domiciled, English-C1+, PH-libel-trained, blind). This is
an instance-level requirement, not a spine rule — it does not apply to the
English gate. The original "native-Filipino (L1)" framing is retired: the
load-bearing property is PH libel-law calibration + Filipino fluency, not L1
nativeness per se (a PH-domiciled Filipino-proficient libel-trained annotator
who is not L1-Filipino is still the legally-relevant annotator; an L1-Filipino
annotator who is not PH-libel-trained is NOT).

#### §13. Language detection (Taglish — instance-level)

- Primary: **Lingua** (Tagalog model); fallback **fastText lid.176**.
- **Per-span classifier** for Taglish (code-switching within a span).
- A **mixed span defaults to Filipino** — fail toward the stricter DR-4 path.
- Confidence floor 0.85 → force the fallback classifier.
- **Misdetection on a RED-severity item counts against τ_red.**

#### §14. Filipino DR-4 fallback (English-only coverage gap)

If the Filipino gate is unmet (today, because the corpus is unannotated):
Filipino sources are ingested and searchable, but claims/relationships are NOT
extracted, and the UI/demo explicitly discloses the limitation (the
DR-4 fallback path is mutation-tested in
`packages/render/src/gate-dr4-fallback.mutation.test.ts`).

## Alternatives

1. **Treat Filipino as a secondary i18n layer under the English gate.**
   - Rejected (VAL-10). Conflates volume with salience; the English stratum
     would mask a failing Filipino stratum in any blended metric. Filipino is
     a first-class salience gate with its own threshold, scored separately.
2. **Aggregate mean / p95 instead of a stratified floor.**
   - Rejected (Murat F4). An aggregate can hit 0.95 while failing every
     libel-relevant document in a stratum. The Clopper–Pearson lower bound on
     the within-stratum pass rate is the minimum defamation-safe aggregation.
3. **LLM-generated gold labels (fast to produce).**
   - Rejected as a *sole* source (Murat + John F5). Circular: an LLM evaluating
     an LLM always "passes," and the *Disini* "reasonable Filipino reader" test
     is human-cultural by legal definition. Annotation provenance (≥2 humans
     under §9, κ ≥ 0.75) is load-bearing; the hash must cover the provenance
     manifest. *LLM-assisted* annotation IS permitted within the firewall — see
     §9 for the three legitimate roles and the reduced-headcount path.
4. **Permit extraction in v1 with no gate ("ship and see").**
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
     collapses the circularity firewall (§3, §9 forbidden role). The §9
     protocol exists precisely to let Gemini do the heavy lifting *without*
     becoming the ground truth.
7. **Keep the unreachable `CP 95% LCB ≥ 0.95 @ n≥30/stratum` threshold
   (pre-amendment).**
   - Rejected (Mary F1, verified Murat — Story 2.6c). A gate a perfect corpus
     cannot pass is not a gate; it is a documentation artifact that forces
     every honest run to file an exception. The recalibrated Phase-1/Phase-2
     rule (§4) is reachable, stringent, and spends annotation budget on
     finding real libel rather than padding an interval.
8. **Pure-raise-n (n≈250 everywhere) to make the original 0.95 LCB reachable.**
   - Rejected (John). Buys statistical form at 3–5× annotation cost past
     diminishing harm-prevention returns; the Phase-1 floor (0.90) + targeted
     raise-n on the failing stratum captures the defamation-safety property at
     a fraction of the cost.
9. **Pure-reframe (demote the LCB to transparency-only, gate on the
   point-estimate alone).**
   - Rejected (John). Loses the only voice saying "we haven't measured enough"
     at exactly the n where the one tolerated error *is* the defamatory
     hallucination. The LCB floor is retained (at the recalibrated 0.90
     Phase-1 level) precisely to keep small-sample pessimism.
10. **A peer ADR-0026 that re-states the protocol (pre-restructure shape).**
    - Rejected (Winston split-the-difference — Story 2.6c). A full peer ADR
      would manufacture drift between the English and Filipino pass rules. The
      spine lives here once; ADR-0026 inherits it by reference and carries
      only the English instance decisions.

## Consequences

- A language gate is **gated off in v1** via DR-4 (ingest + search, no claim
  extraction, explicit UI disclosure) until the spine's acceptance criteria
  are met for that language — i.e. until ≥2 human annotators (under the §9
  LLM-assisted protocol, PH-domiciled + language-proficient + libel-trained +
  blind) + optionally an adjudicator are procured, human–human Fleiss' κ ≥ 0.75
  is measured on the high-risk stratum, and the recalibrated OQ-9 protocol
  passes on the frozen corpus.
- `eval:smoke` (n=20, per PR, advisory) and `eval:full` (n≥200,
  deploy-blocking) are the two CI enforcement tiers; release runs are never
  cached. Both auto-discover every language instance's `*-oq9.spec.ts`.
- Each language stratum is scored and reported separately; no blended
  cross-language mean is produced or relied upon.
- The Phase-1 LCB floor (0.90) is interim with a Phase-2 sunset (raise toward
  0.95 before broad public launch); the point-estimate (≥0.95) is fixed by the
  defamation-safety tolerance. τ_doc is re-derived from RED-item false-negative
  calibration before G-3 release.
- **A cloud LLM (Gemini 2.5 Pro) may carry most of the annotation labor** via
  §9 (pre-annotation + calibrated co-rater + adjudication assistant), reducing
  the procurement blocker from ≥3 humans to ≥2 — but it can never be the sole
  gold-label source or adjudicator, and every LLM-exposed human rating is
  flagged in the provenance manifest. The Gemini↔human κ ≥ 0.70 calibration is
  re-proven on every model swap.
- **Promoted to `Accepted` on spec-completeness (2026-07-03, Story 2.6b-code).**
  The design-gate evidence (methodology justification + complete OQ-9 protocol
  + gate machinery live + κ-vs-α decision + §9 firewall + guardrails) is
  recorded in the "Spec-completeness methodology justification" subsection
  below; the release-gate evidence (κ ≥ 0.75 measurement) lands in Story
  2.6b-measure (Filipino) / Story 2.6c-measure (English) when procurement
  closes. The spec is binding AND the design gate is closed; the release gate
  remains procurement-blocked.
- **Amended 2026-07-03 (Story 2.6c):** restructured into Part I (protocol
  spine) + Part II (Filipino reference instance); recalibrated pass rule (§4);
  corrected annotator eligibility (§3); recorded metric+judge provenance (§9).
  This retroactively fixes the portfolio-wide unreachable-threshold defect
  (Mary F1) that 2.6b-code inherited. The runtime INCONCLUSIVE/n_min guard
  that operationalizes the recalibrated floor inside `oq9.ts` is filed as
  Open Item O-3 of Story 2.6c (sibling story).

### Spec-completeness methodology justification (Story 2.6b-code, 2026-07-03)

This subsection is the methodology justification that flips the ADR from
`Proposed` to `Accepted` on **spec-completeness** (per the party-mode panel:
Winston, decider-of-record). It records the four decisions the panel
identified as blocking honest "specified" status, all now landed.

**1. κ-vs-α decision — Fleiss' κ is the gate statistic; Krippendorff's α is NOT used.**

The `project-context.md` note *"krippendorff vs simpledorff: pick ONE and
pin"* names **two α libraries** — both compute Krippendorff's α, NOT Fleiss'
κ. A developer reaching for either to satisfy a κ requirement would silently
redefine the gate on a non-interchangeable scale:

| Statistic | Scale at 0.75 | Library | Chosen? |
|-----------|---------------|---------|---------|
| **Fleiss' κ** | "substantial agreement" (Landis-Koch) | — (closed-form, `packages/eval/src/kappa.ts`) | **YES — gate statistic** (multi-rater, nominal defamation labels) |
| Cohen's κ | "substantial agreement" (Landis-Koch, pairwise) | — (closed-form, `packages/eval/src/kappa.ts`) | **YES — license statistic** (§9 Role-2 Gemini↔human, pairwise) |
| Krippendorff's α | "tentative, not yet conclusive" at 0.75 | `krippendorffs-alpha` / `simpledorff` (both 404 on npm as of 2026-07-03) | **NO** — different scale; the 0.75 threshold means a different thing |

**Decision: Fleiss' κ for the multi-rater gate (≥ 0.75), Cohen's κ for the
§9 Role-2 pairwise license (≥ 0.70).** These are TWO DISTINCT functions
(`packages/eval/src/kappa.ts` exports both; never reused one for the other —
AC #4). No κ library exists on the npm registry (verified 2026-07-03:
`krippendorffs-alpha`/`simpledorff` → 404), so both are closed-form
implementations with known-answer fixture vectors — defamation-grade stable
(no transitive dependency drift can move the κ number silently). At exactly 2
raters, Fleiss' κ collapses to Cohen's κ (the boundary where the multi-rater
formula reduces to the pairwise one), which is why the 2-human RED-stratum
path in §3 is mathematically sound.

**2. §9 circularity firewall + Role-2 disjointness — verified, no collapse.**

The production defamation defense is the **mechanical render gate**
(`packages/render/gate.ts`, SC-3 — no LLM at the gate). Serving-path generation
is **Qwen3-14B (local)** for extraction and **Gemini 2.5 Flash/Pro** for the
render Q&A path (ADR-005). So the highest-stakes slice — *extraction* — is
measured against Qwen3-14B, which is **disjoint** from the Gemini 2.5 Pro
co-rater. §9 Role-2 is therefore safe for extraction: no LLM-vs-LLM circularity.
The render-path RAGAS metrics have a **same-family (Gemini↔Gemini) overlap** →
Winston's "report the human-only pairwise Cohen's κ baseline alongside the
Gemini-inclusive Fleiss' κ" guardrail applies there. **No circularity collapse**
(the catastrophic scenario the panel feared is off the table).

**3. Above-contract guardrails (recorded in the ADR, do NOT block dev).**

The epic is silent on annotator headcount/statistic (it mandates only
"annotation provenance"); §9's 2-human protocol is epic-compliant. The
following are defamation-defense *posture*, recorded here as above-contract
recommendations (not contractual requirements):

- **(a) Held-out calibration partition** for the Gemini↔human κ ≥ 0.70
  admission gate (so the calibration is not computed on the same data it
  admits).
- **(b) No Gemini tie-breaking on committed gold** — a human adjudicator
  resolves 1-1 splits (addresses John's tie-break question; the 3→2 headcount
  relaxation is only "real" if a human still adjudicates splits).
- **(c) Report a human-only pairwise Cohen's κ baseline** alongside the
  Gemini-inclusive Fleiss' κ (so the Gemini contribution to agreement is
  visible, not hidden in a blended multi-rater number).

**4. Owner-independence counter-sign (Mary's recommendation).**

The owner (anti lustay) may serve as annotator #1 but must **not** be the sole
arbiter of κ pass/fail. The ADR-0025 promotion requires an independent
counter-sign on the κ measurement (Story 2.6b-measure closes this when the
second annotator lands). Recorded here so the procurement slice cannot
self-certify.

## Open questions

| # | Question | Owner | Trigger |
|---|----------|-------|---------|
| 1 | Source **1** additional human annotator for the Filipino high-risk stratum (down from 2 under the §9 LLM-assisted protocol) + optionally a named adjudicator. | PM + human | Story 2.6b-measure unblock (the measurement slice; off the G-3 design-gate critical path) |
| 2 | Derive τ_doc empirically from RED-item false-negative rate vs legal "reckless disregard" tolerance (Phase-2 floor sunset). | Legal + Test architect | Pre-G-3 release |
| 3 | At what corpus size does in-repo storage (ADR-0011) hurt git performance enough to revisit for a language corpus specifically? | Architect | When any language corpus exceeds ~10k items |
| 4 | Does the §9 Role-2 Gemini↔human κ ≥ 0.70 gate hold specifically on Taglish code-switched spans, or does calibration need to be stratified by language-mix ratio? | Test architect | First §9 calibration run |
| 5 | **(Story 2.6c amendment)** Phase-2 floor re-tightening: date + migration commitment to raise the Phase-1 LCB floor (0.90) toward 0.95 before broad public launch. | PM + Test architect | Before broad public launch (Phase-2 gate) |
| 6 | **(Story 2.6c amendment; widened by code-review patch P9, 2026-07-03)** The `oq9.ts` code catch-up for the recalibrated `OQ9_PASS` rule (Open Item O-3 of Story 2.6c). The shipped deploy-blocking gate still enforces the legacy single-conjunct `CP_LCB_95 ≥ 0.95` rule; the catch-up is an enumerated **four-part** scope: **(i)** LCB floor 0.95→0.90, **(ii)** point-estimate ≥ 0.95 conjunct, **(iii)** AND-joined non-rescuing aggregate-head, **(iv)** n_min/INCONCLUSIVE guard. Old/new rules are non-monotone — see the `OQ9_PASS` code-catch-up banner in §4. Sibling story; the empty-corpus AC prose is the interim control. Lands before broad public launch. | Engineer | Story 2.6c O-3 sibling |

*Note: an earlier draft listed "should the LLM-judge↔human κ calibration be
re-run on every model swap?" as an open question — that is now a settled
decision (§9 Role 2: the κ ≥ 0.70 calibration is re-proven on every model
swap; Gemini version drift breaks it silently), so it is removed from the
open-questions table.*
