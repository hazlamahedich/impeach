---
id: ADR-004
title: DDoS and Attack Posture for IIP v1
status: Accepted
date: 2026-06-23
supersedes: null
superseded_by: null
deciders: [Winston (architect), user]
related: [SEC-9, NFR-D-1, NFR-S-1, NFR-S-2, NFR-S-3, NFR-L-3, D9, AR-20, ADR-013, ADR-020]
evidence:
  - _bmad-output/planning-artifacts/architecture.md (SEC-9, D9)
  - _bmad-output/planning-artifacts/foundation-action-plan-2026-06-23.md (Winston BLOCKER #3)
  - _bmad-output/planning-artifacts/research/market-philippine-political-intelligence-civic-tech-2026-06-19.md
---

# ADR-004: DDoS and Attack Posture for IIP v1

## Context

SEC-9 states that Caddy's `rate_limit` directive is "OWASP-noise mitigation
only — not DDoS defense against state-aligned actors." But it does not name
what IS the DDoS defense. IIP is a defamation-grade platform covering an
active Philippine impeachment. It will attract adversarial attention. The
Party Mode review (Winston BLOCKER #3) flagged this as an architecture-defining
gap.

## Decision

### v1 Posture: Local-First, No External DDoS Layer

**IIP v1 has NO dedicated DDoS protection layer.** This is an accepted risk,
not an oversight. The rationale:

1. **NFR-D-1 binding constraint:** v1 runs on a single workstation with no
   proprietary cloud dependency. Cloud DDoS services (Cloudflare, AWS Shield)
   require external infrastructure, violating the local-first mandate.

2. **NFR-S-1:** v1 API is read-only public. No user write endpoints are
   exposed. The attack surface is query-only, not mutation.

3. **NFR-L-3:** Before any external presentation, the Pre-External Presentation
   Gate (FR-5.5, G1–G8) must clear. v1 is pre-external — no content is served
   outside the build team until the gate passes.

4. **Threat model:** The v1 adversary is not a state-aligned DDoS actor —
   v1 content is not externally visible. The adversary is internal: a build
   team member who sees uncited content rendered internally is a
   "republication audience" (SEC-5). The defense is the render gate, not
   network infrastructure.

### What Caddy rate_limit DOES

- Mitigates OWASP noise (automated scanners, script kiddies, curiosity
  traffic) when the platform is eventually exposed.
- Enforces NFR-S-3 (per-IP rate limiting, 429 with Retry-After).
- Caps payload sizes.

### What Caddy rate_limit DOES NOT Do

- Defend against volumetric DDoS (SYN floods, amplification attacks).
- Defend against state-aligned actors with dedicated infrastructure.
- Defend against application-layer attacks at scale.

### Pre-External Exposure Requirements (PD-3 Gate)

Before IIP serves content to external audiences (post-G8), the DDoS posture
MUST be upgraded. Options evaluated for that phase:

| Option | Pros | Cons | License |
|--------|------|------|---------|
| Cloudflare Free/Pro | Best DDoS mitigation, zero config | External dependency, data passes through CF | Proprietary |
| self-hosted NGINX + fail2ban | FOSS, local-first | Manual tuning, limited against volumetric | FOSS |
| Skip — accept risk | Simple | Defamation platform with no DDoS defense = liability | N/A |

**Decision deferred to PD-3 gate ADR.** The chosen option must align with
NFR-D-1/D-2 (local-first, FOSS) or file a superseding ADR accepting the
cloud dependency.

## Consequences

- v1 ships without DDoS protection. Accepted risk documented here.
- Caddy rate_limit is configured but explicitly documented as OWASP-noise only
  (inline comment in Caddyfile per Story 1.3 spec).
- NFR-S-3 rate limiting is enforced at the application layer (Fastify
  `@fastify/rate-limit`), not just the proxy layer.
- The PD-3 gate (Story 8.x) MUST resolve the DDoS posture before any external
  exposure. This ADR's "accepted risk" status expires at G8.
- If v1 is exposed externally before PD-3 without updating this ADR, that is
  a NFR-L-3 violation (cyberlibel exposure — an unavailable platform cannot
  serve defamatory content, but a compromised one can).

## Alternatives

The pre-external-exposure (post-G8) DDoS posture was evaluated against these
options (decision deferred to the PD-3 gate ADR):

| Option | Pros | Cons | License |
|--------|------|------|---------|
| Cloudflare Free/Pro | Best DDoS mitigation, zero config | External dependency, data passes through CF | Proprietary |
| Self-hosted NGINX + fail2ban | FOSS, local-first | Manual tuning, limited against volumetric | FOSS |
| Skip — accept risk | Simple | Defamation platform with no DDoS defense = liability | N/A |

For **v1** the binding constraint is NFR-D-1 (single-workstation, local-first,
no proprietary cloud dependency). Every cloud-DDoS option violates that
constraint, so v1 ships with **no dedicated DDoS layer** — the accepted risk
documented in `## Decision`. The render gate (ADR-001 §1) is the v1 defense
against the v1-relevant adversary (internal republication audience, SEC-5),
not network infrastructure.

## Open questions

| # | Question | Owner | Trigger |
|---|----------|-------|---------|
| 1 | Which post-G8 option clears NFR-D-1/D-2 (local-first, FOSS)? Cloudflare fails; NGINX+fail2ban is FOSS but volumetric-weak. | Architect/Security | Pre-PD-3 gate (G8) |
| 2 | Is any state-aligned-actor threat model realistic for v1 (content is pre-external), or purely a post-exposure concern? | Analyst/Security | Before first external presentation |
| 3 | Should Caddy's rate-limit config carry an inline "OWASP-noise only" comment per Story 1.3, and is that lint-enforced? | Developer | F1 Caddyfile authoring |
