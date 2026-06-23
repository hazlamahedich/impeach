---
id: ADR-022
title: Node.js 22.23.0 Patch Pin Root Cause
status: Accepted
date: 2026-06-23
supersedes: null
supersedes_by: null
deciders: [Amelia (dev), Winston (architect), user]
related: [SC-9, PC-2, NFR-D-1, ADR-001]
evidence:
  - _bmad-output/implementation-artifacts/1-1-turborepo-scaffold-process-stubs.md (Debug Log)
  - _bmad-output/planning-artifacts/foundation-action-plan-2026-06-23.md (Winston DEBT #18)
---

# ADR-022: Node.js 22.23.0 Patch Pin Root Cause

## Context

Story 1.1 originally pinned `.nvmrc` to Node `22.11.0`. During `pnpm install`,
the install failed because a transitive dependency of `typescript-eslint@8.x`
(`eslint-visitor-keys@5.0.1`) requires Node `^22.13.0 || >=24` and `.npmrc`
has `engine-strict=true`. The patch was bumped to `22.23.0` (latest 22.x LTS
at the time). The root cause was not documented (Winston DEBT #18).

## Decision

### Root Cause

**`eslint-visitor-keys@5.0.1`** (transitive dependency of
`typescript-eslint@8.x` → `@typescript-eslint/typescript-estree` →
`eslint-visitor-keys`) declares in its `package.json`:

```json
"engines": { "node": "^22.13.0 || >=24" }
```

Under `engine-strict=true` in `.npmrc`, pnpm refuses to install any package
whose `engines.node` constraint is not satisfied by the current Node version.
Node 22.11.0 < 22.13.0 → install aborts.

### Why 22.23.0

`22.23.0` is the latest Node.js 22.x LTS release as of 2026-06-23. It
satisfies `^22.13.0` with margin. The exact-patch-pin intent of `.nvmrc`
(story 1.1 guardrail) is preserved — the mandate is "exact patch within the
22.x range," not "exact patch 22.11.0."

### Why Not Node 24

Node 24 is a current (non-LTS) release. The project mandates Node 22.x
(SC-9 ADR-001 original decision — Node 22 is the active LTS). Node 24's
non-LTS status means faster deprecation cycles, which is unacceptable for a
multi-year defamation-grade platform.

## Consequences

- `.nvmrc` pins `22.23.0` exact. `engines.node` stays `"22.x"` (range form).
- `engine-strict=true` in `.npmrc` catches future Node-engine-constraint
  violations at install time, not at runtime.
- When Node 22 EOL approaches (typically ~30 months after initial release),
  a superseding ADR must evaluate Node 24 (or next-LTS) migration.
- If `eslint-visitor-keys` drops the `^22.13.0` constraint in a future
  release, the minimum viable Node version may decrease — but we stay pinned
  to the latest 22.x LTS for security patches.

## Monitoring

The upgrade owner (Amelia/Dev) should check on each `pnpm update` whether
the `eslint-visitor-keys` engine constraint has changed, and whether a newer
22.x patch is available. The `.nvmrc` should be bumped to the latest 22.x
LTS security patch within 1 week of release.
