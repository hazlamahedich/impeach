---
story_id: '1.10'
story_key: '1-10-13-adrs-authored'
epic: 'Epic 1: Foundation'
status: review
last_updated: '2026-06-26'
baseline_commit: 737eb1e
---

# Story 1.10: 13 ADRs Authored + 9 Existing Validated

Status: done

## Story

As a developer,
I want to author 13 new ADRs, normalize 9 existing ADRs, and implement an adr-lint suite,
So that every architectural divergence from the TDD is cited with research evidence and machine-validated.

## Acceptance Criteria

1. **ADR Directory and Files Presence (SC-9 + VAL-4)**:
   - `docs/adr/` must contain the complete set of ADRs numbered from `ADR-001` through `ADR-022`.
   - The files must be named using the four-digit kebab-case pattern (e.g., `0006-ocr-technology-selection.md`).
2. **PC-3 Template Compliance (including retroactive)**:
   - ALL 22 ADRs must follow the PC-3 template and contain YAML frontmatter with the following keys:
     - `id` (must be 3-digit exactly: e.g., `ADR-001`)
     - `title`
     - `status` (Proposed, Accepted, Superseded, Deprecated)
     - `date` (YYYY-MM-DD format)
     - `supersedes` (null or ID)
     - `superseded_by` (null or ID)
     - `deciders` (array of decider names)
     - `related` (array of related IDs/tags)
     - `evidence` (array of evidence references/files)
   - Each ADR must have EXACTLY the following Markdown section headers (case-sensitive):
     - `## Context`
     - `## Decision`
     - `## Alternatives`
     - `## Consequences`
     - `## Open questions`
3. **`adr-lint` Validation Suite**:
   - Create an automated `adr-lint` check at `tests/lint/adr-lint.test.ts` that runs as part of the Vitest `lint` test suite.
   - The linter must validate:
     - Frontmatter presence and type correctness for all required keys.
     - Section header presence (exact case-sensitive match).
     - **Evidence Requirement:** For any ADR marked as `Accepted` status, the `evidence` array must be non-empty and contain real paths/URLs (not placeholders).
     - **Bidirectional Relations:** `related` array must be bidirectional between all ADRs (ADR-001 through ADR-022).
4. **"Evidence Pending" Markers**:
   - ADRs 013, 016, 017, and 018 must be in `Proposed` status and may have an `"evidence pending"` or `"evidence pending F18/F19"` marker in their `evidence` array. The linter must ONLY allow this bypass for `Proposed` ADRs.
5. **ADR Content Briefs**:
   - The 13 new ADRs must be populated with the specific decisions, alternatives, and context outlined in the Dev Notes (derived from `architecture.md`).
   - `docs/adr/0019-gpu-runner-workstation-contradiction.md` must resolve the SEC-4 vs NFR-D-1 contradiction (container-level isolation / GPU passthrough).

## Impacted Files / Directories

```
docs/adr/
  ├── [MODIFY] 0001-defamation-grade-operational-definition.md (through 0005, 0010, 0020-0022)
  ├── [NEW] 0006-ocr-technology-selection.md
  ├── [NEW] 0007-tiered-ingestion-architecture.md
  ├── [NEW] 0008-nli-entailment-gate-citation-engine.md
  ├── [NEW] 0009-monorepo-orchestrator-selection.md
  ├── [NEW] 0011-golden-corpus-versioning.md
  ├── [NEW] 0012-llm-observability-fork.md
  ├── [NEW] 0013-adversary-formalism.md
  ├── [NEW] 0014-polyglot-eval-invocation-subprocess.md
  ├── [NEW] 0015-age-raw-sql-escape-hatch.md
  ├── [NEW] 0016-query-planner-extraction.md
  ├── [NEW] 0017-supersession-orchestration.md
  ├── [NEW] 0018-partner-keyring-rotation-nonce-ttl.md
  └── [NEW] 0019-gpu-runner-workstation-contradiction.md
tests/lint/
  └── [NEW] adr-lint.test.ts
package.json
  └── [MODIFY] add gray-matter dependency
```

## Tasks / Subtasks

- [x] **Task 0: Retrofit Existing ADRs**
  - [x] Audit and normalize ADRs 001-005, 010, and 020-022 to strict PC-3 compliance.
  - [x] Fix the `supersedes_by` typo to `superseded_by` across the 5 files that have it.
  - [x] Standardize section headers to exact case-sensitive matches (`## Alternatives`, `## Open questions`).
  - [x] Canonicalize `id` format to 3-digit padding (`ADR-001`).
