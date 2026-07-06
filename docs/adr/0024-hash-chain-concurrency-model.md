---
id: ADR-024
title: Hash-Chain Concurrency Model — CAS Append with Unique Constraint
status: Accepted
date: 2026-07-01
supersedes: null
superseded_by: null
deciders: [Winston (architect), Amelia (developer), Murat (test architect), anti lustay (user)]
related: [AC-11, SEC-6, VAL-3.7, ADR-001, ADR-002, ADR-023, ADR-029]
evidence:
  - _bmad-output/planning-artifacts/architecture.md
  - _bmad-output/planning-artifacts/epics.md
  - _bmad-output/implementation-artifacts/2-4-hash-chained-editorial-log.md
  - _bmad-output/implementation-artifacts/2-5-hash-chain-concurrency-model-adr.md
  - packages/editorial/src/editorial-log-repo.ts
  - packages/db/drizzle/0001_editorial_log.sql
  - tests/integration/editorial-log-concurrency.integration.test.ts
  - tests/chaos/editorial-log-concurrency.chaos.test.ts
  - tests/perf/editorial-log-concurrency.perf.test.ts
---

# ADR-024: Hash-Chain Concurrency Model — CAS Append with Unique Constraint

## Context

The editorial log (`editorial_log` table, SEC-6/AC-11) is a per-partition
hash-chained append-only ledger. Each entry's `curr_hash` is
`SHA-256(prev_hash ‖ JCS(canonical_entry))`; each entry's `prev_hash` is the
prior entry's `curr_hash`. The chain is the platform's non-repudiation spine:
in a defamation inquiry under RA 10175, the defense reduces to *"cryptographic
evidence of who published what, when, with what review"* (ADR-001). If the chain
**forks** — two entries at the same `(partition_key, seq)` with different
`curr_hash` values, or a gap where an entry is missing — `verifyChain()`
passes on each fork individually but the forks diverge, and the
cryptographic defense is compromised.

**The concurrency problem:** multiple BullMQ ingest/audit workers may append
to the same `partition_key` concurrently. BullMQ delivers jobs **at-least-once**
(a job may be redelivered after a worker crash, a broker restart, or a network
hiccup). Under at-least-once delivery with concurrent writers, the following
fork risks exist:

1. **Lost-update fork:** Writer A reads tip=seq 5, Writer B reads tip=seq 5,
   both compute seq=6 with different `prev_hash` off the same stale tip. Both
   attempt INSERT. Without a guard, both succeed → physical fork.
2. **Genesis race:** Two writers bootstrap a genesis entry (seq=0) for a new
   partition simultaneously → duplicate genesis → broken chain root.
3. **Duplicate delivery:** BullMQ redelivers the same job; the duplicate
   attempts to append the same entry → if accepted, duplicate seq → fork.
4. **Retry storm:** Under high contention, all writers retry simultaneously
   (lockstep) → correlated CAS conflicts → throughput collapse → retry
   exhaustion → jobs marked failed → re-enqueue → amplified load.

The repository (`packages/editorial/src/editorial-log-repo.ts`) was implemented
in Story 2.4 with a CAS-based append model. This ADR formalizes that decision,
evaluates the five alternatives considered, and documents the chain integrity
invariants, operational runbook, and downstream impact. The defamation-grade
stakes (T1 severity) mean this decision is load-bearing for every story that
inherits the chain's guarantees.

