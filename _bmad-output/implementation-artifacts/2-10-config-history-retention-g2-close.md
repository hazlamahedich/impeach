---
story_id: '2.10'
story_key: '2-10-config-history-retention-g2-close'
epic: 'Epic 2: Provenance & Invariants'
status: proposed
last_updated: '2026-07-03'
depends_on:
  - '2-6-retention-takedown-schema-filipino-eval-spec'
---

# Story 2.10: config_history Build + Retention (the real G-2 close) (PC-2.6, AR-23, VAL-2, VAL-8)

Status: proposed

> **This story is the honest close of VAL-2 G-2.** Story 2.6a encoded retention on `intake_documents` only and left G-2 **OPEN** because `config_history` — the operational config lineage table (PC-2.6) — does not exist yet. `config_history` is the table that answers *"what was this system configured to do when claim #C was served?"* — it is the proof substrate for every claim the platform touches. Undefined/destructible retention on it is **spoliation liability** under Philippine defamation law (Civil/Cybercrime §4(c)(4)). VAL-8 explicitly flagged that G-2 was scoped too narrowly without it. G-2 stays open until this story lands.

## Story

As a **compliance officer and architect**,
I want `config_history` built as a versioned, append-only config-lineage table with unbounded legal-hold retention encoded at the schema level,
so that the system can reconstruct its operational state at the moment of any alleged harm, and G-2 closes honestly.

## Acceptance Criteria

### Behavioral (stakeholder-verifiable)

1. **config_history table exists (PC-2.6):**
   - **Given** the `@iip/config` package,
   - **When** an output-affecting config knob (model IDs, thresholds, k, fusion weights, eval splits) changes,
   - **Then** the previous + new value, the timestamp, and the acting principal are recorded in a `config_history` table, proving threshold-at-time-T for AC-2 reproducibility.

2. **Retention encoded at the schema level (G-2 close):**
   - **Given** the `config_history` Drizzle schema,
   - **When** a row is stored,
   - **Then** it carries:
     - `retention_class` (branded, vocab: `unbounded_legal_hold` default, `superseded_retain`, `purged_after_audit`) — `NOT NULL DEFAULT 'unbounded_legal_hold'` (config_history is unbounded legal-hold *by design* per VAL-8; this is the one table where the default is NOT a fabrication).
     - `legal_hold` (boolean, `NOT NULL DEFAULT TRUE`) — the enforced "never purge" pin.
   - **And** a CHECK or trigger forbids `legal_hold` from going false unless `retention_class` has transitioned via an audited path.

3. **Append-only discipline (mirrors editorial_log, DoD-17):**
   - **Given** `config_history`,
   - **When** any attempt to UPDATE or DELETE a row occurs,
   - **Then** it is rejected at the PostgreSQL level (revoked privileges / trigger), consistent with `editorial_log` (DoD-17). Supersession is recorded by a *new row* with `effective_from`/`effective_until`, never by mutating history.

4. **G-2 closure criteria satisfied:**
   - **Given** the G-2 closure boolean (see review report F2),
   - **When** this story completes,
   - **Then** every table in G-2's scope (`intake_documents` from 2.6a **AND** `config_history` from 2.7) has a retention_policy/class column + legal_hold; up/down migrations exist and are tested; the G-2 ADR text enumerates `config_history`; and a backfill guarantees no row has undefined retention. **G-2 may then be marked CLOSED.**

## Tasks / Subtasks

- [ ] **Task 1: Build the config_history table (PC-2.6)**
  - Author `packages/config/src/telemetry/config_history/` (schema + versioning write-path + read API), or a Drizzle schema in `packages/db` per STR-1.
  - Columns: `id`, `config_key`, `old_value` (jsonb, nullable), `new_value` (jsonb), `effective_from` (timestamptz), `effective_until` (timestamptz, nullable), `acting_principal`, `retention_class`, `legal_hold`, + audit fields.
  - Revoke UPDATE/DELETE at the PG level (DoD-17 pattern from `editorial-log.ts`).
- [ ] **Task 2: Retention columns + invariant**
  - `retention_class` NOT NULL DEFAULT `'unbounded_legal_hold'` with CHECK vocabulary.
  - `legal_hold` NOT NULL DEFAULT TRUE; trigger/guard preventing un-audited un-hold.
- [ ] **Task 3: ADR + adr-lint**
  - Author the G-2 retention ADR (covers BOTH `intake_documents` and `config_history` scope); bidirectional links per PC-3.
  - Update `tests/lint/adr-lint.test.ts` count if a new ADR lands.
- [ ] **Task 4: Migrations + tests**
  - Up + DOWN migration (DROP order: index → columns; whole table for rollback).
  - Integration test: append-only enforcement (UPDATE/DELETE rejected), retention defaults, legal_hold invariant, backfill leaves no undefined-retention row.
- [ ] **Task 5: Wire the versioning write-path**
  - `@iip/config` writes to `config_history` on every output-affecting knob change (AC-2 reproducibility).

## Dev Notes

- **G-2 closure lives here, not in 2.6a.** Until 2.7 lands, G-2 is OPEN-with-plan.
- **Effort estimate:** ~3–5 days (new package: schema, versioning write-path, read API, ADR, tests, retention) — NOT "a few columns."
- The Drizzle conventions to follow are in `packages/db/src/schema/intake-documents.ts` (branded `.$type<>()`, JSDoc `@rules/@adr/@term`) and `packages/db/src/schema/editorial-log.ts` (append-only, index patterns).
- `config_history` does NOT get `takedown_trigger` (no public-facing artifact to take down) and does NOT get a `superseded_at` (it records its own supersession natively via `effective_from`/`effective_until`).

## References
- [Story 2.6 Review Report (F2)](file:///Users/sherwingorechomante/impeach/_bmad-output/implementation-artifacts/story-2-6-review-report.md)
- [Architecture: VAL-8 config_history scope](file:///Users/sherwingorechomante/impeach/_bmad-output/planning-artifacts/architecture.md#L570)
- [Architecture: PC-2.6 config surface](file:///Users/sherwingorechomante/impeach/_bmad-output/planning-artifacts/architecture.md#L300)
- [editorial_log schema (append-only pattern)](file:///Users/sherwingorechomante/impeach/packages/db/src/schema/editorial-log.ts)

## Dev Agent Record
### Agent Model Used
(Pending)
### Completion Notes List
- Story 2.10 proposed 2026-07-03 from the Story 2.6 party-mode adversarial review. (Renumbered from 2.7 to avoid collision with the existing epic Story 2.7 "Defamation Threshold & Blast-Radius ADRs".)
## QA Results
*(Pending implementation)*
