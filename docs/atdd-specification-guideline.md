# ATDD-as-Specification Guideline

**Owner:** Murat (Test Architect)
**Date:** 2026-06-28
**Status:** Active
**Source:** Epic 1 Retrospective P1 (epic-1-retro-2026-06-28.md)

---

## Rule

ATDD test scaffolds are **specification documents**, not runnable code, for any story touching a non-trivial test environment.

## Rationale

During Epic 1, pre-authored ATDD test scaffolds were defective in 3 of 12 stories (1.1, 1.8, 1.9). The worst case (Story 1.9) had 7 critical defects: ESM/CJS conflicts, `require()` in an ESM module, undeclared `execa` dependency, wrong API expectations (nuqs), Server Component rendered in jsdom, `.skip` violating CI gates, and ROOT path resolution bugs.

The root cause: scaffolds are generated without running the code, so they assume test environments (jsdom, React Server Components, ESM/CJS seams) that can't be validated without execution. Dev time went into rewriting scaffolds instead of implementing against them.

## Classification

### Scaffolds MAY be runnable (low defect risk)

Stories using **pure Node.js / TypeScript test environments** with no DOM, no React, no ESM/CJS ambiguity:

- Unit tests for `packages/*` (contracts, db, citation, render, eval, etc.)
- Integration tests using Testcontainers / Docker
- Contract tests using vitest + fast-check
- Lint tests (ESLint programmatic assertions)

For these stories, the scaffold can include imports, assertions, and be close to runnable. Stories 1.2, 1.6, 1.10, 1.11 followed this pattern successfully.

### Scaffolds MUST be specification-only (high defect risk)

Stories touching **any of the following**:

- **jsdom / DOM environment** (`apps/web/**` tests)
- **React components** (JSX, Server Components, Client Components, hooks)
- **ESM/CJS boundary** (mixed module systems)
- **Next.js-specific APIs** (`next/font`, `next/navigation`, App Router conventions)
- **External runtime dependencies** not in `package.json` at scaffold time

For these stories, the scaffold defines **WHAT to test**, not HOW:

## Specification-Only Scaffold Format

Every specification-only scaffold MUST include this header:

```markdown
> ⚠️ **DO NOT COPY VERBATIM.**
>
> This scaffold is a **specification of what to test**, not runnable code.
> It contains known defects (ESM/CJS assumptions, jsdom limitations, wrong API
> expectations) that make it crash if copied directly.
>
> **Task 0:** Rewrite the test from scratch following the corrected patterns
> in the story's Dev Notes. Use this document only as a guide for:
> - Which ACs to cover
> - Test case names and descriptions
> - Property-based test strategies
> - Expected behaviors (GREEN/RED)
```

### What the scaffold specifies

- **Test case names** — one per acceptance criterion, clearly mapped (`TC-X.Y → AC #N`)
- **Input shapes** — the data structures each test uses
- **Expected behaviors** — what the test asserts (GREEN = pass condition, RED = fail condition)
- **Property-based strategies** — fast-check arbitrary definitions and invariant descriptions
- **Edge cases** — boundary conditions, empty inputs, malformed data

### What the scaffold does NOT include

- No `import` statements (the dev determines correct imports for the target environment)
- No assertion code (the dev writes `expect()` calls based on the expected behavior)
- No test runner configuration (the dev uses the project's `vitest.config.ts`)
- No `require()` calls (ESM only — `"type": "module"`)
- No `.skip` / `.only` / `.todo` (CI forbids these)

## Workflow

1. **`bmad-create-story`** generates the scaffold as a specification document
2. The scaffold is placed in `_bmad-output/test-artifacts/atdd/epic-N/story-N-M/`
3. The story file's Dev Notes reference the scaffold with the warning header
4. **`bmad-dev-story` Task 0:** dev reads the scaffold, authors the runnable RED test from scratch
5. The runnable test lives in the project's standard test location (`packages/*/src/*.test.ts`, `tests/`, `apps/web/**/*.test.tsx`)
6. The scaffold remains as a design artifact — it is NOT committed to the test suite

## Applicability

This guideline applies retroactively to all Epic 2+ stories. The `bmad-create-story` template should auto-include a reference to this document (`docs/atdd-specification-guideline.md`) in every story that touches a non-trivial test environment.
