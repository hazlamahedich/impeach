---
story_id: '3.1'
story_key: '3-1-source-registry-confirmed-trust-tiers'
epic: 'Epic 3: Source Onboarding & Intelligence Ingestion'
status: ready-for-dev
last_updated: '2026-07-08'
baseline_commit: '2fdf051030ee7171a4e38549921c68fd93afe841'
party_mode_reviewed: false
---

# Story 3.1: Source Registry with Confirmed Trust Tiers (FR-1.1)

Status: ready-for-dev

<!-- Note: Validation is optional. Run validate-create-story for quality check before dev-story. -->

## Story

As an Intake Operator,
I want to register and configure sources by type and crawl strategy with a confirmed trust tier,
so that evidence reliability and citation-quality floor are grounded in validated source authenticity.

**FR-1.1 provenance & citation anchoring:** Attributing ingested information to a specific, authenticated origin is a key integrity check of the platform. By validating and recording the `trust_tier` (1 primary -> 3 aggregator) and confirmation status at the source level, we ensure the downstream citation gate can evaluate reliability (EI-8) and check provenance authenticity (SEC-3).

## Acceptance Criteria

### Behavioral (stakeholder-verifiable)

1. **Source Registration:** **Given** an Intake Operator with write permissions, **When** they request to register a new source, **Then** the source is created with name, url, `source_type` (`government` | `court` | `media` | `press_release` | `transcript`), `crawl_strategy` (`rss` | `sitemap` | `list_page` | `api` | `manual`), `trust_tier` (1 | 2 | 3), and confirmation status (`confirmed` boolean, defaulting to `false`).
2. **Duplicate Prevention:** **Given** a source already registered with a specific URL, **When** a registration request is received for the same URL, **Then** the request is rejected with a conflict error (`409 Conflict`) to prevent trust-tier fragmentation.
3. **Upstream Feed Provenance:** **Given** a source that syndicates news or content from an upstream provider, **When** registered, **Then** its `wire_service` (e.g. AP, Reuters, PNA) and/or `original_publisher` are persisted, supporting the EI-2 independence checker.
4. **Authorized Management:** **Given** a registration or update request, **When** the operator lacks `admin` or `write` scope in their JWT, **Then** the action is rejected with `403 Forbidden`. If missing authentication, rejected with `401 Unauthorized`.
5. **Registry Queries:** **Given** registered sources, **When** querying the registry, **Then** the operator can retrieve sources filtered by `source_type`, `trust_tier`, or `confirmed` status.

### Implementation Constraints (Definition of Done)

- **DoD-1 (Schema Adherence):** Relational schema is defined strictly in `packages/db/src/schema/sources.ts`. Hand-authored migrations (`0004_epic3_ingest_tables.sql` or subsequent) must match the Drizzle schemas exactly.
- **DoD-2 (Nominal Types):** All method parameters representing source identities must use the branded `SourceId` nominal type defined in `@iip/contracts` (SEC-6).
- **DoD-3 (Validation):** All registration inputs must be validated using Zod schemas (`RegisterSourcePayloadSchema`) defined in `packages/contracts/src/ingest.ts`.
- **DoD-4 (Stryker Mutation):** Enforce 100% mutation score on the sources routes and repository logic.
- **DoD-5 (SEC-3 Compliance):** Documents cannot be linked to the graph if their source has `confirmed = false`. The trust tier must be assigned at ingest and persisted as a structural graph property.

## Red-Phase Test Specifications

### Integration (8 tests) — `tests/integration/sources-registry.integration.test.ts`
- **TC-1.1: Register new source with valid data succeeds**
  - **Given** a valid token with `scope: ['write']` or `['admin']`,
  - **When** calling `POST /api/sources` with name, url, source_type, crawl_strategy, trust_tier, and confirmed=true,
  - **Then** it returns 201 Created and the created source record containing the generated `id` as `SourceId`.
