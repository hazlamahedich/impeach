# Eval CI Tiers — `eval:smoke` (per-PR, non-gating) + `eval:full` (deploy-blocking)

> **Story 2.6b-code, AC #5, ADR-0025 §5.** The OQ-9 Filipino salience eval gate
> is enforced in two CI tiers. This document is the per-branch blocking policy
> referenced by the workflow files
> (`.github/workflows/eval-{smoke,full}.yml`) and by branch-protection.md.

## Why two tiers

A single eval lane is wrong at defamation grade:

- **PR-gate eval (n=20):** fast (<8 min), but at n=20 the full `OQ9_PASS` rule
  (`n≥100 ∧ every stratum≥30`) is *structurally unsatisfiable* and the
  Clopper–Pearson confidence width is ≈ ±0.22 — pure noise. Running the full
  gate per-PR would either (a) block every PR on noise, or (b) force the
  threshold down to "what passes at n=20," silently redefining the gate.
- **Release eval (n≥200):** the real gate, but too slow (~90 min) and too
  corpus-dependent (needs the full annotated Filipino set) to run per-PR.

So the gate is split. Smoke is a *fast-feedback sanity loop* (advisory,
non-gating); full is the *quality gate* (deploy-blocking, never cached for
releases). Neither tier substitutes for the other.

## `eval:smoke` — n=20, per-PR, NON-GATING

- **Trigger:** `pull_request`, `push` to `main`.
- **Asserts (the relaxed subset only):**
  - No `τ_red` (≈0.50) violation on any sampled doc.
  - No provenance-manifest SHA-256 mismatch.
  - Schema-valid output.
- **Does NOT assert:** the stratified Clopper–Pearson 0.95 lower bound, the
  Fleiss' κ ≥ 0.75 gate, the `n≥100 ∧ stratum≥30` sample-size floor. These are
  deferred to `eval:full`.
- **Blocking policy:** `continue-on-error: true` in the workflow + listed as a
  **non-required** check in branch protection. Its failure surfaces in the PR
  checks UI for visibility but does not block merge. A maintainer who makes
  smoke required is silently turning noise into a gate.
- **Location:** `.github/workflows/eval-smoke.yml`.
- **Script:** `pnpm --filter @iip/eval eval:smoke`
  (`packages/eval/package.json` `eval:smoke` → vitest on the smoke fixture).

## `eval:full` — n≥200, DEPLOY-BLOCKING on main/release

- **Trigger:** `push` to `main`, `release` `{created, published}`. NOT run on
  PR branches (too slow; needs the full annotated corpus).
- **Asserts:** the full `OQ9_PASS` rule
  (`(n≥100 ∧ every stratum≥30) ∧ (∀doc: metric≥τ_red) ∧
  (CP_LCB_95(k/n) ≥ 0.95 ∀ metric ∈ {RAGAS Faithfulness, Citation Recall,
  Citation Precision, NLI}) ∧ (human-only baseline κ reported) ∧
  (provenance manifest SHA-256 matches)`). The Fleiss' κ ≥ 0.75 gate is a
  measurement-time input from the annotation work (Story 2.6b-measure); until
  that lands, `eval:full` reports the structural conjuncts and the gate stays
  inert (advisory) per PC-3 — it cannot cite ADR-0025 as binding until the ADR
  is Accepted AND the κ measurement exists.
- **Caching policy:** `--force` + no `actions/cache` + no Turbo remote cache +
  no Vercel remote cache for releases. A cached release eval is a non-eval
  (ADR-0025 §5): the result must be reproducible-from-source.
- **Blocking policy:** required check on `main` + release tags. Failure blocks
  merge to main and blocks release publication.
- **Location:** `.github/workflows/eval-full.yml`.
- **Script:** `IIP_EVAL_FULL=1 pnpm --filter @iip/eval eval:full -- --force`.

## Wiring summary (AC #5 — three named places)

The two-tier gate is wired in three named locations, per AC #5:

1. **`turbo.json`** — `eval:smoke` + `eval:full` task entries (both
   `dependsOn: ["^build"]` so workspace deps are built first).
2. **`packages/eval/package.json`** — `eval:smoke` + `eval:full` scripts
   (vitest invocations; `eval:full` gates on `IIP_EVAL_FULL=1`).
3. **`.github/workflows/eval-{smoke,full}.yml`** — the CI jobs that invoke the
   scripts with the documented per-branch blocking policy.

## Status as of Story 2.6b-code (2026-07-03)

Both tiers are wired and the gate *machinery* (κ function, OQ-9 module,
Decimal CP-LCB) is live and unit-tested. The **measurement** (κ ≥ 0.75 on real
annotated Filipino data) is split to Story 2.6b-measure, blocked on
native-Filipino annotator procurement. Until the measurement lands,
`eval:full` reports the structural conjuncts only and the κ gate is advisory
(PC-3: ADR-0025 is binding-citable once Accepted on spec-completeness, which
Task 7 of this story achieves; the κ *measurement* gates release, not
citation).
