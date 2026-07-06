---
id: ADR-028
title: "Numeric Defamation Threshold — Max Acceptable Hallucination Rate per Language per Citation Class (AR-26, VAL-3.8)"
status: Accepted
date: 2026-07-06
supersedes: null
superseded_by: null
deciders: [Winston (architect), Murat (test architect), Mary (analyst), Amelia (engineer), John (PM), anti lustay (user)]
related: [AR-26, VAL-2, VAL-3.8, AC-2, SC-3, SEC-5, NFR-EI-1, NFR-EI-2, INV-001, INV-002, ADR-001, ADR-025, ADR-026]
evidence:
  # Story 2.7 (2026-07-06). ADR-0028 quantifies the "defamation-grade" bar
  # defined qualitatively in ADR-001. VAL-2 (architecture.md L564) escalated the
  # absence of a numeric threshold to Critical: "defamation-grade appears ~30×
  # in the spec and is never quantified; define the max acceptable hallucination
  # rate per language per citation class — the whole safety case reduces to this
  # number." This ADR is that number, plus the measurement protocol, the
  # sample-size calculation, the provenance of every threshold, and the
  # operational response to a breach. The measurement path (packages/eval) is
  # live and tested (verified AC #9 — see Context §3); the thresholds are
  # design-binding; the operational response is wired into the render gate
  # (ADR-0007) and the SEC-8 red-team battery.
  - _bmad-output/planning-artifacts/architecture.md
  - _bmad-output/planning-artifacts/epics.md
  - _bmad-output/implementation-artifacts/2-7-defamation-threshold-blast-radius-adrs.md
  - docs/adr/0001-defamation-grade-operational-definition.md
  - docs/adr/0025-filipino-eval-set-spec.md
  - docs/adr/0026-english-eval-set-spec.md
  - packages/eval/src/oq9.ts
  - packages/eval/src/kappa.ts
  - packages/eval/src/freeze.ts
  - packages/eval/src/manifest.ts
  - packages/eval/src/__tests__/filipino-oq9.spec.ts
  - packages/eval/src/__tests__/english-oq9.spec.ts
  - packages/render/src/gate.ts
---

# ADR-028: Numeric Defamation Threshold — Max Acceptable Hallucination Rate per Language per Citation Class (AR-26, VAL-3.8)

> **Status: Accepted (2026-07-06, Story 2.7).** This ADR quantifies the
> "defamation-grade" bar defined qualitatively in ADR-001 (Decision §1, §3).
> VAL-2 (`architecture.md` L564) escalated the absence of a numeric threshold to
> **Critical**: *"defamation-grade appears ~30× in the spec and is never
> quantified; define the max acceptable hallucination rate per language per
> citation class — the whole safety case reduces to this number."* This ADR is
> that number.
>
> The thresholds below are **design-binding** (they drive render-gate behavior,
> eval-gate pass rules, and the SEC-8 red-team acceptance bar) but their
> **measurement** on real annotated data is procurement-blocked (Story 2.6b-measure
> for Filipino, Story 2.6c-measure for English), exactly as ADR-0025/0026 are
> spec-complete on design and procurement-blocked on κ measurement. The
> distinction between a *detection target* (zero tolerance) and a *statistical
> threshold* (measurable rate) is load-bearing and is explained in §1.

## Context

### 1. The problem — an undefined bar cannot be mechanically enforced

ADR-001 defines "defamation-grade" qualitatively: 100% citation coverage
(NFR-EI-1), 0 allegation-as-fact incidents (NFR-EI-2, INV-002), trust-tier
visibility (EI-8), fact/claim distinction (EI-7). These are the right
*properties*. But the platform also produces derived content (RAG answers,
extracted claims, entity resolutions) that is not binary — an LLM extraction
may be *mostly* faithful with one hallucinated span, or *mostly* cited with one
unsupported citation. Without numeric thresholds, every "is this safe to serve?"
question reduces to editorial judgment, which is exactly the non-mechanical
enforcement ADR-001 §1 forbids. VAL-2 named this gap Critical.

