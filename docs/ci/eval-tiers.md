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
- **Script:** `pnpm --filter @iip/eval eval:full -- --force`.

## Wiring summary (AC #5 — three named places)

The two-tier gate is wired in three named locations, per AC #5:

1. **`turbo.json`** — `eval:smoke` + `eval:full` task entries (both
   `dependsOn: ["^build"]` so workspace deps are built first).
2. **`packages/eval/package.json`** — `eval:smoke` + `eval:full` scripts
   (vitest invocations over `'src/__tests__/**/*.spec.ts'`; the smoke/full
   distinction is enforced by Turbo/CI wiring, not a package-level env var —
   see Story 2.6c update below).
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

## Story 2.6c update (2026-07-03) — auto-discovery + English spec

The `eval:smoke` and `eval:full` scripts in `packages/eval/package.json` were
**corrected from a hardcoded Filipino path to a path filter** (`vitest run
src/__tests__`). The prior hardcoded form silently dropped every other language
spec; the filter makes AC #5 of Story 2.6c's "auto-discovered with zero
per-language CI wiring" claim literally true.

**Scope note (code-review patch P7):** the positional `src/__tests__` is a
vitest path *filter* (matched as a prefix over resolved test-file paths), NOT a
shell glob — vitest does not expand glob positional args, so
`src/__tests__/**/*.spec.ts` matches nothing and the directory form is used.
The filter therefore runs every file under `__tests__` that the vitest config
`include` matches (`src/**/*.spec.ts` + `src/**/*.test.ts`). Today only the
`*-oq9.spec.ts` gate specs live there; a future `.test.ts` under `__tests__`
would also be picked up. Keep gate specs as `*.spec.ts` and put helper tests
elsewhere (or tighten the vitest `include` for the eval package) if that
distinction becomes load-bearing. Both tiers now auto-discover:

- `packages/eval/src/__tests__/filipino-oq9.spec.ts` (8 tests — Story 2.6b-code)
- `packages/eval/src/__tests__/english-oq9.spec.ts` (9 tests — Story 2.6c)

Future language instances drop a `*-oq9.spec.ts` into `__tests__/` and are
picked up with no script, turbo, or workflow edit (ADR-0025 §6 / ADR-0026
AC #5). The English measurement (κ ≥ 0.75 on real annotated English data) is
split to Story 2.6c-measure, blocked on PH-domiciled annotator procurement;
until it lands, the English spec asserts decision-logic on synthetic fixtures
only (INCONCLUSIVE on `n < n_min` is the acceptance anchor — ADR-0026 §5).

**Code-review patch (2026-07-03, P7):** the prior scripts set
`IIP_EVAL_FULL=1` on `eval:full`, but nothing in the codebase read that env
var — the smoke/full distinction lived entirely in the Turbo/CI wiring
(`eval:full` task pinned `cache:false`; `eval:full` runs only on main/release
per `.github/workflows/eval-full.yml`). The no-op env var was removed; the
`// tiering` package.json comment now documents that the tiering is
CI-enforced, not package-enforced. The `eval:full` script invocation in the
"Script" line above is updated to drop the `IIP_EVAL_FULL=1` prefix.

