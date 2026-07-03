# Story 2.6 Adversarial Review Report — Retention/Takedown Schema & Filipino Eval Spec

| Item | Value |
|---|---|
| Story | 2-6-retention-takedown-schema-filipino-eval-spec (AR-23, AR-24, VAL-2) |
| Review type | BMAD party-mode adversarial (3 rounds, 6 agents: Winston, Murat, Mary, Amelia, + John PM) |
| Date | 2026-07-03 |
| Final status | **SPLIT — NOT READY (spec-level); 2.6a doc-fix-then-ship, 2.6b blocked, 2.10 + 2.6c new** |

## Scope
- `_bmad-output/implementation-artifacts/2-6-retention-takedown-schema-filipino-eval-spec.md` (the ready-for-dev SPEC)
- Ground-truth verification against: `packages/db/src/schema/intake-documents.ts`, `packages/db/src/schema/editorial-log.ts`, `packages/db/src/schema/` (config_history absence), `docs/adr/` (24 ADRs), `tests/lint/adr-lint.test.ts`, `_bmad-output/planning-artifacts/architecture.md` (VAL-2/VAL-8), `_bmad-output/planning-artifacts/epics.md` (Story 2.6 AC, L666–678)

## Headline Findings (consensus)

### F1 — Language premise inversion (BLOCKING, architecture-level) — Mary
VAL-2 G-3's premise — *"Filipino is the PRODUCTION case, not i18n"* — is contradicted by the project owner's ground truth: **most source articles are in English.** "Production case" conflated two axes that diverge: **volume** (English = majority serving path) vs **defamation salience/risk** (Filipino/Taglish = highest-risk subset). This is the highest-leverage finding of the session: it propagates into every downstream story referencing G-3 and reveals a **missing English extraction-quality eval gate** that is the *actual* volume-critical path. Resolved via **VAL-10** (architecture amendment).

### F2 — G-2 is uncloseable in 2.6a; config_history does not exist (BLOCKING) — Amelia + Mary + Winston
`config_history` is *planned* (PC-2.6, VAL-8) but **unbuilt** — 0 hits across `packages/` and `docs/`. Winston's round-2 "ALTER TABLE config_history" plan operated on a phantom table. "Honestly closing G-2" therefore requires *building* config_history first (3–5 days, separate story), not "a few extra columns." John's "small cost, real close" holds *only* for the intake_documents half. **Resolution:** 2.6a ships intake-only; G-2 marked **OPEN-with-plan**; config_history build deferred to new **Story 2.10**.

### F3 — AC contract drift (BLOCKING, documentation-bound) — Mary
The epic AC (epics.md L666–678) names a specific field tuple `(retention_policy, takedown_trigger, superseded_at)`. The room's spec work: renamed `retention_policy`→`retention_class`; **evicted `superseded_at`** to ADR-0017 scope (a legitimate engineering call — it is supersession lifecycle, not retention); and **dropped `takedown_trigger`** in the rename. Drift score: 2 fail, 2 narrowed, 0 clean pass. **Resolution:** amend the epic AC (the engineering improvements are correct; the contract must catch up) AND **restore `takedown_trigger`** (distinct concept: the removal rationale — court_order/dmca/editor_retraction — orthogonal to the policy class and the freeze flag).

### F4 — Filipino eval gate: thresholds with no measurement protocol (BLOCKING for 2.6b) — Murat
OQ-9 lists `RAGAS Faithfulness ≥ 0.95`, `Citation Recall/Precision ≥ 0.95`, `NLI ≥ 0.95` with no protocol: per-doc vs aggregate? sample size? pass rule? CI enforcement? An aggregate mean can hit 0.95 while silently failing every libel-relevant Tagalog document. **Resolution:** Murat drafted a complete OQ-9 protocol (Clopper–Pearson floor, n≥100, two-tier CI enforcement, annotation provenance) — captured in this report's appendix and to be encoded in ADR-0025.