**The blast-radius of an undefined bar.** ADR-0029 (the blast-radius matrix)
classifies partial-failure states as Acceptable or Chargeable — but the
classification is meaningless without a numeric definition of "chargeable." If
"allegation-as-fact served" is chargeable, what is the threshold? One occurrence
(detection target) or a measurable rate (statistical threshold)? ADR-0028 is the
numeric spine that ADR-0029's matrix references.

### 2. Two distinct kinds of threshold — do not collapse them (Murat/Winston, Story 2.7 panel)

The Story 2.7 party-mode panel (Winston/Murat/Amelia/John, 2026-07-06) identified
a category error in the original draft: it treated all four thresholds as
statistical claims, including the 0.00% allegation-as-fact floor. The panel
unanimously split them into two distinct kinds:

| Kind | Threshold | What "below threshold" means | How verified |
|------|-----------|------------------------------|--------------|
| **Detection target** | 0.00% allegation-as-fact (INV-002) | **Zero occurrences.** Any single occurrence triggers an incident response (P0). | Exhaustive check (render gate on every render) + SEC-8 red-team battery. NOT a statistical claim — zero defects cannot be *proven* through measurement, only *failed to be detected*. |
| **Statistical threshold** | 0.50% / 1.50% / 3.00% per citation class | **The true rate is below the threshold with 95% confidence** (Clopper-Pearson upper bound). | Stratified sample evaluation via the polyglot eval harness (ADR-0014), with a sample-size calculation (§3). |

Collapsing these into one kind is the F1 defect: "0.00% verified by measurement"
is a logical impossibility (the CP 95% lower bound for zero failures is trivially
0.00% and provides no discrimination; the meaningful bound is the *upper* bound,
≈3/N — see §3). The detection target is enforced *exhaustively* (every render);
the statistical thresholds are enforced *by sampling*. Both are real gates; they
are not interchangeable.

### 3. The measurement path exists (AC #9 verification)

Per AC #9 (Murat/Amelia, Story 2.7 panel), the eval harness measurement path is
verified to exist before this ADR claims it as the measurement instrument:

- **`packages/eval/`** is a built, tested workspace package (`packages/eval/package.json`,
  `packages/eval/src/oq9.ts`, `packages/eval/src/kappa.ts`, `packages/eval/src/freeze.ts`,
  `packages/eval/src/manifest.ts`).
- **Filipino eval gate** (ADR-0025): 8 tests GREEN (`packages/eval/src/__tests__/filipino-oq9.spec.ts`).
- **English eval gate** (ADR-0026): 9 tests GREEN (`packages/eval/src/__tests__/english-oq9.spec.ts`).
- **Clopper-Pearson machinery**: `packages/eval/src/oq9.ts` implements Decimal-precision
  CP LCB; the upper-bound counterpart is the same interval family read from the
  other tail (no new library).
- **Two-tier CI** (`eval:smoke` advisory per-PR + `eval:full` deploy-blocking)
  auto-discovers both language specs.

**Verdict: the measurement path exists and is tested.** No blocking Open Question
on AC #9. The *corpus population* (the annotated data the harness runs over) is
procurement-blocked (Stories 2.6b-measure / 2.6c-measure) — but the instrument
itself is live, which is what AC #9 asks.

## Decision

### §1. The numeric thresholds

The max acceptable hallucination rate, per citation class (mapping to the trust
tiers in ADR-001 §5), uniform across languages (English and Filipino scored and
reported separately, but the per-class threshold is the same — defamation harm
does not vary by language):

| Citation class (Trust Tier) | Max acceptable hallucination rate | Kind | Source / provenance (full table in §2) |
|-----------------------------|-----------------------------------|------|----------------------------------------|
| **Allegation-as-Fact** (INV-002 / NFR-EI-2) | **0.00%** | **Detection target** (zero tolerance) | NFR-EI-2 (PRD): "0 allegation-as-fact incidents." ADR-001 §3. Enforced exhaustively. |
| **Tier-1 Primary** (gov/court/official) | **≤ 0.50%** | Statistical threshold | Stakeholder risk-appetite (§2-P2) + Citation Recall ≥ 0.97 floor (architecture.md Regression Thresholds) translated to a class-specific ceiling. |
| **Tier-2 Secondary** (reputable media) | **≤ 1.50%** | Statistical threshold | Stakeholder risk-appetite (§2-P2) + Citation Recall ≥ 0.97 floor, loosened for the lower-corroboration class. |
| **Tier-3 Aggregator** (where trust tier is displayed AND corroboration required) | **≤ 3.00%** | Statistical threshold | Stakeholder risk-appetite (§2-P2); the corroboration marker (ADR-001 §5) is the safety mechanism, not the rate alone. |

