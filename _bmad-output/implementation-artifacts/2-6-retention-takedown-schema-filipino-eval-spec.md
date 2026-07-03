---
story_id: '2.6'
story_key: '2-6-retention-takedown-schema-filipino-eval-spec'
epic: 'Epic 2: Provenance & Invariants'
status: done
baseline_commit: f9583b14f7e2649e833f03be9ce21eeb059dfd2c
last_updated: '2026-07-03'
amended_by: 'party-mode adversarial review 2026-07-03 (see story-2-6-review-report.md)'
review_scope: '2.6a slice only (retention schema on intake_documents). 2.6b ACs #2/#3 split to Story 2.6b-close (backlog) — blocked on native-Filipino annotator procurement + Fleiss kappa measurement.'
split_into:
  - '2.6a (this story — retention schema, intake-only)'
  - '2.6b (Filipino salience eval gate — blocked on annotator)'
  - '2.10 (NEW — config_history build, the real G-2 close)'
  - '2.6c (NEW — English eval gate, the volume-critical path per VAL-10)'
g2_status: OPEN-until-2.7
depends_on: []
---

# Story 2.6: Retention/Takedown Schema & Filipino Eval Spec (AR-23, AR-24, VAL-2)

Status: done (2.6a slice — code review passed 2026-07-03; all 4 decision-needed resolved + 12 patches applied + verified. 2.6b ACs #2/#3 remain UNCLOSED, split to Story 2.6b-close)

> **AMENDED 2026-07-03 — party-mode adversarial review (6 agents, 3 rounds).** This story is **SPLIT**: 2.6a (this doc, retention schema on `intake_documents` only) ships after ~1 day of doc work; 2.6b (Filipino eval) is blocked on sourcing a native-Filipino annotator (procurement). Two new stories filed: **2.7** (build `config_history` = the real G-2 close, since config_history is currently unbuilt) and **2.6c** (English extraction-quality eval gate = the volume-critical path per VAL-10). **G-2 stays OPEN until 2.7 lands.** See `story-2-6-review-report.md` for the full findings.

> **CRITICAL G-2 & G-3 GATES — DEFAMATION & COVERAGE EXPOSURE.** 
> This story closes two critical validation gaps (VAL-2) blocking claim-touching milestones:
> 1. **G-2 (Retention/Takedown Schema):** PostgreSQL/Drizzle must encode retention policy, takedown triggers, and superseded timestamps directly in the schema. In defamation-grade software, ambiguity in legal holds or deletion semantics is a fatal defect. **Scope correction (VAL-8/F2):** G-2 covers BOTH `intake_documents` (this story, 2.6a) AND `config_history` (Story 2.10, currently unbuilt). G-2 is OPEN until both land.
> 2. **G-3 (Filipino Eval Spec):** Lock in a formal ADR defining the Filipino evaluation dataset before claim extraction begins. **Premise correction (VAL-10):** under the owner's ground truth (most articles are English), Filipino is the **salience** production case (highest defamation-risk subset), NOT the volume-production case. General LLMs fail on specialized Philippine legal registers (e.g., *kasong libelo*, *pinagbintangan*). If the Filipino eval gates fail, v1 must fallback to a documented English-only coverage gap (DR-4). **G-3 closes only when BOTH the English (2.6c) and Filipino (2.6b) gates are specified.**

## Story

As a **developer and compliance officer**,
I want retention/takedown metadata fields in the Drizzle data model and a Filipino evaluation dataset specification locked in an ADR,
so that we can enforce legally-compliant data lifecycles and ensure that any extraction of Filipino claims meets strict, verified quality gates.

## Acceptance Criteria

### Behavioral (stakeholder-verifiable)

1. **Drizzle Schema Retention Metadata (AR-23, G-2 Critical — intake-surface only):**
   - **Given** the Drizzle relational schema in `packages/db/src/schema/intake-documents.ts`,
   - **When** a document is stored,
   - **Then** the `intake_documents` table contains explicit retention metadata (Option A — nullable-conditional, matching the file's existing discipline):
     - `retention_class` (branded `RetentionPolicy` text, nullable) — the governance hold class (e.g., standard, litigation_hold, immediate_takedown). **Renamed from `retention_policy`** to avoid the vocabulary clash with the orthogonal `legal_hold` flag.
     - `takedown_trigger` (text, nullable) — captures the trigger or rationale for removal (e.g., court_order, dmca, editor_retraction). **Distinct from `retention_class` (the policy) and `legal_hold` (the freeze flag).**
     - `legal_hold` (boolean, NOT NULL DEFAULT false) — the orthogonal litigation-freeze flag (boolean-NULL is an anti-pattern; false is the honest "not held").
     - `retention_set_at` (timestamptz, nullable) — when the non-default class/hold was set.
   - **Moved to ADR-0017:** `superseded_at` is supersession lifecycle, NOT retention; a lone timestamp under-models what ADR-0017 must orchestrate (successor FK, reason, audit). The epic AC is amended accordingly.
   - *Nullability rationale (Winston #2/#20):* retention columns are `.nullable()` because they are populated only when a takedown/hold event triggers. At defamation grade, NULL `retention_class` = "no decision yet" (honest); a fabricated `'standard'` default = a lie that looks like compliance. A vocabulary `CHECK` is added in the hand-authored SQL migration only (belt-and-suspenders at near-zero cost). `legal_hold` is the exception: NOT NULL DEFAULT false.
   - **G-2 is NOT closed by this AC** — `config_history` (Story 2.10) is still unbuilt. G-2 stays OPEN.

2. **Filipino Eval-Set Spec ADR (AR-24, G-3 Critical-design-gate):**
   - **Given** the ADR folder at `docs/adr/`,
   - **When** the new ADR `0025-filipino-eval-set-spec.md` is reviewed,
   - **Then** it is accepted with evidence and details:
     - Filipino is a first-class **salience** production target (VAL-10: highest defamation-risk subset), sequenced after the English volume-production gate. NOT a secondary internationalization (i18n) layer.
     - Specific Philippine legal/political terminologies and registers (e.g., *kasong libelo*, *pinagbintangan*, *nagsampa*, *paglabag*) are codified in the evaluation criteria.
     - Support for bilingual English-Tagalog code-switching ("Taglish") is explicitly addressed.
     - A frozen, version-controlled set of evaluation fixtures (the golden Filipino corpus) is specified with a startup verification check (SHA-256 hash matching the **provenance manifest**, not just source text).
   - **ADR-0025 bidirectional links:** ADR-0001, ADR-0005, ADR-0007, ADR-0008, ADR-0014, ADR-0017, ADR-0020. **ADR-0024 REMOVED** (hash-chain-concurrency — no architectural relationship to an eval dataset; was copy-paste residue from story 2.5's template).

3. **Filipino Quality Gate Enforcement (OQ-9, G-3):**
   - **Given** the Filipino eval spec ADR,
   - **When** claims or relationships are extracted from Filipino-language sources,
   - **Then** the ADR defines a **measurement protocol** (not thresholds alone): RAGAS Faithfulness, Citation Recall/Precision, and NLI entailment scored as a **stratified floor + red-line (never mean)** — the one-sided Clopper–Pearson 95% lower confidence bound on the within-stratum pass rate ≥ 0.95; τ_red ≈ 0.50 (instant fail), τ_doc ≈ 0.90; minimum corpus n ≥ 100 with each stratum ≥ 30. Filipino stratum scored and reported separately; a blended English+Filipino mean is forbidden.
   - **And** the ADR specifies annotation provenance (native Filipino speakers, ≥3 annotators/doc, named adjudicator, Fleiss' κ ≥ 0.75) with the SHA-256 covering the provenance manifest, and a circularity firewall (an LLM may NEVER generate/adjudicate gold labels; LLM-as-judge permitted only when calibrated to human, κ ≥ 0.70).
   - **And** the ADR specifies two-tier CI enforcement: `eval:smoke` (n=20, merge-blocking per PR) + `eval:full` (n≥200, deploy-blocking on main/release; never cached for releases).
   - **And** if the quality gate is *not* met, the system falls back to the **English-only coverage gap** (DR-4): Filipino sources are ingested and searchable, but claims and relationships are not extracted, and the UI/demo explicitly discloses this limitation. The threshold provenance (why 0.95) must be argued from harm data (RED/YELLOW/GREEN calibration), not picked by convention — 0.95 is an interim floor with a documented sunset pending calibration.

## Tasks / Subtasks

- [x] **Task 1: Relational Schema Updates (Drizzle & PostgreSQL) — 2.6a**
  - [x] Add branded `RetentionPolicy` to `packages/contracts/src/intake/retention.ts` (`z.enum(['standard','litigation_hold','immediate_takedown'])`); export from the contracts barrel.
  - [x] Update `packages/db/src/schema/intake-documents.ts` to add `retention_class`, `takedown_trigger`, `legal_hold` (NOT NULL DEFAULT false), `retention_set_at`. Add `boolean` to the import. `superseded_at` is NOT in this story (moved to ADR-0017).
  - [x] Add JSDoc comments explaining the nullability rationale (NULL = "no decision yet", honest at defamation grade).
  - [x] Hand-author up + DOWN migration `packages/db/drizzle/0002_intake_retention.sql` (project hand-authors migrations; `pnpm --filter @iip/db db:generate` to reconcile). DOWN drops the partial indexes (`legal_hold = true`, `retention_class`) then the columns. ⚠️ Reconcile journal `meta/_journal.json` (0001 unjournaled) first.
  - [x] Add the vocabulary `CHECK` in the raw SQL migration only (belt-and-suspenders; the Drizzle def stays nullable per Option A).
  - [x] Run migration tests via the Testcontainers/PostgreSQL suite to verify the table compiles + the columns exist at the DB level (`information_schema`, not the Drizzle object).

- [~] **Task 2: Author ADR-0025 (Filipino Eval Spec) — 2.6b (partially unblocked — interim annotator committed)**
  - [x] Create `docs/adr/0025-filipino-eval-set-spec.md` following the standard PC-3 ADR template.
  - [x] Define the context (Taglish code-switching, Philippine political/legal register, model limits of Qwen3-14B, VAL-10 salience-vs-volume framing).
  - [x] Define the extraction quality gate (OQ-9) **measurement protocol** (Clopper–Pearson floor, n≥100, annotation provenance, two-tier CI enforcement) and fallback model (English-only coverage gap under DR-4).
  - [x] Link ADR-0025 bidirectionally to `ADR-0001`, `ADR-0005`, `ADR-0007`, `ADR-0008`, `ADR-0014`, `ADR-0017`, `ADR-0020`. **(ADR-0002 and ADR-0024 removed — no relationship to an eval dataset; were copy-paste residue.)**
  - [x] Increment the expected ADR count in `tests/lint/adr-lint.test.ts` from 24 to 25 — **only when the ADR file physically lands** (update all 4 sites: header comment, `it()` description, `toBe()`, loop bound).
  - [ ] **BLOCKED — AC #3 κ-gate.** ADR-0025 is `Proposed` (not `Accepted`) because Fleiss' κ ≥ 0.75 is mathematically undefined for fewer than 3 raters. As of 2026-07-03 the project owner (anti lustay) has committed as **interim annotator #1 of 3**; two additional native-Filipino annotators + a named adjudicator are still pending procurement. Until they land and κ is measured, ADR-0025 cannot reach `Accepted` and the Filipino extraction path stays gated off via the DR-4 fallback. AC #2 ("reviewed → Accepted with evidence") and AC #3 (κ ≥ 0.75) are honestly UNCLOSED for this dev run.

- [x] **Task 3: Implement Integration and Contract Tests — 2.6a**
  - [x] Create `tests/integration/retention-schema.integration.test.ts` to verify database schema invariants, asserting against the **live Postgres `information_schema`**, not the Drizzle object:
    - Assert that `retention_class`, `takedown_trigger`, `legal_hold`, `retention_set_at` columns exist on the `intake_documents` table.
    - Verify `retention_class`/`takedown_trigger`/`retention_set_at` allow null on insert; `legal_hold` defaults to `false` and is NOT NULL.
    - Verify the partial index on `legal_hold = true` backs the hold scan.
    - Verify the DOWN migration restores the schema.
  - [ ] (2.6b) Pin the Filipino eval test location and the exact artifact it parses — no "or" hand-wave; defer until annotator is sourced.

- [x] **Task 4: Run Validation and Quality Gates**
  - [x] Ensure that all tests across the monorepo pass (`pnpm test`).
  - [x] Run `pnpm lint` and `pnpm typecheck` to verify Biome/ESLint flat config and TypeScript strict compilation.
  - [x] Validate conventional commit format with `Refs: AR-23, VAL-2, G-2, VAL-10` trailer (2.6a scope; DR-4, OQ-9, G-3, AR-24 belong to 2.6b).

## Dev Notes

### Relational Schema Strategy
- **File to touch:** [intake-documents.ts](file:///Users/sherwingorechomante/impeach/packages/db/src/schema/intake-documents.ts).
- **Decision (Option A — nullable-conditional, per Amelia):** add columns to `intakeDocuments` after the `updated_at` block:
  ```ts
  retention_class: text('retention_class').$type<RetentionPolicy>().nullable(),
  takedown_trigger: text('takedown_trigger').nullable(),
  legal_hold: boolean('legal_hold').notNull().default(false),
  retention_set_at: timestamp('retention_set_at', { withTimezone: true, mode: 'date' }).nullable(),
  ```
- Add `boolean` to the `drizzle-orm/pg-core` import; add a branded `RetentionPolicy` (`z.enum(['standard','litigation_hold','immediate_takedown'])`) to `packages/contracts/src/intake/retention.ts` (precedent: `state.ts`).
- **Why NOT Option B (NOT NULL + DEFAULT + CHECK):** a fabricated `'standard'` default would read as "actively classified" when no decision was made — at defamation grade, NULL "no decision yet" is the honest state. `legal_hold` is the sole exception (NOT NULL DEFAULT false; boolean-NULL is an anti-pattern). A vocabulary `CHECK` goes in the **hand-authored SQL migration only** (the project hand-authors migrations due to a false version-check on the pinned drizzle-kit; the CHECK is near-zero-cost belt-and-suspenders).
- **`superseded_at` is REMOVED from this story** — moved to ADR-0017 (supersession-orchestration) scope. Its clock-skew/future-timestamp test (Murat M4/8.3) relocates with it.
- **Up + DOWN migration required** (DoD). Forward: `packages/db/drizzle/0002_intake_retention.sql` (hand-authored). DOWN: DROP partial indexes (`legal_hold = true`, `retention_class`) then columns. ⚠️ The migration journal `meta/_journal.json` lists only idx 0 — `0001_editorial_log.sql` is unjournaled; reconcile before adding 0002.

### Filipino Eval Spec Structure
- The ADR must reside at `docs/adr/0025-filipino-eval-set-spec.md`.
- Legal terms to test in the eval suite include:
  - *kasong libelo* (libel case / cyberlibel)
  - *pinagbintangan* (accused/alleged)
  - *hukuman* (court)
  - *paglabag* (violation)
- The quality gate is critical: it prevents claims extraction on unverified local models.

### Project Structure Notes
- **ADR Path:** `docs/adr/0025-filipino-eval-set-spec.md`
- **Database Schema Path:** `packages/db/src/schema/intake-documents.ts`
- **Tests Path:** `tests/integration/retention-schema.integration.test.ts`

### References
- [Story 2.6 Review Report (party-mode adversarial, 2026-07-03)](file:///Users/sherwingorechomante/impeach/_bmad-output/implementation-artifacts/story-2-6-review-report.md)
- [Architecture Spec: VAL-2 G-2/G-3 Critical Gaps](file:///Users/sherwingorechomante/impeach/_bmad-output/planning-artifacts/architecture.md#L564)
- [Architecture Spec: VAL-10 Language-Premise Correction (English volume / Filipino salience)](file:///Users/sherwingorechomante/impeach/_bmad-output/planning-artifacts/architecture.md)
- [Architecture Spec: VAL-3 F1-Gate Additions](file:///Users/sherwingorechomante/impeach/_bmad-output/planning-artifacts/architecture.md#L570)
- [Epics: Story 2.6 Spec (amended)](file:///Users/sherwingorechomante/impeach/_bmad-output/planning-artifacts/epics.md#L666)
- [ADR-0017: Supersession Orchestration](file:///Users/sherwingorechomante/impeach/docs/adr/0017-supersession-orchestration.md)
- [Proposed Story 2.10 (config_history — real G-2 close)](file:///Users/sherwingorechomante/impeach/_bmad-output/implementation-artifacts/2-10-config-history-retention-g2-close.md)
- [Proposed Story 2.6c (English eval gate — volume-critical path)](file:///Users/sherwingorechomante/impeach/_bmad-output/implementation-artifacts/2-6c-english-extraction-quality-eval-gate.md)
- [Project Context: TS tsconfig.base.json and Schema constraints](file:///Users/sherwingorechomante/impeach/_bmad-output/project-context.md#L136)

## Dev Agent Record

### Agent Model Used

Gemini 3.5 Flash (High) — initial spec. Dev implementation: ZCode (builtin:zai-coding-plan/GLM-5.2), 2026-07-03.

### Debug Log References

- `tsc --noEmit` on `@iip/db` initially rejected `.nullable()` on Drizzle column builders — this project's Drizzle 0.35 discipline makes columns nullable by *omitting* `.notNull()` (precedent: `reviewer_sub` in the same file). Fixed by dropping the explicit `.nullable()` calls; nullability is now conveyed by the absence of `.notNull()` + a load-bearing JSDoc block.
- First integration run: 11/13 passed; the 2 partial-index assertions failed because `indexPredicate` selected `indexdef` but read `.predicate` (undefined). Fixed the row-property alias to `.indexdef`; 13/13 green.
- ADR-0025 YAML parse error (`missed comma between flow collection entries`): the `deciders` entry `anti lustay (interim Filipino annotator #1)` broke the flow sequence — the `#` is comment-marker-adjacent inside unquoted parens. Removed the `#1`; adr-lint then parsed + passed.

### Completion Notes List

- Story file generated in `_bmad-output/implementation-artifacts/2-6-retention-takedown-schema-filipino-eval-spec.md`.
- **AMENDED 2026-07-03** by party-mode adversarial review (Winston, Murat, Mary, Amelia, John PM; 3 rounds). Key changes: split into 2.6a/2.6b; `superseded_at` evicted to ADR-0017; `takedown_trigger` restored; `retention_policy`→`retention_class` + added `legal_hold`/`retention_set_at`; Option A nullability chosen; `depends_on: 2.5` stripped; spurious ADR-0024 link removed; G-2 marked OPEN (config_history deferred to Story 2.10); VAL-10 language-premise correction (English = volume-production, Filipino = salience-production); English eval gate filed as Story 2.6c. See `story-2-6-review-report.md`.
- **Ground-truth note (from project owner):** most source articles are in English. This informed VAL-10 and the filing of Story 2.6c (English eval gate = volume-critical path). It does not change this schema migration.
- **2.6a IMPLEMENTED 2026-07-03 (ZCode).** Branded `RetentionPolicy` contract added (`packages/contracts/src/intake/retention.ts`) + exported via intake + root barrels. Four retention columns added to `intakeDocuments` (Option A nullability; `legal_hold` NOT NULL DEFAULT false). Migration `0002_intake_retention.sql` hand-authored with UP + DOWN blocks, vocabulary CHECK, and two sparse partial indexes (`legal_hold = true`, `retention_class IS NOT NULL`). Journal `meta/_journal.json` reconciled (added the previously-unjournaled `0001_editorial_log` entry at idx 1 + the new `0002` at idx 2). Integration test `retention-schema.integration.test.ts` (13 cases) asserts against the **live Postgres `information_schema`** — column presence/types/nullability, `legal_hold` DEFAULT-false on real writes, the vocabulary CHECK (accepts the 3 sanctioned values, rejects a misspelling with `23514`), both partial indexes, and the DOWN round-trip. All 13 GREEN against the real `ghcr.io/iip/postgres-age-pgvector:pg16` Testcontainers image.
- **2.6b ADR-0025 AUTHORED 2026-07-03 (Zode) — `Proposed`, not `Accepted`.** ADR-0025 captures the full OQ-9 measurement protocol (stratified Clopper–Pearson floor + red-line, n≥100/stratum≥30, two-tier CI enforcement `eval:smoke`/`eval:full`, Lingua+fastText detection, DR-4 fallback, 0.95-as-interim-floor sunset), the golden-Filipino-corpus provenance-manifest discipline, and the circularity firewall. Bidirectional links added to ADR-0001/0005/0007/0008/0014/0017/0020 (7 back-references); ADR-0002 + ADR-0024 NOT linked (copy-paste residue per F7). adr-lint bumped 24→25 at all 4 sites (now 103 tests, GREEN). **The project owner (anti lustay) committed as interim annotator #1 of 3**, partially unblocking the procurement gap. However AC #2 (`Accepted` with evidence) and AC #3 (Fleiss' κ ≥ 0.75) remain UNCLOSED: κ is mathematically undefined for <3 raters, so the ADR cannot honestly reach `Accepted` until 2 more native-Filipino annotators + a named adjudicator are sourced and κ is measured. Filipino extraction stays gated off via DR-4 in v1 until then.
- **G-2 status unchanged:** OPEN. `config_history` (Story 2.10) is still unbuilt; this story's intake-surface retention columns do not close G-2.
- **Pre-existing integration failures (NOT caused by this story):** `compose-stack.health.test.ts` (MinIO image tag unresolvable from Docker Hub) and `sops-decryption.test.ts` (sops/age binaries gated as "tools not installed") — verified to fail identically at the baseline commit `f9583b1` with this story's changes stashed.

### File List

- `_bmad-output/implementation-artifacts/2-6-retention-takedown-schema-filipino-eval-spec.md` — Story 2.6a specification (amended).
- `_bmad-output/implementation-artifacts/story-2-6-review-report.md` — **NEW** — adversarial review report.
- `_bmad-output/implementation-artifacts/2-10-config-history-retention-g2-close.md` — **NEW** — proposed Story 2.10 (real G-2 close).
- `_bmad-output/implementation-artifacts/2-6c-english-extraction-quality-eval-gate.md` — **NEW** — proposed Story 2.6c (English eval gate, volume-critical path).
- `packages/contracts/src/intake/retention.ts` — **NEW** — branded `RetentionPolicy` zod enum contract (2.6a).
- `packages/contracts/src/intake/index.ts` — **MODIFIED** — export `RetentionPolicy`/`RetentionPolicyLiteral` (+ types) from the intake barrel.
- `packages/contracts/src/index.ts` — **MODIFIED** — re-export retention contract types from the root `@iip/contracts` barrel.
- `packages/db/src/schema/intake-documents.ts` — **MODIFIED** — added `retention_class`, `takedown_trigger`, `legal_hold` (NOT NULL DEFAULT false), `retention_set_at` + nullability JSDoc (2.6a).
- `packages/db/drizzle/0002_intake_retention.sql` — **NEW** — hand-authored UP + DOWN migration, vocabulary CHECK, two sparse partial indexes (2.6a).
- `packages/db/drizzle/meta/_journal.json` — **MODIFIED** — reconciled: added unjournaled `0001_editorial_log` (idx 1) + new `0002_intake_retention` (idx 2).
- `tests/integration/retention-schema.integration.test.ts` — **NEW** — 13 Testcontainers cases asserting against live `information_schema` (2.6a).
- `docs/adr/0025-filipino-eval-set-spec.md` — **NEW** — ADR-0025 Filipino salience eval-set spec (`Proposed`; interim annotator committed; AC #3 κ-gate pending).
- `docs/adr/0001-defamation-grade-operational-definition.md` — **MODIFIED** — `related:` + back-link to ADR-025.
- `docs/adr/0005-llm-model-tier.md` — **MODIFIED** — `related:` + back-link to ADR-025.
- `docs/adr/0007-tiered-ingestion-architecture.md` — **MODIFIED** — `related:` + back-link to ADR-025.
- `docs/adr/0008-nli-entailment-gate-citation-engine.md` — **MODIFIED** — `related:` + back-link to ADR-025.
- `docs/adr/0014-polyglot-eval-invocation-subprocess.md` — **MODIFIED** — `related:` + back-link to ADR-025.
- `docs/adr/0017-supersession-orchestration.md` — **MODIFIED** — `related:` + back-link to ADR-025.
- `docs/adr/0020-embedding-serving-runtime.md` — **MODIFIED** — `related:` + back-link to ADR-025.
- `tests/lint/adr-lint.test.ts` — **MODIFIED** — ADR count 24→25 at all 4 sites (header comment, `it()` description, `toBe()`, loop bound).
- `_bmad-output/implementation-artifacts/sprint-status.yaml` — **MODIFIED** — story 2-6 promoted `ready-for-dev → in-progress`.

## Change Log

| Date | Version | Description | Author |
|---|---|---|---|
| 2026-07-03 | 2.6a | Implemented retention/takedown schema on `intake_documents`: branded `RetentionPolicy` contract + Drizzle columns + hand-authored UP/DOWN migration + 13-case Testcontainers integration test. G-2 stays OPEN (config_history deferred to Story 2.10). | ZCode (GLM-5.2) |
| 2026-07-03 | 2.6b-partial | Authored ADR-0025 (Filipino salience eval-set spec) as `Proposed` with the complete OQ-9 measurement protocol + 7 bidirectional ADR links + adr-lint bump 24→25. Project owner (anti lustay) committed as interim annotator #1 of 3. AC #2 (`Accepted`) + AC #3 (Fleiss' κ ≥ 0.75) remain UNCLOSED pending 2 more native-Filipino annotators + an adjudicator. | ZCode (GLM-5.2) |
| 2026-07-03 | 2.6b-amend | Amended ADR-0025 with **§9 LLM-assisted annotation protocol** (cloud-LLM roles: pre-annotation / calibrated co-rater / adjudication assistant; forbidden: sole gold-label source). Reduced the procurement blocker from ≥3 humans to **≥2 humans** via Gemini 2.5 Pro pre-annotation + Role-2 κ ≥ 0.70 calibrated co-rating; added exposure-discipline (`llm-exposed` flag), Alternative #6 (Gemini-only rejected), Consequence bullet, Open Question #5 (Taglish-stratified calibration). Synced Story 2-6b-close ACs #1–#3 + Tasks 1–2 to the reduced-headcount path. adr-lint 103/103 GREEN. ADR stays `Proposed` — the human–human κ still needs the one extra human to be measured. | ZCode (GLM-5.2) |

## QA Results

### Automated Test Results

- `tests/integration/retention-schema.integration.test.ts`: **13/13 GREEN** (Testcontainers `ghcr.io/iip/postgres-age-pgvector:pg16`).
- `tests/lint/adr-lint.test.ts`: **103/103 GREEN** (ADR count 24→25; ADR-0025 template + 7 bidirectional links valid).
- `pnpm test` (smoke + contract + lint + turbo 23 tasks): **all GREEN**.
- `pnpm typecheck` (21 projects): **all GREEN**.
- `pnpm lint` (eslint .): **clean**.
- `@iip/contracts` test: **10/10 GREEN** (barrel exports intact).
- **Pre-existing failures (NOT caused by this story; verified at baseline `f9583b1`):** `tests/integration/compose-stack.health.test.ts` (MinIO image tag unresolvable) + `tests/integration/sops-decryption.test.ts` (sops/age binary gating).

### Definition of Done — 2.6a slice

- [x] All 2.6a tasks/subtasks marked complete with `[x]`.
- [x] AC #1 (Drizzle Schema Retention Metadata — intake-surface) satisfied: 4 columns + nullability discipline + partial indexes + vocabulary CHECK, verified at the DB level.
- [x] Integration tests for DB schema invariants added (information_schema, not ORM).
- [x] All tests pass (no regressions from this story); typecheck + lint clean.
- [x] File List complete; Dev Agent Record + Change Log populated.

### Definition of Done — 2.6b slice (PARTIAL — honestly reported)

- [x] ADR-0025 authored per PC-3 template with full OQ-9 protocol + DR-4 fallback.
- [x] Bidirectional links to ADR-0001/0005/0007/0008/0014/0017/0020; adr-lint bumped 24→25, GREEN.
- [x] Interim annotator (#1 of 3) committed by project owner.
- [ ] **AC #2 UNCLOSED:** ADR-0025 is `Proposed`, not `Accepted` — requires the annotated golden corpus (real evidence), which requires the annotator team.
- [ ] **AC #3 UNCLOSED:** Fleiss' κ ≥ 0.75 is undefined for <3 raters; cannot be measured until 2 more native-Filipino annotators + an adjudicator are procured.
- [ ] Filipino eval test location pinning deferred until annotators are sourced (Task 3 subtask).
- **Story does NOT move to `review`** for the 2.6b ACs; only the 2.6a slice is review-ready. See Open Items below.

### Open Items for the Human (2.6b → 2.6b-close)

1. **Source 2 additional native-Filipino annotators + a named adjudicator** (procurement). Owner: PM + human. Until this lands, ADR-0025 cannot become `Accepted` and Filipino extraction stays gated off via DR-4.
2. **0.95 threshold calibration** — derive τ_doc empirically from RED-item false-negative rate vs the legal team's "reckless disregard" tolerance (Murat's F8 calibration procedure). Owner: Legal + Test architect. Blocks G-3 release.
3. **Confirm Option A nullability** sign-off (recommended by review; already implemented).

### Review Findings

_Code review 2026-07-03 (bmad-code-review; parallel Blind Hunter + Edge Case Hunter + Acceptance Auditor). 22 raw findings → 4 decision-needed, 8 patch, 5 defer, 3 dismissed. **All 4 decision-needed resolved by user (2026-07-03); all 12 patches applied + verified (typecheck/lint/adr-lint 103/103/contracts 10/10/integration 13/13 GREEN).**_

**Decision-needed (require human call):**

- [x] [Review][Decision] **§9's 2-rater Fleiss' κ path contradicts §3's own "meaningless below 3 raters" standard** [docs/adr/0025-filipino-eval-set-spec.md §3 vs §9] — **RESOLVED (user): justify 2-rater κ in §3.** Patch applied: §3 now permits a 2-human κ on the high-risk stratum (Fleiss' κ collapses to Cohen's κ at exactly 2 raters; §9 Role-2 Gemini acts as the third rating cross-check).
- [x] [Review][Decision] **`eval:smoke` (n=20) structurally cannot satisfy the §4 OQ9_PASS rule** (n≥100 ∧ stratum≥30) [docs/adr/0025-filipino-eval-set-spec.md §4 vs §5] — **RESOLVED (user): relaxed smoke rule.** Patch applied: §5 now defines the smoke-tier pass rule (no τ_red violation, no manifest-hash mismatch, schema-valid output; full OQ9_PASS deferred to eval:full).
- [x] [Review][Decision] **`libel-injection detector recall ≥ 0.99` in the OQ9_PASS formula is undefined** [docs/adr/0025-filipino-eval-set-spec.md:131] — **RESOLVED (user): strike from formula.** Patch applied: term removed from OQ9_PASS; cross-references SEC-8 promptfoo red-team as the distinct invariant it belongs to.
- [x] [Review][Decision] **`retention_set_at` has no DB default and no server-side `now()` path → forgeable audit timestamp** [packages/db/src/schema/intake-documents.ts:81, packages/db/drizzle/0002_intake_retention.sql:45] — **RESOLVED (user): code comment + open item.** Patch applied: load-bearing FORGEABILITY GUARD comment added to the Drizzle schema; tracked as an open item for the retention-write story.

**Patch (unambiguous fixes):**

- [x] [Review][Patch] **ADR-0025 internal contradiction: header/frontmatter/evidence say "2 additional" annotators but §3/§9/Consequences/OQ-1 say "1 additional"** [docs/adr/0025-filipino-eval-set-spec.md:11,22 vs :101,:223,:267,:290] — applied: frontmatter `evidence` + status banner updated to "1 additional".
- [x] [Review][Patch] **Proposed ADR-0017 cited as binding in `@adr` docblocks** [packages/contracts/src/intake/retention.ts:21, tests/integration/retention-schema.integration.test.ts:19] — applied: `@adr ADR-0017` dropped from both files; ADR-0017 reference kept as plain prose (PC-3 compliant).
- [x] [Review][Patch] **Integration test accepts `timestamp without time zone` for `retention_set_at` — false-positive on a timezone regression** [tests/integration/retention-schema.integration.test.ts:130-138] — applied: assertion tightened to `'timestamp with time zone'` only.
- [x] [Review][Patch] **Open Question #4 is already decided in §9 — internal contradiction** [docs/adr/0025-filipino-eval-set-spec.md OQ-4 vs §9 Role 2] — applied: OQ-4 removed; OQ-5 renumbered to OQ-4; resolving note added.
- [x] [Review][Patch] **§8 conflates τ_doc (0.90) with the 0.95 interim stratum floor** [docs/adr/0025-filipino-eval-set-spec.md §8] — applied: §8 retitled + reworded to name τ_stratum = 0.95 (interim, defamation-safety-anchored) vs τ_doc (re-derived from RED-item FN calibration) explicitly.
- [x] [Review][Patch] **`legal_hold` partial-index assertion too loose — matches any `true` token** [tests/integration/retention-schema.integration.test.ts:627-632] — applied: assertions now check the exact normalized predicate `'where (legal_hold = true)'` / `'where (retention_class is not null)'`.
- [x] [Review][Patch] **DOWN migration test hand-retypes SQL instead of executing the documented DOWN block** [tests/integration/retention-schema.integration.test.ts:650-658] — applied: DOWN SQL now parsed from `0002_intake_retention.sql`; added UP→DOWN→UP round-trip re-asserting `legal_hold` DEFAULT false.
- [x] [Review][Patch] **AppleDouble junk file `packages/db/drizzle/._0001_editorial_log.sql` committed risk** — applied: file removed (`.gitignore` already covers `._*`).

**Defer (real, forward-looking — not actionable in 2.6a slice):**

- [x] [Review][Defer] **Drizzle schema omits the two partial indexes declared in the SQL migration (drift hazard)** [packages/db/src/schema/intake-documents.ts vs 0002…sql:63-69] — deferred, pre-existing convention (0000/0001 also hand-author indexes not modeled in Drizzle). Add a documenting comment or model in Drizzle when the index-source-of-truth convention is settled project-wide.
- [x] [Review][Defer] **Vocabulary CHECK lives only in raw SQL; Drizzle has no knowledge → drift hazard** [packages/db/drizzle/0002_intake_retention.sql vs packages/db/src/schema/intake-documents.ts:217] — deferred, pre-existing project pattern (hand-authored migrations due to drizzle-kit version-check); spec explicitly chose SQL-only CHECK. Track until Drizzle `check()` adoption is decided.
- [x] [Review][Defer] **Branded `RetentionPolicy` applied via `.$type<>()` with no runtime `.parse()` on read path** [packages/db/src/schema/intake-documents.ts:217] — deferred, pre-existing pattern; no read path exists yet. Validate at repository boundary when the read path lands.
- [x] [Review][Defer] **Integration test applies only 0000 + 0002, skipping 0001 — unrealistic chain** [tests/integration/retention-schema.integration.test.ts:428-429] — deferred; applying the full journal chain (0000→0001→0002) in `beforeAll` is a test-architecture improvement tracked with the broader migration-test convention.
- [x] [Review][Defer] **Scope leak: uncommitted Story 2.5 editorial-log changes co-mingled in working tree** [eslint.config.js, packages/contracts/src/editorial-log.ts, packages/editorial/*, tests/{chaos,integration,perf}/editorial-log-concurrency.*] — deferred; these are Story 2.5 leftovers, not 2.6 dependencies. Must be split into separate commits before any 2.6 commit/merge.

**Dismissed (noise / working-as-specified):**

- §9's procurement reduction from ≥3→≥2 humans is internally consistent *with itself*; the contradiction is only against §3's "meaningless below 3" claim (captured as a decision-needed above), not a standalone defect.
- ADR-lint bidirectional-link test verified genuine (would catch a missing back-link; all 7 back-references byte-verified).
- `legal_hold` NOT NULL DEFAULT false consistent across Drizzle + SQL + test; vocabulary CHECK matches the zod enum exactly.
