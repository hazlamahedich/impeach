---
id: ADR-027
title: "G-2 Retention Policy — config_history + intake_documents Unbounded Legal-Hold"
status: Accepted
date: 2026-07-06
supersedes: null
superseded_by: null
deciders: [Winston (architect), Amelia (engineer), Murat (test architect), anti lustay (user)]
related: [AC-2, AR-23, VAL-2, VAL-8, PC-2.6, G-2, ADR-001, ADR-003, ADR-017, ADR-025]
evidence:
  # Story 2.10 (2026-07-06). ADR-0027 is the G-2 closure record: it enumerates
  # the retention scope (intake_documents from 2.6a + config_history from this
  # story), pins the unbounded-legal-hold default for config_history, and
  # records the deliberate divergences (no hash-chaining, trigger-based
  # append-only vs role-based REVOKE, no effective_until column). Each entry
  # below is a real artifact produced by Story 2.6a or Story 2.10.
  - _bmad-output/planning-artifacts/architecture.md
  - _bmad-output/planning-artifacts/epics.md
  - _bmad-output/implementation-artifacts/2-6-retention-takedown-schema-filipino-eval-spec.md
  - _bmad-output/implementation-artifacts/2-10-config-history-retention-g2-close.md
  - _bmad-output/implementation-artifacts/story-2-6-review-report.md
  - packages/db/src/schema/config-history.ts
  - packages/db/src/schema/intake-documents.ts
  - packages/db/drizzle/0002_intake_retention.sql
  - packages/db/drizzle/0003_config_history.sql
  - packages/contracts/src/config-history.ts
  - packages/contracts/src/intake/retention.ts
  - packages/config/src/config-history-repo.ts
  - tests/integration/retention-schema.integration.test.ts
  - tests/integration/config-history-schema.integration.test.ts
---

# ADR-027: G-2 Retention Policy — config_history + intake_documents Unbounded Legal-Hold

> **Status: Accepted (2026-07-06, Story 2.10).** This ADR closes **G-2** (the
> retention-policy gate). G-2's closure criteria required every table in its
> scope to carry a `retention_class`/`legal_hold` pair, with up/down migrations
> tested, and an ADR enumerating the scope. `intake_documents` (Story 2.6a)
> and `config_history` (Story 2.10) now both satisfy those criteria. This ADR
> is that enumeration.

## Context

G-2 (VAL-2, see `epics.md` and the Story 2.6 review report F2) is the
**retention-policy gate**: it requires that every table whose rows participate
in the defamation-defense spine carries an explicit, schema-level retention
classification, so that the platform can prove in a Philippine court (RA 10175
/ Civil Code) that it did NOT destroy or alter records that would exonerate or
inculpate it. Spoliation — the destruction or alteration of evidence — is
itself a cause of action under Philippine law; a system that cannot prove
what model/prompt/threshold produced a given answer at the moment of alleged
harm has a spoliation gap.

G-2's scope covers two tables, each with a distinct retention profile:

1. **`intake_documents`** (Story 2.6a): the two-person intake state machine
   record. These rows describe source documents entering the corpus. They
   carry content that may itself be defamatory (an allegedly-libelous
   quotation extracted from a source). Their retention is **conditional**:
   a document may be under `standard` retention, placed under
   `litigation_hold`, or flagged for `immediate_takedown`. The
   `takedown_trigger` column records the removal *rationale* (court_order,
   dmca, editor_retraction) — orthogonal to the class. A `retention_set_at`
   timestamp records when the non-default class/hold was set
   (forgeability-guarded: stamped server-side via an injected clock, never
   accepted from client input). See ADR-001 (defamation-grade operational
   definition) and the Story 2.6 review report for the per-column rationale.