**Reading the table.**
- "Hallucination rate" = the fraction of served citations in that class that are
  unsupported by their cited source span (RAGAS Faithfulness + NLI entailment
  gate from ADR-0008, scored per the ADR-0025 §4 metric definitions).
- **Per language, scored separately.** English (ADR-0026) and Filipino
  (ADR-0025 Part II) each have their own strata and their own pass/fail per the
  ADR-0025 §4 recalibrated rule; a blended cross-language mean is forbidden
  (ADR-0025 Context).
- **The Tier-1/Tier-2/Tier-3 thresholds are upper bounds on the per-class
  hallucination rate**, verified via the Clopper-Pearson 95% **upper** bound
  (§3), NOT lower bounds. The allegation-as-fact row is a detection target, not
  a statistical threshold — it is enforced exhaustively (§4).

### §2. Threshold provenance (AC #8 — John, Story 2.7 panel)

Every numeric threshold carries a provenance statement. A threshold without
provenance is a tuned knob, not a legal argument.

| Threshold | Provenance kind | Citation | Notes |
|-----------|-----------------|----------|-------|
| **0.00% allegation-as-fact** | **NFR (PRD)** | NFR-EI-2 (`prd.md`): "0 allegation-as-fact incidents (P0 on any occurrence)." ADR-001 §3 ("Fact vs Claim Distinction"). | This is a **contractual zero** from the PRD, not a derived number. It is a detection target (§1) because zero defects cannot be proven by sampling — only by exhaustive enforcement (render gate on every render). |
| **≤ 0.50% Tier-1** | **Stakeholder risk-appetite + empirical floor** | `_bmad-output/project-context.md` Regression Thresholds: Citation Recall ≥ 0.97 raw generation / Citation Precision ≥ 0.97 raw; **Citation Precision ≥ 0.99 served** post citation-resolvability gate. A 0.50% hallucination ceiling on Tier-1 (the highest-trust class) is consistent with the served-precision floor: it is stricter than the ≤ 1% raw ceiling and reflects the highest-stakes defamation surface (Senate roll-call, SC fallo). | The 0.97/0.99 floors are *aggregate* floors; this ADR allocates them across classes so a strong Tier-1 cannot mask a failing Tier-3. The 0.50% Tier-1 ceiling is the tightest because Tier-1 sources are the highest-stakes defamation surface. |
| **≤ 1.50% Tier-2** | **Stakeholder risk-appetite** | architecture.md Citation Recall ≥ 0.97 raw floor, loosened for the Tier-2 class (reputable media — higher baseline retrieval noise than primary records). | The 3× ratio Tier-1 → Tier-2 (0.50% → 1.50%) reflects the corroboration gradient: Tier-2 sources are one step removed from the primary record. **Open Question OQ-28.1** (Legal + Test architect): recalibrate empirically once the eval corpus is populated. |
| **≤ 3.00% Tier-3** | **Stakeholder risk-appetite + corroboration marker** | ADR-001 §5: "Lone tier-3 allegation about a named person is never served as established — it requires corroboration signal (EI-8)." | The 3.00% ceiling is the loosest because Tier-3 citations are *always* displayed with their trust tier AND require a corroboration marker (ADR-001 §5). The rate is not the sole safety mechanism; the corroboration requirement is. **Open Question OQ-28.1**: recalibrate empirically. |