### F5 — Corpus annotation provenance unvalidated (BLOCKING for 2.6b) — Murat + John
The "golden Filipino corpus" specifies a SHA-256 startup check (proves bytes didn't drift) but nothing about **who vouches the labels**. An LLM-generated Filipino ground truth used to evaluate an LLM is circular — it always "passes." Annotation provenance (native speaker, ≥3 annotators, Fleiss' κ ≥ 0.75, adjudication) must be specified; the hash must cover the annotations, not the source text. This is a **procurement problem** (sourcing a native-Filipino annotator), not a dev task — owner: PM + human.

### F6 — `depends_on: story 2.5` over-serializes (IMPORTANT) — Winston
Retention columns and the Filipino eval have zero coupling to hash-chain concurrency. Gating G-3 (the production case) behind unrelated storage work taxes the critical path. **Resolution:** strip `depends_on` from 2.6a; unblock immediately.

### F7 — Spurious ADR-0024 bidirectional link (MINOR) — Winston + Mary
ADR-0025 (Filipino eval) was required to link ADR-0024 (hash-chain concurrency) — no relationship; copy-paste residue from story 2.5's template. **Resolution:** remove ADR-0024 from the link list.

### F8 — 0.95 thresholds cite no source (IMPORTANT) — Mary + Murat
At defamation grade a threshold is a legal argument, not a tuning knob. "Industry uses 0.95" is not a defensible citation. **Resolution:** 0.95 is an *interim floor* with a documented sunset (one sprint) + a calibration task blocking G-3 release (derive τ_doc from RED-item false-negative rate vs legal "reckless disregard" tolerance).

## Resolved Design Decisions

| Decision | Call | Rationale |
|---|---|---|
| Nullability: Option A (nullable-conditional) vs Option B (NOT NULL+DEFAULT+CHECK) | **Option A** (Amelia's pick), with vocabulary `CHECK` added in the hand-authored SQL migration only | At defamation grade, NULL `retention_class` = "no decision yet" (honest); a fabricated `'standard'` default = a lie that looks like compliance. `legal_hold` is the exception: NOT NULL DEFAULT false (boolean-NULL is an anti-pattern). SQL-level CHECK is near-zero-cost belt-and-suspenders since migrations are hand-authored anyway. |
| AC contract: amend vs restore alignment | **Amend** (restore `takedown_trigger`) | `superseded_at` eviction to ADR-0017 is the correct architectural call; restoring it re-introduces the scope conflation Winston flagged. Update the contract to match, with a recorded decision + ADR-0017 cross-link. |
| G-2 closure in 2.6a | **OPEN-with-plan** (never "narrowed-closed") | config_history unbuilt → uncloseable. Ship intake-only; file Story 2.10; mark G-2 explicitly OPEN with cross-link + 3–5 day estimate. |
| Language premise | **VAL-10 amendment** | English = volume-production (first eval gate); Filipino = salience-production (own gate, sequenced after). Both real, neither i18n. |
| `depends_on: 2.5` | **Stripped** from 2.6a | No coupling; over-serialization. |
| ADR-0024 link | **Removed** | Spurious; no architectural relationship. |

## Story Reshaping

| Story | Scope | Status | Blocks |
|---|---|---|---|
| **2.6a** | Retention schema on `intake_documents` only (`retention_class`, `takedown_trigger`, `legal_hold`, `retention_set_at`). Option A + SQL CHECK. Up/down migration. adr-lint patch (24→25) **only if** a retention ADR-0025 is authored. | doc-fix (~1 day) then **SHIP**; G-2 stays OPEN | unblocks claim-touching milestones (intake-surface) |
| **2.6b** | Filipino eval-set spec (ADR-0025). Murat's OQ-9 protocol. Relabeled **salience gate** (not "production gate"). | **BLOCKED** on native-Filipino annotator sourcing (procurement) | the salience path, not the volume path |
| **2.10** (NEW) | Build `config_history` (PC-2.6) + retention columns = the **real G-2 close**. | proposed; `depends_on: 2.6a`; ~3–5 days | closes G-2 honestly |
| **2.6c** (NEW) | **English extraction-quality eval gate** — the actual volume-critical path under English-majority. Mirrors the OQ-9 protocol structure for an English corpus. | proposed (was a missing work item) | the majority serving path |

## Verification Commands (for 2.6a implementation)
```text
pnpm test --filter @iip/db                                    # AC-RETENTION: nullable on insert, legal_hold default false, rollback restores schema
pnpm --filter @iip/db db:generate                             # reconcile migration journal (0001_editorial_log.sql unjournaled — FLAG)
pnpm lint && pnpm typecheck                                   # Biome/ESLint + TS strict
pnpm exec vitest run tests/lint/adr-lint.test.ts              # ADR count (24 or 25 depending on retention-ADR decision)
```

## Open Items for the Human
1. **Native-Filipino annotator sourcing** (Story 2.6b blocker) — procurement call, owner: PM + human. De-prioritized from critical-path under VAL-10.
2. **0.95 threshold calibration** — needs the legal team's "reckless disregard" tolerance to derive τ_doc empirically (Murat's calibration procedure, F8).
3. **Final nullability sign-off** — Option A recommended; confirm before Amelia writes RED tests.
4. **Whether 2.6a authors a retention ADR-0025** (triggers adr-lint bump) or leaves the slot for 2.6b's Filipino-eval ADR-0025. Recommendation: 2.6a authors the retention ADR; 2.6b's Filipino eval becomes ADR-0026.