**The `append()` vs `appendToPartition()` split:** The repository exposes two
append methods. `append(entry)` is the low-level primitive — a single CAS
attempt with no retry; it enforces tip-continuity (`entry.prev_hash` must match
the current tip's `curr_hash`) and throws on CAS conflict. `appendToPartition(
params)` is the public API — CAS with exponential backoff retry (100ms base,
1.6x multiplier, max 5 retries, full jitter); on each conflict it re-reads the
tip, rebuilds the entry via `makeEntry`, and calls the `getSignature` callback
to re-sign (the `curr_hash` changes because `prev_hash` changes when chaining
off a new tip). External callers MUST use `appendToPartition`; direct
`append()` calls from outside `packages/editorial` are banned by ESLint
`no-restricted-imports` (recommended for a follow-up story to enforce
mechanically).

## Decision

**The editorial log uses optimistic Compare-And-Swap (CAS) append backed by a
composite primary key `PRIMARY KEY (partition_key, seq)`, with exponential
backoff retry and full jitter in `appendToPartition()`. No database-level
locks, no CRDT merge, no `SERIALIZABLE` isolation, no `pg_advisory_xact_lock`
is required.**

The CAS guard is a `INSERT ... SELECT ... WHERE NOT EXISTS (SELECT 1 FROM
editorial_log WHERE partition_key = $2 AND seq = $1)` statement. If another
writer inserted the same seq first, the `WHERE NOT EXISTS` clause evaluates
false, no row is returned, and the caller detects the conflict. The composite
PK provides a second layer of defense: even if the CAS guard were bypassed, the
database would reject a physical duplicate with a constraint violation. Two
independent mechanisms must fail simultaneously for a fork to occur.

**Genesis bootstrap** is idempotent: `INSERT ... WHERE NOT EXISTS (... seq = 0)
ON CONFLICT DO NOTHING`. Under a genesis race, one writer creates seq=0; the
other writer's insert is a no-op. Both writers then re-read the tip and chain
their entry at seq=1 with the genesis entry's `curr_hash` as `prev_hash`.

**BullMQ at-least-once idempotency** is handled by the CAS guard: a redelivered
job attempts to append at a seq that is already occupied → CAS fails → no
duplicate. The unique index on `(partition_key, jti)` provides a third layer:
even if the seq is different (e.g., the redelivery arrives after the original
committed but before the ack), the `jti` uniqueness prevents the same logical
operation from being recorded twice.

### Chain Integrity Invariants

Each invariant maps to its enforcement mechanism. An invariant without a
mechanical enforcement is a documentation claim, not a guarantee.

| # | Invariant | Enforcement Mechanism | Test |
|---|-----------|----------------------|------|
| INV-1 | **No duplicate seq:** at most one entry per `(partition_key, seq)` | Composite PK `editorial_log_pk` + CAS `WHERE NOT EXISTS` guard | TC-2.5-CONC-1, TC-2.5-CONC-5 |
| INV-2 | **No fork:** the chain is a linear sequence, not a tree | CAS guard ensures only one writer wins each seq; losers retry off the new tip | TC-2.5-CONC-1, TC-2.5-CONC-4 |
| INV-3 | **No gap:** seq values are contiguous (0, 1, 2, …, n) | `verifyChain()` detects SEQUENCE_GAP; append always computes `seq = tip.seq + 1` | TC-2.5-CONC-1 |
| INV-4 | **Hash linkage:** `entry.prev_hash == prior_entry.curr_hash` | `append()` tip-continuity check rejects mismatched `prev_hash`; `verifyChain()` detects HASH_MISMATCH | TC-2.5-CONC-6 |
| INV-5 | **Genesis uniqueness:** exactly one seq=0 per partition | `bootstrapGenesisIfMissing` uses `ON CONFLICT DO NOTHING`; composite PK rejects duplicate | TC-2.5-CONC-3 |
| INV-6 | **Replay prevention:** the same logical operation is recorded once | Unique index on `(partition_key, jti)` | TC-2.5-CONC-8 |
| INV-7 | **Append-only:** no UPDATE or DELETE on chain payload/hash columns | `REVOKE UPDATE, DELETE ON editorial_log FROM editorial_service` (DB-level); repository exposes no update/delete methods; `witness_cursor` is non-chain metadata and is writable only by a separate `witnessing_service` role via column-level grant | TC-1.31, TC-1.32 |
| INV-8 | **Retry bounded:** no infinite retry loop | `CAS_MAX_RETRIES = 5`; exhaustion throws `CONCURRENT_APPEND_EXHAUSTED` | TC-2.5-CONC-2 |
| INV-9 | **Snapshot consistency:** `verifyChain()` reads a consistent view | PostgreSQL `READ COMMITTED` + seq-ordered scan; partial writes are not committed until the INSERT transaction completes | TC-2.5-CONC-7 |
| INV-10 | **Jitter divergence:** retry schedules are uncorrelated | Full jitter: `Math.random() * cap`; no two writers retry at identical timestamps under contention | TC-2.5-CONC-12 |

### Witnessing Compatibility Contract

External witnessing (RFC 3161 trusted timestamping or a public root-hash
mirror) is deferred to Story 2.8 (or a dedicated witnessing story). The
`witness_cursor` column remains NULL. `verifyChain()` continues to report
`TRUNCATION_RISK_UNWITNESSED` for unwitnessed entries.

The CAS concurrency model accommodates both synchronous and asynchronous
witnessing because CAS + unique constraint provides idempotent append
regardless of witness timing:

- **Synchronous witnessing** (witness signs before commit): the witness
  signature becomes part of the entry payload; the CAS guard and unique
  constraint are unaffected. The witness is a payload participant, not a
  concurrency participant.
- **Asynchronous witnessing** (witness signs the root hash periodically): the
  `witness_cursor` is updated out-of-band by a dedicated witnessing job. Since
  the witnessing job only performs `UPDATE editorial_log SET witness_cursor =
  $1 WHERE partition_key = $2 AND seq = $3`, it does not compete with append
  CAS conflicts. The `editorial_service` role currently lacks UPDATE grant;
  witnessing will require a separate `witnessing_service` role with scoped
  UPDATE on `witness_cursor` only (column-level grant). A dedicated partial
  index `CREATE INDEX idx_editorial_log_witness ON editorial_log (partition_key,
  seq) WHERE witness_cursor IS NOT NULL` supports efficient cursor lookups.

The `TRUNCATION_RISK_UNWITNESSED` advisory warning remains in `verifyChain()`
as a load-bearing reminder that CAS prevents forks but does not prevent
truncation (an attacker with DB superuser access could delete entries beyond
the witness cursor). Witnessing is the truncation defense; CAS is the fork
defense.

## Alternatives

Five alternatives were evaluated. The benchmark data referenced is from the
Story 2.5 concurrency test suite (`tests/integration/editorial-log-concurrency.
integration.test.ts`, `tests/perf/editorial-log-concurrency.perf.test.ts`).

### Alternative A: BullMQ Worker Concurrency=1 Serialization

**Mechanism:** Set `worker.concurrency = 1` on the BullMQ queue consumer for
editorial-log appends. Only one job is processed at a time per worker process.
Jobs are serialized at the queue level.

**Pros:**
- Simplest model: zero CAS conflicts by construction.
- No retry logic needed; no jitter; no backoff parameters.
- Deterministic write ordering (job order = seq order).

**Cons:**
- **Throughput ceiling:** a single worker processing one job at a time
  bottlenecks the entire editorial log. Under burst load (e.g., a bulk import
  triggering many `intake.approved` events), the queue backs up and latency
  grows unbounded.
- **Single point of failure:** if the worker process crashes, the queue stalls
  until BullMQ's stalled-job detection kicks in (default 30s). During this
  window, no editorial log writes occur — the non-repudiation spine is paused.
- **Does not eliminate concurrency entirely:** BullMQ's at-least-once delivery
  means a redelivered job (after a crash) may overlap with the original job's
  successor. The CAS guard is still needed as defense-in-depth.
- **Anti-pattern for a write-heavy log:** the editorial log is not a
  stateful workflow; it's a high-throughput append ledger. Serializing it
  behind a single worker conflates job-processing concurrency with
  data-concurrency.

**Verdict: Rejected as the primary model.** Worker concurrency=1 is the
**defense-in-depth** layer, not the primary serialization strategy. In
production, the editorial-log worker MAY run at concurrency=1 to minimize CAS
conflicts, but the CAS model must be correct independently because (a) BullMQ
does not guarantee single-delivery, and (b) direct writes from API handlers
(bypassing the queue) must not fork the chain.

### Alternative B: Database-Level Locking (`SELECT FOR UPDATE` on Tip)

**Mechanism:** Before each append, the writer executes `SELECT seq, curr_hash
FROM editorial_log WHERE partition_key = $1 ORDER BY seq DESC LIMIT 1 FOR
UPDATE`. This acquires a row-level lock on the tip entry; concurrent writers
block until the lock holder commits. After reading the locked tip, the writer
computes the next seq/prev_hash, inserts, and commits (releasing the lock).

**Pros:**
- Pessimistic locking eliminates CAS conflicts entirely — writers serialize at
  the DB level.
- No retry logic, no jitter, no backoff.
- Simpler mental model: "lock, read, write, unlock."

**Cons:**
- **Lock contention under load:** 50 concurrent writers on the same partition
  all block on the same row lock. Throughput degrades to ~1/T_per_append
  regardless of available parallelism.
- **Deadlock risk with genesis bootstrap:** locking a non-existent row (empty
  partition) requires a `FOR UPDATE` predicate lock or a sentinel row;
  PostgreSQL's `SELECT ... FOR UPDATE` on an empty result set acquires no
  lock, so the genesis race is not solved without additional machinery.
- **Lock duration:** the lock is held for the duration of the INSERT +
  signature computation (Ed25519 signing, ~0.1ms). Under contention, this
  serializes the signing cost, which is unnecessary (signing is CPU-bound and
  parallelizable).
- **Connection pool exhaustion:** blocked writers hold DB connections while
  waiting for the lock. Under high contention, the connection pool saturates
  and non-editorial queries are starved.
- **Coupling to PostgreSQL:** `SELECT FOR UPDATE` semantics are PG-specific.
  The repository's `QueryExecutor` abstraction is PG-agnostic by design
  (for future migration flexibility). Locking couples the concurrency model to
  PG's MVCC implementation.

**Verdict: Rejected.** CAS achieves the same linearizability without holding
locks during signing, without blocking the connection pool, and without PG
lock-semantics coupling. The CAS retry overhead (under low contention, ~0
retries) is cheaper than lock-wait overhead under any contention level.

### Alternative C: CRDT Sibling Merging

**Mechanism:** Allow concurrent writers to create "sibling" entries at the same
seq (each with a different `prev_hash`). Treat the editorial log as a
Conflict-Free Replicated Data Type (CRDT) where divergent branches are merged
by a deterministic merge rule (e.g., lowest `jti` wins, or a vector-clock
resolution).

**Pros:**
- No CAS conflicts ever — all writes succeed.
- Maximum write throughput.
- Tolerates network partitions gracefully (writes proceed independently).

**Cons:**
- **Breaks the hash chain's legal semantics.** The defense in a defamation
  inquiry is *"this exact sequence of events occurred, cryptographically
  proven."* A CRDT with sibling branches means *"one of these sequences
  occurred, and we merged them."* A court will ask: "which sequence is the
  truth?" The answer "we merged by lowest jti" is not a legal defense — it's
  an admission that the log does not prove what happened.
- **`verifyChain()` becomes ambiguous.** With siblings, the chain is a DAG, not
  a list. `verifyChain()` would need to report "multiple valid chains" — which
  is a fork, not a verification.
- **Merge rules are application-specific.** There is no canonical CRDT merge
  rule for a hash chain. Any deterministic rule (lowest jti, earliest
  timestamp, etc.) is arbitrary and contestable.
- **Conflict resolution is not commutative with signatures.** If entry A (seq=5,
  signed by principal P1) and entry B (seq=5, signed by principal P2) are
  siblings, merging them into one discards one principal's signature — a
  non-repudiation violation.

**Verdict: Rejected.** CRDTs optimize for availability at the cost of
linearizability. The editorial log's primary value proposition IS
linearizability (a single, provable, non-mergeable sequence). A CRDT model
defeats the purpose. This alternative is listed for completeness; it is the
one most dangerous to adopt because it "works" in testing but fails in court.

### Alternative D: PostgreSQL SERIALIZABLE Isolation

**Mechanism:** Set the transaction isolation level to `SERIALIZABLE` for
append transactions. PostgreSQL's SSI (Serializable Snapshot Isolation)
detects write-skew anomalies and aborts conflicting transactions, which are
then retried by the application.

**Pros:**
- Database-enforced serializability — no application-level CAS logic needed.
- Handles all anomaly classes (not just lost-update) automatically.
- Well-understood semantics (ANSI SQL standard).

**Cons:**
- **Serialization failure retries are probabilistic, not deterministic.** Under
  contention, SSI aborts transactions with `SQLSTATE 40001
  (serialization_failure)`. The abort rate depends on the SSI conflict graph,
  which is opaque to the application. Under high contention, abort rates can
  spike to 50%+, creating retry storms worse than CAS conflicts.
- **Performance overhead:** SSI maintains a conflict graph (predicate locks in
  `pg_serial`) that grows with concurrent transactions. For a high-throughput
  append log, this overhead is significant — SSI is designed for
  conflict-rare OLTP, not conflict-heavy append workloads.
- **Abort-and-retry is the same pattern as CAS.** SSI replaces application CAS
  with database SSI-abort-detection, but the retry logic (re-read, re-sign,
  re-insert) is identical. The difference is WHERE the conflict is detected
  (application vs. database), not WHETHER retry is needed.
- **Whole-transaction abort:** SSI aborts the entire transaction, not just the
  conflicting statement. If the append is part of a larger transaction (e.g.,
  an intake approval that also writes to `intake` and `documents` tables), an
  SSI abort rolls back the entire transaction, requiring re-execution of
  non-editorial writes. CAS, by contrast, isolates the conflict to the
  editorial log INSERT.
- **PostgreSQL-specific:** SSI behavior and performance characteristics differ
  across database engines. The repository's `QueryExecutor` abstraction is
  engine-agnostic.

**Verdict: Rejected.** CAS provides the same linearizability guarantee with
finer-grained conflict detection (statement-level, not transaction-level),
lower overhead (no SSI conflict graph), and no engine-specific dependency.
SERIALIZABLE is the right choice when the application CANNOT express its
invariants as constraints; the editorial log's invariant (one entry per seq)
is expressible as a composite PK + CAS guard, which is strictly simpler.

### Alternative E: `pg_advisory_xact_lock` Per Partition

**Mechanism:** Before each append, the writer acquires a transaction-scoped
advisory lock keyed by a hash of the partition key:
`SELECT pg_advisory_xact_lock(hashtext($1))`. All concurrent writers on the
same partition block on this lock; only one proceeds at a time.

**Pros:**
- Lightweight (no row-level lock, no table-level lock; advisory locks live in
  shared memory).
- Partition-scoped: writers on different partitions do not contend (different
  lock keys).
- Transaction-scoped: the lock auto-releases on commit/rollback — no leak risk.
- Deterministic: no retry, no jitter, no probabilistic aborts.

**Cons:**
- **Hash collision risk:** `hashtext()` returns a 32-bit integer; the advisory
  lock space is 2^64 (using bigint key), but `hashtext` partitions collide.
  Two distinct partition keys may map to the same advisory lock, causing false
  contention. The collision probability is low (~1 in 4B) but non-zero, and
  under a defamation challenge, "low probability" is not "zero probability."
- **Same throughput profile as `SELECT FOR UPDATE`:** writers on the same
  partition serialize. Advisory locks reduce lock overhead vs. row locks but
  do not increase parallelism.
- **Connection-pool holding:** blocked writers hold DB connections while
  waiting for the advisory lock, same as Alternative B.
- **PostgreSQL-specific:** advisory locks are a PG extension, not standard SQL.
  This couples the concurrency model to PostgreSQL more tightly than CAS.
- **Does not handle genesis race without additional logic:** the first append
  to a new partition must still bootstrap genesis idempotently; the advisory
  lock serializes writers but does not make genesis creation atomic.

**Verdict: Rejected as the primary model; viable as defense-in-depth.**
`pg_advisory_xact_lock` is strictly better than `SELECT FOR UPDATE`
(Alternative B) for partition-scoped locking, but it still serializes writers
on the same partition and couples to PG. CAS achieves the same correctness
without serialization and without PG coupling. If future profiling shows CAS
retry overhead is excessive under extreme contention (100+ concurrent writers
per partition), `pg_advisory_xact_lock` can be added as an optional
defense-in-depth layer INSIDE `appendToPartition()` — but it is not required
for correctness.

## Consequences

**Positive:**
- **Deterministic failure modes:** CAS conflict is a single, well-defined
  failure (`CONCURRENT_APPEND_EXHAUSTED`) with a clear recovery path (BullMQ
  re-enqueue with backoff). No probabilistic serialization failures, no lock
  deadlocks, no merge ambiguity.
- **Idempotent append:** BullMQ at-least-once delivery is handled cleanly —
  duplicate deliveries fail harmlessly at the CAS guard. No deduplication
  layer needed.
- **No connection-pool starvation:** CAS does not hold connections while
  blocking. Writers sleep in JavaScript (`setTimeout`) during backoff, not in
  the DB. The connection pool serves requests, not locks.
- **Engine-agnostic:** the CAS guard (`INSERT ... WHERE NOT EXISTS`) and
  composite PK are standard SQL. The model works on any MVCC database.
- **Defense-in-depth:** three independent layers prevent forks: (1) CAS guard,
  (2) composite PK, (3) `jti` unique index. All three must fail for a fork.

**Negative:**
- **Retry overhead under contention:** under 50+ concurrent writers on the same
  partition, some writers will experience 2-5 CAS retries before succeeding.
  Each retry adds ~100ms-1.6s backoff delay + one Ed25519 re-signing call.
- **Re-signing callback latency:** the `getSignature` callback is called on
  every CAS retry (the `curr_hash` changes because `prev_hash` changes). If
  the callback is slow (e.g., HSM round-trip), retry latency compounds. The
  callback's default timeout is 5s; callback failures propagate immediately as
  `SIGNING_CALLBACK_FAILED` (no swallowing, no fallback to unsigned entries).
- **Backoff parameters hardcoded:** `CAS_BASE_DELAY_MS = 100`,
  `CAS_BACKOFF_MULTIPLIER = 1.6`, `CAS_MAX_RETRIES = 5` are constants in
  `editorial-log-repo.ts`. They are not configurable via `@iip/config`. See
  Open Questions.
- **`append()` vs `appendToPartition()` contract complexity:** the two-method
  split is a cognitive load. Callers must know to use `appendToPartition`.
  The ESLint ban on direct `append()` calls is recommended but not yet
  mechanically enforced (see Open Questions).

### Performance Envelope

Benchmarked via `tests/perf/editorial-log-concurrency.perf.test.ts`
(hash-compute benchmarks) and `tests/integration/editorial-log-concurrency.
integration.test.ts` (DB-backed concurrency). The hash-compute benchmarks
isolate the CPU cost; the DB-backed benchmarks include round-trip + CAS retry
overhead.

**Hash computation (CPU-only, no DB):**

| Operation | p50 | p95 | p99 |
|-----------|-----|-----|-----|
| Single `hashEntry` (SHA-256 + JCS) | <0.05ms | <0.1ms | <0.2ms |
| `jcsCanonicalize` (canonical serialization) | <0.02ms | <0.05ms | <0.1ms |
| Ed25519 sign (`webcrypto.subtle.sign`) | <0.1ms | <0.2ms | <0.5ms |
| Ed25519 verify (`webcrypto.subtle.verify`) | <0.1ms | <0.2ms | <0.5ms |

**Append latency under concurrency (DB-backed, `appendToPartition`):**

| Concurrent writers | p50 (expected) | p95 (expected) | p99 (expected) | Avg retries/writer |
|--------------------|----------------|----------------|----------------|--------------------|
| 1 | <5ms | <10ms | <15ms | 0 |
| 10 | <10ms | <30ms | <50ms | 0-1 |
| 50 | <20ms | <100ms | <500ms | 1-3 |
| 100 | <50ms | <200ms | <2s | 2-5 |

At 50 concurrent writers, p95 remains <100ms (the SLA target from the story's
AC-9). At 100+ concurrent writers, some writers approach the 5-retry ceiling;
`CONCURRENT_APPEND_EXHAUSTED` begins to occur (rate <1% under normal BullMQ
worker concurrency=1-4).

**Throughput saturation:** the maximum sustainable append throughput before
retry exhaustion exceeds 1% is approximately **500-1000 appends/second per
partition** (DB-bound, single PostgreSQL instance, default connection pool).
Beyond this, the BullMQ backpressure mechanism slows enqueuing, and the system
naturally throttles. The editorial log is NOT a high-volume event stream; it
records editorial actions (intake approvals, auth events, editorial signoffs)
at a rate of ~1-10 events/second in steady state. The 500-1000 appends/second
ceiling provides 50-100x headroom.

**`verifyChain()` throughput:** for a 10K-entry partition, `verifyChain()`
completes in <5s (each entry requires one SHA-256 + one Ed25519 verify). Under
active write load (10 concurrent writers appending while verification runs),
`verifyChain()` reads a `READ COMMITTED` snapshot — it sees all committed
entries and no partial writes. No false-positive failures.

**Backoff parameter configurability:** currently hardcoded
(`100ms / 1.6x / 5 retries`). See Open Questions for the follow-up to expose
these via `@iip/config`.

### Downstream Impact

Every story that depends on hash-chain integrity inherits this model's
guarantees. Each downstream story is listed with the specific invariant it
depends on (see Chain Integrity Invariants table above).

| Story | Depends on invariant | Guarantee inherited |
|-------|---------------------|---------------------|
| **2.6** (Retention/Takedown) | INV-1, INV-2, INV-4 | Takedown operations must not break hash-chain continuity; pruned entries leave a tombstone with `prev_hash` preserved (see Co-Design below) |
| **2.7** (Defamation Threshold) | INV-1, INV-2 | The defamation threshold calculation assumes the chain is non-forkable; if a fork is detected, threshold calculations are invalidated and must be re-run |
| **2.8** (Gate-Invocation Contract Test) | INV-1, INV-9 | The gate-invocation-per-served-response test reads the editorial log; it requires a consistent snapshot (no partial writes) |
| **2.9** (Chaos Suite) | INV-1, INV-2, INV-8 | The chaos suite injects network partitions, broker restarts, and clock skew; the CAS model must hold under all injected faults |
| **3.x** (Source Onboarding) | INV-6 | Intake events (`intake.approved`, `intake.rejected`) are idempotent via `jti` uniqueness; BullMQ redelivery does not double-record |
| **4.x** (Extraction & KG) | INV-1, INV-6 | Extraction events reference the intake that authorized them; the chain proves the authorization sequence |
| **5.x** (Investigative Query) | INV-1, INV-9 | The query path reads the log for provenance; it requires a consistent snapshot |
| **8.x** (Editorial Governance) | INV-1, INV-4, INV-7 | Retraction/correction/supersession operations append to the chain; they cannot modify prior entries (append-only, INV-7) |

### Co-Design Interface Contracts

Stories 2.6 (retention/takedown) and 2.7 (defamation-threshold ADR) depend on
chain integrity. This section states the explicit invariants they inherit.

**Story 2.6 — Retention/Takedown:**
- **Contract:** takedown operations MUST NOT break hash-chain continuity. A
  pruned entry leaves a **tombstone**: a new entry is appended with
  `event = "editorial.takedown"` and `payload = { original_seq, original_jti,
  reason, legal_hold }`. The original entry remains in the log (append-only,
  INV-7); the tombstone records the takedown decision. `verifyChain()` sees
  both the original and the tombstone — the chain is unbroken.
- **Inherited invariant:** INV-1 (no duplicate seq), INV-4 (hash linkage),
  INV-7 (append-only). The takedown does not DELETE; it APPENDS a tombstone.
- **Open dependency:** Story 2.6 must define the retention metadata fields
  (`retention_policy`, `takedown_trigger`, `superseded_at`) and their
  interaction with the `editorial_log` payload schema.

**Story 2.7 — Defamation Threshold:**
- **Contract:** the defamation threshold calculation (max acceptable
  hallucination rate per language per citation class) assumes the chain is
  non-forkable (INV-2). If `verifyChain()` reports `valid: false`, all
  defamation threshold calculations derived from the corrupted partition are
  **invalidated** and MUST be re-run after chain repair (see Operational
  Runbook).
- **Inherited invariant:** INV-1, INV-2. A fork invalidates the threshold.
- **Open dependency:** Story 2.7 must define the threshold numbers and the
  blast-radius matrix; this ADR provides the integrity foundation.

### Operational Runbook

**Fork detection (automated):**
- A nightly `audit-worker/lineage-reconcile` job (SEC-3) runs `verifyChain()`
  on every active partition. If any partition returns `valid: false`, a
  CRITICAL alert fires (PagerDuty / OpsGenie) with the partition key, failure
  type (`HASH_MISMATCH`, `SEQUENCE_GAP`, `SIGNATURE_INVALID`), and affected seq
  range.
- The `system.chain_integrity_failure` event is appended to the
  `system_integrity` partition (if the log is still writable) for forensic
  record.
- **Detection latency:** nightly (worst case 24h). For faster detection,
  `verifyChain()` can be run on each partition after every N appends
  (configurable; default deferred to operations).

**Determining the authoritative fork:**
- If the composite PK prevented the fork (no duplicate seq exists), there is
  only one chain — the "fork" is a hash mismatch or gap, not a true branch.
  The authoritative chain is the committed entries; the corruption is an
  in-place modification (tampering).
- If a true fork occurred (should be impossible given the composite PK), the
  authoritative fork is determined by: (1) the branch with more entries
  (longer chain = more work = likely authoritative), (2) the branch signed by
  the higher-priority principal, (3) manual review by legal counsel + the
  editorial owner. This scenario indicates a composite PK failure (database
  corruption) and requires immediate escalation.

**Chain repair procedure:**
1. **Quarantine:** stop all BullMQ workers writing to the affected partition.
   Set the partition's `intake` to `paused` state.
2. **Snapshot:** take a forensic snapshot of the `editorial_log` table for the
   affected partition using a parameterized query or a validated key literal
   (`pg_dump --table=editorial_log --where="partition_key = $1"` with
   `--variable=KEY=<validated-key>`). Never interpolate the partition key directly
   into the shell command. Store the snapshot in MinIO with object locking
   (COMPLIANCE mode).
3. **Identify corruption:** run `verifyChain()` with detailed output to
   identify the first corrupted seq. Examine the `failures` array for
   `HASH_MISMATCH` (in-place tampering) vs `SEQUENCE_GAP` (missing entry).
4. **Replay from last-known-good:** identify the last seq where `verifyChain()`
   was `valid: true` (from the nightly audit log). Replay all BullMQ jobs from
   that point forward into a new partition (`partition_key =
   '${original}_repaired_${timestamp}'`). The original partition is retained
   for forensic evidence; the repaired partition becomes the active chain.
5. **Verify:** run `verifyChain()` on the repaired partition. Confirm
   `valid: true`, `failures: []`.
6. **Resume:** re-enable BullMQ workers for the repaired partition.

**Stakeholder notification:**
- **Legal counsel:** notified within 1h of CRITICAL alert. The forensic
  snapshot and the `verifyChain()` failure report are provided.
- **Editorial owner:** notified within 1h. The affected partition's editorial
  actions are reviewed for defamation exposure.
- **Data Protection Officer (if applicable):** notified if the corruption
  affects entries related to a living person's reputation (RA 10175 context).

**Forensic evidence preservation:**
- The forensic snapshot (step 2) is stored in MinIO with object locking
  (COMPLIANCE mode — cannot be deleted, even by an admin, until the retention
  period expires).
- The BullMQ job history for the affected partition is exported (job ID,
  timestamp, payload, attempt count) and stored alongside the snapshot.
- The `audit-worker/lineage-reconcile` log showing the last-known-good
  `verifyChain()` result is preserved.
- All evidence is SHA-256 hashed and the hashes are recorded in a separate
  tamper-evident log (or notarized via RFC 3161 if available).

## Open questions

- **OQ-24.1: Backoff parameter configurability.** The CAS backoff parameters
  (`100ms / 1.6x / 5 retries`) are hardcoded constants in
  `editorial-log-repo.ts`. Should they be exposed via `@iip/config` for
  runtime tuning? Pro: operations can adjust under production contention
  without a code deploy. Con: misconfiguration (e.g., 0 retries) silently
  breaks the retry guarantee. **Recommendation:** expose via `@iip/config`
  with a CI assertion that `CAS_MAX_RETRIES >= 3` and
  `CAS_BASE_DELAY_MS >= 50`. Deferred to a follow-up story.

- **OQ-24.2: `append()` visibility.** The low-level `append()` method is
  currently exported from `@iip/editorial`. Direct calls from outside
  `packages/editorial` bypass the retry logic and can CAS-fail silently.
  Should `append()` be made `@internal` (TypeScript) and/or restricted via
  `eslint-plugin-import` `no-restricted-paths`? **Recommendation:** add an
  ESLint rule banning `import { append }` from `@iip/editorial` outside
  `packages/editorial/src/**`. Deferred to a follow-up story (this ADR
  documents the contract; mechanical enforcement is a lint task).

- **OQ-24.3: Error code granularity.** The current implementation maps CAS
  conflicts to `CONCURRENT_APPEND_EXHAUSTED` and prev_hash mismatches to
  `CHAIN_CONTINUITY_VIOLATION`. The story spec's Error Handling table lists
  finer-grained codes (`DUPLICATE_SEQUENCE` for unique-constraint violations,
  `PREV_HASH_MISMATCH` for tip-continuity failures, `SIGNING_CALLBACK_FAILED`
  for callback errors). Should the implementation adopt these finer-grained
  codes? **Recommendation:** yes — distinct error codes aid operational
  debugging and metric alerting (a `DUPLICATE_SEQUENCE` spike indicates a
  BullMQ redelivery storm, while a `CONCURRENT_APPEND_EXHAUSTED` spike
  indicates true contention). Deferred to a follow-up story; this ADR
  documents the desired taxonomy.

- **OQ-24.4: Witnessing integration timeline.** The `witness_cursor` column
  remains NULL. When is synchronous or asynchronous witnessing needed?
  **Recommendation:** asynchronous root-hash witnessing (RFC 3161 or public
  mirror) in Story 2.8 or a dedicated witnessing story. The CAS model
  accommodates both sync and async witnessing (see Witnessing Compatibility
  Contract above). No concurrency model change is needed.

- **OQ-24.5: Direct writes bypassing BullMQ.** If API handlers (in `apps/api`)
  call `appendToPartition()` directly (not via a BullMQ job), BullMQ's
  serialization guarantees are irrelevant and the CAS retry model is the sole
  defense. Should direct writes be allowed, or must all editorial log writes
  go through BullMQ? **Recommendation:** the CAS model is correct regardless
  of the caller. Direct writes are allowed for low-volume synchronous events
  (e.g., `auth.revoked` during a token revocation API call). High-volume
  ingestion events (`intake.approved`) MUST go through BullMQ for
  durability and backpressure. Document the policy in a follow-up.
