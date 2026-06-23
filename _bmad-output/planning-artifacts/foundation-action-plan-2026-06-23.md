---
title: 'Foundation Action Plan — Stories 1.1–1.3 Adversarial Review Outcome'
project: impeachment-watch
date: 2026-06-23
author: anti lustay
status: 'Action Required'
scope_classification: Major
triggered_by: 'Party Mode adversarial review + validation (6-agent panel + 4-agent debate)'
agents_consulted:
  - Winston (🏗️ System Architect)
  - Amelia (💻 Senior Software Engineer)
  - Murat (🧪 Master Test Architect)
  - John (📋 Product Manager)
  - Mary (📊 Business Analyst)
  - Paige (📚 Technical Writer)
stories_reviewed: ['1.1', '1.2', '1.3']
total_findings: 90+
blockers_identified: 18
consensus_sequence: 'P0 Define Grade → P1 Invariant Contract → P2 CI Live → P3 Close Blockers → P4 Capture → P5 Governance Tail'
output_actions:
  - 'Re-baseline Stories 1.1/1.2 as DONE (local-only)'
  - 'Demote Story 1.3 to DRAFT (blocked)'
  - 'Execute P0–P5 action sequence before Story 1.4'
  - 'Create docs/invariant-ledger.yaml'
  - 'Write ADR-001 (AGE pin + defamation-grade definition)'
  - 'Wire CI pipeline on a real PR'
---

# Foundation Action Plan — Stories 1.1–1.3

**Date:** 2026-06-23
**Author:** anti lustay
**Project:** Impeachment Watch (IIP)
**Scope:** Major — Foundation re-baseline + blocked-story remediation
**Mode:** Batch

---

## Section 1: Issue Summary

### 1.1 Triggering Event

A Party Mode roundtable of six BMAD agents performed an adversarial review and validation of Stories 1.1 (Turborepo Scaffold), 1.2 (PostgreSQL + pgvector + AGE Compatibility Proof), and 1.3 (Docker Compose Platform Stack). The review produced **90+ findings** across architecture, implementation, testing, product, analysis, and documentation dimensions. A follow-up debate of four agents produced consensus on remediation sequencing.

### 1.2 Core Problem

Three foundation stories carry status labels ("DONE", "READY-FOR-DEV") that are **asserted by the author, not evidenced by an executable environment**. The CI pipeline has never run on GitHub Actions. The single most critical product invariant (citation-or-silence) has no testable representation. Eight editorial-integrity NFRs (EI-1–8) that define the platform's reason for existing have zero architectural reservation in the foundation. The phrase "defamation-grade" — the platform's central quality claim — has no operational definition.

### 1.3 Severity Distribution

| Severity | Count | Description |
|----------|-------|-------------|
| **BLOCKER** | 18 | Must resolve before any further story work |
| **RISK** | 25 | High blast radius if deferred; compounds over time |
| **GAP** | 30 | Missing artifacts, traceability, or reservations |
| **DEBT** | 20+ | Recoverable but accrues interest |

---

## Section 2: Blocker Inventory

### 2.1 Unanimous Blockers (all 6 agents)

| ID | Finding | Stories | Root Cause |
|----|---------|---------|------------|
| **B-01** | CI has never executed on GitHub Actions — all CI-gated ACs are unverified | 1.1, 1.2 | `.github/workflows/ci.yml` exists but has never run against a real PR |
| **B-02** | Story 1.3 ATDD test (`compose-stack.health.test.ts`) is `.skip`'d but story is marked READY-FOR-DEV; CI grep guard for `.skip` either catches this (blocking) or doesn't (toothless) | 1.3 | Self-contradicting enforcement: tooth #1 vs skipped ATDD |
| **B-03** | `scripts/age-migrate.ts` boot runner referenced but not created — Story 1.2's AGE migration has no production application path | 1.2, 1.3 | Cross-story dependency unfulfilled |
| **B-04** | `createDb()` from `@iip/db` shipped untested — workspace linking issue unresolved and undocumented | 1.2 | Deferred blocker wearing debt clothing |

### 2.2 Strong Consensus Blockers (4–5 agents)

