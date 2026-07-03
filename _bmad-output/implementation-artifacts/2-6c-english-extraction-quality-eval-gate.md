---
story_id: '2.6c'
story_key: '2-6c-english-extraction-quality-eval-gate'
epic: 'Epic 2: Provenance & Invariants'
status: done
last_updated: '2026-07-03'
baseline_commit: '8358e2e7c99838b807f41c9c6b5dcf01215d02a9'
depends_on:
  - '2-6b-code-filipino-eval-gate-scaffolding (must reuse the kappa/oq9/freeze packages and two-tier CI scaffolding)'
  - 'ADR-0025 amendment (portfolio-wide threshold-recalibration + protocol-spine restructure + annotator-eligibility correction — see Open Item O-1; lands as Task 1a in this story)'
  - 'shared-harness manifest-validator fix (validateCorpusManifest() in packages/eval; see Open Item O-2; sibling story, 2.6c blocked-on-it)'
blocks: ['G-3 design gate — JOINTLY with 2.6b-code (necessary-but-not-sufficient)']
g3_status: design-gate-trackable
---

# Story 2.6c: English Extraction-Quality Eval Gate — the source-corpus volume path (OQ-9-EN, VAL-10)

Status: done

> **Surfaced 2026-07-03** by the Story 2.6 party-mode adversarial review (finding F1) and codified by the **VAL-10** architecture amendment. Re-scoped 2026-07-03 by a **3-round party-mode adversarial review** (5 agents: Winston, Murat, Mary, Amelia, John — see **Review Trail** below). English legal/journalism documents are the **majority *source-corpus* path** of the platform (court pleadings, Senate records, and the broadsheet record are English — audience-independent). This story scaffolds the English extraction-quality gate and closes the G-3 *design* gate jointly with 2.6b-code.
>
> **Premise correction (John, round 3 — VAL-10 re-read):** the original framing conflated the *source-corpus* claim (English documents dominate what we ingest — empirically true, audience-independent) with the *serving-path* claim (the language users query/receive in — audience-dependent, currently undocumented). 2.6c gates a defamation surface that exists under *any* audience scenario: English allegations are surfaced and cited regardless of the end-user's language. So 2.6c is **not** blocked on the audience question (routed to a PM-owned item — Open Item O-4), but the premise language is corrected throughout to "*source-corpus* path," not "serving path."

## Story

As a **test architect and compliance officer**,
I want the English extraction-quality eval gate **specified** as a thin instance record (ADR-0026) inheriting the amended, language-agnostic OQ-9 protocol spine (ADR-0025) — codifying the English strata, annotator eligibility, disambiguation rule, metric+judge provenance, and the recalibrated pass rule — with the v0 corpus manifest reshaped and pinned,
so that the English source-corpus volume gate is **specified** — closing the G-3 *design* gate — independent of the corpus-population + κ-measurement release gate (deferred to Story 2.6c-measure).

## Context

- **G-3 is a DESIGN gate, not a release gate.** `epics.md` L682: *"G-3 closes only when BOTH the English and Filipino gates are **specified**"*; AR-24: *"Critical-DESIGN-gate."* This story produces the English gate *specification*; the annotated corpus + κ measurement (release gate) is deferred to Story 2.6c-measure.
- **Portfolio-wide threshold defect discovered in review (Mary F1, verified Murat).** The original `CP 95% LCB ≥ 0.95` at `n ≥ 30/stratum` is **unreachable by construction**: zero errors at n=30 yields a 95% LCB of ~0.886–0.905 (Wilson/CP/rule-of-three) — a *perfect* corpus fails the gate. This defect lives in ADR-0025 (Filipino) and is inherited by 2.6c. Per panel consensus (Winston decider-of-record): **fix once where it lives** — a single amendment to ADR-0025 (Task 1a), not a peer-ADR patch and not a 2.6c-local patch. The fix is *structural* (how the CP result is applied), not numerical — the decimal.js CP machinery in `oq9.ts` is untouched.
- **Reusing gate machinery.** This story leverages the generic OQ-9 gate engine (`packages/eval/src/oq9.ts`), κ computation (`packages/eval/src/kappa.ts`), and corpus-freeze (`packages/eval/src/freeze.ts`) built in Story 2.6b-code. **No new interval family is introduced** (Murat/Mary convergence: at the operative n≈59, CP/Wilson/Jeffreys agree to ~0.002, so the interval family is not load-bearing — reuse the audited decimal.js CP).
- **Annotation provenance & anti-circularity firewall (corrected — Mary F3, panel consensus).** The original "L1 native English speakers" requirement is **dropped**: it imports US/UK defamation community standards (actual-malice / serious-harm) into a corpus governed by **PH libel law** (Revised Penal Code Art. 353–362, Cybercrime Prevention Act §4(c)(4)) and *excludes* the correct annotators. Correct eligibility: **PH-domiciled, English-C1+-proficient, PH-libel-trained, blind to model output** — language-agnostic, lives in the amended shared ADR. ≥3 raters/doc, named adjudicator, Fleiss' κ ≥ 0.75 (gate), no LLM-as-sole-rater; LLM-as-judge only when calibrated to human (Cohen's κ ≥ 0.70) under §9 Role-2 co-rater. **Note (Mary/Murat): κ validates inter-rater *consistency*, NOT fidelity to the legal standard** — eligibility is what protects calibration to PH law; κ is orthogonal and cannot rescue a wrong-standard pool.
- **Empty-corpus honesty (Murat R1 / Amelia).** The English v0 corpus is a **target-state empty manifest** (`files: []`). This story specifies the *gate scaffold* — it does NOT validate English extraction quality (no corpus yet). The ACs say so explicitly so no one mistakes a green scaffold test for English-language coverage. The deploy-blocking `eval:full` must not either block-all-deploys (gate fails red on n=0) or force a vacuous green (short-circuit on `files.length===0`); the runtime `INCONCLUSIVE`/`n_min` guard that prevents both is **out of 2.6c scope** (`oq9.ts` is shipped deploy-blocking logic — changing it is production logic in a scaffold costume) and is filed as a sibling story (Open Item O-3).