**No threshold in this ADR is derived from "industry uses X."** "Industry uses
0.95" is not a defensible citation (ADR-0025 §8, review report F8). The
allegation-as-fact floor is a PRD mandate; the per-class ceilings are
stakeholder risk-appetite decisions anchored to the architecture.md aggregate
floors, with an explicit Open Question (OQ-28.1) to recalibrate empirically
once the eval corpus is populated. If a threshold is later found to lack
empirical support, it is *tightened*, never loosened, without a new ADR.

### §3. Sample-size calculation for statistical validity (AC #5 — Murat/Winston)

**The lower-vs-upper-bound correction (critical).** The original draft said
"verified using Clopper-Pearson 95% LCB." This is a category error: the CP 95%
**lower** confidence bound for zero observed failures is trivially 0.00% and
provides *no discrimination* (you cannot distinguish "true rate is 0%" from
"true rate is 5%" with a lower bound that is always 0). The meaningful bound
for "is the true rate *below* the threshold?" is the **upper** bound: for zero
failures in N trials, the CP 95% upper bound ≈ 3/N (the "rule of three"). To
claim "below threshold T" with 95% confidence and zero observed failures,
**N ≥ 3/T** (exact: N ≥ ln(0.05)/ln(1−T)).

**Sample-size table (exact one-sided CP 95% upper bound, zero failures):**

| Citation class | Threshold T | Min N (0 failures) | CP 95% upper bound at min N | Source |
|----------------|-------------|--------------------|-----------------------------|--------|
| Tier-1 Primary | 0.50% | **N = 598** | 0.4997% | N = ⌈ln(0.05)/ln(0.995)⌉ |
| Tier-2 Secondary | 1.50% | **N = 199** | 1.4941% | N = ⌈ln(0.05)/ln(0.985)⌉ |
| Tier-3 Aggregator | 3.00% | **N = 99** | 2.9807% | N = ⌈ln(0.05)/ln(0.97)⌉ |
| *(reference)* 0.01% resolution | 0.01% | N = 29,956 | 0.0100% | Why "0.00% by measurement" is impossible — the sample size is absurd. |
| *(reference)* 0.10% resolution | 0.10% | N = 2,995 | 0.1000% | Mid-resolution reference. |

**Reading the table.** "Min N (0 failures)" is the smallest sample size at
which observing *zero* hallucinations lets you claim "the true rate is below T
with 95% confidence." If you observe ≥1 hallucination, the required N rises. The tolerance-schedule
structure from ADR-0025 §4 applies to pass-rate lower bounds, not to fail-rate
upper bounds; for the per-class hallucination ceiling, a single failure at the
zero-failure N often invalidates the class. Example: for Tier-1 at n=598, k=1
gives a CP 95% upper bound ≈ 0.79%, which exceeds the 0.50% threshold; passing
with k=1 requires n≈948. When any failure is observed, the test architect must
recompute the UCB and decide whether to resample or treat the class as failed.
The table is per **(language, citation-class) pair** — English Tier-1 needs
N=598, Filipino Tier-1 needs another N=598, etc. — because the thresholds are
verified independently per language (ADR-0025 Context: no blended
cross-language mean).

