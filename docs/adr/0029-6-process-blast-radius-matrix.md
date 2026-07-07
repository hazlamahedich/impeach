---
id: ADR-029
title: "6-Process Blast-Radius Matrix — Partial-Failure Enumeration for the Citation-or-Silence Invariant (AR-28, VAL-3.5)"
status: Accepted
date: 2026-07-06
supersedes: null
superseded_by: null
deciders: [Winston (architect), Murat (test architect), Mary (analyst), Amelia (engineer), John (PM), anti lustay (user)]
related: [AR-28, VAL-2, VAL-3.5, AC-2, SC-3, SEC-5, STR-2, STR-3, INV-001, ADR-001, ADR-021, ADR-024]
evidence:
  # Story 2.7 (2026-07-06). ADR-0029 enumerates the partial-failure states of
  # the 6-process topology (ADR-021) and classifies each as Acceptable
  # (Fail-Closed/Graceful) or Chargeable (Catastrophic) with respect to the
  # citation-or-silence invariant (INV-001 / AC-2). VAL-2 (architecture.md
  # L564) escalated the absence of this matrix to Critical: "which N-of-5
  # failure combos are acceptable vs chargeable; 'no uncited path' must hold
  # under partial failure (when api or audit-worker dies, not just happy-path
  # — an audit-worker death that silently drops audit events is a
  # defamation-grade catastrophe)." This ADR is that matrix. The evidence
  # standard is exhaustive enumeration with manual reasoning per equivalence
  # class (NOT formal verification — see §3). The matrix references the numeric
  # thresholds in ADR-0028 for the definition of "chargeable."
  - _bmad-output/planning-artifacts/architecture.md
  - _bmad-output/planning-artifacts/epics.md
  - _bmad-output/implementation-artifacts/2-7-defamation-threshold-blast-radius-adrs.md
  - docs/adr/0001-defamation-grade-operational-definition.md
  - docs/adr/0021-process-count-reconciliation.md
  - docs/adr/0024-hash-chain-concurrency-model.md
  - docs/adr/0028-numeric-defamation-threshold.md
  - packages/render/src/gate.ts
  - tests/contract/render-gate-live-contract.md
---

# ADR-029: 6-Process Blast-Radius Matrix — Partial-Failure Enumeration for the Citation-or-Silence Invariant (AR-28, VAL-3.5)

