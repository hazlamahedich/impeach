---
id: ADR-014
title: Polyglot Eval Invocation — Subprocess, Not HTTP
status: Accepted
date: 2026-06-26
supersedes: null
superseded_by: null
deciders: [Winston (architect), Murat (test architect), Amelia (developer), user]
related: [SC-1, STR-12, AC-1, ADR-009, ADR-011, ADR-012, ADR-025, ADR-026]
evidence:
  - _bmad-output/planning-artifacts/architecture.md (SC-1: polyglot eval invoked via subprocess/CLI NOT HTTP; STR-12 TS↔Python via subprocess)
  - _bmad-output/project-context.md (§Polyglot eval bridge: subprocess contract needs a schema version; TS zod ↔ Python pydantic)
---

# ADR-014: Polyglot Eval Invocation — Subprocess, Not HTTP

## Context

The eval harness is polyglot by design (SC-1): `packages/eval/` (TS) is the
orchestration shell + render-time metrics; `tools/eval/` (Python, containerized)
is DeepEval/RAGAS/Inspect + corpus-aggregate metrics + inter-rater α + red-team
generators. The two halves must communicate. The naive choice is an HTTP
bridge (a Python FastAPI service the TS shell calls). SC-1 explicitly rejects
this and mandates a **subprocess/CLI** boundary — and the rejection must be
recorded (SC-9) so an HTTP bridge does not creep back in.

## Decision

**The TS↔Python eval boundary is a subprocess/CLI invocation, never HTTP.**

1. `tools/eval` runs under `uv` with its own `uv.lock` (NOT shared with any
   other Python). It is invoked by the TS orchestrator as a CLI subprocess
   (stdin/stdout contract), modeled as a Turborepo task node (ADR-009).
2. **The subprocess contract has a schema version.** TS zod ↔ Python pydantic
   are generated from one source via `datamodel-code-generator`
   (`packages/contracts/eval.ts` → JSON Schema → pydantic). Contract tests on
   both sides assert the round-trip per CI. Without a versioned contract, a
   Python minor lift silently breaks the gate and Stryker on the TS gate never
   sees it (different language, different mutation engine).
3. The reason for subprocess over HTTP: an HTTP bridge introduces a **network
   failure mode that overlaps AC-2's failure mode** — a correlated risk inside
   a gate. The eval gate must not be downable by the same class of failure
   (network) that the system it is gating can suffer. A subprocess either
   returns or the orchestrator sees a non-zero exit; there is no
   "half-reachable" HTTP state.
4. **Cassettes do not cross the language boundary:** Python eval cassettes in
   `tools/eval/tests/cassettes/` (pytest-vcr); TS Ollama cassettes in
   `tests/cassettes/` (vcr-ts). Different formats (STR-12) — do not share.

## Alternatives

1. **HTTP bridge (Python FastAPI service + TS fetch).**
   - Rejected (SC-1). Introduces a network failure mode correlated with AC-2's,
     a always-on Python service on the serving-adjacent path (violates the
     TS-first STR-12 boundary for the serving path), and a second
     serialization/deserialization surface. The subprocess boundary fails loud
     (non-zero exit) rather than silently (timeout/503).
2. **HTTP but on a Unix domain socket (local-only).**
   - Rejected. Reduces the network exposure but keeps the HTTP
     serialization/timeout/serialization drift and the always-on service. A
     domain socket is HTTP-with-extra-steps; the subprocess CLI is simpler.
3. **Inline Python via a JS-Python bridge (pythonia, etc.).**
   - Rejected. Couples the TS process to a Python runtime in-process
     (GIL/embedding fragility) and breaks the containerized-Python invariant
     (SC-1: the single workstation needs no Python toolchain because eval is
     containerized).

## Consequences

- `tools/eval` is a Turborepo task node invoked by subprocess; the
  contract is versioned + round-trip tested (zod↔pydantic↔JSON Schema) per CI.
- `krippendorff` vs `simpledorff` (inter-annotator α) is pinned to ONE — the
  implementations disagree on missing-data handling, which moves the α number.
- The boundary is loud-fail (non-zero exit) not silent-fail; the eval gate
  cannot be half-reached.
- Mutation coverage gap: Stryker is TS-only; Python `tools/eval` uses
  `mutmut`/`cosmic-ray` (project-context) so the libel-injection evals have
  mutation coverage otherwise absent.

## Open questions

| # | Question | Owner | Trigger |
|---|----------|-------|---------|
| 1 | Should the subprocess contract ship as a versioned JSON file in the repo, or generated in CI from `packages/contracts/eval.ts`? | Architect | SC-1 wiring (Epic 4) |
| 2 | Is `mutmut` or `cosmic-ray` the Python mutation engine, and is it pinned? | Test Architect | tools/eval setup |
| 3 | Does the subprocess exit-code taxonomy need a typed mapping into TS eval results? | Developer | First ambiguous-exit incident |