2. **`config_history`** (Story 2.10, this ADR's primary subject): the
   versioned, append-only config-lineage table. Every output-affecting config
   knob change (model IDs, thresholds, k, fusion weights, eval splits) is
   recorded as a new row. Unlike `intake_documents`, config_history's
   retention is **unconditional by design**: the DEFAULT
   `unbounded_legal_hold` is the honest classification — config_history IS
   unbounded legal-hold, because the entire point of the table is to be
   available as evidence for the lifetime of any potential claim (which under
   Philippine defamation law can be years). A fabricated default would be a
   lie that looks like compliance (Winston #2/#20).

**G-2 was OPEN** after Story 2.6a because `config_history` was unbuilt. Story
2.10 builds it, and this ADR records the policy. With both tables in scope
carrying retention metadata, G-2 closes.

## Decision

### 1. config_history is append-only via a `BEFORE UPDATE OR DELETE` trigger (AM-2)

`config_history` is written by `@iip/config` (via `ConfigHistoryRepository`),
NOT by the editorial service. The `editorial_log` migration uses role-based
`REVOKE UPDATE, DELETE FROM editorial_service` — that mechanism is
inapplicable here (no `config_service` role exists, and creating one would
couple retention enforcement to role provisioning, which is a deployment
concern, not a schema concern). Instead, `config_history` uses a
self-contained `BEFORE UPDATE OR DELETE ... RETURN NULL` trigger
(`reject_config_history_mutation()`). The trigger has no role dependency: it
fires regardless of which DB role issues the mutation. This is the
"trigger" alternative in AC #3 of Story 2.10.

### 2. Supersession is recorded by a NEW ROW with `effective_from` (AM-1)

There is **no `effective_until` column**. Temporal validity is derived at
query time: a row is effective from `effective_from` until the
`effective_from` of the next row for the same key. This avoids the
contradiction between append-only (no UPDATE) and closing a previous row's
window (which would require UPDATE). The `getActiveConfigAt(key, time)`
query uses `ORDER BY effective_from DESC LIMIT 1` — the successor's
`effective_from` implicitly closes the predecessor's window.

A unique index on `(config_key, effective_from)` prevents two rows with the
same key + timestamp (the no-fork guarantee for config_history, mirroring
`editorial_log`'s `(partition_key, seq)` composite PK pattern).

### 3. `retention_class` vocabulary is DISTINCT from `intake_documents`

`config_history` uses `unbounded_legal_hold`/`superseded_retain`/
`purged_after_audit` — a DIFFERENT vocabulary from `intake_documents`'s
`standard`/`litigation_hold`/`immediate_takedown`. This is intentional: the
tables serve different purposes, and conflating the vocabularies would
suggest a false equivalence (an `intake_documents` row under `standard`
retention may be purged on a schedule; a `config_history` row under
`unbounded_legal_hold` may NOT). The branded TS types
(`ConfigHistoryRetentionClass` vs `RetentionPolicy`) make this distinction
at the type level (Winston #1) — a `ConfigHistoryRetentionClass` value
cannot be assigned where an `intake_documents` `RetentionPolicy` is expected.

### 4. `legal_hold` CHECK constraint enforces the "never purge" pin (AC #2)

```sql
CHECK ("legal_hold" = true OR "retention_class" = 'purged_after_audit')
```

This is the schema-level enforcement of the unbounded-legal-hold default.
The DEFAULT `true` on `legal_hold` + this CHECK = the only legal path to
releasing a row from hold is an explicit audit-driven class transition to
`purged_after_audit`. A `legal_hold = false` on any other class is rejected
at the DB level — not at the application level, not at the ORM level, but at
the PostgreSQL level. This is the strongest available enforcement short of
cryptographic tamper-evidence (see Alternatives).

### 5. No hash-chaining (conscious tradeoff, see Alternatives)

`config_history` is append-only at the DB level (trigger) but NOT
hash-chained at the cryptographic level. This is a deliberate divergence
from `editorial_log` (ADR-001, SEC-6, which uses Ed25519-signed hash-chained
entries). The defamation-defense spine for config_history is the
**trigger-enforced append-only discipline + the retention CHECK + the
unbounded default**, not a cryptographic chain. See Alternatives for the
rationale and Consequences for the follow-up cost.

## Alternatives

### A1. Hash-chained config_history (REJECTED)

**Proposal:** mirror `editorial_log`'s SHA-256 hash chain + Ed25519 signing
for config_history rows.

**Rejected because:**
- **Cost:** every config write would require a signing callback, prev_hash
  lookup, and JCS canonicalization. The editorial log pays this cost because
  every entry is a defamation-grade attribution act; config changes are
  operational, not editorial.
- **Benefit gap:** a hash chain proves *non-repudiation of authorship* (who
  signed what). For config_history, the author is always the system itself
  (via `@iip/config`) — there is no second-party attribution dispute to
  resolve cryptographically.
- **DBA escape hatch:** a PostgreSQL superuser can `ALTER TABLE ... DISABLE
  TRIGGER` and mutate rows regardless. A hash chain would catch this
  post-hoc (via `verifyChain`), but the trigger is already a database-level
  guard, not a cryptographic one — adding a chain changes the threat model
  (DBA tampering) without changing the day-to-day operational property
  (append-only).

**Follow-up:** if tamper-evidence beyond DB-level guards becomes a
legal-defense requirement, a follow-up story should add hash-chaining. The
trigger does not preclude it — a `curr_hash`/`prev_hash` pair could be added
as nullable columns and backfilled.

### A2. Role-based REVOKE instead of a trigger (REJECTED, AM-2)

**Proposal:** create a `config_service` role and `REVOKE UPDATE, DELETE ON
config_history FROM config_service` — mirroring `editorial_log`.

**Rejected because:**
- `config_history` is written by `@iip/config`, which runs inside the API,
  ingest-worker, serve-worker, etc. — processes that already hold the
  application DB role. Introducing a separate `config_service` role would
  require either (a) a separate connection pool per process just for config
  writes, or (b) a role-switching mechanism that is itself a new attack
  surface.
- The trigger is self-contained and role-independent; it cannot be bypassed
  by a misconfigured role grant. This is a stronger property for a table
  whose writers are diverse.

### A3. `effective_until` column for temporal validity (REJECTED, AM-1)

**Proposal:** add an `effective_until` column, set to the successor's
`effective_from` on supersession.

**Rejected because:**
- **Contradicts append-only:** setting `effective_until` on the previous row
  requires an UPDATE, which the trigger rejects. The append-only discipline
  and the `effective_until` model are mutually exclusive.
- **Derived data:** `effective_until` is fully derivable from
  `effective_from` of the next row — storing it is a denormalization that
  invites drift (a row whose `effective_until` does not match the
  successor's `effective_from` is a silent integrity bug).

### A4. Single shared retention vocabulary across all tables (REJECTED)

**Proposal:** use one `retention_class` enum (e.g.
`standard`/`litigation_hold`/`immediate_takedown`) for both
`intake_documents` and `config_history`.

**Rejected because:**
- The tables have fundamentally different retention profiles (see Decision
  §3). A shared vocabulary would force `config_history` into
  `litigation_hold` by default — a label that implies a specific litigation
  event triggered the hold, which is false (config_history is on hold by
  *design*, not by litigation).
- The branded TS types already enforce the distinction at the type level;
  collapsing the vocabularies would erase that enforcement.

## Consequences

### Positive

- **G-2 closes.** Every table in G-2's scope (`intake_documents` +
  `config_history`) now carries retention metadata at the schema level, with
  up/down migrations tested. The closure is honest: `config_history`'s
  default `unbounded_legal_hold` IS the truth (VAL-8), not a fabrication.
- **Spoliation gap closed.** The team can now reconstruct the operational
  state (model IDs, thresholds, k, fusion weights, eval splits) at the
  moment of any alleged harm — proving threshold-at-time-T for AC-2
  reproducibility.
- **Append-only is mechanical, not aspirational.** The trigger enforces
  append-only at the DB level, independent of application discipline or
  role provisioning. A future bug in `@iip/config` that attempts an UPDATE
  will fail loudly, not silently corrupt history.

### Negative

- **No cryptographic tamper-evidence.** A PostgreSQL superuser can disable
  the trigger and mutate rows. This is the same threat model as
  `intake_documents` (which also relies on trigger/role enforcement, not
  crypto). If a defamation defense requires proving the config_history was
  not tampered with by a DBA, this ADR's decision is insufficient — see
  Alternatives A1 (follow-up cost: signing callback + verifyChain).
- **Trigger overhead.** Every UPDATE/DELETE attempt pays a trigger-firing
  cost (negligible for a low-volume table like config_history, but nonzero).
- **No `effective_until` means point-in-time queries require a subquery.**
  `getActiveConfigAt(key, time)` uses `ORDER BY effective_from DESC LIMIT 1`
  rather than a direct `effective_until IS NULL` filter. This is
  index-friendly (the `(config_key, effective_from)` unique index serves the
  scan) but slightly less ergonomic than a direct range query.

### Neutral

- **Vocabulary is stable and explicit.** `config_history` carries its own
  retention vocabulary (`unbounded_legal_hold`/`superseded_retain`/
  `purged_after_audit`) separate from `intake_documents`. This avoids false
  equivalence and keeps each table's policy readable without cross-referencing
  another table's semantics. The CHECK constraints and branded TS types keep
  the vocabulary aligned between code and schema.

### Relationship to other ADRs

- **ADR-001 (defamation-grade operational definition):** config_history is
  the legal-defense prerequisite for AC-2 reproducibility — without it, the
  team cannot prove what model/prompt/threshold produced any given answer.
- **ADR-003 (Drizzle ORM selection):** the schema is defined in Drizzle
  (`packages/db/src/schema/config-history.ts`) with `.$type<>()` branded
  columns, but the CHECK constraints and trigger live in the hand-authored
  SQL migration (Drizzle's schema-definition surface does not cover
  `BEFORE UPDATE OR DELETE` triggers).
- **ADR-0017 (supersession orchestration):** config_history's supersession
  model (new row with `effective_from`) is a simpler instance of the
  mark-don't-delete principle in ADR-0017. ADR-0017 orchestrates graph +
  citation + cache supersession; config_history orchestrates only its own
  temporal validity.
- **ADR-0025 (Filipino eval-set spec):** ADR-0025's reproducibility
  contract requires that the model/prompt/threshold triple be recorded per
  eval run. config_history is the table that record points at — the eval
  run references a `(corpus_version, model_version, gate_version)` triple
  whose components are config knobs tracked here. (ADR-0027 does NOT
  supersede ADR-0025; it extends the reproducibility spine into the
  operational-config layer.)
- **VAL-8 / PC-2.6 (architecture):** VAL-8 defines the config_history
  scope (unbounded legal-hold by design); PC-2.6 defines the config knob
  surface (model IDs, thresholds, k, fusion weights, eval splits) that
  config_history tracks.

**Deliberate non-links (AM-3):** ADR-0023 (AGE RLS) is unrelated to
config_history retention. ADR-0024 (hash-chain concurrency) is not linked
because config_history is NOT hash-chained (see Decision §5 and Alternatives
A1) — the append-only pattern divergence is documented in this ADR's body
without requiring a bidirectional ADR link.

## Open questions

- **OQ-1:** When (if ever) should `config_history` rows transition from
  `unbounded_legal_hold` to `purged_after_audit`? The current policy is
  "never" — but a long-running platform may accumulate decades of config
  history. A retention policy with a defined purge-after-audit cadence may
  be needed; this is a Legal-team decision, not an engineering one.
- **OQ-2:** Should the `acting_principal` column carry an Ed25519 signature
  (like `editorial_log.principal_sub` + `signature`)? Currently it is a
  plain branded `Principal` string. If config_history becomes
  evidence-critical beyond the trigger, per-row signing may be warranted
  (this would also close the cryptographic-tamper-evidence gap in A1).
