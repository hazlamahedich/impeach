---
story_id: '1.5'
story_key: '1-5-polyglot-eval-seam'
epic: 'Epic 1: Foundation'
status: ready-for-dev
last_updated: '2026-06-25'
baseline_commit: 545cfd9
---

# Story 1.5: Polyglot Eval Seam (SC-1)

Status: ready-for-dev

<!-- Note: Validation is optional. Run validate-create-story for quality check before dev-story. -->

## Story

As a developer,  
I want the polyglot evaluation harness seam wired,  
so that TS orchestration can invoke Python eval tooling via subprocess and share schemas.

*(Scope: polyglot eval harness ONLY — nothing else bundled.)*

## Acceptance Criteria

1. **Given** `packages/eval/` (TS) and `tools/eval/` (Python) exist  
   **When** the polyglot round-trip is invoked  
   **Then** the Python eval workspace returns an `EvalResult` that passes the TS-side zod parse (AC-F1-05 KEYSTONE). (AC: #1)
2. **Given** contracts are defined on the TS side  
   **When** code generation runs  
   **Then** `packages/contracts/scripts/gen-pydantic.ts` generates Pydantic from Zod to JSON Schema in CI. (AC: #2)
3. **Given** the Python eval workspace exists  
   **When** inspected  
   **Then** `tools/eval` has `pyproject.toml`, uv config, Dockerfile (containerized) (AC: #3).
4. **Given** `tools/eval` is a workspace tool  
   **When** package manifests are audited  
   **Then** `tools/eval/package.json` is a shim (no JS, scripts shell to `uv run` and inline comment documenting intentional non-standard layout (STR-12)) (AC: #4).
5. **Given** the monorepo task runner config  
   **When** turbo commands are executed  
   **Then** `turbo.json` declares `py:*` tasks (`py:lint`, `py:test` dependsOn `py:lint`) (AC: #5).
6. **Given** the polyglot eval bridge  
   **When** execution occurs  
   **Then** the invocation is subprocess/CLI, NOT HTTP (ADR-014) (AC: #6).
7. **Given** contract schema generation  
   **When** running python-side checks  
   **Then** the subprocess contract has a schema version (zod ↔ pydantic generated from one source) (AC: #7).

## Tasks / Subtasks

- [ ] **TS-Side Contracts Scaffold** (AC: #2, #7)
  - [ ] Create `packages/contracts/src/eval.ts` with `EvalInput` and `EvalResult` Zod schemas.
  - [ ] Enforce a matching `schemaVersion` (e.g. `1.0.0`) in both Zod schemas (using `z.literal("1.0.0")`).
  - [ ] Export schemas and type definitions in `packages/contracts/src/index.ts`.
- [ ] **Pydantic Codegen Script** (AC: #2, #7)
  - [ ] Install `zod-to-json-schema` in `@iip/contracts` as a dependency.
  - [ ] Create `packages/contracts/scripts/gen-pydantic.ts` which imports schemas and uses `zod-to-json-schema` to write temporary JSON Schema files.
  - [ ] Execute `datamodel-codegen` via subprocess in the script with the exact flags:  
        `--field-constraints --use-union-operator --strict-types str,int,float,bool`
  - [ ] Write the generated Pydantic code to `tools/eval/src/eval/models.py`.
  - [ ] Ensure `gen-pydantic.ts` compiles and builds successfully.
- [ ] **Python Eval Workspace Setup** (AC: #3, #4, #7)
  - [ ] Verify `tools/eval/pyproject.toml` references Python `requires-python = ">=3.12,<3.13"`.
  - [ ] Add dependencies to `tools/eval/pyproject.toml`: `pydantic>=2.0`, `datamodel-code-generator>=0.25.0` (or similar), and test utilities like `pytest`.
  - [ ] Ensure a lock file `uv.lock` is committed.
  - [ ] Create `tools/eval/Dockerfile` based on `FROM python:3.12-slim` containing `uv` install and setup.
  - [ ] Add `package.json` shim in `tools/eval/package.json` with scripts calling `uv run ruff` and `uv run pytest` and an inline comment highlighting `"shim — intentional non-standard layout (STR-12)"`.
- [ ] **TS Polyglot Eval Bridge** (AC: #1, #6)
  - [ ] Install `execa` (or use built-in `child_process.execSync` / `spawnSync`) in `@iip/eval` package.
  - [ ] Implement `packages/eval/src/bridge.ts` providing `runPythonEval(spec)` that executes `tools/eval` via subprocess CLI (`uv run`), passing arguments as CLI strings or stdin (no HTTP).
  - [ ] Parse returned JSON against the `EvalResult` zod contract.
- [ ] **Turborepo Task Wiring** (AC: #5)
  - [ ] Modify root `turbo.json` to define `py#lint` and `py#test` (where `py#test` depends on `py#lint`).
  - [ ] Ensure `contracts#build` runs before Python tests so the schemas are generated.
- [ ] **Test & CI Integration** (AC: #1, #8)
  - [ ] Create test scaffold at `packages/eval/polyglot-eval-roundtrip.test.ts` (originally at `_bmad-output/test-artifacts/atdd/epic-1/story-1-5/polyglot-eval-roundtrip.test.ts`) skipped with `describe.skip` at first to satisfy red-phase scaffolding.
  - [ ] Ensure all workspaces build, typecheck, lint, and tests pass.

## Dev Notes

### Scope Boundary

This story is the **polyglot eval harness seam ONLY**. It establishes the communication, schemas, and task runner orchestration between the TS packages and Python tools. It does not write the real evaluation metrics or logic (which will be implemented in Epic 4+). The goal is a verified, schema-conforming round-trip via subprocess.

### Developer Agent Guardrails

1. **No HTTP allowed for Eval Boundary (ADR-014):** The bridge MUST call the Python code via a subprocess CLI runner (e.g. `execa` or node's `spawn`/`exec`). Spinning up an HTTP daemon or REST server inside `tools/eval` is prohibited.
2. **Schema Versioning is Load-Bearing:** Subprocess parameters are untrusted boundaries. The `schemaVersion` constant (pinned at `1.0.0` or similar) MUST be part of the schema contract. Both TS and Python sides must assert that the received schemaVersion matches.
3. **No Hand-Written Pydantic Models (SC-1):** All Python models mirroring Zod schemas must be generated automatically in `packages/contracts/scripts/gen-pydantic.ts` using `datamodel-code-generator` with the exact flags to preserve field constraints, union operators, and strict types.
4. **Intentional Non-Workspace Layout (STR-12):** `tools/eval` must NOT be added to `pnpm-workspace.yaml`. It remains outside the pnpm workspaces. The `package.json` inside it is a shim that allows Turborepo to discover tasks.
5. **Python Strict Quality Rules:** Ruff must be configured in `tools/eval/pyproject.toml` with `DTZ` checks enabled (UTC timezone checks) to prevent timezone drift. Mypy must run in strict mode with the pydantic plugin enabled.

### Previous Story Intelligence (Learnings from Story 1.4)

- In Story 1.4, package boundaries were strictly enforced (`packages/render` imports only `@iip/contracts`). Similarly, `packages/eval` should only import `@iip/contracts` and subprocess tooling.
- The TS `exports` map format: `exports: { ".": { "types": "./src/index.ts", "default": "./src/index.ts" } }` should be preserved.
- Programmatic ESLint boundary checks are live. Do not violate package restrictions (e.g., trying to import `@iip/render` in `@iip/eval` or vice versa).

### Git Intelligence Summary

- Last Commit: `545cfd9` (Story 1.3 implementation and review fixes).
- Active changes for Story 1.4 are present in the workspace, including `@iip/eslint-plugin`, `packages/render/src/gate.test.ts`, and programmatic boundary assertions. These should be preserved and kept green.

### Latest Tech Information

- **datamodel-code-generator:** Pydantic V2 generation flags require `--output-model-type pydantic_v2.BaseModel` to generate compatible V2 Pydantic models.
- **uv:** Use `uv run --project tools/eval python -m eval` rather than global python executables to ensure deterministic virtualenv package execution.

### Project Context Reference

- **SC-1 (Polyglot Eval):** TS orchestrates, Python executes. Zod schema translates to Pydantic.
- **STR-12 (Polyglot Monorepo):** `tools/` is not a workspace member. Shims invoke `uv`.
- **ADR-014 (Subprocess Invocation):** CLI subprocess communication, no HTTP overhead.

## Dev Agent Record

### Agent Model Used

Gemini 3.5 Flash (High)

### Debug Log References

- None.

### Completion Notes List

- None (to be completed by implementing agent).

### File List

- None (to be completed by implementing agent).
