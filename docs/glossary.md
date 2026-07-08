# Glossary

> **Seeded 2026-06-23** per Foundation Action Plan P2. Terms marked with
> stable IDs (`T-NNN`) for machine-validated citation (PC-4). This is a
> living document — terms grow with each story. Authority for any term that
> restates a binding amendment remains the cited AC/PD/SC/D/SEC/PC/STR/VAL/ADR
> identifier in `architecture.md`.

---

## T-001 — Defamation-Grade

The platform's central quality standard. Defined operationally in
[ADR-001](adr/0001-defamation-grade-operational-definition.md) as the
conjunction of eight properties: citation-or-silence, source provenance
chain, fact/claim distinction, hash-chained editorial log, trust-tier
visibility, honest non-claims, pre-external presentation gate, and
reproducibility. Not aspirational — every property has a measurable
threshold and a failure mode.

## T-002 — Citation-Or-Silence

The invariant (EI-1, AC-2) that every factual assertion served to any
audience either carries ≥1 valid citation resolving to a stored raw
snapshot + character span, or is suppressed (fail-closed). There is no
uncited-answer path. See [ADR-001](adr/0001-defamation-grade-operational-definition.md) §1.

## T-003 — Render Gate

The mechanical enforcement point (`packages/render`) that fires on every
render — internal or external — and withholds any claim-bearing clause
lacking valid citation support (AC-2, SEC-5). Structurally separate from
`packages/rag` (generation); imports ONLY `@iip/contracts`. Default action
on missing citation: WITHHOLD. See
[ADR-001](adr/0001-defamation-grade-operational-definition.md) §1.

## T-004 — Fail-Closed

The design principle (SEC-5) that when the system cannot verify citation
support, it refuses to serve. "Unavailability > wrongness." The render gate
fails closed under load, under backing-service degradation, and under
threshold-miss. Contrast with "best-effort serving."

## T-005 — CitationTuple

The provenance data structure (AC-4, SC-2) that decouples citation from
embeddings. Schema: `(source_doc_id, span_start, span_end, content_hash)`.
Produced in `ingest`, attached in `rag`, verified at the render gate, scored
in `eval`, preserved across edits by `editorial` (AC-11). Lives in
`packages/contracts` as a zod schema. Hash algorithm defined per ADR-010.

## T-006 — Editorial Log

The append-only, hash-chained, Ed25519-signed audit trail (AC-11, SEC-6)
that records every action creating, modifying, or surfacing content. Each
entry includes the SHA-256 hash of the previous entry (chain) and the acting
principal's signature. No update/delete API exposed
(`EditorialLog.append()` only). Purpose: personal-criminal-exposure defense
under PH cyberlibel. See [ADR-001](adr/0001-defamation-grade-operational-definition.md) §4.

## T-007 — Trust Tier

The source-reliability classification (EI-8, SEC-3) assigned at ingest and
persisted on every graph node and edge. Three tiers: **1 (Primary)** —
government/court/official record; **2 (Secondary)** — reputable media/press
release; **3 (Aggregator)** — news aggregator/social media. Every citation
displays its trust tier to the user. Lone tier-3 allegation about a named
person is never served as established.

## T-008 — Source Verb

The verbatim verb from the source document (EI-3) preserved in attributed
claims: "ALLEGED", "TESTIFIED", "VOTED", "DENIED", "CLAIMED". Never
paraphrased, never softened, never strengthened. Registered in
`lib/citation/source-verbs.ts`. Visual treatment via `<SourceVerbTag>`
component.

## T-009 — Claim

A served assertion tagged as either **fact** (established, corroborated,
sourced to primary record) or **attributed claim** (someone said this —
source verb preserved). The distinction (EI-2, EI-7) is mechanically
enforced at the render layer. Visually: fact = solid border + full ink;
attributed = dashed border + italic + muted. See
[ADR-001](adr/0001-defamation-grade-operational-definition.md) §3.

## T-010 — Binding Amendment

A governance rule in `architecture.md` carrying a stable identifier (AC-1
through AC-11, PD-1 through PD-3, SC-1 through SC-10, SEC-1 through SEC-9,
PC-1 through PC-9, STR-1 through STR-12, VAL-1 through VAL-9). Binding
amendments are the authority — code, comments, and documentation cite them
by ID, never by paraphrase.

## T-011 — Golden Corpus

The versioned, content-addressed test fixture set used for defamation-grade
evaluation. Contains hard negatives, citation traps, plausible-but-wrong
passages, citation-invariant queries, prompt-injection payloads, and
Filipino-language edge cases. Frozen per corpus hash; manifests at
`eval/corpus/golden/v<N>/manifest.json`. Gate-time re-runs are
content-addressed to `eval/gates/<corpus-hash>/`.

## T-012 — Invariant Ledger