## Appendix — OQ-9 Measurement Protocol v0.1 (Murat, for ADR-0025/0026)
- **Aggregation:** stratified floor + red-line, never mean/p95. τ_red (instant fail) ≈ 0.50; τ_doc (per-doc pass) ≈ 0.90; τ_stratum = 0.95 applied to the **one-sided Clopper–Pearson 95% lower confidence bound** on the within-stratum pass rate. Filipino stratum scored + reported separately; blended English+Filipino mean forbidden.
- **Sample size:** n ≥ 100 libel-relevant docs minimum (1-failure tolerance), n ≥ 200 target; each stratum ≥ 30. Power note: n ≈ 250 for genuine 0.95-vs-0.90 discriminating power.
- **Pass/fail rule:** `OQ9_PASS = (n≥100 ∧ every stratum≥30) ∧ (∀doc: metric≥τ_red) ∧ (CP_LCB_95(k/n) ≥ 0.95 ∀ metric) ∧ (Fleiss' κ ≥ 0.75) ∧ (LLM-judge↔human κ ≥ 0.70) ∧ (provenance manifest SHA-256 matches) ∧ (detector recall ≥ 0.99)`.
- **CI enforcement:** `eval:smoke` (n=20, merge-blocking per PR) + `eval:full` (n≥200, deploy-blocking on main/release; `--force`, never cached for releases).
- **Annotation provenance:** L1 Filipino speakers, ≥3 annotators/doc, named adjudicator, Fleiss' κ ≥ 0.75 (reject corpus < 0.60), hash covers full provenance manifest not source text. **Circularity firewall:** LLM may NEVER generate/adjudicate gold labels; LLM-as-judge permitted only when calibrated to human (κ ≥ 0.70).
- **Language detection:** primary Lingua (Tagalog model), fallback fastText lid.176; per-span classifier for Taglish; mixed-span defaults Filipino (fail toward stricter DR-4 path). Confidence floor 0.85 → force fallback. Misdetection on a RED-severity item counts against τ_red.
- **DR-4 fallback tests:** property-based trigger + locale-matched disclosure hashing to canonical lawyer-owned value + mutation testing (each mutation must still produce safe behavior) + 100% branch coverage on the fallback path.
- **Clock-skew (relocates with `superseded_at` to ADR-0017 story):** inject future/negative/zero timestamps; assert fail-closed.

## Sign-off
2.6a: BLOCK → READY after ~1 day of doc remediation (epics AC amendment + restore `takedown_trigger` + mark G-2 open). 2.6b: correctly engineered, relabeled salience-gate, blocked on procurement. 2.10 + 2.6c filed as new proposals. Language premise corrected via VAL-10.