- [x] **Task 1: Seed Missing ADR Files (ADR-006 to ADR-009, ADR-011 to ADR-019)**
  - [x] Write the missing 13 ADR markdown files into `docs/adr/` with substantive content based on the briefs in Dev Notes.
  - [x] Set ADRs 013, 016, 017, and 018 to `Proposed` status with `"evidence pending F18/F19"` markers in their `evidence` array.
  - [x] In `docs/adr/0019-gpu-runner-workstation-contradiction.md`, resolve the SEC-4 vs NFR-D-1 contradiction (logical container VM isolation/GPU time-slicing).
- [x] **Task 2: Implement the `adr-lint` Test Suite**
  - [x] Run `pnpm add -D -w gray-matter` to install the frontmatter parser.
  - [x] Create `tests/lint/adr-lint.test.ts` within the Vitest lint project.
  - [x] Read and parse the frontmatter and headers of all files in `docs/adr/`.
  - [x] Validate exact frontmatter keys and section headers (case-sensitive).
  - [x] `Accepted` ADRs must have non-empty `evidence` containing real paths/URLs. "Evidence pending" markers are ONLY valid for `Proposed` status.
  - [x] `related[]` array links must be bidirectional between ADR-001 and ADR-022.
- [x] **Task 3: Run and Verify the Test Suite**
  - [x] Run `pnpm test:lint` or `pnpm test` to verify that `adr-lint.test.ts` passes against all 22 ADRs.

### Review Findings (2026-06-26)

- [x] [Review][Decision] AC #2 "exactly the following" section headers vs extra H2s — 5 ADRs carried extra H2 headers beyond the required 5; linter did not reject them. Consensus: "exactly" means only the 5 required H2s. Fixed by folding extras into H3 subsections and tightening the linter to reject additional H2s.
  - `docs/adr/0001-defamation-grade-operational-definition.md`: `## Related Decisions` → `### Related Decisions` under `## Consequences`
  - `docs/adr/0002-apache-age-version-pin.md`: `## RC0 Risk Acceptance and GA Upgrade Plan`, `## Implementation Notes` → H3 subsections under `## Consequences`
  - `docs/adr/0005-llm-model-tier.md`: `## Implementation Notes` → `### Implementation Notes` under `## Consequences`
  - `docs/adr/0020-embedding-serving-runtime.md`: `## Implementation Notes` → `### Implementation Notes` under `## Consequences`
  - `docs/adr/0022-node-22-23-0-patch-pin-root-cause.md`: `## Monitoring` → `### Monitoring` under `## Consequences`
- [x] [Review][Patch] ADR-005 evidence path pointed to non-existent file — `planning-artifacts/prds/prd-impeachment-watch-2026-06-19/.decision-log.md` corrected to `_bmad-output/planning-artifacts/prds/prd-impeachment-watch-2026-06-19/.decision-log.md`.
- [x] [Review][Patch] File permissions are `0700` on all changed/new markdown and test files; attempted `chmod 0644` but the external APFS/exFAT volume does not preserve Unix permission bits. No further action possible in this environment.
- [x] [Review][Decision] Linter did not verify that `evidence` paths/URLs actually exist (only syntactic shape). Consensus: local paths must resolve; URLs validated syntactically only (no network calls in CI). Added `resolveEvidencePath()` + `existsSync()` check in `tests/lint/adr-lint.test.ts`.
- [x] [Review][Patch] Linter did not detect duplicate `id` values across ADR files; added uniqueness assertion in the completeness test.
- [x] [Review][Patch] Linter `h2Headers()` ignored H2 lines with leading whitespace; fixed to require `## ` at the start of the raw line.
- [x] [Review][Patch] ADR-001 referenced `ADR-007` inline but neither file included the other in `related`; added bidirectional ADR-001 ↔ ADR-007 `related` link.

## Dev Notes

