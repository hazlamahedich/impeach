# Epic 2 Prep Sprint — Action Items

**Created:** 2026-06-28
**Source:** Epic 1 Retrospective (`epic-1-retro-2026-06-28.md`)
**Status:** ready-for-dev
**Constraint:** No Epic 2 feature story (2.1-2.9) begins until this prep sprint is complete (Team Agreement A4).

---

## Critical Path Order

Tasks TD3 and TD4 are the highest-leverage. TD3 is timeboxed to a go/no-go within the first 2 days. If TD3 returns "go" (PG17 migration required), convene an epic-planning review before any other Epic 2 story starts.

```
TD3 (RLS spike) ──┬── go   ──→ Epic 2 plan update (add 2.0: PG17 migration)
                  └── no-go ──→ document decision, proceed

TD4 (RED test contract) ──→ defines 2.1 scope ──→ unblocks 2.1
TD2 (sops secrets) ──────→ unblocks 2.2
TD1 (TS error fix) ──────→ unblocks Epic 4 prep, quick kill
TD5 (perf baseline) ─────→ reference point for 2.9
TD6 (ATDD guideline) ────→ process debt, applies to all Epic 2 stories
```

---

## Task TD1 — Clear Pre-Existing TS Error

**Owner:** Amelia
**Priority:** High (quick kill)
**Debt Source:** D1, flagged in 1.10 and 1.11

### Problem
`tests/integration/polyglot-eval-roundtrip.test.ts:213` has a TS2554 error (wrong number of arguments) present at baseline commit `737eb1e`. Not introduced by any Epic 1 story, but blocks clean typecheck and will cause ambiguity when Epic 4 expands eval tests.

### Acceptance Criteria
- [ ] `pnpm typecheck` passes with zero errors (currently 1 pre-existing error)
- [ ] The fix is minimal — correct the argument count at line 213, not a refactor
- [ ] `pnpm test` full regression remains GREEN
- [ ] No other files touched

### Verification
```bash
pnpm typecheck   # 19/19 tasks, 0 errors
pnpm test        # full regression GREEN
```

---

## Task TD2 — Bootstrap sops/age Secrets + Activate Deferred Integration Test

**Owner:** Amelia
**Priority:** High (blocks 2.2)
**Debt Source:** D2, deferred in 1.11

### Problem
Story 1.11 implemented `validateConfig()` / `bootOrDie()` and the sops/age encryption pipeline, but deferred the integration test because no real encrypted secrets exist under `secrets/`. Story 2.2 (per-issued JWT authentication) needs real keys at boot.

### Acceptance Criteria
- [ ] Generate a real age keypair (`age-keygen`)
- [ ] Create `.sops.yaml` with the age backend (already scaffolded in 1.11 — verify)
- [ ] Encrypt a real `.env.sops` with the required env vars (DATABASE_URL, REDIS_URL, MINIO keys, JWT secret stub)
- [ ] Activate the deferred 1.11 integration test: `packages/config/src/secrets.test.ts` bootOrDie decryption path
- [ ] `bootOrDie()` successfully decrypts and validates on boot; fails closed on missing/malformed
- [ ] Document key lifecycle in `docs/ci/secrets.md` (started in 1.11 — complete it)
- [ ] Real age key NOT committed; `.env.sops` committed encrypted; key location documented for operators

### Verification
```bash
# Decryption succeeds with key present
IIP_SOPS_AGE_KEY=<key> pnpm test --filter @iip/config
# Boot fails closed with key absent
pnpm test:integration --filter secrets
```

---

## Task TD3 — AGE RLS Investigation Spike

**Owner:** Winston
**Priority:** High (could reshape Epic 2)
**Debt Source:** D3, latent risk from 1.2

### Problem
Apache AGE `PG16/v1.6.0-rc0` does **NOT** include row-level security (RLS) on graph tables — RLS landed in AGE 1.7.0, which only ships for PG17/PG18. Stories 2.3 (two-person intake state machine) and 2.4 (hash-chained editorial log) may require RLS on graph/editorial tables for access isolation. If they do, Epic 2 must absorb a PG17 migration.

### Investigation Scope
- [ ] Analyze 2.3 two-person intake: does it require graph-table RLS, or can access isolation be enforced at the application layer (packages/ingest state machine + packages/auth)?
- [ ] Analyze 2.4 hash-chained editorial log: does it require RLS on editorial tables, or is append-only with application-layer auth sufficient?
- [ ] If application-layer enforcement suffices for both → document the decision in an ADR, close the spike as "no-go"
- [ ] If RLS is required → draft superseding ADR-002 (PG17 + AGE `PG17/v1.7.0-rc0`), scope the Docker image rebuild, estimate re-validation of 1.2 compatibility proof