## Acceptance Criteria

### Behavioral (stakeholder-verifiable)

1. **ADR-0025 amended (portfolio-wide threshold recalibration + protocol-spine restructure + annotator-eligibility correction) — Task 1a:**
   - **Given** ADR-0025 (Filipino, `Accepted` 2026-07-03) carries the unreachable-threshold defect and the L1-native annotator clause,
   - **When** ADR-0025 is amended,
   - **Then** the amendment separates its two currently-conflated halves into (i) a **language-agnostic protocol spine** (metric definitions, the recalibrated pass rule, sidedness, the n_min/INCONCLUSIVE contract, freeze semantics, MECE disambiguation-rule logic) and (ii) the **Filipino measurement-design instance** (Filipino strata, Filipino annotator profile) labeled as the *reference instance*,
   - **And** the **recalibrated pass rule** (panel consensus; see Dev Notes §Recalibrated Pass Rule) is recorded: **per-stratum CP 95% LCB floor + Phase-1 point-estimate ≥0.95 + LCB floor ≥0.90 + INCONCLUSIVE escalation to targeted raise-n**, with a published error-count→required-n tolerance schedule (Phase-1: n=36 @ 0 errors, n=54 @ 1 error; Phase-2: n=72 @ 0 errors, n=110 @ 1 error — exact one-sided CP per code-review patch P8) and an explicit Phase-2 re-tighten-to-0.95 commitment dated before broad public launch,
   - **And** the annotator-eligibility clause is corrected to **PH-domiciled, English-C1+-proficient, PH-libel-trained, blind** (L1-native dropped), language-agnostic,
   - **And** the metric + judge provenance is recorded (judge model+version, frozen judge prompt, judge↔human calibration floor, English-specific notes),
   - **And** `adr-lint` passes GREEN.