The durable registry (`docs/invariant-ledger.yaml`) of architectural
invariants the system must maintain. Each entry (INV-NNN) carries: the
invariant statement, testing techniques, severity (T1 defamation exposure /
T2 credibility / T3 operational), assertion signature, fixtures, and gate
level. Gives testing rules durability beyond the original author. See AC-1,
SC-6, SEC-8, VAL-9, PC-9.

## T-013 — Apache AGE

Apache AGE — the openCypher extension for PostgreSQL. Pinned to
`PG16/v1.6.0-rc0` (release candidate — AGE has no GA release; all upstream
artifacts are `-rc0`). The openCypher path for IIP (SQL:PGQ does not exist
in PG17/18). See [ADR-002](adr/0002-apache-age-version-pin.md).

## T-014 — pgvector

The PostgreSQL extension providing vector similarity search. Pinned to
0.8.x. Configured with HNSW index, `vector(1024)` columns, bge-m3 dense-only
embeddings. See architecture.md §Data Layer.

## T-015 — Pattern Index

The cross-reference registry (`docs/pattern-index.md`, PC-7) linking each
language-level helper (`withTx`, `upsert.ts`, AGE `cypher()` wrapper,
`@iip/llm-router`, `makeEntry`, `EditorialLog.append`) back to its governing
rule + ADR. Bidirectional citation: pattern → rule + ADR.

## T-016 — Pre-External Presentation Gate

The hard gate (FR-5.5, NFR-L-3) that blocks any content from reaching
audiences outside the build team until eight sub-gates pass (G1–G8): corpus
freeze, adversarial pass, hard CI gates, recall split, independent
spot-verification, editorial sign-off, legal clearance, honest-framing
slide. Machine-checkable where possible; human gates recorded in editorial
log. See [ADR-001](adr/0001-defamation-grade-operational-definition.md) §7.

## T-017 — Source

A publishable origin of documents registered in the source registry
(FR-1.1, SEC-3): a government site, a court, a media outlet, a press-release
feed, or a transcript archive. Each source carries a confirmed trust tier
(1 primary → 3 aggregator) — "confirmed" means source-authenticity validated,
not self-declared. The tier is assigned AT INGEST and persisted as a
structural graph property (SEC-3). Upstream feed provenance
(`wire_service`, `original_publisher`) is tracked for EI-2 independence: a
wire-service story syndicated across multiple outlets is NOT independent
corroboration. Stored in the `sources` table (packages/db/src/schema/sources.ts).

## T-018 — Document

A single cleaned, provenance-bearing artifact produced by ingestion (FR-1.5).
A document records `source_id` + `content_checksum` + `raw_snapshot_key` +
fetch metadata; per-artifact provenance (`source_doc_id` + character span) is
wired into the citation package (T-005). Documents are deduplicated by
`content_checksum` (FR-1.3): the same content ingested twice is processed
once. Provenance is decoupled from embeddings (AC-4): re-embedding preserves
the citation. Distinct from `intake_documents` (the SEC-2 gate state): a
`documents` row is the cleaned record post-ingest; `intake_documents` is the
two-person-intake gate state. Stored in the `documents` table
(packages/db/src/schema/documents.ts).

## T-019 — Content Checksum

The SHA-256 hex digest of cleaned document content (FR-1.3, PC-1a). The
dedupe anchor for idempotent ingestion: the same document ingested twice
produces the same checksum and is processed once. 64-char lowercase hex.
Branded `ContentChecksum` in packages/contracts/src/ingest.ts to prevent
transposition with `IntakeContentHash` (raw pre-clean hash) and `CorpusHash`
(editorial-log hash chain).

## T-020 — Raw Snapshot

The immutable, content-addressed (SHA-256) copy of original fetched content
(HTML/PDF bytes + fetch metadata: url, timestamp, headers) written to MinIO
(FR-1.4, NFR-S-5). Off the public serving path. Versioned append-only bucket.
Pointed to by `documents.raw_snapshot_key`. Branded `RawSnapshotKey` in
packages/contracts/src/ingest.ts.

## T-021 — Ingestion Job

The unit of idempotent, observable, resilient ingestion work (FR-1.6,
PC-2.4, NFR-R-1..3). `job_id = sha256(dedupe-anchor)`: re-enqueuing the same
anchor yields the same id, so a crashed-and-retried job resumes rather than
duplicates. Lifecycle: `pending → running → completed` (happy path) or
`→ failed → dead_lettered` (DLQ triage). `state_run_id` is the JOIN key to
the LangGraph checkpoint store (NFR-R-3): resume-after-crash reloads the
graph from the last checkpoint. Stored in the `ingestion_jobs` table
(packages/db/src/schema/ingestion-jobs.ts).

## T-022 — Dedupe Anchor

The stable input to the `job_id = sha256(dedupe-anchor)` hash (PC-2.4,
FR-1.6). Composed from the fields that make a job idempotent (typically
`content_checksum` + `source_id` + stage). Two jobs with the same anchor
produce the same `job_id`, so BullMQ treats the second as a duplicate and
the work runs exactly once. Branded `JobId` in packages/contracts/src/ingest.ts.