| ID | Finding | Primary Flaggers |
|----|---------|------------------|
| **B-05** | No Invariant Ledger (`docs/invariant-ledger.yaml`) — AC-1, SC-6, SEC-8, VAL-9, PC-9 have no durable home | Murat, Winston, Mary |
| **B-06** | Zero requirements traceability from stories to FG1–FG5 / EI-1–EI-8 | John, Mary, Paige |
| **B-07** | EI-1 through EI-8 have zero architectural reservation in foundation stories | Mary |
| **B-08** | "Defamation-grade" undefined operationally — no legal rubric, sign-off authority, or threshold | Mary |
| **B-09** | FR-5.5 (Pre-External Presentation Gate) — a PRD "hard gate" — has no architectural slot | Mary |
| **B-10** | Intake Operators (v1 primary user) entirely absent from stories | Mary |
| **B-11** | Golden corpus empty with no schema — defamation-grade safety net has no bullets | Murat, John, Mary |
| **B-12** | Glossary empty but PC-4/PC-5 mandate CI enforcement against it | Paige |

### 2.3 Structural Blockers

| ID | Finding | Primary Flaggers |
|----|---------|------------------|
| **B-13** | AGE `1.6.0-rc0` (release candidate) in production path with no documented GA upgrade plan or decision owner | Winston, Amelia, John, Mary |
| **B-14** | Boot runner ordering (Drizzle first, AGE second) has no enforced mechanism — "after" is a hope, not a contract | Winston, Amelia |
| **B-15** | Story deviations (4+ in 1.2, 5+ in 1.1) unblessed by VAL amendments — no governance paper trail | Amelia, Mary, Paige |
| **B-16** | AGE version history (1.5.0 → 1.7.0 → 1.6.0-rc0) has no authoritative timeline artifact or ADR | Paige |
| **B-17** | DDoS posture undefined — SEC-9 says "not Caddy" but nobody names what IS the defense | Winston |
| **B-18** | 5-process count (AR-3) inconsistent with 11-service list — `web` is either process #6 or misclassified | Winston |

---

## Section 3: Consensus Action Sequence

The 4-agent debate (Winston, Amelia, Murat, John) produced unanimous convergence on sequencing through structured concession. The principle: **define the grade → write the invariant contract → let CI enforce it → fix what CI exposes → capture what CI proved → govern the tail.**

### P0: Operationally Define "Defamation-Grade" ⏱️ 3 days

**Owner:** Mary (draft), Winston (architecture review), legal counsel (sign-off input)
**Unblocks:** P1, P2, P3, P4 — everything

**Deliverables:**
- One-page operational definition covering:
  - Chain of custody requirements (source → extraction → storage → serving)
  - Citation binding strength (what constitutes valid provenance)
  - Cryptographic provenance requirements (hash chain, signatures)
  - Human-reviewable audit trail format
  - Legal sign-off authority and threshold criteria
- Written as ADR-001 frontmatter content (feeds P4 ADR creation)

**Rationale (consensus):**
- Mary: "The platform's central quality claim has no testable definition."
- Winston: "Determines every storage, replication, and audit requirement downstream. Irreversible if wrong."
- Murat: "The citation invariant is downstream of this definition — can't write the contract without it."
- John: "Can't reorder around a word that has no definition."

**Exit Criteria:**
- [ ] One-page definition document reviewed by all stakeholders
- [ ] Maps to specific EI-1–8 NFRs with measurable thresholds
- [ ] Names the legal sign-off authority
- [ ] Approved by product owner (anti lustay)

---

### P1: Write the Citation Invariant as a Failing RED Test ⏱️ 2 days

**Owner:** John (contract definition), Amelia (test implementation), Murat (test review)
**Depends on:** P0

**Deliverables:**
- Citation-or-silence invariant expressed as a testable contract:
  ```
  GIVEN any rendered assertion
  WHEN citation is present and valid
  THEN the assertion is served (POSITIVE — EI-1)

  GIVEN any rendered assertion
  WHEN citation is absent or invalid
  THEN render output is suppressed — fail-closed (NEGATIVE — AC-2, EI-1)
  ```
- Implemented as a RED test (fails by design — no implementation yet)
- Test asserts: every emitted span has non-null `citation.source_id` (positive) AND no span without `citation.source_id` is emitted (negative)
- Property test scaffold using `fast-check` (PC-9)

**Rationale (consensus):**
- John: "The citation invariant is the product spine. Write it as a contract, not a story."
- Murat: "The testable contract is the thing the ledger locks and CI guards. Invariant before ledger."
- Amelia: "Red before green. Non-negotiable."