> **Status: Accepted (2026-07-06, Story 2.7).** This ADR enumerates the
> partial-failure states of the 6-process topology (ADR-021) and classifies each
> as **Acceptable** (Fail-Closed/Graceful) or **Chargeable** (Catastrophic) with
> respect to the citation-or-silence invariant (**INV-001 / AC-2**: every served
> factual assertion carries a valid citation OR is suppressed).
>
> VAL-2 (`architecture.md` L564) escalated the absence of this matrix to
> **Critical**: *"which N-of-5 failure combos are acceptable vs chargeable; 'no
> uncited path' must hold under partial failure (when api or audit-worker dies,
> not just happy-path — an audit-worker death that silently drops audit events
> is a defamation-grade catastrophe)."* The "5-process" language in VAL-2 is
> superseded by the **6-process** reconciliation in ADR-021 (`web` is process
> #6); this ADR enumerates 2^6 = 64 combinations, reduced by structural
> dependencies (§2).
>
> **The evidence standard is exhaustive enumeration with manual reasoning per
> equivalence class — NOT formal verification (§3).** ADR-0028 defines the
> numeric thresholds that make a state "Chargeable"; this ADR enumerates the
> states.

## Context

### 1. The 6 processes and their failure domains (per ADR-021)

| # | Process | Role | On serving path? | Failure domain |
|---|---------|------|------------------|----------------|
| 1 | `api` | Fastify 5 public ingress (read-only, post-PD-3) | **YES** — sole public ingress | API down → no queries served |
| 2 | `ingest-worker` | Write-path worker, sole AGE writer | No (write path) | Ingestion paused; query path live |
| 3 | `serve-worker` | Read-path worker (RAG → render-queue → render gate) | **YES** — hosts the render gate | Query path degraded; API returns error |
| 4 | `audit-worker` | Append-only lineage reconcile | No (but health gates serving — §4) | Audit gap; query path live but unaudited |
| 5 | `enqueuer` | Durable control-plane (Redis Streams) | No (control-plane) | DAG handoff stalled; workers idle |
| 6 | `web` | Next.js 15 frontend (RSC + client) | **YES** — primary UI | Frontend down; API still queryable |

**The citation invariant is a serving-path property.** A factual assertion can
only reach a user via `web → api → serve-worker` (the render gate fires inside
`serve-worker`, SC-3). Processes not on the serving path (`ingest-worker`,
`enqueuer`, `audit-worker`) affect *freshness*, *audit completeness*, and
*write-path liveness* — but they do not directly serve citations. Their health
*gates* the serving path (§4: fail-closed on audit-worker death), which is the
core defamation-safety mechanism this matrix encodes.

### 2. The reduction — why 64 collapses to a tractable matrix

2^6 = 64 raw combinations (each process UP or DOWN). Structural dependencies
collapse these into **equivalence classes** that share a classification and a
concrete behavior. The reduction is *not* an approximation — every one of the
64 is enumerated, just grouped.

**Reduction principle:** the citation invariant (INV-001) can only be breached
on the **serving path** (`web → api → serve-worker` + render gate). If the
serving path is DOWN, no assertion is served, and the invariant holds trivially
(nothing served = nothing uncited served). This collapses 40 of the 64
combinations into a single class: "serving path DOWN → Acceptable
(unavailable)."

The remaining 24 combinations (serving path UP in some configuration) are
where the classification depends on `audit-worker` health and the failure
class (§3). These collapse into a small number of sub-cases.

**This is exhaustive enumeration, not sampling.** §4's matrix lists every
equivalence class with the combinations it covers, so a reader can verify no
combination is missing.

### 3. The failure model — 3 classes (AC #6 — Murat/Winston)

A process is not simply "UP" or "DOWN." The Story 2.7 party-mode panel
(Winston/Murat/Amelia/John) identified three distinct failure classes that
multiply the state space. Each is a **distinct defect** with a different
detection mechanism and a different blast radius.

| Failure class | Definition | Detection mechanism | Blast radius |
|---------------|------------|---------------------|--------------|
| **Crash-stop** | Process is dead (container exited, OOM-killed, crashed). | Healthcheck (Docker Compose `/healthz`); BullMQ stalled-job detection. | The process produces *nothing*. Downstream consumers see a timeout or a connection refused. |
| **Timeout** | Process is alive but unresponsive (hung event loop, GC pause, resource starvation, network partition). | Healthcheck with timeout; BullMQ job TTL; render-gate latency budget (§5). | The process produces *stale or no* output. Downstream consumers block waiting, or hit a timeout and fail. |
| **Corrupt-output** | Process is alive and responsive but returns **invalid data** (e.g., serve-worker renders with citations stripped; audit-worker returns "verified" on unverified content; LLM hallucinates a citation). | Render gate (SC-3) verifies citation support independently; NLI entailment gate (ADR-0008); hash-chain integrity (ADR-0024); SEC-8 red-team battery. | The process produces *wrong* output that looks valid. **This is the most dangerous class** — it is the citation-bypass scenario. |

**Corrupt-output is the defamation-grade failure mode.** A crashed serve-worker
is safe (nothing served); a serve-worker that silently strips citations is a
catastrophe. The render gate (`packages/render/gate.ts`, SC-3) is the
structural defense: it verifies citation support independently of the
generation path, so a corrupt-output serve-worker is caught *unless the render
gate itself is corrupted. Render-gate corruption = Chargeable in every
combination.* The matrix in §4 is stated for the **crash-stop** class (the
baseline); §6 extends each row to the timeout and corrupt-output variants.

## Decision

The Decision is the blast-radius matrix (§4), the fail-closed design
requirement that makes it hold (§5), the timeout/corrupt-output extensions
(§6), the performance budget (§7), and the Story 2.9 traceability contract
(§8). The matrix is exhaustive enumeration by equivalence class, not formal
verification (§3 evidence standard).

### 4. The matrix (crash-stop baseline) — exhaustive enumeration by equivalence class

**Classification legend:**
- **✅ Acceptable (Fail-Closed/Graceful):** the citation invariant holds. Either
  nothing is served (unavailable), or what is served carries valid citations
  with audit intact. Service may be degraded but is not defamation-grade broken.
- **🟡 Acceptable CONDITIONAL on fail-closed design:** the invariant holds *if
  and only if* the api/serve-worker fail-closed when audit-worker is down (§4
  design requirement). If the fail-closed mechanism fails, the state escalates
  to Chargeable.
- **⛔ Chargeable (Catastrophic):** the citation invariant is breached. An
  uncited assertion could reach a user. This is a defamation-grade incident
  (ADR-0028 detection target).

**Shorthand:** A=api, I=ingest-worker, S=serve-worker, U=audit-worker,
E=enqueuer, W=web. `↑` = UP, `↓` = DOWN. `{X,Y}` = "X and Y in any combination."

---

#### GROUP A — Serving path DOWN (S ↓ OR A ↓): 48 combinations. ALL ✅ Acceptable (unavailable).

The citation invariant holds trivially: nothing is served from the query path,
so nothing uncited can be served. These are availability degradations, not
defamation-safety breaches. **Unavailability > wrongness (SEC-5).**

| Row | State | Combos covered | Classification | Concrete behavior |
|-----|-------|----------------|----------------|-------------------|
| **A.1** | S ↓ (A, I, U, E, W any) | 32 | ✅ Acceptable (unavailable) | `serve-worker` dead → render gate never fires → `api` returns `503 Service Unavailable` for `/query` (no answer served). `web` shows error/degraded state. The citation invariant holds: zero responses served from the query path. `ingest-worker`/`audit-worker`/`enqueuer` state is irrelevant to the invariant (they don't serve). |
| **A.2** | S ↑, A ↓ (I, U, E, W any) | 16 | ✅ Acceptable (unavailable) | `serve-worker` alive but `api` (sole public ingress) dead → no external request reaches the serving path. `web` cannot fetch from `/api/v1` → frontend shows error. Even if `serve-worker` processes internally, no user-facing response is emitted. `audit-worker`/`ingest-worker`/`enqueuer` state irrelevant. |

**Subtotal: 48 combinations, all ✅ Acceptable.**

---

#### GROUP B — Serving path UP, W ↓ (S ↑, A ↑, W ↓): 8 combinations. Classification depends on U.

`web` is down (frontend unavailable) but `api` is still queryable by other
clients. The citation invariant applies to *served* content, regardless of
whether `web` is the consumer — so `api`+`serve-worker` must still enforce it.

| Row | State | Combos covered | Classification | Concrete behavior |
|-----|-------|----------------|----------------|-------------------|
| **B.1** | S ↑, A ↑, W ↓, U ↑ (I, E any) | 4 | ✅ Acceptable (frontend down; API invariant holds) | `web` down → primary UI unavailable. `api` still serves queryable clients with citations + audit intact (render gate fires in `serve-worker`; `audit-worker` live). `ingest-worker`/`enqueuer` state affects freshness, not citation safety. Frontend-down is an availability degradation, not a defamation breach. |
| **B.2** | S ↑, A ↑, W ↓, U ↓ (I, E any) | 4 | 🟡 Acceptable **CONDITIONAL on fail-closed** | `audit-worker` down → **`api` MUST fail-closed**: stop serving claims (the `/query` path degrades to search-only or returns `503`), per the §4 design requirement. If fail-closed → ✅ Acceptable (degraded, no unaudited claims served). If `api` continues serving claims without audit → ⛔ **Chargeable** (unaudited claims reach `web`-independent clients). |

**Subtotal: 8 combinations. B.1 (4) ✅; B.2 (4) 🟡 conditional.**

---

#### GROUP C — Serving path fully UP (S ↑, A ↑, W ↑): 8 combinations. Classification depends on U.

This is the operational sweet spot where the design must hold. The citation
invariant is enforced by the render gate on every render (ADR-0007); the
question is whether `audit-worker` health gates the serving path.

| Row | State | Combos covered | Classification | Concrete behavior |
|-----|-------|----------------|----------------|-------------------|
| **C.1** | S ↑, A ↑, W ↑, U ↑ (I, E any) | 4 | ✅ Acceptable (normal or write-path-degraded operation) | Full serving path live + audit live. `ingest-worker`/`enqueuer` state affects only write-path freshness: if `ingest-worker` ↓ or `enqueuer` ↓, no new content is ingested, but already-cited content is served correctly with citations + audit. Claims served carry valid citations (render gate) and are audited (`audit-worker` live). This is the happy path and the write-path-paused path — both citation-safe. |
| **C.2** | S ↑, A ↑, W ↑, U ↓ (I, E any) | 4 | 🟡 Acceptable **CONDITIONAL on fail-closed** | `audit-worker` down → **`api` MUST fail-closed** (same as B.2): the `/query` path stops serving claims (degrades to search-only or `503`), OR the render gate withholds claims whose audit trail is incomplete. If fail-closed → ✅ Acceptable (degraded). If `api`/`serve-worker` continue serving claims without audit → ⛔ **Chargeable** (unaudited claims served to `web` → users). This is the **core defamation-safety requirement** (Dev Notes: "If audit-worker is offline or its queue is saturated, the api and web layers must not continue serving unaudited claims"). |

**Subtotal: 8 combinations. C.1 (4) ✅; C.2 (4) 🟡 conditional.**

---

#### Summary (crash-stop baseline)

| Group | Combos | ✅ Acceptable | 🟡 Conditional | ⛔ Chargeable |
|-------|--------|---------------|----------------|---------------|
| A (serving path down) | 48 | 48 | 0 | 0 |
| B (W down, A up) | 8 | 4 | 4 | 0 (if fail-closed) |
| C (fully up) | 8 | 4 | 4 | 0 (if fail-closed) |
| **Total** | **64** (reduced) | **56** | **8** | **0** (if fail-closed design holds) |

**The matrix reduces to a single load-bearing design requirement:** when
`audit-worker` is DOWN and the serving path is UP, `api`/`serve-worker` MUST
fail-closed (stop serving claims, degrade to search-only or `503`). If that
requirement holds, **no crash-stop combination is Chargeable** — the 8
conditional rows escalate to Acceptable. If it fails, the 8 conditional rows
escalate to Chargeable (unaudited claims served).

### 5. The fail-closed design requirement (the matrix's load-bearing invariant)

**Requirement (binding):** when `audit-worker` is unreachable (crash-stop OR
timeout — §6), the serving path MUST fail-closed for *claim-serving* queries:

- **`api`** degrades the `/query` path: claim-emitting responses return `503
  Service Unavailable` (or a structured "degraded — audit offline" response);
  search-only responses (document listing without extracted claims) MAY continue.
- **`serve-worker`** / render gate: claims whose audit trail is incomplete are
  WITHHELD (the render gate's existing fail-closed behavior, ADR-0007, extended
  to treat "audit-worker unreachable" as a citation-support failure).
- **`web`** renders the degraded state explicitly (honest non-claim, ADR-001 §6).

**Why this is the only load-bearing requirement.** Every other failure
combination is either (a) off the serving path (citation invariant trivially
holds) or (b) on the serving path with audit intact (render gate enforces
citations). The *only* way to breach the citation invariant under crash-stop is
to serve claims while audit is dead. Fail-closed on audit-death closes that path.

**Detection of audit-worker death.** The `api` and `serve-worker` must detect
`audit-worker` unhealthiness within the performance budget (§7). Mechanism:
healthcheck poll (Docker Compose `/healthz`) + a circuit-breaker state in
`@iip/config` that `api` reads on every `/query` request. **For claim-serving
`/query` requests, the serving path MUST perform a fresh health poll per request
(or use a cache only as advisory input, not as the serving decision); any cached
or stale health state must not be used to authorize serving a claim.** If the
fresh poll fails or exceeds the latency budget, `/query` fails-closed. The
cache (>5s background refresh) is retained only for resilience of non-claim paths
and as a fallback when the healthcheck service itself is degraded.

**Transient "audit-worker down + cache stale healthy" state.** While the
health-read is in flight, the serving path may briefly believe `audit-worker` is
healthy. This transient state is classified as **🟡 Acceptable CONDITIONAL** in
the matrix, bounded by the 100ms dependency-check budget. The window is **not**
the 5s cache TTL — the 5s TTL applies only to background advisory refresh. Once
the fresh poll completes, the system fail-closes. ~~The follow-up engineering
story (OQ-29.6) will implement and validate this behavior.~~

> **Implementation (Story 2.11, 2026-07-07 — OQ-29.6 RESOLVED).** The
> fail-closed mechanism is implemented as:
> - `packages/config/src/audit-health.ts` — the circuit-breaker + fresh-poll
>   client. `pollAuditHealthForClaim()` performs the fresh HTTP GET
>   `audit-worker/healthz` per claim-serving request; a 50ms default poll timeout
>   leaves headroom under the 100ms total budget (§7). State machine:
>   Closed → Open → Half-Open → Closed, in-memory per-process (no Redis
>   dependency), exponential backoff 1s → 2s → 4s → 8s → 30s max. Transitions
>   emit `audit.circuit_breaker.opened` / `audit.circuit_breaker.closed` to the
>   editorial log (AC-11).
> - `apps/api/src/routes/query.ts` — the `/query` route performs the fresh poll
>   as its first action; on unhealthy/slow → `503` with `{ error: { code:
>   "degraded", reason: "audit_offline", … } }`. The advisory cache is
>   intentionally NOT consulted for claim serving (AC #2).
> - `packages/render/src/gate.ts` — the render gate reads the circuit-breaker
>   state via an injected `AuditHealthProbe` (single source of truth; SC-3
>   preserved — the gate imports only `@iip/contracts`). When Open, every claim
>   is WITHHELD with an `audit_offline` violation (defense-in-depth).
> - `tests/integration/audit-health-gate.integration.test.ts` — 7 integration
>   tests exercising the real mechanism end-to-end (AC #1, #2, #3, #4, #6, #7).
>
> The 500 RPS chaos verification of this mechanism under load remains Story
> 2.9b's scope, which requires the real serving pipeline + golden corpus.

### 6. Extension to timeout and corrupt-output classes (AC #6)

The crash-stop matrix (§4) is the baseline. The timeout and corrupt-output
classes modify the classification per row.

#### Timeout

A process that times out is treated **identically to crash-stop for
classification purposes**, with one addition: the *detection* must happen
within the performance budget (§7) to avoid blocking the serving path. A
timeout that exceeds the budget is escalated to crash-stop (the process is
declared dead).

- **`audit-worker` timeout** → treated as `audit-worker` ↓ → §5 fail-closed
  fires. The performance budget (§7) ensures the timeout is detected before
  claims are served unaudited.
- **`serve-worker` timeout** → the render gate does not fire → no response
  served → Acceptable (unavailable), same as Row A.1.
- **`api` timeout** → clients (incl. `web`) receive a timeout → no response
  served → Acceptable (unavailable), same as Row A.2.
- **`enqueuer`/`ingest-worker` timeout** → write-path stalled; serving path
  unaffected (serves already-cited content) → Acceptable, same as C.1.

#### Corrupt-output (the defamation-grade class)

Corrupt-output is **always Chargeable if it reaches the user.** The defense is
*detection before serving* — the render gate, the NLI entailment gate, and the
hash-chain integrity check are the structural barriers.

| Corrupt-output process | Classification | Defense |
|------------------------|----------------|---------|
| **`serve-worker` emits a response with citations stripped** | ⛔ **Chargeable if served**; ✅ Acceptable if caught | **Render gate (SC-3)** verifies citation support independently of generation. If the gate catches it → WITHHOLD (Acceptable). If the gate is bypassed or also corrupted → Chargeable. **Render-gate corruption = Chargeable in every combination** (the gate is the last defense). |
| **`serve-worker` emits a hallucinated citation (LLM fabricates a source)** | ⛔ Chargeable if served; ✅ Acceptable if caught | Render gate + **NLI entailment gate (ADR-0008)** + Citation Precision eval (ADR-0028 §4). Detection target = 0.00% (ADR-0028 §1). |
| **`audit-worker` returns "verified" on unverified content** | ⛔ Chargeable | **Hash-chain integrity (ADR-0024)** detects a forged audit entry (`verifyChain()` reports `HASH_MISMATCH`). The chain is append-only with Ed25519 signatures; a corrupt audit entry breaks the chain. Nightly `lineage-reconcile` catches it; the editorial log is the forensic record. |
| **`ingest-worker` writes a forged extraction** | ⛔ Chargeable if served | The extraction is stamped with `extractor_version` (model + prompt + schema); the render gate verifies the citation resolves to a stored raw snapshot (ADR-001 §2). A forged span fails the snapshot + span containment check. |
| **`api` corrupts a response on the way out** | ⛔ Chargeable | The render gate fires *inside* `serve-worker` (before `api` sees the response). If `api` corrupts after the gate, the citation is already verified — but response tampering is detected via the served-response envelope hash (VAL-9, Story 2.8). |
| **`web` renders client-side bypassing the server-side gate** | ⛔ Chargeable | **ADR-021 Open Question #1** (binding resolution): `web` SSR fetches MUST be gated by the same render gate as `api` (shared package). Client-side rendering MUST NOT bypass the gate. A client-side bypass is a defect, not a design choice. |

**Corrupt-output summary:** the matrix's defense-in-depth is the render gate
(the last mechanical barrier) + the NLI entailment gate + hash-chain integrity.
If all three hold, corrupt-output is caught before serving. If any one fails,
the state is Chargeable — and the failure is a P0 incident (ADR-0028 §5).

### 7. Performance budget for blast-radius dependency checks (AC #6 — performance)

**Requirement:** blast-radius dependency checks (e.g., "is `audit-worker`
healthy enough to serve claims?") MUST complete within a defined latency bound
to avoid cascading citation suppression.

- **Budget: 100ms p99** for the health-read that gates each claim-serving `/query`
  request. This covers: reading the advisory circuit-breaker state from
  `@iip/config` (in-memory read, <1ms) + a **fresh** healthcheck poll before
  serving a claim (HTTP `/healthz` with a 50ms timeout). The background cache
  refresh (>5s TTL) is advisory-only and does not gate claim serving.
- **Behavior on budget exceed:** if the fresh health-read does not complete
  within 100ms, the system **fails-closed** (treats `audit-worker` as unhealthy
  → `/query` degrades). A slow dependency check that causes citation suppression
  is a *correctness* behavior (fail-closed), not just a performance regression.
  The inverse — a slow check that lets claims through unaudited — is the
  Chargeable defect this budget prevents.
- **Why 100ms.** The render-path p95 latency gate is ≤10s (ADR-005); a 100ms
  dependency check is 1% of that budget. Spending more would erode the
  render-path SLO; spending less risks false-negative healthchecks (a process
  that is slow but alive). 100ms is the balance.
- **Open Question OQ-29.3:** validate the 100ms budget empirically under load
  (Story 2.9 chaos suite — queue-backpressure scenario).

### 8. Traceability to Story 2.9 chaos suite (AC #7 — Murat)

The matrix rows are exercised by specific Story 2.9 failure-injection
scenarios. Without this traceability, Story 2.9 cannot verify what Story 2.7
defines.

| This ADR's matrix row / concept | Story 2.9 chaos scenario that exercises it | How |
|--------------------------------|-------------------------------------------|-----|
| **Row A.1 (serve-worker ↓)** | Story 2.9 AC: "partial-render (serve-worker degraded — fail-closed verified)." | Chaos injects serve-worker degradation; the suite verifies fail-closed (no uncited response served) — Row A.1 behavior. |
| **Row C.2 (audit-worker ↓, serving up)** | Story 2.9 AC: "node-loss (audit-worker dies — no silently dropped audit events)." | Chaos kills audit-worker mid-run; the suite verifies api fails-closed (no unaudited claims served) — Row C.2 conditional → Acceptable. If claims ARE served → Chargeable, suite fails. |
| **§5 fail-closed on audit-death** | Story 2.9 AC: "queue backpressure (render-queue saturated — gate still invoked per Story 2.8)." | Under render-queue backpressure (which can stall audit-worker), the suite verifies the render gate still fires per served response — the §5 mechanism under load. |
| **§6 corrupt-output (serve-worker strips citations)** | Story 2.9 AC: "zero claim-responses return without source attribution (AC-2, SC-6)" under 500 RPS + failure injection. | The chaos suite proves the render gate catches corrupt-output (citation stripping) under load — the §6 defense holds. |
| **§6 corrupt-output (network partition)** | Story 2.9 AC: "partition (network split between api and serve-worker)." | A partition between api and serve-worker is a timeout/crash-stop for the serving path → Row A classification. The suite verifies no uncited response leaks across the partition. |
| **§6 corrupt-output (clock-skew)** | Story 2.9 AC: "clock-skew (hash-chain ordering)." | Clock-skew tests the hash-chain integrity defense (ADR-0024) against corrupt-output on the audit path — §6 audit-worker corrupt-output row. |
| **ADR-0028 thresholds (cross-reference)** | Story 2.9 AC: "citation-drop rate = 0" SLO + "chaos tests block PD-3 gate." | The chaos suite enforces the ADR-0028 detection target (0.00% allegation-as-fact) under failure injection — any citation-drop is a threshold breach. |

**Story 2.9 dependency note:** Story 2.9 is `backlog` (not yet started). The
traceability above is the *contract* — when 2.9 implements its ACs, it must
reference these matrix rows by ID. This ADR does not block on 2.9; it defines
what 2.9 must verify.

## Alternatives

1. **Leave the matrix unspecified; handle partial failure ad hoc.**
   - Rejected (VAL-2). An unspecified matrix means the team cannot reason about
     whether a given failure combo is safe. VAL-2 named this Critical: "an
     audit-worker death that silently drops audit events is a defamation-grade
     catastrophe." The matrix is the systematic enumeration that prevents ad hoc
     reasoning from missing a chargeable combo.

2. **Formal verification (model checking / TLA+) of the 64 states.**
   - Rejected (Winston/Murat, Story 2.7 panel — AC #6). Formal verification of
     a 6-process distributed system with 3 failure classes is a research
     project, not an engineering gate. The evidence standard here is
     **exhaustive enumeration with manual reasoning per equivalence class**
     (§3) — sufficient for defamation-grade reasoning, auditable by a human,
     and verifiable by the Story 2.9 chaos suite (§8). Claiming "formal proof"
     would be dishonest; the ADR states the evidence standard explicitly.

3. **Treat all 64 combinations individually (no equivalence-class reduction).**
   - Rejected. 64 rows with near-identical reasoning is unreadable and
     unmaintainable. The equivalence-class reduction (§2) preserves
     exhaustiveness (every combo is in a class) while making the matrix
     auditable. A reviewer can verify the class sizes sum to 64.

4. **Collapse the 3 failure classes into one (UP/DOWN only).**
   - Rejected (Murat/Winston, Story 2.7 panel — AC #6). Crash-stop, timeout,
     and corrupt-output are distinct defects with different detection mechanisms
     and different blast radii (§3). Collapsing them hides the corrupt-output
     class — the defamation-grade failure mode. The 3-class model multiplies the
     analysis but is load-bearing.

5. **Allow the serving path to continue when audit-worker is down (no fail-closed).**
   - Rejected (Dev Notes, ADR-001 §4). Serving unaudited claims is the
     defamation-grade catastrophe. The §5 fail-closed requirement is the
     matrix's load-bearing invariant; without it, 8 combinations escalate to
     Chargeable.

6. **5-process matrix (pre-ADR-021).**
   - Rejected (AM-1, ADR-021). `web` is process #6 with its own failure domain
     (Next.js 15 RSC). Omitting it leaves a process outside the matrix where a
     render-gate bypass could hide (ADR-021 §"Why This Matters for Defamation
     Grade"). The matrix must enumerate 2^6 = 64, not 2^5 = 32.

## Consequences

- **The blast-radius matrix is exhaustive and auditable.** All 64 crash-stop
  combinations are enumerated via equivalence classes (§4); the 3 failure
  classes extend each row (§6). A reviewer can verify no combination is missing
  (class sizes sum to 64) and no Chargeable combo is mis-classified (the single
  load-bearing requirement in §5 determines the 8 conditional rows).
- **The single load-bearing design requirement is fail-closed on audit-death
  (§5).** When `audit-worker` is unreachable and the serving path is UP,
  `api`/`serve-worker` MUST stop serving claims. This converts 8 conditional
  combinations from 🟡 to ✅. Without it, they escalate to ⛔ Chargeable.
- **Corrupt-output is the defamation-grade class (§6).** The render gate (SC-3)
  is the last mechanical defense; render-gate corruption is Chargeable in every
  combination. The NLI entailment gate (ADR-0008) and hash-chain integrity
  (ADR-0024) are the supporting barriers.
- **The performance budget (§7) is a correctness requirement, not just a
  performance SLO.** A blast-radius dependency check that exceeds 100ms must
  fail-closed — a slow check that lets claims through unaudited is the
  Chargeable defect.
- **Story 2.9 has a traceability contract (§8).** The chaos-suite scenarios
  reference these matrix rows by ID; when 2.9 implements, it verifies the
  fail-closed behavior holds under failure injection.
- **VAL-2's Critical gap (AR-28) is closed.** The "no uncited path" invariant
  (INV-001 / AC-2) is now shown to hold under all partial-failure combinations
  (crash-stop baseline), with the fail-closed requirement (§5) as the
  load-bearing mechanism and the corrupt-output defenses (§6) as the
  defense-in-depth.

## Open questions

| # | Question | Owner | Trigger | Status |
|---|----------|-------|---------|---------|
| 1 | **Circuit-breaker implementation for audit-death fail-closed.** §5 requires `api` to perform a fresh health poll per claim-serving `/query` (or treat any cached state as advisory-only). Where does the circuit-breaker/health client live (`@iip/config`? a dedicated health package?), and what is its Open/Half-Open/Closed transition logic? | Architect + Engineer | Story 2.8 or a dedicated health/circuit-breaker story | **RESOLVED (Story 2.11, 2026-07-07).** Lives in `@iip/config` (`packages/config/src/audit-health.ts`). Closed → Open → Half-Open → Closed, in-memory per-process (no Redis dep), exponential backoff 1s → 2s → 4s → 8s → 30s. |
| 2 | **Timeout thresholds per process for the timeout failure class (§6).** The 100ms budget (§7) is for the dependency healthcheck. What are the per-process timeout thresholds for declaring a process dead (crash-stop escalation)? | Test architect + Engineer | Story 2.9 chaos suite (informs thresholds empirically) | Open — deferred to Story 2.9b chaos verification. |
| 3 | **Validate the 100ms performance budget under load.** §7 sets the dependency-check budget at 100ms p99. Validate empirically under Story 2.9's queue-backpressure scenario; adjust if false-negative healthchecks appear. | Test architect | Story 2.9 chaos suite | Open — deferred to Story 2.9b chaos verification (requires the real serving pipeline + golden corpus). |
| 4 | **`web` client-side render-gate bypass detection (§6).** ADR-021 Open Question #1 (binding) requires `web` SSR to use the shared render gate. How is a client-side bypass mechanically prevented (ESLint rule? runtime check?), and is it in the Story 2.9 chaos scope? | Architect + Test architect | Story 2.9 / a dedicated web-gate story | Open. |
| 5 | **Corrupt-output detection coverage.** §6 lists 6 corrupt-output processes with defenses. Which are covered by existing tests (render gate Stryker 100%, hash-chain verifyChain) and which need new coverage? Is the `api`-corrupts-response case covered by VAL-9 (Story 2.8)? | Test architect | Story 2.8 / Story 2.9 | Partially open — VAL-9 (Story 2.8) covers the `api`-corrupts-response row. |
| 6 | **Serving-path audit health gate implementation.** §5 now requires a fresh health poll per claim-serving `/query`. Implement the `/query` route in `apps/api`, the audit health client, and the fail-closed behavior, then validate with phase-aligned chaos tests under 500 RPS. | Engineer + Test architect | New engineering story (e.g., Story 2.11: Serving-Path Audit Health Gate) | **RESOLVED (Story 2.11, 2026-07-07).** Implemented: `packages/config/src/audit-health.ts` (circuit-breaker + fresh-poll client) + `apps/api/src/routes/query.ts` (fresh-poll pre-handler, 503 fail-closed) + `packages/render/src/gate.ts` (`audit_offline` violation via injected `AuditHealthProbe`). Integration test: `tests/integration/audit-health-gate.integration.test.ts` (7 tests, AC #1/#2/#3/#4/#6/#7). The 500 RPS chaos verification remains Story 2.9b's scope. |