2. **ADR-0026 (English instance record) accepted on spec-completeness — Task 1b:**
   - **Given** the amended ADR-0025 (protocol spine) exists,
   - **When** `docs/adr/0026-english-eval-set-spec.md` is reviewed,
   - **Then** it is a **thin instance record** that inherits the protocol spine *by reference* and carries ONLY the English measurement design: the English strata manifest (with the Conversational/Social-English motivation answered honestly — see AC #3), the PH-domiciled annotator eligibility (inherited), a pointer to the shared MECE disambiguation rule, and the rationale + resolved open questions behind each English-specific decision,
   - **And** it is bidirectionally linked to the **load-bearing** subset of {ADR-0001, ADR-0005, ADR-0007, ADR-0008, ADR-0011, ADR-0014, ADR-0017, ADR-0020, ADR-0025} — each link classified as `supersedes / extends / instance-of / context-only`; **context-only** links are downgraded to one-way references that `adr-lint` does NOT enforce (the full 9-link set is enforced only if each is genuinely load-bearing),
   - **And** `adr-lint` passes GREEN.

3. **English OQ-9 gate scaffold specified (scaffold, NOT live gate) — Task 2:**
   - **Given** the amended ADR-0025 (protocol spine) + ADR-0026 (English instance),
   - **When** the English gate is specified,
   - **Then** the specification records the English strata {Journalism/News, Legal/Official, Conversational/Social} with the **stratum-disambiguation rule** (assign to the stratum that determines the document's *serving context*) and an explicit **justification or de-scoping of "Conversational/Social English"** (Mary F2: PH social-media defamation is Filipino/Taglish-dominant — the social-English stratum is thinly motivated and is *pressure-tested by the per-stratum floor*: if n≈59 real defamatory English social items cannot be populated, the stratum is exiled from the gate, not carved-out),
   - **And** the gate is **AND-joined, non-rescuing**: passes iff *(every stratum floor passes) AND (aggregate head passes)* — the aggregate may **veto** but can **never rescue** a failing stratum (defamation harm does not average across strata),
   - **And** the metric+judge provenance, the Phase-1/Phase-2 threshold schedule, and the sidedness (one-sided — testing against a lower bound) are all recorded,
   - **And** the AC explicitly states this is a **scaffold against an empty corpus** — the gate is *inert* (no quality claim) until Story 2.6c-measure populates the corpus; the runtime `INCONCLUSIVE`/`n_min` guard (Open Item O-3) is the mechanism that makes "inert" literally true and is filed as a blocking sibling,
   - **And** the English stratum is scored/reported separately from Filipino; blended means are forbidden.

4. **Fallback Enforced (DR-4) — Task 6:**
   - **Given** the English quality gate,
   - **When** the gate is not met (or the corpus is unannotated — the current state),
   - **Then** the system falls back to a documented English coverage gap: English sources ingested/searchable but claims not extracted, and the UI/demo explicitly discloses the limitation,
   - **And** English DR-4 assertions are added to `packages/render/src/gate-dr4-fallback.mutation.test.ts`, scoped to **English-unique fallback cases** (e.g., distinct disclaimer copy / jurisdictional framing) OR — if DR-4 render logic is language-invariant — explicitly labeled as a **regression-anchor for English inputs** (not a parallel ceremony block), with the mutation vectors enumerated (corrupted-manifest hash mismatch, schema-version mismatch, empty-files-list).

5. **Two-tier CI — verification (no-op reworded) — Task 5:**
   - **Given** the two-tier CI wired in Story 2.6b-code (`eval:smoke` per-PR non-gating + `eval:full` deploy-blocking) and the eval vitest config that auto-discovers `src/**/*.spec.ts`,
   - **When** `english-oq9.spec.ts` lands,
   - **Then** it is **automatically discovered** by both tiers with **zero** `turbo.json`/workflow/package.json edits,
   - **And** verification asserts: `pnpm eval:smoke` reports the English spec's N tests discovered (N pinned in AC #6); no CI wiring edit is made (Task 5 is a *verification* step, not implementation — `eval:smoke`/`eval:full` already wired).

6. **English test file + reshaped manifest (decision-function unit test, NOT a quality-gate test) — Tasks 3, 4:**
   - **Given** the English gate scaffold + the shared-harness `validateCorpusManifest()` (Open Item O-2, blocking dep),
   - **When** testing the gate machinery,
   - **Then** `eval/corpus/golden/v0/manifest.json` is reshaped to the `CorpusManifest` shape `freeze.ts` produces (`{schemaVersion: "1.0.0", corpusHash: "sha256:e3b0c44298fc1c149afbf4c8996fb92427ae41e4649b934ca495991b7852b855", files: []}` — the empty-input sentinel is **correct**: `freeze.ts` computes `corpusHash = sha256(merged)` over the sorted concatenation of `${path}\0${sha256}\n` entries (path + per-file-hash metadata — ADR-0025 §2), so for `files: []` this is SHA-256 of empty input),
   - **And** `packages/eval/src/__tests__/english-oq9.spec.ts` exists and asserts: (a) file path + module location (`oq9.ts`, NOT `bridge.ts`); (b) the manifest passes `validateCorpusManifest()` (the **regression guard** for the pre-existing shape defect — this is the load-bearing assertion, since the defect was caught by eyeball, not by test); (c) gate decision-logic on **synthetic fixtures only** — RED on low-pass, **INCONCLUSIVE on `n < n_min`** (the acceptance anchor that carries real weight and survives the unreachable-threshold finding), GREEN only on an *engineered* high-pass large-n fixture labeled "unrealistic per F1"; (d) the manifest's `files.length === 0`,
   - **And** the test file is named/scoped as a **decision-function unit test + harness-shape test**, NOT a product-quality acceptance test (no green-path on a realistic corpus at n=30/stratum is possible — F1),
   - **And** the test count N is **pinned** in the spec header (Filipino reference = 8; English N stated, not left to drift).

## Tasks / Subtasks

- [x] **Task 1a: Amend ADR-0025 (portfolio-wide fix — math + protocol spine + eligibility)** (AC #1)
  - [x] Restructure into (i) language-agnostic protocol spine + (ii) Filipino reference instance.
  - [x] Record the recalibrated pass rule (Phase-1/Phase-2, per-stratum floor, AND-join, tolerance schedule, one-sided).
  - [x] Correct annotator eligibility: drop L1-native; PH-domiciled C1+ libel-trained blind.
  - [x] Record metric + judge provenance (model, prompt, calibration floor).
  - [x] Verify `adr-lint` GREEN. *(adr-lint 107/107 GREEN — ADR-0025 amendment + ADR-0026 + 4 bidirectional back-links in ADR-001/011/014/025; the ADR-025↔ADR-026 link is symmetric)*

- [x] **Task 1b: Author ADR-0026 (thin English instance record)** (AC #2)
  - [x] Inherit protocol spine by reference; carry ONLY English strata/annotator/disambiguation + rationale.
  - [x] Classify each of the 9 candidate links (load-bearing vs context-only); downgrade context-only.
  - [x] Promote to `Accepted` on spec-completeness.
  - [x] Reconcile `project-context.md` references.
  - [x] Verify `adr-lint` GREEN. *(adr-lint 107/107 GREEN — ADR-0026 evidence paths all resolve: docs/adr/0025, 0011, 0014, 0001, packages/eval/src/{oq9,freeze,manifest}.ts, __tests__/english-oq9.spec.ts, eval/corpus/golden/v0/manifest.json, gate-dr4-fallback.mutation.test.ts, docs/ci/eval-tiers.md, architecture.md, epics.md)*

- [x] **Task 2: Specify English gate (scaffold, not live gate)** (AC #3)
  - [x] Codify English strata + disambiguation rule; justify or de-scope Conversational/Social English (pressure-tested by the per-stratum floor).
  - [x] Record the AND-joined non-rescuing structure + Phase-1/Phase-2 thresholds + sidedness + judge provenance.
  - [x] Record the empty-corpus/inert-state honesty clause + pointer to Open Item O-3 (INCONCLUSIVE guard sibling).
  - [x] Pin each protocol deliverable to a named ADR-0026 §section (no "vibes" prose).

- [x] **Task 3: Reshape English v0 manifest + regression guard** (AC #6) — **Open Item O-2 pulled in-scope per user decision**
  - [x] Reshape `eval/corpus/golden/v0/manifest.json` to `CorpusManifest` (sentinel `sha256:e3b0c44…`).
  - [x] Grep `rg "\.entries" packages/ apps/` for stale consumers of the old `{version, entries}` shape. *(none — `Object.entries` hits are unrelated JS API; the old shape had no typed consumers)*
  - [x] Implement shared-harness `validateCorpusManifest()` in `packages/eval/src/manifest.ts` (Open Item O-2) + assert the manifest passes it. *(validator: typed type-guard, no zod dep, `manifest:invalid_shape` AppError, smoke-tested against EN + FIL manifests + old-shape rejection)*

- [x] **Task 4: Pin `english-oq9.spec.ts` (decision-function unit test)** (AC #6)
  - [x] Create the spec; pin test count N=9 in the header (Filipino reference = 8; English N=9 stated, not left to drift).
  - [x] Implement: module-location (EN-1/EN-2), manifest-shape-via-validator regression guard (EN-3/EN-4/EN-5 — the load-bearing assertion + the old-shape rejection), gate decision-logic on synthetic fixtures (EN-6 INCONCLUSIVE-on-small-n acceptance anchor / EN-7 RED on red-line / EN-8 AND-joined non-rescuing / EN-9 engineered-GREEN labeled unrealistic).
  - [x] Do NOT write any realistic-corpus GREEN assertion (F1-impossible). *(the only GREEN fixture is EN-9, explicitly labeled "UNREALISTIC per F1" — n=500/stratum engineered)*

- [x] **Task 5: Two-tier CI verification (no-op reworded per AC #5)** (AC #5)
  - [x] Verify `english-oq9.spec.ts` is auto-discovered by `eval:smoke` + `eval:full`; assert N=9 tests reported; **no** per-language CI wiring edit. *(finding: the 2.6b-code `eval:smoke`/`eval:full` scripts were hardcoded to `filipino-oq9.spec.ts`, which silently dropped every other language spec — AC #5's "auto-discovered with zero edits" premise was FALSE as-shipped. Corrected the scripts to glob `src/__tests__` so the claim is literally true going forward. Verified: `pnpm eval:smoke` now reports Filipino 8 + English 9 = 17 tests discovered, zero per-language wiring.)*

- [x] **Task 6: DR-4 English fallback assertions** (AC #4)
  - [x] Scope to English-unique cases OR label as regression-anchor for English inputs; enumerate mutation vectors. *(labeled as regression-anchor for English inputs — DR-4 render logic is language-invariant per SC-3; EN-DR-1 English structured-silence + EN-DR-2 jurisdictional-framing English allegation stripped. Manifest-mutation vectors (corrupted-manifest hash mismatch / schema-version mismatch / empty-files-list) ENUMERATED as a documentation contract in the render companion + TESTED in @iip/eval/english-oq9.spec.ts — boundary-respecting split: @iip/render cannot import @iip/eval per SC-3/STR-4.)*

### Review Findings

_Code review (3-layer adversarial: Blind Hunter + Edge Case Hunter + Acceptance Auditor), 2026-07-03; 2 decision-needed resolved by 5-agent panel consensus (Winston/Murat/Mary/Amelia/John, Round 1, 2026-07-03). Final: 9 patch (incl. 2 resolved decisions), 2 defer, 6 dismissed._

**Decision-needed (RESOLVED by panel consensus → patch):**

- [x] [Review][Decision→Patch] **D1 — Tolerance-schedule numbers are calibrated to ~0.95, not the Phase-1 0.90 floor they're presented under** (Blind H1 + Edge H3). ADR-0025 §4 table records `n≈59 @ 0 errors, ~115 @ 1 error` as the Phase-1 (LCB floor ≥0.90) schedule. Exact one-sided CP 95% LCB (verified): 0 errors → n=59 gives **0.939**, n=36 gives 0.902; 1 error → 0.90 floor needs n≥54, 0.95 floor needs n≥110. So the table matches the ~0.95 (Phase-2) target via rule-of-three, NOT the Phase-1 0.90 floor. The Dev Notes claim "at operative n≈59 CP/Wilson/Jeffreys agree to ~0.002" conflates interval-family convergence with clearing a floor (n=59 doesn't clear 0.95 either). **Panel consensus (4/5 first-choice, unanimous block on defer):** restructure as a **Phase-1 + Phase-2 side-by-side table**, every cell recomputed by exact one-sided CP, rule-of-three exiled to a footnote, with Mary's invariant wording "n is the smallest integer satisfying the stated floor at the stated error count." Corrected values: Phase-1 (0.90) → n≈36 @ 0 errors (0.9026), n≈54 @ 1 error (0.9011); Phase-2 (0.95) → n≈72 @ 0 errors (0.9501), n≈110 @ 1 error (0.9504). → folded into Patch P8.
- [x] [Review][Decision→Patch] **D2 — Recalibrated pass rule is recorded as binding in ADR-0025 §4 (`OQ9_PASS` formula) but `oq9.ts` still enforces the old `TAU_STRATUM_LCB = 0.95` rule** (Edge C1 + Blind M4 + Auditor F1). The 0.90 floor, the point-estimate ≥0.95 conjunct, and the AND-joined aggregate-head conjunct exist only in the ADR; the deploy-blocking gate code is unchanged. Open Item O-3 is filed for the "INCONCLUSIVE/n_min guard," but its scope name understates what's missing. **Panel consensus (unanimous: (a)+(b) as one motion; unanimous block on accept-drift):** (a) **widen O-3** to an enumerated four-part scope [(i) 0.95→0.90 LCB floor, (ii) point-estimate ≥0.95 conjunct, (iii) AND-joined non-rescuing aggregate-head, (iv) n_min/INCONCLUSIVE guard] AND (b) **banner on `OQ9_PASS`** worded honestly: *"Phase-1 rule documented; code catch-up (4 pieces) tracked under O-3; lands before broad public launch."* Panel-sharpened rationale (Murat): old/new rules are **non-monotone** — old stricter on LCB axis, new stricter on point-estimate/aggregate; the AND-vs-OR aggregate gap is the swing risk (aggregate-rescue). Banner MUST follow O-3 widening (banner→incomplete-O-3 is itself dishonest). Coupling rule (Amelia): D1 + D2 land as one honest-handoff edit — Phase-1 numbers without the code-gap label would be a new lie. → folded into Patch P9.

**Patch:**

- [x] [Review][Patch] **P1 — EN-8 test comment is factually false + test is mislabeled** (Blind M2 + Edge H1 + Auditor F2) [`packages/eval/src/__tests__/english-oq9.spec.ts` EN-8]. Comment claims "even though the aggregate head would pass" — but the fixture aggregates to 320/360 ≈ 0.889 (LCB ≈ 0.855), so the aggregate FAILS too; AND `evaluateOQ9Grouped` has no aggregate-head conjunct at all (per-stratum loop only). The test proves only that a failing stratum trips the per-stratum floor (≡ OQ-3), not the AND-join/non-rescue property. Fix: correct the comment and relabel EN-8 to honestly describe what it tests (per-stratum floor veto), noting the aggregate-head conjunct lands with O-3 — OR defer EN-8 until O-3 adds the conjunct.
- [x] [Review][Patch] **P2 — ADR-0026 §8 link-table self-contradiction for ADR-0001** (Blind M6 + Edge M4 + Auditor F5) [`docs/adr/0026-english-eval-set-spec.md` §8]. The ADR-0001 row labels the relationship `context-only` but the Load-bearing column marks it `YES (bidirectional)`, and ADR-0001 IS in `related` + back-links ADR-026. AC #2 says context-only links are downgraded to one-way refs `adr-lint` does NOT enforce. Fix: reconcile — either ADR-0001 is load-bearing (fix the `context-only` relationship label) or context-only (remove from `related` + drop the back-link).
- [x] [Review][Patch] **P3 — Dead ternary branch in `describeShapeFailure`** (Blind L1 + Edge L1) [`packages/eval/src/manifest.ts`]. Inside `if (!Array.isArray(v['files']))`, `Array.isArray(v['files']) ? 'array' : typeof v['files']` — the true arm is unreachable; `got` is always `typeof`. Fix: simplify to `typeof v['files']`.
- [x] [Review][Patch] **P4 — EN-5 error matcher too loose** (Blind L2) [`english-oq9.spec.ts` EN-5]. `/manifest:invalid_shape|CorpusManifest/` also matches success-path text containing "CorpusManifest". Fix: tighten to `/manifest:invalid_shape/` to pin the error code.
- [x] [Review][Patch] **P5 — `manifest.ts` JSDoc "does NOT use `as`" is literally false** (Blind L3) [`packages/eval/src/manifest.ts` header]. The file uses `value as Record<string, unknown>` (safe, post-`typeof` guard). Fix: reword to "does not use unchecked `as` to the target type."
- [x] [Review][Patch] **P6 — Story doc corpusHash wording imprecise** (Blind M5) [`2-6c-...md` L98]. "sha256(merged) over sorted file contents" — `freeze.ts` actually hashes sorted `${path}\0${sha256}\n` entries (path + per-file-hash metadata), matching ADR-0025 §2. They coincide only for the empty corpus. Fix: align the story-doc wording with ADR-0025 §2 / `freeze.ts`. (Sentinel `e3b0c44…` itself is correct.)
- [x] [Review][Patch] **P7 — `eval:smoke`/`eval:full` glob scope is the directory, not `*.spec.ts`; `IIP_EVAL_FULL` is a no-op env var** (Edge M3) [`packages/eval/package.json`]. `vitest run src/__tests__` picks up any future `.test.ts` under `__tests__` (not just `*-oq9.spec.ts`), and `IIP_EVAL_FULL=1` is read by nothing (grep confirms — tiering lives only in Turbo/CI wiring). Fix: tighten positional to `src/__tests__/**/*.spec.ts` (or document the directory-scope choice), and either wire or remove `IIP_EVAL_FULL`.
- [x] [Review][Patch] **P8 — Restructure ADR-0025 §4 tolerance schedule into Phase-1 + Phase-2 side-by-side table with exact CP values** (panel consensus on D1). Replace the single mislabeled row (`n≈59 @ 0 errors, ~115 @ 1 error`) with a two-column table: Phase-1 (0.90 floor) → n≈36 @ 0 errors (0.9026), n≈54 @ 1 error (0.9011); Phase-2 (0.95 floor) → n≈72 @ 0 errors (0.9501), n≈110 @ 1 error (0.9504). Add Mary's invariant wording "n is the smallest integer satisfying the stated floor at the stated error count." Strike the Dev Notes "CP/Wilson/Jeffreys agree to ~0.002 at n≈59" convergence claim from the binding schedule (exile to a methods footnote if retained — it conflates interval-family convergence with floor clearance).
- [x] [Review][Patch] **P9 — Widen Open Item O-3 to enumerated four-part scope + add honest "code catch-up" banner on ADR-0025 §4 `OQ9_PASS`** (panel consensus on D2). (a) Rewrite O-3 from "INCONCLUSIVE/n_min guard" to a four-item checklist: (i) 0.95→0.90 LCB floor, (ii) point-estimate ≥0.95 conjunct, (iii) AND-joined non-rescuing aggregate-head, (iv) n_min/INCONCLUSIVE guard. (b) Add banner directly at `OQ9_PASS` formula: *"Phase-1 rule documented; code catch-up (4 pieces) tracked under O-3; lands before broad public launch."* **Coupling:** P8 + P9 must land together — corrected Phase-1 numbers without the code-gap banner would be a new lie (Amelia). Zero `oq9.ts` behavior change (scope-gate holds).

**Defer:**

- [x] [Review][Defer] **W1 — `validateCorpusManifest()` is consumed only by the English spec; Filipino spec + Python side bypass it** [deferred, pre-existing — `packages/eval/src/manifest.ts`] — the "shared-harness, every-language-instance" framing is aspirational; `filipino-oq9.spec.ts` hand-rolls its own `JSON.parse` + shape checks. Wiring Filipino (and `tools/eval`) in is sibling work outside this slice's scope.
- [x] [Review][Defer] **W2 — EN-DR-1 assumes `essence_sentence` derives from `answer_text`** [deferred, pre-existing — `packages/render/src/gate-dr4-fallback.mutation.test.ts` EN-DR-1] — the `expect(out.essence_sentence).toContain('coverage gap')` assertion is only robust if `renderGateLive` derives `essence_sentence` from `answer_text`; needs `gate.ts` verification (outside the diff). Pre-existing render behavior.

## Dev Notes

### Recalibrated Pass Rule (panel consensus — recorded verbatim in the ADR-0025 amendment)

The original `CP 95% LCB ≥ 0.95 @ n≥30/stratum` is **unreachable** and is replaced by a structure agreed across Murat (Test Architect), Mary (Analyst), and John (PM):

- **Interval:** Clopper–Pearson, **unchanged** (reuse the audited decimal.js machinery in `oq9.ts`). **No new interval family** (Murat/Mary: at operative n≈59, CP/Wilson/Jeffreys agree to ~0.002; a second family = transcription + mutation risk in a deploy-blocking defamation gate, for zero marginal benefit).
- **Per-stratum floor (PRIMARY):** every stratum must independently clear the CP 95% LCB floor, **uniform across strata** (no carve-outs), with a published **error-count→required-n tolerance schedule** so the floor is a band, not a knife-edge. Per the code-review patch (P8, exact one-sided CP): Phase-1 (0.90 floor) → n=36 @ 0 errors, n=54 @ 1 error; Phase-2 (0.95 floor) → n=72 @ 0 errors, n=110 @ 1 error. The schedule *is* the graceful degradation within each phase.
- **Aggregate head (AND-joined, non-rescuing):** the gate passes iff *(every stratum floor passes) AND (aggregate head passes)*. The aggregate may **veto** but can **never rescue** a failing stratum (defamation harm does not average across strata). At defused n≈200–300 one-sided the head tolerates 1–2 errors — not the single-error cliff at n=100.
- **Phase-1 / Phase-2 (John, PM-owned):**
  - **Phase 1 (now):** hard point-estimate ≥0.95 pass + LCB floor **≥0.90** (not the unreachable 0.95) + INCONCLUSIVE escalation → *targeted* raise-n (annotate the stratum that trips, not all of them). Reachable. Stringent. The one tolerated error at n=30 is not given a free pass — the LCB floor keeps small-sample pessimism.
  - **Phase 2 (before broad public launch):** raise n toward LCB≥0.95-reachable; re-tighten the floor toward 0.95. Point-estimate stays ≥0.95 throughout. Date + migration commitment written into the ADR in daylight.
- **Sidedness:** **one-sided** (testing against a lower bound, not two-sided equivalence). This must be explicit — the original ADR left it unspecified, and two compliant implementations could disagree.
- **Why not pure-reframe / pure-raise-n (John):** pure-reframe (demote LCB to transparency-only) loses the only voice saying "we haven't measured enough" at exactly the n where the one tolerated error *is* the defamatory hallucination; pure-raise-n buys statistical form at 3–5× annotation cost past diminishing harm-prevention returns. The Phase-1/Phase-2 path spends the next annotation peso on finding real libel, not padding an interval.

### Anti-patterns to prevent

- **Do NOT** mix English and Filipino metrics into a single mean. Score and report separately.
- **Do NOT** write a realistic-corpus GREEN assertion in `english-oq9.spec.ts` — F1-impossible at spec'd n.
- **Do NOT** introduce a second interval family (Jeffreys) — reuse the audited CP.
- **Do NOT** add the `INCONCLUSIVE`/`n_min` runtime guard inside this story — `oq9.ts` is shipped deploy-blocking logic (file as Open Item O-3).
- **Do NOT** write a full peer ADR-0026 — it inherits the amended 0025 protocol spine by reference and carries only the English instance decisions.

### Golden Corpus Path

`eval/corpus/golden/v0/` (default/English path) is root-anchored (ADR-0011 Amendment 2). Filipino parallel chain at `eval/corpus/golden/filipino/v0/`.

### Spec-completeness vs. Measurement

This story addresses **design-gate spec-completeness**. The actual annotation + κ measurement of English data is deferred to Story 2.6c-measure (blocked on PH-domiciled annotator procurement).

## Open Items / Blocking Dependencies

- **O-1 — ADR-0025 amendment (Task 1a, in-scope).** Portfolio-wide threshold recalibration + protocol-spine restructure + annotator-eligibility correction. Lands *within* this story (2.6c is the active story; the amended 0025 is the prerequisite for 0026; "fix once where it lives"). Also retroactively fixes the Filipino gate (2.6b-code inherited the same defect).
- **O-2 — Shared-harness `validateCorpusManifest()` (BLOCKING sibling).** A schema validator for on-disk manifests in `packages/eval`, defined once (both gates + future languages consume it). The English manifest has been sitting in the *wrong shape* (`{version, entries}` vs `CorpusManifest`) since before 2.6b-code; the Filipino one was corrected in 2.6b review, English was not. The defect survived because **nothing asserts the manifest conforms to the schema** — caught by eyeball, not by test. **2.6c is blocked on this landing** (Winston: "file it against the harness; make 2.6c carry a blocking dependency"). 2.6c Task 3 + AC #6 reference it; the spec asserts "manifest must pass harness validation" without redefining the schema.
- **O-3 — `oq9.ts` code catch-up for the recalibrated `OQ9_PASS` rule (sibling, out-of-scope — widened by code-review patch P9, 2026-07-03).** The shipped deploy-blocking gate (`packages/eval/src/oq9.ts`) still enforces the legacy single-conjunct `CP_LCB_95 ≥ TAU_STRATUM_LCB (0.95)` rule; it does NOT yet enforce four pieces of the recalibrated `OQ9_PASS` formula (ADR-0025 §4). The catch-up is an enumerated **four-part** scope: **(i)** LCB floor 0.95→0.90, **(ii)** point-estimate ≥ 0.95 conjunct, **(iii)** AND-joined non-rescuing aggregate-head, **(iv)** n_min/INCONCLUSIVE guard. **Old/new rules are non-monotone** (Murat): old stricter on LCB axis, new stricter on point-estimate + aggregate; the AND-vs-OR aggregate gap is the swing risk (aggregate-rescue). Architecturally right (Murat) but `oq9.ts` is shipped deploy-blocking logic — a behavior change is production logic wearing a scaffold costume and splits to its own story with regression coverage (Amelia scope-gate). 2.6c references it via the `OQ9_PASS` code-catch-up banner in ADR-0025 §4 + the empty-corpus AC prose (interim control). **Lands before broad public launch** (John PM commitment).
- **O-4 (RESOLVED — audience & serving language, John PM round 4).** *Source corpus* is English-dominant; Tagalog/Taglish phrases occur but are typically followed by in-document English glosses, so the English extraction gate (2.6c) effectively captures the *meaning* of glossed non-English content — corpus coverage is stronger than an English-only surface read implies. **Caveat / failure mode to track:** assumes extraction ingests the English gloss and that the gloss is faithful (not a softened paraphrase of a defamation-grade claim). *Serving/query language* is trilingual-aspirational (English + Tagalog + Taglish, "if possible") — confirms a future Taglish serving-layer quality gate is real work, not hypothetical. *Primary audience* not formally documented; infer PH legal/journalism with international reach — re-confirm only if precision targets ever need to split. **2.6c NOT blocked:** defamation risk on an English-dominant corpus holds under any audience/serving scenario. **Prioritization:** Taglish serving-gate is a **Phase-2 successor**, sequenced *after* 2.6c (English source-corpus) and 2.6b (Filipino salience) — build the English serving path first, layer Taglish once the product has traction.

## Review Trail (party-mode adversarial review, 2026-07-03)

5 agents, 3 rounds.

- **Round 1 (independent reads):** all four (Winston, Murat, Mary, Amelia) unanimously found the story **NOT ready-for-dev as written** but close; do not split further. Mary's Finding 1 (the unreachable-threshold math) was the sharpest discovery.
- **Round 2 (cross-talk):** converged on ADR shape (amend 0025 + thin instance-bearing 0026 — Winston's split-the-difference, Mary's condition met since 0025 is amendable), annotator eligibility (drop L1-native), manifest regression guard (shared harness), Task 5 no-op, empty-corpus honesty. Murat/Mary began the math-fix dispute.
- **Round 3 (PM + math convergence):** John made the reframe-vs-raise-n call (Phase-1/Phase-2 third path) + the audience-segment ruling (not blocked; premise corrected; PM-owned item). Murat/Mary **converged on the math fix**: CP reused (no new interval), per-stratum floor uniform + tolerance schedule, aggregate AND-joined non-rescuing. Residual knob (fail-closed vs pure-report aggregate) resolved as AND-joined = veto-capable = Murat's fail-closed.

**Ground truth verified by the orchestrator during review:** `oq9.ts` is shipped (87/87 GREEN, deploy-blocking); the unreachable threshold is portfolio-wide (0025 §4 + `oq9.ts` both carry `TAU_STRATUM_LCB=0.95` @ n≥30/stratum); `freeze.ts` computes `corpusHash = sha256(merged)` over the sorted concatenation of `${path}\0${sha256}\n` entries (so for the empty corpus this is SHA-256 of empty input — the `e3b0c44…` sentinel is correct); `adr-lint` enforces reciprocal links (2.6b review caught an ADR-0011↔0025 back-link format mismatch); ADR-0025 is amendable (just promoted 2026-07-03); the English manifest is in the wrong shape today.

### References

- [Story 2.6b-code (Filipino eval gate scaffolding spec)](file:///Users/sherwingorechomante/impeach/_bmad-output/implementation-artifacts/2-6b-code-filipino-eval-gate-scaffolding.md)
- [Story 2.6 Review Report (consensus on VAL-10 language premise)](file:///Users/sherwingorechomante/impeach/_bmad-output/implementation-artifacts/story-2-6-review-report.md)
- [ADR-0011: Golden Corpus Versioning](file:///Users/sherwingorechomante/impeach/docs/adr/0011-golden-corpus-versioning.md)
- [ADR-0025: Filipino Salience Eval-Set Spec (to be amended — Task 1a)](file:///Users/sherwingorechomante/impeach/docs/adr/0025-filipino-eval-set-spec.md)
- [Architecture: VAL-10 (language premise amendment)](file:///Users/sherwingorechomante/impeach/_bmad-output/planning-artifacts/architecture.md)

## Dev Agent Record

### Agent Model Used

`builtin:zai-coding-plan/GLM-5.2` (ZCode dev-story workflow, Story 2.6c, 2026-07-03).

### Completion Notes List

- Story 2.6c proposed 2026-07-03 from the Story 2.6 party-mode adversarial review (finding F1) + VAL-10.
- Story 2.6c **re-scoped 2026-07-03** by a 3-round party-mode adversarial review (5 agents: Winston, Murat, Mary, Amelia, John). Consensus changes: (1) premise corrected to "*source-corpus* path" (John); (2) ADR-0025 amended in-scope for portfolio-wide threshold recalibration + protocol-spine restructure + annotator-eligibility correction (Mary F1 + F3); ADR-0026 downgraded to thin instance record inheriting 0025 by reference (Winston split-the-difference); (3) recalibrated pass rule — CP reused, per-stratum floor uniform + tolerance schedule, aggregate AND-joined non-rescuing, Phase-1/Phase-2 (Murat/Mary/John); (4) Conversational/Social-English stratum pressure-tested by the floor (Mary F2); (5) L1-native annotator requirement dropped → PH-domiciled C1+ libel-trained (Mary F3); (6) Task 5 reworded to verification (Murat/Amelia); (7) `english-oq9.spec.ts` scoped as decision-function unit test, synthetic fixtures only (Amelia); (8) shared-harness `validateCorpusManifest()` filed as blocking sibling O-2 (Winston/Amelia/Murat); (9) INCONCLUSIVE runtime guard filed as sibling O-3, out-of-scope (Amelia scope-gate); (10) audience-segment doc filed as PM-owned O-4, not a gate (John).

## QA Results

*(Story implementation complete — ready for code review. See File List + Change Log for the full artifact set. Recommended: run `code-review` with a different LLM than the implementer.)*

## File List

**New files:**
- `docs/adr/0026-english-eval-set-spec.md` — thin English instance record (AC #2, inherits ADR-0025 Part I by reference).
- `packages/eval/src/manifest.ts` — shared-harness `validateCorpusManifest()` (Open Item O-2, AC #6 regression guard).
- `packages/eval/src/__tests__/english-oq9.spec.ts` — English decision-function unit test (AC #6, N=9 tests pinned).

**Modified files:**
- `docs/adr/0025-filipino-eval-set-spec.md` — restructured into Part I (protocol spine) + Part II (Filipino reference instance); recalibrated pass rule (§4); annotator-eligibility correction (§3); metric+judge provenance (§9); evidence array + related array updated (AC #1).
- `docs/adr/0001-defamation-grade-operational-definition.md` — added ADR-026 back-link (load-bearing bidirectional).
- `docs/adr/0011-golden-corpus-versioning.md` — added ADR-026 back-link (load-bearing bidirectional).
- `docs/adr/0014-polyglot-eval-invocation-subprocess.md` — added ADR-026 back-link (load-bearing bidirectional).
- `tests/lint/adr-lint.test.ts` — ADR count 25→26 + JSDoc header (AC #1).
- `eval/corpus/golden/v0/manifest.json` — reshaped from `{version, entries}` to `CorpusManifest` (`{schemaVersion, corpusHash, files}`, empty-input sentinel) (AC #6).
- `packages/eval/src/index.ts` — exported `validateCorpusManifest` + `ValidatedManifest`.
- `packages/eval/package.json` — `eval:smoke`/`eval:full` scripts corrected from hardcoded Filipino path to glob `src/__tests__` (AC #5 auto-discovery fix).
- `packages/render/src/gate-dr4-fallback.mutation.test.ts` — added English DR-4 regression-anchor (EN-DR-1/EN-DR-2) + manifest-mutation vectors documentation contract (AC #4).
- `docs/ci/eval-tiers.md` — documented the glob fix + English spec auto-discovery.
- `_bmad-output/project-context.md` — reconciled ADR-0025 amendment + ADR-0026 references.

## Change Log

- 2026-07-03: Story 2.6c re-scoped by party-mode adversarial review (5 agents, 3 rounds) — premise corrected, ADR-0025 amendment + ADR-0026 thin instance + recalibrated pass rule + eligibility correction scoped.
- 2026-07-03: Story 2.6c implemented (dev-story workflow, GLM-5.2). All 6 tasks done, all 6 ACs satisfied. ADR-0025 amended (protocol spine + Filipino reference instance + recalibrated pass rule + eligibility + provenance); ADR-0026 authored (thin English instance, Accepted on spec-completeness); `validateCorpusManifest()` implemented (Open Item O-2 pulled in-scope per user decision); English v0 manifest reshaped; `english-oq9.spec.ts` pinned (N=9 decision-function unit test, INCONCLUSIVE-on-small-n acceptance anchor); `eval:smoke`/`eval:full` scripts globbed (AC #5 'zero edits' premise was false as-shipped — corrected); DR-4 English regression-anchor + manifest vectors added (boundary-respecting: render companion documents, eval tests the logic). adr-lint 107/107, eval 96/96, render 96/96, full turbo 23/23, contract+lint+smoke 218 passed / 5 skipped, typecheck + lint clean. G-3 design gate CLOSED (both English + Filipino gates specified). κ ≥ 0.75 measurement deferred to Story 2.6c-measure (procurement-blocked).
