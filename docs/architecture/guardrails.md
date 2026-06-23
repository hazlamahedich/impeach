# IIP Architecture Guardrails

> Extracted from Story 1.1 implementation artifacts per Foundation Action
> Plan P5 (Paige GAP #9). Global guardrails that every developer must follow,
> indexed and discoverable — not trapped in episodic story files.
>
> Authority: The binding amendments (AC/PD/SC/D/SEC/PC/STR/VAL) in
> `architecture.md` remain the source of truth. This document is a
> quick-reference index.

---

## 1. Worker Runtime — All Node.js 22

All 6 processes run Node.js 22. `ingest-worker` is **MANDATORY** Node — AGE
native Postgres bindings cannot load in Cloudflare Workers V8 isolates.

Override permitted only with a recorded ADR stating rationale and proving no
AGE native binding touch. See ADR-022 for Node 22.23.0 pin rationale.

## 2. Package `exports` — Types-Condition Mandatory

Every `packages/*/package.json` must use the condition shape:

```json
"exports": { ".": { "types": "./src/index.ts", "default": "./src/index.ts" } }
```

A silent `any` on `@iip/contracts` is a spec violation.

## 3. `.npmrc` — Four Flags Required

```ini
node-linker=hoisted       # AGE native bindings
engine-strict=true        # Enforces engines.node
auto-install-peers=true
strict-peer-dependencies=true
```

## 4. Turborepo v2 — `"tasks"`, NOT `"pipeline"`

`turbo.json` uses the v2 `"tasks"` schema. Copying a v1 `turbo.json` →
schema error.

## 5. `tools/` NOT a Workspace Member

`pnpm-workspace.yaml` lists `apps/*` + `packages/*` ONLY. `tools/*/package.json`
are shims (scripts shell to `uv run`). Adding `tools/*` breaks `pnpm install`.

## 6. Render Gate — Structurally Separate from RAG

- `packages/render` imports ONLY `@iip/contracts` (SC-3)
- `@iip/render` BANNED in `packages/rag/**` (STR-4)
- Rag→render crosses a queue (BullMQ `render-queue`), not an import

## 7. AGE Cypher — One Wrapper Only

AGE Cypher ONLY via `packages/graph/src/cypher.ts → cypher(graph, query, params)`
(PC-1e). Raw `ag_catalog.cypher(` is lint-banned. The `$id`-inside-`$$`
positional-binding footgun is an injection vector.

## 8. Editorial Log — Append-Only, Hash-Chained

- Construct entries ONLY via `makeEntry(...)` — hand-constructing is a defect
- `EditorialLog.append(entry)` — NO update/delete exposed
- Monotonic `seq` (BIGINT) is the ordering key; `time` is display-only
- Branded fields: `CorpusHash`, `PrevHash`, `Signature`, `Principal`
- `.default()` BANNED on `principal`, `signature`, `corpusHash`, `prevHash`
- Sequential `await` for hash-chain writes; `Promise.all` for independent ops

## 9. Citations — Typed Top-Level Array

`citations: CitationRef[]` as a sibling top-level field on the answer contract.
NEVER embedded in `answerText`. Inline `[1]` markers are render-time only.

## 10. IDs — UUID v4, Branded

- `z.string().uuid()` (zod ≥3.23)
- `gen_random_uuid()` (built-in pgcrypto, PG13+)
- Brand every ID: `.$type<EntityId>()` in Drizzle
- Ban client-supplied IDs for editorial log / intake entries

## 11. Timestamps — UTC Only

- TIMESTAMPTZ UTC in Postgres; ISO-8601 UTC in JSON
- `created_at` source-of-truth = DB `defaultNow()`
- Ban `z.coerce.date()` (accepts local-time) — use safe pattern
- UTC helpers only: `packages/contracts/src/time.ts → now()`

## 12. Confidence — Canonical Term

- `z.number().min(0).max(1).multipleOf(0.001)` — must reject NaN/Infinity
- DB: `NUMERIC(4,3)` + `CHECK (confidence >= 0 AND confidence <= 1)`
- Round at contract parse: `z.number().transform(round3)`

## 13. Process Boundaries — 6 Processes (ADR-021)

| # | Process | Role |
|---|---------|------|
| 1 | api | Fastify 5 public ingress |
| 2 | ingest-worker | Write-path, sole AGE writer |
| 3 | serve-worker | Read-path (RAG → render-queue → render) |
| 4 | audit-worker | Append-only lineage reconcile |
| 5 | enqueuer | Durable control-plane (Redis Streams) |
| 6 | web | Next.js 15 frontend (RSC + client) |

Apps communicate via queue messages or HTTP, never function calls.
Ban `apps/*` importing from `apps/*`.

## 14. Migration Order — Drizzle First, AGE Second

Relational Drizzle migrations complete and commit BEFORE AGE boot migration
runs (ADR-002 §Decision #5). Enforced by `scripts/age-migrate.ts` boot runner
with precondition check and idempotency guard.

## 15. Common LLM Mistakes

1. Adding `tools/*` to `pnpm-workspace.yaml`
2. Using `"pipeline"` in `turbo.json`
3. Using Node 20 or floating pnpm
4. Forgetting `exports` maps on packages
5. Implementing real logic in app stubs
6. Creating per-package lockfiles
7. Skipping `node-linker=hoisted`
8. Hand-writing pydantic models in `tools/eval/`
9. Putting ADR content in story files
10. Forgetting to commit `pnpm-lock.yaml`
11. Using `postgres:16` instead of the custom AGE+pgvector image
12. Using Redis Stack or Dragonfly for BullMQ
13. Exposing MinIO or Ollama through Caddy
14. Registering AGE migration under `/docker-entrypoint-initdb.d/`
15. Describing Caddy rate-limit as DDoS defense
16. Using `qwen2.5:14b-instruct` instead of `qwen3:14b`
17. Putting Jaeger instead of Tempo