### New ADR Content Briefs (from Architecture)
- **ADR-006 (OCR Technology Selection):** Docling + PaddleOCR-VL for OCR.
- **ADR-007 (Tiered Ingestion Architecture):** Firecrawl Tier-1 only for v1; Tier-2 Crawlee+stealth deferred.
- **ADR-008 (NLI Entailment Gate):** Add citation engine using NLI entailment gate.
- **ADR-009 (Monorepo Orchestrator Selection):** Turborepo selected over Nx or bare pnpm-workspaces for eval caching.
- **ADR-011 (Golden Corpus Versioning):** Manifest versioning strategy for corpus stability.
- **ADR-012 (LLM Observability Fork):** OTel vs Langfuse selection.
- **ADR-013 (Adversary Formalism):** Threat models and attack taxonomies.
- **ADR-014 (Polyglot Eval Invocation):** Subprocess invocation instead of HTTP for polyglot eval.
- **ADR-015 (AGE Raw-SQL Escape Hatch):** Raw SQL escape for AGE Cypher within Drizzle.
- **ADR-016 (Query Planner Extraction):** Design around extracting query planning.
- **ADR-017 (Supersession Orchestration):** Handling supersession events and cache invalidation.
- **ADR-018 (Partner Keyring Rotation):** Nonce TTL and key rotation strategy.
- **ADR-019 (GPU Runner Workstation Contradiction):** Resolves SEC-4 (isolated runner) vs NFR-D-1 (single-workstation) by using container-level VM isolation/GPU passthrough.

### PC-3 Frontmatter and Section Schema
Every ADR markdown file must begin with a YAML block containing these exact fields:
```yaml
---
id: ADR-001
title: A Concise Descriptive Title
status: Accepted
date: 2026-06-26
supersedes: null
superseded_by: null
deciders: [Winston (architect), user]
related: [AC-5, SC-9]
evidence:
  - _bmad-output/planning-artifacts/architecture.md
---
```

Sections to include (case-sensitive exact matches):
- `# ADR-XXX: Title` (H1)
- `## Context` (H2)
- `## Decision` (H2)
- `## Alternatives` (H2)
- `## Consequences` (H2)
- `## Open questions` (H2)

## Dev Agent Record

### Agent Model Used
glm-5.2 (zai-coding-plan/glm-5.2) via opencode `bmad-dev-story` workflow.

### Debug Log References
- Initial `adr-lint` run surfaced 9 evidence failures: gray-matter (js-yaml) parses evidence list items containing `: ` (colon-space) as YAML maps, not strings. Fixed by normalizing evidence entries to strings (`normalizeEvidence`) before the real/placeholder check — collapses parsed maps/dates to a searchable string containing the path/URL text. Re-run: 94/94 green.
- Verified the linter is load-bearing (not vacuous) by temporarily mutating `## Open questions` → `## Open Questions` in ADR-006: the case-sensitive section assertion failed as expected, then restored to green.
- `noPropertyAccessFromIndexSignature` (project tsconfig) flagged dot-access on gray-matter's `Record<string, unknown>` frontmatter; resolved by declaring a named-key `AdrFrontmatter` interface and casting. Zero typecheck errors in `adr-lint.test.ts`.
- Pre-existing typecheck error in `tests/integration/polyglot-eval-roundtrip.test.ts:213` (TS2554) confirmed present at baseline commit `737eb1e` — unrelated to this story; not touched.

### Completion Notes List
- **AC #1 (presence + naming):** `docs/adr/` contains exactly 22 ADRs (ADR-001 … ADR-022), all matching the four-digit kebab-case pattern. 13 new files authored (006-009, 011-019); 9 existing validated.
- **AC #2 (PC-3 template):** All 22 ADRs carry the 9 required YAML frontmatter keys with correct types; `id` is 3-digit padded (`ADR-NNN`). The `supersedes_by` typo was corrected to `superseded_by` in 5 files (001, 003, 004, 021, 022). The 5 required section headers (`## Context`, `## Decision`, `## Alternatives`, `## Consequences`, `## Open questions`) are present with exact case-sensitive match in every ADR; the `## Alternatives Considered` / `## Open Questions` variants were standardized.
- **AC #3 (adr-lint suite):** `tests/lint/adr-lint.test.ts` created in the existing `lint` Vitest project (91 assertions). Validates frontmatter keys/types, section headers (case-sensitive), the `supersedes_by` typo ban, evidence rules, and bidirectional `related` links.
- **AC #4 (evidence + bidirectional):** `Accepted`/`Superseded`/`Deprecated` ADRs have non-empty `evidence` with real paths/URLs (architecture.md, research files, repo paths). The "evidence pending" marker is allowed ONLY for `Proposed` status. ADR↔ADR `related` links are bidirectional across all 22 ADRs (existing one-directional refs fixed).
- **AC #5 (content briefs + ADR-019):** The 13 new ADRs are populated from the architecture briefs. ADR-019 resolves the SEC-4 (isolated runner) vs NFR-D-1 (single workstation) contradiction via logical container/VM isolation + mediated GPU passthrough (no shared filesystem/secrets/namespace; GPU is a device not a trust boundary), with a documented second-box fallback trigger.
- **Full regression:** `pnpm test:lint` (94 passed), `pnpm test` (smoke+contract+lint + turbo 15/15), `pnpm typecheck` (19/19), `pnpm build` (19/19), `eslint` on the new file (clean). No regressions.

