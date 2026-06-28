---
id: ADR-023
title: AGE Row-Level Security Not Required for Editorial Security Model
status: Accepted
date: 2026-06-28
supersedes: null
superseded_by: null
deciders: [Winston (architect), anti lustay (user)]
related: [ADR-002, SEC-2, SEC-6, SEC-7]
evidence:
  - _bmad-output/planning-artifacts/architecture.md
  - _bmad-output/planning-artifacts/epics.md
  - docs/adr/0002-apache-age-version-pin.md
  - _bmad-output/planning-artifacts/research/technical-graph-db-apache-age-evaluation-2026-06-19.md
  - _bmad-output/implementation-artifacts/epic-1-retro-2026-06-28.md
---

# ADR-023: AGE Row-Level Security Not Required for Editorial Security Model

## Context

Apache AGE `PG16/v1.6.0-rc0` (pinned in ADR-002) does **not** include row-level security (RLS) on graph tables. RLS support landed in AGE 1.7.0-rc0, which ships only for PostgreSQL 17/18. ADR-002 flagged this as a "Medium" risk: *"If RLS on graph tables becomes a requirement, that triggers a PG17 + PG17/v1.7.0-rc0 migration via a new superseding ADR."*

During the Epic 1 retrospective (2026-06-28), the team identified the unresolved RLS question as the single highest-risk unknown for Epic 2 — specifically for Story 2.3 (Two-Person Intake State Machine, SEC-2) and Story 2.4 (Hash-Chained Editorial Log, SEC-6). A spike (TD3) was authorized to resolve the question before any Epic 2 feature story begins.

## Decision

**RLS on graph/editorial tables is NOT required for the current security model. The PG16 + AGE 1.6.0-rc0 pin stands. No PG17 migration is needed for Epic 2.**

The editorial security model enforces access control and non-repudiation through application-layer and cryptographic mechanisms, not through database-level row-level security.

## Alternatives

**Alternative 1: Migrate to PG17 + AGE 1.7.0-rc0 for graph-table RLS.**

Rejected. The security model does not rely on RLS:

- **SEC-2 (Two-Person Intake):** The architecture explicitly describes this as a "*code-enforced* two-person intake state machine" (architecture.md §SEC-2). Enforcement lives in `packages/ingest/src/gate/` (state machine: staging → reviewed_once → approved → extracting → indexed) with Ed25519 signatures from two DISTINCT principals. The extraction worker (`apps/workers/extract/worker.ts`) hard-refuses any document not in 'approved' state, logging `intake.bypass_attempt` to AC-11. This is mutation-tested (SEC-8, ≥90% mutation score): flipping the state check causes every extract test to fail red. RLS would add defense-in-depth but is not the load-bearing control.

- **SEC-6 (Hash-Chained Editorial Log):** Enforcement is append-only semantics + hash-chaining (each entry includes the previous entry's hash) + Ed25519 signatures per acting principal + periodic root hash externally witnessed (RFC 3161 or public mirror). The defense in a defamation inquiry (RA 10175) is *"cryptographic evidence of who published what, when, with what review"* — not database access control. RLS does not strengthen this defense.

- **No multi-tenant isolation requirement.** The platform is a single-team editorial system. All authenticated operators (via per-issued JWT, SEC-1) access the same corpus. The two-person rule is an approval workflow (review → approve), not a data-partitioning boundary. There is no threat model where one operator must be prevented from reading another operator's rows.

**Alternative 2: Add RLS as defense-in-depth on top of application-layer enforcement.**

Rejected for Epic 2, open for re-evaluation in Epic 3+. The cost (PG17 migration, Docker image rebuild, re-validation of the 1.2 compatibility proof, potential AGE 1.7.0-rc0 instability) outweighs the marginal defense-in-depth benefit given that:
- The load-bearing controls (state machine + signatures + hash-chaining) are already cryptographically enforced
- SEC-7 (insider/coercion) is addressed via rotating reviewer pools, escalation on disagreement, and tabletop exercises — not via RLS
- The mutation-test target (SEC-8) already catches state-check bypasses

## Consequences

**Positive:**
- Epic 2 proceeds on PG16 + AGE 1.6.0-rc0 with no migration risk
- No Docker image rebuild or compatibility-proof re-validation needed
- Stories 2.3 and 2.4 are unblocked immediately
- The PG17 migration risk (flagged as "Medium" in ADR-002) is downgraded to "Low — re-evaluate if multi-tenant or per-operator isolation becomes a requirement in Epic 3+"

**Negative:**
- If a future epic introduces per-operator data isolation or multi-tenant partitioning, the PG17 migration cost will need to be absorbed at that point
- RLS would have provided defense-in-depth against direct database access by a compromised application process (but the threat model rates this as lower-priority than insider/coercion, which RLS does not address)

**Monitoring:**
- If Epic 3 (Source Onboarding) or later introduces operator-specific data partitioning, re-evaluate this decision
- The AGE GA re-audit (deferred from Story 1.2) should track whether AGE 1.7.0 stabilizes to a GA release, which would lower the migration cost if needed later

## Open questions

- **OQ-23.1:** If Epic 3+ introduces per-source access control (e.g., Tier-5 partnership sources restricted to specific operators), does that require RLS, or can it be enforced at the application layer (packages/auth scope + packages/ingest gate)? Re-evaluate when Epic 3 stories are authored.
- **OQ-23.2:** Should the nightly `audit-worker/lineage-reconcile` job (SEC-3) eventually cross-check against database-level constraints as a second layer? Currently out of scope; track as potential Epic 8 hardening.
