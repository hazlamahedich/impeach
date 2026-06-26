---
id: ADR-019
title: GPU Runner / Workstation Contradiction — Isolated Runner + GPU Time-Slicing
status: Accepted
date: 2026-06-26
supersedes: null
superseded_by: null
deciders: [Winston (architect), Security, Amelia (developer), user]
related: [SEC-4, NFR-D-1, D14, D15, AC-3, ADR-005, ADR-020, ADR-021]
evidence:
  - _bmad-output/planning-artifacts/architecture.md (SEC-4 runner isolation; NFR-D-1 single workstation; D14 CI/CD self-hosted runner; D15 GPU for Ollama)
  - _bmad-output/planning-artifacts/foundation-action-plan-2026-06-23.md
---

# ADR-019: GPU Runner / Workstation Contradiction — Isolated Runner + GPU Time-Slicing

## Context

Two binding amendments appear to contradict:

- **SEC-4 (Runner isolation)** states the self-hosted GitHub Actions runner is
  **NOT on the corpus/GPU workstation** — a separate box/VM, no `/corpus` mount,
  no sops age keys, secret-less ephemeral containers, OIDC ephemeral tokens.
  Rationale: D7+D14 = untrusted code with prod secrets + corpus on the same
  host = RCE-as-CI (Codecov/Solarwinds in miniature).
- **NFR-D-1 (Single workstation)** states v1 runs on a single workstation with
  no proprietary cloud dependency; D14 requires the self-hosted runner on "the
  build workstation" specifically because it needs the **GPU** for the eval
  smoke (Ollama, D15) + AGE + pgvector + MinIO testcontainers. D15 provisions
  the GPU for Ollama on that same host.

The contradiction: the runner must be off the GPU workstation (SEC-4) but
needs the GPU that lives on the workstation (D14/D15). An apparent
"runner-on-workstation" reading of D14 violates SEC-4; a strict
"runner-off-workstation" reading of SEC-4 strips the eval gate of its GPU.

This ADR resolves the contradiction so both amendments hold.

## Decision

**The runner is logically isolated from the workstation via container/VM
isolation, and GPU access is time-sliced/passthrough-mediated — the runner
never shares a filesystem, secret store, or process namespace with the
corpus/GPU host, but can access the GPU through a mediated device.**

1. **No shared filesystem or secret store.** The runner executes inside an
   ephemeral container (or a lightweight VM) on the host that has **no mount**
   of `/corpus` and **no access** to `~/.config/sops/age/keys.txt`. PR-triggered
   runs are secret-less ephemeral containers; secret access requires a merged
   commit OR `secrets-ok` label + `@security` CODEOWNER approval, and uses
   **OIDC ephemeral tokens (≤1h)** that never persist (SEC-4 unchanged).
2. **GPU access is mediated, not host-shared.** The GPU is exposed to the
   runner's ephemeral container via a **device passthrough / mediated device
   (NVIDIA Container Toolkit MIG or a VFIO-mediated GPU partition)** —
   time-sliced so the runner's eval smoke can use the GPU without touching the
   corpus-serving path's process namespace. On Apple Silicon (MLX), the
   equivalent is an isolated container runtime that does not mount the corpus
   volume. The GPU is a device, not a trust boundary: a container with GPU
   access cannot read `/corpus` or sops keys.
3. **Egress restricted.** The runner's network egress allows only named CI
   registries (SEC-4); it cannot exfiltrate corpus or secrets even with GPU
   access.
4. **So both amendments hold:** SEC-4's "NOT on the corpus/GPU workstation"
  means not sharing its **trust boundary** (filesystem, secrets, process
  namespace) — which container/VM isolation satisfies. NFR-D-1's "single
  workstation" means no second physical machine is required; the isolation is
  logical (container/VM), not a second box. D14/D15's GPU requirement is met
  via mediated passthrough. If physical isolation ever becomes mandatory
  (e.g. a verified container-escape CVE class), this ADR is superseded by a
  second-box runner ADR.

## Alternatives

1. **Runner on a second physical machine (strict SEC-4 literal reading).**
   - Rejected for v1. Violates NFR-D-1 (single workstation, no second box).
     This is the documented fallback if logical isolation is ever judged
     insufficient — not the v1 default.
2. **Runner directly on the host with full access (strict D14 literal reading).**
   - Rejected. Re-creates the SEC-4 P0: untrusted PR code with prod secrets +
     corpus on the same trust boundary = RCE-as-CI. This is exactly the hole
     SEC-4 closed.
3. **No GPU in CI eval (drop D15 from the runner).**
   - Rejected. The eval smoke (AC-1) needs the local model (Ollama,
     ADR-005/ADR-020) to be meaningful; a CPU-only eval smoke hides the
     latency + citation regressions the gate exists to catch. Better to
     time-slice the GPU than drop it.
4. **Cloud GPU runner (GitHub-hosted / cloud GPU).**
   - Rejected. Violates NFR-D-1/D-2 (local-first, no proprietary cloud
     dependency) and ships corpus + eval data to a third party (cyberlibel
     republication risk).

## Consequences

- SEC-4 and NFR-D-1 both hold: logical isolation (container/VM, no shared
  fs/secrets/namespace) + mediated GPU passthrough on a single workstation.
- The runner's ephemeral container can use the GPU (eval smoke, ADR-005/020)
  without a trust-boundary overlap with the corpus host.
- The AGE decryption key lives on the deploy runner only, behind a hardware
  token or separate keystore (SEC-4).
- Documented escape hatch: a verified container-escape CVE class triggers the
  second-box runner ADR (physical isolation).

## Open questions

| # | Question | Owner | Trigger |
|---|----------|-------|---------|
| 1 | Is NVIDIA MIG partitioning or VFIO-mediated passthrough the right GPU mediation on the actual build host? | Infra/Security | D15 GPU provisioning |
| 2 | On Apple Silicon (MLX), is the container-isolation + no-`/corpus`-mount boundary sufficient absent MIG? | Security | Mac Studio build host decision |
| 3 | What container-escape CVE class would trigger the second-box runner ADR? | Security | Threat-model review (ADR-013) |
