---
id: ADR-021
title: Process Count Reconciliation — web is Process #6
status: Accepted
date: 2026-06-23
supersedes: null
superseded_by: null
deciders: [Winston (architect), user]
related: [AR-3, STR-2, STR-3, NFR-D-1, ADR-001, ADR-019]
evidence:
  - _bmad-output/planning-artifacts/architecture.md (STR-2, AR-3)
  - _bmad-output/planning-artifacts/epics.md (Story 1.3, 11 services)
  - _bmad-output/planning-artifacts/foundation-action-plan-2026-06-23.md (Winston RISK #6)
---

# ADR-021: Process Count Reconciliation — web is Process #6

## Context

AR-3 names 5 process boundaries: `api`, `ingest-worker`, `serve-worker`,
`audit-worker`, `enqueuer`. But Story 1.3's Docker Compose stack includes a
6th service: `web` (Next.js frontend). The Party Mode review (Winston RISK #6)
flagged this inconsistency: is `web` process #6, a static asset host, or
misclassified? Every STR-2/STR-3 reference and blast-radius matrix depends on
the answer.

## Decision

**`web` is process #6.** The canonical runtime topology is 6 processes, not 5.

### Rationale

1. **Next.js 15 is a server process, not a static host.** RSC (React Server
   Components) fetch data server-side from `/api/v1` in server components
   (UX-DR31). This is a running Node.js process with its own event loop,
   memory space, and failure domain — not a CDN-served static bundle.

2. **`web` has its own healthcheck and lifecycle.** In Docker Compose, it has
   its own container, its own health status, and its own dependency chain
   (`depends_on: api, caddy`). If `web` dies, the frontend is down even if
   `api` is healthy. This is a process-level failure domain.

3. **The blast-radius matrix (AR-28) must account for it.** If `web` dies
   but `api` is alive, the API is still queryable by other clients but the
   primary UI is unavailable. This is a different failure mode than any of
   the original 5.

### Updated Process Topology

| # | Process | Role | Port | Failure Mode |
|---|---------|------|------|-------------|
| 1 | `api` | Fastify 5 public ingress (read-only, post-PD-3) | 3001 | API down → no queries served |
| 2 | `ingest-worker` | Write-path worker, sole AGE writer | — | Ingestion paused; query path live |
| 3 | `serve-worker` | Read-path worker (RAG → render-queue → render) | — | Query path degraded; API returns error |
| 4 | `audit-worker` | Append-only lineage reconcile | — | Audit gap; query path live but unaudited |
| 5 | `enqueuer` | Durable control-plane (Redis Streams) | — | DAG handoff stalled; workers idle |
| 6 | `web` | Next.js 15 frontend (RSC + client) | 3000 | Frontend down; API still queryable |

### AR-3 Correction

AR-3 should read: "**6 process boundaries**: api (Fastify), ingest-worker
(write-path, sole AGE writer), serve-worker (read-path), audit-worker
(append-only), enqueuer (control-plane, Redis Streams), web (Next.js 15
frontend)."

The "5-process split" language throughout STR-2/STR-3 is updated to
"6-process split." The blast-radius matrix (AR-28) must enumerate 2^6 = 64
failure combinations (reduced by dependency constraints).

### Why This Matters for Defamation Grade

The citation-or-silence invariant (ADR-001 §1) must hold across all 6
processes. If `web` renders an assertion that `api` didn't gate (e.g.,
client-side rendering bypasses the server-side render gate), the invariant
is violated. Process #6 must be in the Stryker scope, the chaos suite, and
the blast-radius matrix.

## Consequences

- All references to "5-process split" updated to "6-process split."
- AR-28 blast-radius matrix expanded from 2^5 to 2^6 combinations.
- `web` is included in VAL-9 (gate-invocation-per-served-response) scope.
- STR-2/STR-3 documentation updated to reflect 6 processes.
- Docker Compose `web` service is a first-class process, not an afterthought.

## Alternatives

1. **Classify `web` as a static asset host behind Caddy, not a process.**
   - Rejected. Next.js 15 App Router uses React Server Components that fetch
     server-side from `/api/v1` (UX-DR31); it is a running Node.js process
     with its own event loop and failure domain, not a CDN-served bundle.
2. **Keep the 5-process language and treat `web` as a deployment detail.**
   - Rejected. The blast-radius matrix (AR-28) and VAL-9
     (gate-invocation-per-served-response) depend on enumerating every
     failure domain. Omitting `web` leaves a process outside the Stryker/chaos
     scope where a render-gate bypass could hide.
3. **Fold `web` into `api` as a single process serving both API and SSR.**
   - Rejected. STR-2/STR-3 deliberately separate the read-only public ingress
     (`api`, post-PD-3) from the frontend failure domain; co-locating them
     couples an SSR crash to API availability.

## Open questions

| # | Question | Owner | Trigger |
|---|----------|-------|---------|
| 1 | Should `web` SSR fetches be gated by the same render gate as `api` (shared package) or a client-side mirror? | Architect | Story 2-1 (render gate live) |
| 2 | Does the AR-28 blast-radius matrix tooling enumerate 2^6 combinations automatically? | Test Architect | VAL-9 chaos suite (Epic 2) |
| 3 | Is `web` in-scope for Stryker mutation testing on its render-adjacent code? | Test Architect | PD-3 launch gate |