### Decision Gate (timeboxed: 2 days)
- **No-go (RLS not needed):** Write ADR documenting application-layer enforcement decision. Spike closes. Epic 2 proceeds as planned.
- **Go (RLS needed):** Draft PG17 migration ADR. Convene epic-planning review with anti lustay, John, Winston. Epic 2 absorbs a new "2.0: PG17 migration" story. Re-baseline TD1 against new image.

### Output
- Decision recorded in `docs/adr/00XX-age-rls-decision.md`
- If go: updated Epic 2 story list with 2.0 PG17 migration story

---

## Task TD4 — Author RED Test Contract for Real Render Gate

**Owner:** Murat
**Priority:** High (defines 2.1 scope)
**Debt Source:** D4, from 1.4 Amendment C and 1.12

### Problem
The Story 1.4 render gate is a deterministic structural stub. It passes the contract test GREEN-by-construction (strips null citations, sets no_evidence). But the REAL citation-or-silence invariant requires validation that doesn't exist yet:

1. **Substring validation** — cited span text must match the source document at (span_start, span_end)
2. **Trust-tier gating** — tier-3 sources rejected; corroboration requirements enforced
3. **Source-document accessibility** — cited source must exist and be retrievable
4. **Corroboration** — claims require sufficient citation coverage
5. **Expired/retracted detection** — citations past TTL or superseded are rejected
6. **Runtime enforcement** — gate invoked on every served response (VAL-9)

### Deliverable
A **specification document** (not runnable code — per Team Agreement A1) at `tests/contract/render-gate-live-contract.md` that defines:

- [ ] Each of the 6 validation concerns as a named test case
- [ ] For each: the input shape, the expected GREEN behavior, the expected RED behavior
- [ ] Property-based test strategies (fast-check arbitraries) for each concern
- [ ] The transition plan: which tests go RED in 2.1, which go GREEN when 2.1 implements
- [ ] INV-001 promotion criteria: what turns it from yellow → green

### Acceptance Criteria
- [ ] Document covers all 6 validation concerns with concrete test cases
- [ ] Reviewed by Winston (architecture) and Amelia (implementation feasibility)
- [ ] 2.1 story file can be authored directly from this contract
- [ ] INV-001 promotion criteria are explicit and checkable

---

## Task TD5 — Perf Baseline k6 Smoke Load Test

**Owner:** Murat
**Priority:** Medium (reference point for 2.9)
**Debt Source:** D5

### Problem
Epic 2 Story 2.9 claims "500 RPS sustained with the citation invariant holding under failure injection." There is no perf baseline from Epic 1 to compare against — we cannot tell if we regressed or what the stack's current ceiling is.

### Acceptance Criteria
- [ ] Write a k6 script at `tools/chaos/baseline-smoke.js` that hits the compose stack's `/healthz` endpoint at 50 RPS for 30 seconds
- [ ] Capture p50, p95, p99 latency and error rate
- [ ] Run against the standing compose stack (from 1.3)
- [ ] Record baseline numbers in `docs/ci/perf-baseline.md`
- [ ] Script is idempotent and re-runnable (not a one-time measurement)
- [ ] k6 added to `tools/chaos` (already a shim workspace from 1.1)

### Verification
```bash
# Compose stack must be running
docker compose -f infra/docker-compose.yml up -d --wait
k6 run tools/chaos/baseline-smoke.js
# Results recorded in docs/ci/perf-baseline.md
```

---

## Task TD6 — Formalize ATDD-as-Specification Guideline

**Owner:** Murat
**Priority:** Medium (process debt, applies to all Epic 2 stories)
**Debt Source:** P1 from retro action items

### Problem
Pre-authored ATDD test scaffolds were defective in 3 of 12 Epic 1 stories (1.1, 1.8, 1.9 — worst case 7 critical defects). Dev time went into rewriting test scaffolds instead of implementing against them.

### Deliverable
A guideline document at `docs/atdd-specification-guideline.md` that formalizes the pattern adopted ad hoc in 1.8 and 1.9:

- [ ] ATDD scaffolds are **specification documents**, not runnable code, for stories touching jsdom, React/Server Components, ESM/CJS boundaries, or any non-trivial test environment
- [ ] Scaffolds MUST include a "Do not copy verbatim" warning header (template from 1.9)
- [ ] Scaffolds define WHAT to test (AC→test traceability, test case names, property strategies), not HOW (no imports, no assertion code)
- [ ] For pure Node/TS test environments (no jsdom/React), scaffolds MAY be runnable (the 1.2/1.6/1.10/1.11 pattern)
- [ ] Dev authors the runnable RED test from the scaffold specification in Task 0
- [ ] Reference this guideline in the `bmad-create-story` template

### Acceptance Criteria
- [ ] Guideline written and reviewed by Amelia (dev perspective)
- [ ] Template warning-header included
- [ ] Referenced in story creation workflow
- [ ] Applies retroactively: Epic 2 stories auto-include the guideline reference