**Exit Criteria:**
- [ ] RED test exists in `packages/eval/` or `tests/contract/`
- [ ] Test fails by design (no implementation)
- [ ] `fast-check` dependency pinned at root
- [ ] Property test generator scaffold compiles

---

### P2: Wire CI Pipeline on a Real PR ⏱️ 1–2 days

**Owner:** Amelia (pipeline), all (consume truth)
**Depends on:** P1 (CI should enforce the invariant contract)

**Deliverables:**
- Open a real PR against the repository
- `.github/workflows/ci.yml` executes: build → typecheck → lint → test → contract test (P1)
- Seed `docs/glossary.md` with ~15 terms already in use (removes grep guard contradiction — B-12)
- Fix grep guard contradiction with Story 1.3's `.skip` (B-02): either un-skip with Docker precondition, or add documented exception with VAL amendment
- CI reports truthful red/green status

**Rationale (consensus):**
- Amelia: "CI is not a task. CI is the precondition for 'DONE' to have meaning."
- Murat: "Conceded — ledger without CI enforcement is markdown."
- Winston: "Conceded — CI should be the very next action after the grade ADR, not documentation polish."

**Resolves:** B-01, B-02, B-12, surfaces B-03/B-04 as CI-red failures

**Exit Criteria:**
- [ ] Real PR opened with CI execution
- [ ] CI pipeline runs to completion (green or red — truthful either way)
- [ ] Glossary seeded with terms: AGE, pgvector, golden corpus, pattern-index, binding amendment, render gate, citation tuple, editorial log, trust tier, source verb, claim, fact, attributed, fail-closed, invariant ledger
- [ ] Grep guard contradiction resolved
- [ ] CI-gated ACs from Stories 1.1/1.2 now have executable evidence

---

### P3: Close the 4 Hard Blockers ⏱️ 3–5 days

**Owner:** Amelia (implementation), Winston (architecture review)
**Depends on:** P2 (CI must be live to verify)

**Deliverables:**

**B-03: Create `scripts/age-migrate.ts` boot runner**
- Skeleton exists with TODO + exit code 0 (or full implementation)
- Connects via `packages/db/src/client.ts → createDb()`
- Runs `infra/sql/age/migrations/0001-iip-graph.sql` as superuser AFTER relational Drizzle migrations
- Waits for `postgres` healthcheck before connecting
- Idempotent: guards with `SELECT * FROM ag_graph WHERE name = 'iip_graph'`
- Ordering invariant enforced by mechanism (not comment): healthcheck gate or explicit dependency chain

**B-04: Fix `createDb()` workspace linking + test it**
- Resolve the pnpm hoisting / tsconfig paths issue
- Add unit test: `createDb()` returns `{ db, pool }` with correct types
- Add integration test: `createDb()` connects, runs query, closes cleanly
- Document the root cause and fix in the story's Dev Agent Record

**B-14: Enforce boot runner ordering**
- Document invariant: "Drizzle relational migrations MUST complete and commit before AGE boot migration runs"
- Add invariant test: AGE graph does not exist until Drizzle migrator finishes
- Add failure-mode test: AGE graph exists when Drizzle tries same-named schema → expected error + clean rollback

**B-13: Document AGE rc0 decision + GA upgrade plan**
- ADR-001 (or ADR-002) covers: (a) we accept rc0 risk for defamation-grade platform, (b) what happens when 1.6.0 GA ships, (c) AGE pinned by git SHA `2db2f060a0c2d66c0683d6cf1e2a9af40a0c5f87` in Dockerfile, (d) named upgrade owner
- Timeline: 1.5.0 → 1.7.0 → 1.6.0-rc0 corrections documented with dates, deciders, evidence

**Exit Criteria:**
- [ ] Boot runner exists and is tested
- [ ] `createDb()` tested in unit + integration
- [ ] Migration ordering invariant test passes
- [ ] AGE decision documented in ADR
- [ ] All four blockers show GREEN in CI

---

### P4: Capture — Invariant Ledger + ADRs + Epic Reorder ⏱️ 3–4 days

**Owner:** Murat (ledger), Winston (ADRs), John (epic reorder), Paige (documentation)
**Depends on:** P3 (decisions now evidenced by green CI)

**Deliverables:**

