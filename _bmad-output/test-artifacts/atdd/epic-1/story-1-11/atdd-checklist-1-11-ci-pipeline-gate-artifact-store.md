---
stepsCompleted: ['step-01-preflight-and-context','step-02-generation-mode','step-03-test-strategy','step-04-generate-tests']
lastStep: 'step-04-generate-tests'
lastSaved: '2026-06-26'
workflowType: 'testarch-atdd'
storyId: '1.11'
storyKey: '1-11-ci-pipeline-gate-artifact-store'
generatedTestFiles:
  - 'tests/ci/ci-pipeline.test.ts'
adversarial_review_date: '2026-06-26'
adversarial_review_tests_rewritten: true
---

# ATDD Checklist — Epic 1, Story 1.11: CI Pipeline & Gate Artifact Store (AR-20/22)

**Date:** 2026-06-22 · **Updated:** 2026-06-26 (adversarial review) · **Primary Test Level:** integration (workflow YAML + tooling) · **Severity:** T2

## Acceptance Criteria
1. `.github/workflows/ci.yml` runs build/test/lint/typecheck/eval/adr-lint as parallel jobs (AC-F1-07)
2. Branch protection documented in `docs/ci/branch-protection.md` (GitHub does not store protection as a repo file)
3. Self-hosted runner provisioned separately from corpus workstation (SEC-4, `infra/runner/provision.pkr.hcl`)
4. `eval/gates/<runId>/` content-addressed structure with README, where `runId = sha256(corpusHash|commit|modelDigest|harnessSha)` (SC-7)
5. `iip-eval freeze <corpus-dir>` emits SHA-256 `eval/corpus/<hash>/manifest.json` (AC-F1-10)
6. `iip-eval reproduce <run-id>` emits `eval/gates/<runId>/decision.json` with pass/fail + per-metric (AC-F1-10)
7. `iip-config validate --strict` exits non-zero on invalid config (D7, NFR-S-4)
8. `.sops.yaml` with age backend at repo root (D7)
9. CI uses `permissions: id-token: write` for OIDC ephemeral tokens (SEC-4)
10. Chaos job exists as deferred placeholder (activated in Epic 2 Story 2.9)

## Red-Phase Scaffolds
**File:** `tests/ci/ci-pipeline.test.ts` (14 tests)

- ⏭️ ci.yml parallel job coverage (build/test/lint/typecheck/eval/adr-lint) — RED
- ⏭️ chaos job deferred placeholder — RED
- ⏭️ branch protection documented in docs/ci/branch-protection.md — RED
- ⏭️ runner isolated from corpus (SEC-4, no /corpus mount) — RED
- ⏭️ eval/gates content-addressed with README — RED (SC-7)
- ⏭️ corpus freeze manifest (iip-eval freeze --dry-run) — RED (AC-F1-10)
- ⏭️ corpus freeze --corpus-dir flag — RED
- ⏭️ gate reproduce decision.json (iip-eval reproduce --dry-run) — RED (AC-F1-10)
- ⏭️ decision.json schema fields present in reproduce.ts — RED
- ⏭️ iip-eval CLI bin registered — RED
- ⏭️ iip-config CLI bin registered — RED
- ⏭️ .sops.yaml with age backend — RED (D7)
- ⏭️ iip-config validate --strict fail-closed — RED (NFR-S-4)
- ⏭️ CI permissions: id-token: write — RED (SEC-4)

## Implementation Checklist

