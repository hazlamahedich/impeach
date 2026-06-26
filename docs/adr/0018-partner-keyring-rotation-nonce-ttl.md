---
id: ADR-018
title: Partner Keyring Rotation — N + N-1 Window, Nonce TTL
status: Proposed
date: 2026-06-26
supersedes: null
superseded_by: null
deciders: [Winston (architect), Security, user]
related: [SEC-2, AC-11, NFR-L-5, ADR-013]
evidence:
  - evidence pending F18/F19
---

# ADR-018: Partner Keyring Rotation — N + N-1 Window, Nonce TTL

> **Status: Proposed.** Records the partner-keyring rotation + nonce/TTL model
> for Tier-5 partnership provenance signatures (SEC-2). `Proposed` pending
> F18/F19 partnership-integration evidence.

## Context

SEC-2 two-person intake adds, for Tier-5 partnership drops, a **partner
provenance signature** verified against a pinned keyring (fail-closed on
unknown key). Partners rotate their signing keys on their own schedules; the
platform must accept both the current and the just-rotated key during a
rotation window, then revoke the old key — without dropping in-flight drops or
accepting a revoked key. This is a key-management + replay-defense concern
sitting at the intake boundary (SEC-2). STR-6(d) assigns the design to this
ADR.

The companion concern is **nonce + TTL**: a partnership signature must be
fresh (nonce) and time-bounded (TTL) to defeat replay of a captured signature.

## Decision

*(Proposed — confirmed by F18/F19 partnership integration.)*

1. **N + N-1 keys valid concurrently for one rotation window.** During
   rotation, both the current key (N) and the previous key (N-1) are accepted;
   the old key (N-1) is revoked after the grace window. The rotation event is
   recorded to the AC-11 audit log.
2. **Responsibility split (STR-6(d)):**
   - **Policy** (which keys, rotation cadence, grace window) → `@iip/config`
     (zod-validated).
   - **Runtime** (load current key, accept N-1 in window, fail-closed on
     unknown) → `apps/api` (`auth/keyring.ts`).
   - **Rotate-and-flip job** → BullMQ recurring job in the worker.
3. **Nonce + TTL:** each partnership signature carries a nonce + issued-at
   timestamp; the intake gate rejects signatures whose nonce was seen (replay)
   or whose age exceeds the TTL. Nonces are tracked with a bounded
   replay-detection window aligned to the TTL.
4. Fail-closed: an unknown key, an expired signature, or a replayed nonce
   refuses intake and records an `intake.bypass_attempt` AC-11 entry (SEC-2).

## Alternatives

1. **Single active key, hard cutover.**
   - Rejected. Drops in-flight partnership signatures during the cutover
     window (a partner signs with the old key moments after rotation). The
     N+N-1 window is the standard key-rotation hygiene.
2. **Accept any key in the keyring indefinitely (no revocation).**
   - Rejected. A compromised partner key is then forever valid — defeats the
     purpose of rotation and the SEC-2 provenance guarantee.
3. **No nonce/TTL (signature-only verification).**
   - Rejected. A captured partnership signature is replayable indefinitely.
     Nonce + TTL is the minimal replay defense.
4. **Cloud KMS / HSM-managed partner keys.**
   - Deferred. Adds an external dependency (NFR-D-1) for a concern that local
     keyring config + Ed25519 verification handles in v1. Revisit if a partner
     mandates HSM-backed signing.

## Consequences

*(Proposed — confirmed at implementation.)*

- `apps/api/auth/keyring.ts` loads current + N-1 keys from config, verifies
  Tier-5 partnership signatures, and fail-closes on unknown/expired/replayed.
- Rotation is a tracked BullMQ job + an AC-11 audit event; the grace window is
  config-driven.
- Nonce replay detection is bounded to the TTL window (memory-bounded).

## Open questions

| # | Question | Owner | Trigger |
|---|----------|-------|---------|
| 1 | What is the safe grace-window length for N+N-1 overlap (partner rotation cadence dependent)? | Security/PM | F18/F19 partnership evidence |
| 2 | Is the nonce replay store in Redis or Postgres, and is it TTL-evicted? | Architect | SEC-2 implementation |
| 3 | Does Tier-5 ever land in v1, or is this ADR purely a v1.x/v2 design record? | PM | Source-onboarding scope (Epic 3) |