### File List
- `docs/adr/0001-defamation-grade-operational-definition.md` (MODIFIED — typo fix, section headers, related bidirectionality)
- `docs/adr/0002-apache-age-version-pin.md` (MODIFIED — section headers)
- `docs/adr/0003-drizzle-orm-selection-rationale.md` (MODIFIED — typo fix, section headers)
- `docs/adr/0004-ddos-attack-posture.md` (MODIFIED — typo fix, section headers, related bidirectionality)
- `docs/adr/0005-llm-model-tier.md` (MODIFIED — section headers, related bidirectionality)
- `docs/adr/0006-ocr-technology-selection.md` (NEW)
- `docs/adr/0007-tiered-ingestion-architecture.md` (NEW)
- `docs/adr/0008-nli-entailment-gate-citation-engine.md` (NEW)
- `docs/adr/0009-monorepo-orchestrator-selection.md` (NEW)
- `docs/adr/0010-citation-hash-algorithm.md` (MODIFIED — section headers, related bidirectionality)
- `docs/adr/0011-golden-corpus-versioning.md` (NEW)
- `docs/adr/0012-llm-observability-fork.md` (NEW)
- `docs/adr/0013-adversary-formalism.md` (NEW — Proposed, evidence pending)
- `docs/adr/0014-polyglot-eval-invocation-subprocess.md` (NEW)
- `docs/adr/0015-age-raw-sql-escape-hatch.md` (NEW)
- `docs/adr/0016-query-planner-extraction.md` (NEW — Proposed, evidence pending)
- `docs/adr/0017-supersession-orchestration.md` (NEW — Proposed, evidence pending)
- `docs/adr/0018-partner-keyring-rotation-nonce-ttl.md` (NEW — Proposed, evidence pending)
- `docs/adr/0019-gpu-runner-workstation-contradiction.md` (NEW)
- `docs/adr/0020-embedding-serving-runtime.md` (MODIFIED — section headers, related bidirectionality)
- `docs/adr/0021-process-count-reconciliation.md` (MODIFIED — typo fix, section headers, related bidirectionality)
- `docs/adr/0022-node-22-23-0-patch-pin-root-cause.md` (MODIFIED — typo fix, section headers, related bidirectionality)
- `tests/lint/adr-lint.test.ts` (NEW)
- `package.json` (MODIFIED — added `gray-matter` devDependency)
- `pnpm-lock.yaml` (MODIFIED — lockfile for gray-matter)

## QA Results

### Test Execution
- `pnpm test:lint` → 94 passed (91 adr-lint + 3 import-boundaries), 0 failed.
- `pnpm test` → root projects (smoke/contract/lint) + `turbo run test` 15/15 tasks, all green.
- `pnpm typecheck` → 19/19 turbo tasks, 0 errors.
- `pnpm build` → 19/19 turbo tasks.
- `eslint tests/lint/adr-lint.test.ts` → 0 errors/warnings.

### Verification
- All 5 Acceptance Criteria verified mechanically by the linter + manual audit.
- Linter proven load-bearing via a temporary header-case mutation (failed → restored → green).
- No regressions; pre-existing unrelated TS error in `polyglot-eval-roundtrip.test.ts` noted (baseline `737eb1e`).

## Change Log
- 2026-06-26 — Story 1.10 updated to include retroactive validation and content briefs based on adversarial review findings.
- 2026-06-26 — Story 1.10 implemented: 13 new ADRs authored (006-009, 011-019), 9 existing ADRs normalized to PC-3 compliance (typo + section headers + bidirectional related), `adr-lint` suite added (91 assertions). Status → review.