- [ ] `.github/workflows/ci.yml`: parallel jobs for build/test/lint/typecheck/eval/adr-lint/chaos (chaos is deferred placeholder)
- [ ] `docs/ci/branch-protection.md`: `required_status_checks.strict=true`, `enforce_admins.enabled=true`, `dismiss_stale_reviews=true`
- [ ] `infra/runner/provision.pkr.hcl`: Packer template for isolated self-hosted runner (NOT corpus workstation, GPU passthrough commented out)
- [ ] `eval/corpus/golden/`: empty seed directory with `.gitkeep`
- [ ] `eval/gates/README.md`: content-addressed, append-only documentation
- [ ] `packages/eval/src/freeze.ts`: `freezeCorpus(corpusDir)` → `eval/corpus/<hash>/manifest.json`
- [ ] `packages/eval/src/freeze.test.ts`: deterministic hash, file change detection, empty corpus
- [ ] `packages/eval/src/reproduce.ts`: `reproduceRun(runId)` → `eval/gates/<hash>/decision.json`
- [ ] `packages/eval/src/reproduce.test.ts`: schema fields, pass/fail, unknown runId error
- [ ] `packages/eval/src/cli.ts`: `iip-eval freeze|reproduce` with `--dry-run`
- [ ] `packages/eval/package.json`: `"bin": { "iip-eval": "./src/cli.ts" }`
- [ ] `packages/config/src/secrets.ts`: `validateConfig()` with fail-closed on missing/malformed vars
- [ ] `packages/config/src/secrets.test.ts`: missing var, malformed var, valid config, CLI exit codes
- [ ] `packages/config/src/cli.ts`: `iip-config validate --strict`
- [ ] `packages/config/package.json`: `"bin": { "iip-config": "./src/cli.ts" }`
- [ ] `.sops.yaml`: age backend configuration at repo root
- [ ] `docs/ci/secrets.md`: age key management documentation
- [ ] `docs/ci/runner-setup.md`: Packer validation as pre-flight operator task
- [ ] CI uses `permissions: id-token: write` (OIDC), Linux runners only
- [ ] CI shards + `c8 merge` + `--detectOpenHandles`
- [ ] Activate `test.skip` → GREEN

**Estimated Effort:** 3 days

## Adversarial Review Changes (2026-06-26)

| Issue | Resolution |
|-------|-----------|
| Phantom `.github/branch-protection.json` | Replaced with `docs/ci/branch-protection.md` (GitHub stores protection via API, not files) |
| Missing `iip-eval`/`iip-config` CLI binaries | Added Task 5 (iip-eval CLI wiring) + Task 1 subtasks (iip-config CLI) |
| No task for `.sops.yaml` | Added to Task 1 subtasks |
| No task for `eval/gates/README.md` | Added to Task 4 subtasks |
| OIDC token duration regex wrong | Replaced with `permissions.id-token === 'write'` check (lifetime is IAM policy, not YAML) |
| Packer template no validation path | Added `packer validate` as documented pre-flight step; GPU passthrough deferred to Epic 4 |
| Corpus freeze no input contract | Defined `--corpus-dir` flag, defaults to `eval/corpus/golden/` |
| `iip-config` package no CLI | Added `packages/config/src/cli.ts` + bin entry |
| Secrets fail-closed test untestable | Replaced invented `IIP_SECRETS_INVALID` env var with `IIP_DATABASE_URL=''` (real required var) |
| No `eval/gates/` directory task | Added `eval/corpus/golden/` seed dir + `eval/gates/README.md` to tasks |
| `adr-lint` command underspecified | Removed `pnpm test:lint` reference; adr-lint is a CI job name, implementation from Story 1.10 |
| Chaos gate no implementation | Added Task 7: deferred placeholder (`echo "deferred" && exit 0`), activated in Epic 2 Story 2.9 |
| Missing `packages/config/package.json` mod detail | Specified: add `"bin": { "iip-config": "./src/cli.ts" }` |
| No `eval reproduce` implementation task | Split Task 3 into Task 3 (freeze) + Task 4 (reproduce + gates README) |
| Story assumes `ci.yml` exists | Changed `[MODIFY]` to `[NEW]` in impacted files |

## Notes
- **The re-run command is the bisect primitive** (SC-7). Content-addressing without `eval reproduce <run-id>` is just file naming.
- Branch protection `enforce_admins: true` is non-negotiable for SEC-6 — admins can't override hard gates.
- The triple-lock: every eval run records `(corpus_version, model_version, gate_version)` as composite key. Comparisons across mismatched keys are invalid.
- GPU passthrough in Packer template is **commented out** — deferred to Epic 4 when extraction models exist.
- Chaos gate is a **deferred placeholder** — real chaos testing (k6 + Playwright, 500 RPS) is Epic 2 Story 2.9.

**Generated by BMad TEA Agent** — 2026-06-22 · **Updated after adversarial review** — 2026-06-26