- **TC-1.2: Register duplicate URL returns 409**
  - **Given** a source already exists with URL `https://example.com/feed`,
  - **When** calling `POST /api/sources` with the same URL,
  - **Then** it returns 409 Conflict and a clear error message.
- **TC-1.3: Invalid enum values return 400**
  - **Given** a payload with an invalid `source_type` (e.g. `'blog'`), `crawl_strategy` (e.g. `'scrape'`), or `trust_tier` (e.g. `5`),
  - **When** calling `POST /api/sources`,
  - **Then** it returns 400 Bad Request listing the validation errors.
- **TC-1.4: Registration defaults confirmed to false**
  - **Given** a payload missing the `confirmed` field,
  - **When** calling `POST /api/sources`,
  - **Then** it returns 201 and the persisted record has `confirmed = false`.
- **TC-1.5: Register requires write/admin scope**
  - **Given** a JWT with only `scope: ['read']` or no token,
  - **When** calling `POST /api/sources`,
  - **Then** it returns 403 Forbidden or 401 Unauthorized respectively.
- **TC-1.6: Get source by ID succeeds**
  - **Given** a registered source with ID `sources.id`,
  - **When** calling `GET /api/sources/:id`,
  - **Then** it returns 200 OK and the complete source payload.
- **TC-1.7: List sources with filters**
  - **Given** multiple sources registered with different tiers,
  - **When** calling `GET /api/sources?trust_tier=1&confirmed=true`,
  - **Then** it returns 200 OK and only the matching sources list.
- **TC-1.8: Update confirmation status**
  - **Given** a source with `confirmed = false`,
  - **When** calling `PATCH /api/sources/:id` with payload `{ confirmed: true }` signed by an admin,
  - **Then** it returns 200 OK and the updated record has `confirmed = true`.

### Contract (4 tests) — `tests/contract/sources-boundary.contract.test.ts`
- **TC-2.1: RegisterSourcePayloadSchema validates input strictly**
  - **Given** Zod schema `RegisterSourcePayloadSchema`,
  - **When** parsed with invalid inputs or extra fields,
  - **Then** it fails validation and lists the precise field errors.
- **TC-2.2: Source repository interface contract**
  - **Given** the repository module `packages/db/src/repositories/sources.ts`,
  - **When** imported,
  - **Then** it exports `SourcesRepository` with typed methods `create`, `findById`, `findByUrl`, `update`, and `list`.
- **TC-2.3: DB constraints match vocabulary**
  - **Given** the relational database,
  - **When** attempting to insert a source via direct SQL with invalid `source_type` or `trust_tier`,
  - **Then** the database throws a CHECK constraint violation error.
- **TC-2.4: Branded SourceId type safety**
  - **Given** a function signature requiring `SourceId`,
  - **When** passing a plain string or a `DocumentId`,
  - **Then** the TypeScript compiler reports a type mismatch error.

## Tasks / Subtasks

- [ ] **Task 0: Establish RED Test Suite in standard locations**
  - [ ] Create `tests/integration/sources-registry.integration.test.ts` implementing the 8 integration test cases (TC-1.1 through TC-1.8) using Vitest and Fastify injection.
  - [ ] Create `tests/contract/sources-boundary.contract.test.ts` implementing the 4 contract test cases (TC-2.1 through TC-2.4).
  - [ ] Verify that all new tests run and fail RED under Vitest (`pnpm test`).

- [ ] **Task 1: Contract Schemas & Types (`packages/contracts/src/ingest.ts`)**
  - [ ] Export Zod schema `RegisterSourcePayloadSchema` validating `{ name, url, source_type, crawl_strategy, trust_tier, confirmed, wire_service, original_publisher }` matching the allowed enums/types.
  - [ ] Export `UpdateSourcePayloadSchema` for optional updates to a source.
  - [ ] Export Zod schema `SourceSchema` representing the fully-typed persisted source database record.
  - [ ] Re-export these schemas in `packages/contracts/src/index.ts`.