**Why this is not a lower-bound gate (Murat).** ADR-0025 §4 uses the CP 95%
**LCB** on the *pass* rate to gate extraction quality (the gate asks "is the
good rate high enough?"). This ADR uses the CP 95% **UCB** on the
*hallucination* rate (the gate asks "is the bad rate low enough?"). These are
the same interval read from opposite tails — the LCB on pass-rate = 1 − UCB on
fail-rate. The sidedness is one-sided in both cases (ADR-0025 §4). The
distinction matters only when stating which tail you are bounding; the math is
the same CP interval. Recording it here prevents a future agent from
"optimizing" by swapping the tail and silently passing a failing gate.

**The detection target (0.00%) is NOT in the sample-size table.** It cannot be —
zero defects cannot be proven by sampling. The detection target is enforced
exhaustively (§4), not by the sample-based eval gate.

### §4. Measurement protocol

The hallucination rate is measured using the **polyglot eval harness**
(ADR-0014) and the **metric definitions inherited from ADR-0025 §4**:

- **Metrics:** RAGAS Faithfulness (chunk-level citation fidelity), Citation
  Recall, Citation Precision, NLI entailment (ADR-0008). A "hallucination" for
  the per-class rate is a served citation in that class whose Faithfulness
  score is below the τ_doc floor (ADR-0025 §4) OR whose NLI entailment gate
  fails.
- **Stratification:** per language (English strata from ADR-0026 §2; Filipino
  strata from ADR-0025 Part II §11), per citation class (Tier-1/2/3). The
  sample-size table (§3) applies to each (language, class) cell independently.
- **Pass rule:** the per-class CP 95% **upper** bound on the hallucination rate
  must be ≤ the class threshold (§1), at the sample size from §3. This is
  AND-joined across classes (a strong Tier-1 does not rescue a failing Tier-3)
  and AND-joined across languages (per ADR-0025 Context).
- **Instruments:** `packages/eval/src/oq9.ts` (CP interval machinery,
  Decimal-precision), `packages/eval/src/kappa.ts` (inter-rater κ for
  annotation provenance), `packages/eval/src/freeze.ts` (corpus freeze). The
  measurement runs under the two-tier CI (`eval:smoke` advisory / `eval:full`
  deploy-blocking — ADR-0025 §6).

**The detection target (0.00% allegation-as-fact) is NOT measured by this
protocol.** It is enforced by the **render gate** (`packages/render/src/gate.ts`,
ADR-0007, SC-3) on every render — internal or external, per ADR-001 §1. The
gate is mechanically fail-closed: a claim without citation support is WITHHELD,
never served. An allegation-as-fact that reaches a user is a P0 incident
(NFR-EI-2), not a statistical regression. The SEC-8 red-team battery
(promptfoo libel-injection / republication-framing) is the adversarial
detection layer; its recall is a distinct invariant from the per-class
hallucination rate.

### §5. Operational response to a threshold breach

A breach of any threshold triggers a defined response. "Defined" means
*automated where possible, manual where required, always recorded in the
editorial log* (AC-11).

| Breach | Automated response | Manual response | Record |
|--------|-------------------|-----------------|--------|
| **Detection target (0.00% allegation-as-fact)** | **Circuit-breaker OPEN**: render gate refuses to serve the offending content (WITHHOLD); the serving worker returns structured silence. The render gate is already fail-closed by design (ADR-0007), so the "circuit-breaker" is the gate itself firing on every render. | **P0 incident**: on-call editorial owner + legal counsel notified within 1h (ADR-001 §7). The offending extraction is quarantined; the source span + extraction trace are preserved in MinIO with object locking. | Editorial log entry `defamation.allegation_as_fact_detected` (SEC-6). |
| **Tier-1/2/3 statistical threshold (per-class UCB > threshold)** | **`eval:full` gate FAILS → deploy is blocked** (ADR-0025 §6). The offending class is reported in the eval artifact. The render gate does NOT automatically suppress the whole class (a class-level blanket suppression would be an availability decision, not a safety one) — instead the per-document τ_red / τ_doc floors (ADR-0025 §4) withhold the individual offending documents. | **Manual review queue**: the offending documents enter the editorial review queue (Story 8.x). The Test architect + PM decide whether to (a) raise-n on the failing class (re-annotate to tighten the bound), (b) tighten the document-level τ_doc, or (c) accept a DR-4 fallback (no extraction for that class/language until the gate passes — ADR-0025 §7). | Editorial log entry `eval.threshold_breach` with the class, the observed rate, the CP bound, and the response chosen. |

**Both** (automated circuit-breaker + manual review queue) fire on a detection-target
breach; **only the deploy-block + manual review** fire on a statistical-threshold
breach (the per-document gate already withholds the worst offenders via τ_red/τ_doc).
This asymmetry is deliberate: the detection target is a P0 (exhaustive
enforcement), the statistical thresholds are deploy-blocking gates (sample-based
enforcement).

### §6. Traceability to Story 2.9 chaos suite (AC #7 — Murat)

The thresholds in this ADR are exercised by specific Story 2.9 chaos-suite ACs.
Without this traceability, Story 2.9 cannot verify what Story 2.7 defines.

| This ADR's threshold / concept | Story 2.9 chaos AC that exercises it | How |
|--------------------------------|--------------------------------------|-----|
| **0.00% allegation-as-fact (detection target)** | Story 2.9 AC: "zero claim-responses return without source attribution (AC-2, SC-6)" under 500 RPS sustained load + failure injection. | The chaos suite proves the render gate's exhaustive enforcement holds under load — the detection target is *operationalized* by the gate firing on every render even when the system is stressed. |
| **Tier-1/2/3 per-class thresholds (statistical)** | Story 2.9 AC: "zero ground-truth-cited responses return without citations (SC-6)" + the failure-injection matrix (partition, node-loss, clock-skew, partial-render, queue backpressure). | The chaos suite does NOT re-measure the per-class rate (that is the eval gate's job, ADR-0025/0026); it verifies that the *mechanisms* that enforce the thresholds (render gate, citation engine) hold under partial failure. A chaos run that drops citations under load is a threshold breach by construction. |
| **Operational response (circuit-breaker, §5)** | Story 2.9 AC: "partial-render (serve-worker degraded — fail-closed verified)" + "queue backpressure (render-queue saturated — gate still invoked per Story 2.8)." | The chaos suite verifies that the fail-closed behavior (the detection-target circuit-breaker) actually fires when the serve-worker is degraded or the render queue is saturated — the exact scenario where a silent citation-drop would breach the detection target. |
| **SEC-8 red-team mapping** | Story 2.9 AC: "SEC-8 red-team evals are mapped: libel-injection, slow-poisoning, republication-framing, adversarial-query, source-attribution, tamper." | The SEC-8 battery is the adversarial detection layer for the 0.00% target; its recall is tracked separately from the per-class statistical thresholds. |

**Story 2.9 dependency note:** Story 2.9 is `backlog` (not yet started). The
traceability above is the *contract* — when 2.9 implements its ACs, it must
reference these thresholds by ID. This ADR does not block on 2.9; it defines
what 2.9 must verify.

## Alternatives

1. **Leave the threshold undefined; enforce case-by-case (the status quo ante).**
   - Rejected (VAL-2). An undefined bar cannot be mechanically enforced
     (ADR-001 §1). "We know it when we see it" is not a defense in a PH
     cyberlibel inquiry. VAL-2 escalated this to Critical.

2. **A single aggregate threshold (e.g., "≤ 1% hallucination overall").**
   - Rejected (Murat, Story 2.7 panel). An aggregate can hit 1% while every
     Tier-1 citation hallucinates — exactly the libel-relevant failure mode. The
     per-class structure (ADR-001 §5 trust tiers) is the minimum
     defamation-safe allocation. This mirrors ADR-0025 §4's rejection of
     aggregate-mean gating.

3. **Treat 0.00% allegation-as-fact as a statistical threshold (the original draft).**
   - Rejected (Murat/Winston, Story 2.7 panel). Zero defects cannot be proven
     by sampling — the CP 95% lower bound for zero failures is trivially 0.00%,
     and the upper bound requires ~30K observations for 0.01% resolution (§3).
     The detection-target framing (exhaustive enforcement, any single occurrence
     = P0) is the honest and mechanically enforceable version. Collapsing the
     two kinds (§1) is the F1 defect.

4. **Use the CP 95% lower bound instead of the upper bound.**
   - Rejected (Murat, Story 2.7 panel — AC #5). The question "is the true rate
     *below* the threshold?" is answered by the *upper* bound, not the lower.
     The lower bound for zero failures is always 0.00% and provides no
     discrimination. This is the single most important statistical correction in
     the ADR; recording it prevents a future agent from silently swapping the
     tail.

5. **Derive thresholds from "industry standard" (e.g., 0.95).**
   - Rejected (ADR-0025 §8, review report F8). "Industry uses 0.95" is not a
     defensible citation. The allegation-as-fact floor is a PRD mandate; the
     per-class ceilings are stakeholder risk-appetite anchored to the
     architecture.md aggregate floors, with OQ-28.1 to recalibrate empirically.

6. **Different thresholds per language (e.g., looser for Filipino).**
   - Rejected. Defamation harm does not vary by language (ADR-0025 Context). The
     per-class threshold is uniform; the *measurement* is per-language (separate
     strata, separate pass/fail, no blended mean). A defamatory hallucination in
     Tagalog is no less defamatory than one in English (ADR-0025 Context, VAL-10).

7. **No operational response section (thresholds without teeth).**
   - Rejected (Winston, Story 2.7 panel — AC #2). A threshold without a defined
     breach response is a dashboard, not a gate. §5 wires each threshold to a
     concrete automated + manual response recorded in the editorial log.

## Consequences

- **The safety case reduces to a number.** "Defamation-grade" (ADR-001) now has
  a numeric spine: 0.00% detection target (exhaustive) + 0.50%/1.50%/3.00%
  statistical thresholds (sample-based), per class, per language, measured via
  the polyglot eval harness with CP 95% upper bounds. VAL-2's Critical gap
  (AR-26) is closed.
- **The render gate is the detection-target enforcement.** The 0.00% floor is
  not a sampling gate — it is the render gate (`packages/render/src/gate.ts`) firing
  on every render (ADR-0007, SC-3). The SEC-8 red-team battery is the
  adversarial detection layer.
- **The eval gate (ADR-0025/0026) is the statistical-threshold enforcement.**
  The per-class ceilings are verified by `eval:full` (deploy-blocking) using
  the CP 95% upper bound, at the sample sizes from §3.
- **Story 2.9 has a traceability contract.** The chaos-suite ACs (§6) reference
  these thresholds by ID; when 2.9 implements, it verifies the enforcement
  mechanisms hold under failure injection.
- **The thresholds are design-binding now; empirical recalibration is Open
  Question OQ-28.1.** The per-class ceilings are stakeholder risk-appetite
  decisions anchored to the architecture.md floors. Once the eval corpus is
  populated (Stories 2.6b-measure / 2.6c-measure), OQ-28.1 recalibrates — and
  may only tighten, never loosen, without a superseding ADR.
- **ADR-0029 (blast-radius matrix) references these thresholds.** A failure
  combination in ADR-0029 is "Chargeable" if it risks breaching a threshold in
  this ADR (e.g., an audit-worker death that silently drops audit events risks
  an undetected allegation-as-fact breach).

## Open questions

| # | Question | Owner | Trigger |
|---|----------|-------|---------|
| 1 | **Empirical recalibration of Tier-1/2/3 ceilings.** The 0.50%/1.50%/3.00% ceilings are stakeholder risk-appetite anchored to the architecture.md aggregate floors. Once the eval corpus is populated (Stories 2.6b-measure / 2.6c-measure), recalibrate empirically — and may only *tighten*, never loosen, without a superseding ADR. | Legal + Test architect + PM | Stories 2.6b-measure / 2.6c-measure corpus population |
| 2 | **Should the Tier-3 corroboration marker (ADR-001 §5) be a hard gate or a display-time signal?** This ADR assumes the corroboration marker is display-time (the 3.00% ceiling is the hard gate). If Legal determines the corroboration marker must be a hard gate (block serving on lone Tier-3-about-named-person regardless of rate), the Tier-3 threshold becomes moot for that subset. | Legal | Pre-PD-3 launch gate |
| 3 | **τ_doc calibration inheritance.** ADR-0025 §8 Open Question #2 defers τ_doc empirical calibration to pre-G-3 release. Does the per-class τ_doc (the document-level floor that withholds individual offending documents) need to be class-specific, or is the uniform ADR-0025 τ_doc sufficient? | Test architect | Pre-G-3 release |
| 4 | **Sample-size budget for the per-class measurement.** §3 requires N=598 (Tier-1) per language. Across 3 classes × 2 languages, the full measurement is ~1,800 annotated items per gate run. Is this annotation budget feasible under the §9 LLM-assisted protocol (ADR-0025), or does it force a reduced-class measurement (Tier-1 only) for the initial release? | PM + Test architect | Stories 2.6b-measure / 2.6c-measure annotation planning |