**Invariant Ledger (`docs/invariant-ledger.yaml`)**
- Schema per architecture.md:
  ```yaml
  - id: INV-001
    invariant: "Every served claim resolves to a source citation"
    technique: [property-test, chaos, eval]
    severity: T1
    assertion_signature: "fuzzRenderExports.assertEverySpanHasCitation"
    fixtures: [golden/v1/, fixtures/citation/]
    gate: promotion
  ```
- Seed entries for all T1 (defamation exposure) invariants from AC-1, SC-6, SEC-8, VAL-9, PC-9
- Every deferred promise from Stories 1.1–1.3 converted to INV-NNN with owner + trigger condition

**ADR batch:**
- ADR-001: AGE version pin + defamation-grade operational definition (from P0)
- ADR-002 (amend): AGE `PG16/v1.6.0-rc0` pin correction timeline (authoritative version)
- ADR-003: Drizzle 0.35.x selection rationale (Winston RISK #5)
- ADR-004: DDoS posture — what IS the defense (Winston BLOCKER #3)
- ADR-005: Process count reconciliation — is `web` process #6? (Winston RISK #6)
- ADR-006: Node 22.23.0 bump root cause (Winston DEBT #18)

**Epic reorder (minimum viable):**
- Story 1.12 (Citation-or-Silence Contract Test) promoted — now backed by P1's RED test
- Citation invariant is the first testable user-value artifact in Epic 1
- Docker proof (1.3) drops to support-story position
- Traceability scaffolding: every story gets `traces_to: [FR-X.Y, EI-N, NFR-X]` frontmatter

**Exit Criteria:**
- [ ] `docs/invariant-ledger.yaml` exists with ≥5 T1 invariants
- [ ] ADR-001 through ADR-006 written using PC-3 template, validated
- [ ] Epic 1 story order revised (minimum: 1.12 promoted)
- [ ] Every story has traceability frontmatter
- [ ] Glossary terms cross-referenced in ADRs

---

### P5: Governance Tail ⏱️ Ongoing

**Owner:** Paige (documentation), Mary (requirements), all (consume)
**Depends on:** P4

**Deliverables:**

**Documentation architecture:**
- Global guardrails extracted from Story 1.1 to `docs/architecture/guardrails.md` (Paige GAP #9)
- Pattern Index entries created linking patterns → rules → ADRs (Paige GAP #7)
- Dev Agent Record template formalized (Paige GAP #10)
- Source-of-truth artifact designated per decision class (Paige DEBT #13)

**Golden corpus schema:**
- YAML schema spec for corpus entries (severity, expected-vs-actual citations, gate-decision)
- Ingestion script
- 3 seed entries (1 trivial, 1 adversarial, 1 edge case)

**Requirements traceability:**
- Full matrix: PRD FR → Epic → Story → AC → Test → Verification evidence
- EI-1–8 each have an owning test or explicit deferral ADR
- All 4 placeholder gates (golden corpus, glossary, pattern-index, ADR dir) have content ownership assigned

**Testing infrastructure reservations:**
- `stryker.config.json` empty hull with `render/gate.ts` + `auth/verify.ts` pre-registered (Murat RISK #6)
- `tests/chaos/` directory with failing placeholder (Murat RISK #5 — apex not empty)
- `tests/contract/` for Pact consumer-driven contracts (Murat RISK #10)
- VAL-9 telemetry pipeline: "hello world" OTel span from stub → collector → Tempo, asserted in CI (Murat RISK #11)
- Coverage thresholds set in `vitest.config.ts`: 70% lines, 60% branches (Murat GAP #14)

**Exit Criteria:**
- [ ] Global guardrails extracted and indexed
- [ ] Golden corpus schema + 3 seed entries
- [ ] Requirements traceability matrix complete
- [ ] Stryker/chaos/Pact/OTel scaffolding exists
- [ ] Coverage thresholds enforced in CI

---

## Section 4: Story Status Re-Baseline

### Immediate Status Changes

| Story | Current Status | New Status | Rationale |
|-------|---------------|------------|-----------|
| 1.1 | `done` | `done-local-only` | CI never executed; ACs verified locally only |
| 1.2 | `done` | `done-local-only` | CI never executed; createDb() untested; boot runner absent |
| 1.3 | `ready-for-dev` | `draft-blocked` | ATDD skipped; boot runner missing; grep guard contradiction; 6 BLOCKER-level spec gaps |

### Re-Baseline Conditions

Stories 1.1 and 1.2 return to full `done` status when:
- [ ] CI executes green on a real PR (P2)
- [ ] createDb() tested (P3, B-04)
- [ ] Deviations blessed by VAL amendments or ADRs (P4)

Story 1.3 returns to `ready-for-dev` when:
- [ ] P0–P3 complete
- [ ] ATDD test un-skipped with Docker precondition
- [ ] Boot runner skeleton exists
- [ ] grep guard contradiction resolved
- [ ] Process count reconciled (B-18)
- [ ] DDoS posture documented (B-17)

---

## Section 5: Risk Register (Top 10 Deferred Items)

These items are NOT blocked by the action sequence but MUST be tracked in the invariant ledger with owners and trigger conditions:

| ID | Risk | Owner | Trigger | Mitigation |
|----|------|-------|---------|------------|
| R-01 | AGE rc0 → GA migration breaks graph layer | Winston | AGE 1.6.0 GA release | ADR documents upgrade path; graph rebuild is deterministic (FR-2.4) |
| R-02 | 15+ containers exceed workstation capacity | Winston | `docker stats` > 16GB RAM | Profile memory budget; document minimum spec; compose profiles |
| R-03 | Ollama GPU unavailable on dev machines | Winston | Non-GPU host | `compose.gpu.yml` override; CPU-mode smoke-test-only rule |
| R-04 | Tempo/Prometheus fill workstation disk | Winston | Disk > 80% | Retention config shipped with compose services |
| R-05 | Anti-hollow teeth never verified to bite | Murat | P2 CI live | Mutation drill: comment out tooth targets, confirm RED |
| R-06 | No contract testing for 11-service boundaries | Murat | P3 stack live | Pact broker stub + one consumer-provider pair |
| R-07 | VAL-9 telemetry pipeline unvalidated | Murat | P4 ledger | "Hello world" span stub → collector → Tempo |
| R-08 | Base image `pgvector/pgvector:pg16` not digest-pinned | Amelia | P3 image publish | `FROM pgvector/pgvector@sha256:<digest>` |
| R-09 | Secrets flow into containers undefined | Winston | Story 1.11 | sops+age → env var bridge documented in ADR |
| R-10 | MinIO "off serving path" enforced by docstring only | Winston | P3 network config | Separate bridge network; serve-worker not attached |

---

## Section 6: Debate Concession Log

The consensus sequence was achieved through structured concession. This log preserves the reasoning for future reference.

| Agent | Original Position | Conceded To | Concession |
|-------|------------------|-------------|------------|
| **Murat** | "Invariant ledger FIRST" | Amelia, John | "A ledger nobody enforces is a wishlist. CI is the spine. Invariant before ledger — contract first, documentation second." |
| **John** | "Split Epic 1 FIRST" | Mary, Winston | "Full epic split is half theater. The minimum reorder — citation invariant as first testable artifact — is what matters. Mary's grade definition unblocks my reorder." |
| **Winston** | "ADRs FIRST" | Amelia | "ADRs should capture what CI proved, not speculate ahead. CI goes live after the grade ADR, not after all ADRs." |
| **Amelia** | "CI FIRST, nothing before it" | Winston, John, Murat | "CI on the wrong artifact validates nothing. Grade definition + invariant contract before CI goes live." |

**Converged principle:** Define the grade → write the invariant as a failing test → let CI enforce it → fix what CI exposes → capture what CI proved → govern the tail.

---

## Section 7: Approval

| Role | Name | Decision | Date |
|------|------|----------|------|
| Product Owner | anti lustay | ⏳ Pending | |
| Architect | Winston (AI) | ✅ Endorsed | 2026-06-23 |
| Dev | Amelia (AI) | ✅ Endorsed | 2026-06-23 |
| Test Architect | Murat (AI) | ✅ Endorsed | 2026-06-23 |
| PM | John (AI) | ✅ Endorsed | 2026-06-23 |
| Analyst | Mary (AI) | ✅ Endorsed | 2026-06-23 |
| Tech Writer | Paige (AI) | ✅ Endorsed | 2026-06-23 |

---

*This action plan is the output of a Party Mode roundtable (6-agent adversarial review + 4-agent debate) conducted 2026-06-23. All findings are evidence-grounded against the story artifacts in `_bmad-output/implementation-artifacts/` and the binding architecture in `_bmad-output/planning-artifacts/architecture.md`.*