- [ ] **Task 2: Database Repository Implementation (`packages/db/src/repositories/sources.ts`)**
  - [ ] Implement `SourcesRepository` using Drizzle query builder and `@iip/db` client.
  - [ ] Implement `create(payload: RegisterSourcePayload): Promise<Source>` mapping types and defaults.
  - [ ] Implement `findById(id: SourceId): Promise<Source | null>`.
  - [ ] Implement `findByUrl(url: string): Promise<Source | null>`.
  - [ ] Implement `update(id: SourceId, payload: UpdateSourcePayload): Promise<Source>`.
  - [ ] Implement `list(filters: { source_type?, trust_tier?, confirmed? }): Promise<Source[]>`.
  - [ ] Export `SourcesRepository` in `packages/db/src/index.ts`.

- [ ] **Task 3: Fastify API Routes (`apps/api/src/routes/sources.ts`)**
  - [ ] Implement Fastify plugin `createSourcesRoutes` registering:
    - `POST /api/sources` (requires `verifyMiddleware` auth with `write` or `admin` scope, validates payload, calls `SourcesRepository.create`).
    - `GET /api/sources` (requires auth with `read` scope, supports query filters, calls `SourcesRepository.list`).
    - `GET /api/sources/:id` (requires auth with `read` scope, calls `SourcesRepository.findById`).
    - `PATCH /api/sources/:id` (requires `verifyMiddleware` auth with `write` or `admin` scope, validates payload, calls `SourcesRepository.update`).
  - [ ] Handle duplicate URL registration by catching the unique constraint database error and mapping it to a `409 Conflict` structured response.
  - [ ] Wire/register the sources routes plugin inside `apps/api/src/server.ts` alongside query/intake routes.

- [ ] **Task 4: Stryker Mutation Verification**
  - [ ] Add `packages/db/src/repositories/sources.ts` and `apps/api/src/routes/sources.ts` to `mutate` configuration in `stryker.config.json`.
  - [ ] Run Stryker to verify a 100% mutation score threshold is met on these files.

## Dev Notes

- **Database Constraints & Schema:** The `sources` table relies on CHECK constraints in migration `0004` to restrict enum values. Drizzle schema types (`$type<SourceSourceType>()`, etc.) enforce this at compile-time.
- **Scope check implementation:** Fastify route handlers must explicitly call a scope checking helper or utilize a middleware pattern that verifies `scope` includes `'write'` or `'admin'` for write operations, and `'read'` for read operations.
- **Error mapping:** Catch database errors with PostgreSQL code `23505` (unique_violation) on `sources_url_uq` and throw/return a clean Fastify error object: `{ error: { code: 'conflict', message: 'Source URL already registered' } }`.

### Project Structure Notes

- Alignment with unified project structure:
  - Database schema: `packages/db/src/schema/sources.ts`
  - Repository: `packages/db/src/repositories/sources.ts`
  - API Routes: `apps/api/src/routes/sources.ts`
  - Contracts: `packages/contracts/src/ingest.ts`

### References

- Relational Schema definition: [sources.ts](file:///Users/sherwingorechomante/impeach/packages/db/src/schema/sources.ts)
- Ingest contract declarations: [ingest.ts](file:///Users/sherwingorechomante/impeach/packages/contracts/src/ingest.ts)
- Migration SQL defining tables: [0004_epic3_ingest_tables.sql](file:///Users/sherwingorechomante/impeach/packages/db/drizzle/0004_epic3_ingest_tables.sql)
- Auth middleware context: [2-2-per-issued-jwt-authentication.md](file:///Users/sherwingorechomante/impeach/_bmad-output/implementation-artifacts/2-2-per-issued-jwt-authentication.md)

## Dev Agent Record

### Agent Model Used

Gemini 3.5 Flash (High)

### Debug Log References

### Completion Notes List

### File List

## QA Results

