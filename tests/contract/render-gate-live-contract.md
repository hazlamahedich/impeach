# RED Test Contract — Real Render Gate (Story 2.1 Scope Definition)

**Owner:** Murat (Test Architect)
**Date:** 2026-06-28
**Status:** Specification (not runnable code — per Team Agreement A1)
**Source:** Epic 1 Retrospective TD4, Stories 1.4/1.12, ADR-001, architecture.md §AC-2/SEC-5/EI-1

> **DO NOT COPY VERBATIM.** This is a specification of *what* to test, not runnable code.
> Story 2.1's dev authors the runnable RED tests from this contract in Task 0.

---

## Purpose

The Story 1.4 render gate is a **deterministic structural stub**. It passes the current contract test (`tests/contract/citation-or-silence.test.ts`) GREEN-by-construction because it only checks `citation_ref === null`. The real citation-or-silence invariant requires validation that does not exist yet.

This document defines **every test case Story 2.1 must add as RED** and the criteria for promoting INV-001 from `yellow` → `green`.

---

## Current Stub vs. Real Gate — Gap Analysis

| Concern | Stub (1.4) | Real Gate (2.1) |
|---------|-----------|-----------------|
| Null citation | ✅ Strips claim span | ✅ Same |
| Citation shape validity | ❌ Preserves any non-null ref | ✅ Validate against stored tuple |
| Substring accuracy | ❌ No source-doc check | ✅ Span text matches source at offsets |
| Trust-tier gating | ❌ Preserves all tiers | ✅ Tier-3 flagged/rejected per rules |
| Source accessibility | ❌ No existence check | ✅ Source doc must exist + be retrievable |
| Corroboration | ❌ Single-source passes | ✅ Uncorroborated single-source flagged |
| Expired/retracted | ❌ No TTL/supersession | ✅ Expired/retracted citations rejected |
| Runtime invocation | ❌ Callable but not wired | ✅ Every served response invokes gate (VAL-9) |

---

## Validation Concern 1: Substring Accuracy (AC-2, EI-1)

**Invariant:** The text of a cited claim span must exactly match the source document's substring at `(span_start, span_end)`.

### RED Test Cases

**TC-1.1: Valid substring passes**
- Input: span text = source_doc.substring(span_start, span_end), citation_ref with matching tuple
- Expected GREEN: span preserved, citation verified

**TC-1.2: Tampered span text fails**
- Input: span text ≠ source_doc.substring(span_start, span_end) (1-character mutation)
- Expected RED: span stripped or RenderViolation thrown, `citation_mismatch` logged

**TC-1.3: Out-of-bounds span fails**
- Input: span_end > source_doc.length
- Expected RED: span stripped or RenderViolation thrown

**TC-1.4: Span start > span end fails**
- Input: span_start > span_end (inverted)
- Expected RED: span stripped or RenderViolation thrown

**TC-1.5: Empty span text fails**
- Input: span text = "" but span_start ≠ span_end
- Expected RED: span stripped

### Property-Based Strategy (fast-check)
- Generate random source documents, random valid (start, end) offsets, extract the substring, verify the gate preserves it
- Mutate 1 character in the span text, verify the gate rejects it
- Run ≥1000 iterations per property

### Dependency
- The gate needs **async access** to source document content (from `packages/db` or `packages/citation`). The current stub is synchronous and database-free. Story 2.1 must make the gate async or accept a pre-resolved source-document map.

---

## Validation Concern 2: Trust-Tier Gating (EI-8, SEC-3)

**Invariant:** Trust tier gates claim serving. Tier-1/2 cited claims serve normally. Tier-3 (unverified/single-manual-source) claims are flagged with an "uncorroborated, single manual source" provenance string that survives the pipeline.

### RED Test Cases

**TC-2.1: Tier-1 cited claim serves without warning**
- Input: citation_ref.trust_tier = 1, valid substring
- Expected GREEN: span preserved, no warning flag

**TC-2.2: Tier-2 cited claim serves without warning**
- Input: citation_ref.trust_tier = 2, valid substring
- Expected GREEN: span preserved, no warning flag

**TC-2.3: Tier-3 cited claim serves WITH corroboration warning**
- Input: citation_ref.trust_tier = 3, valid substring
- Expected GREEN: span preserved, but output carries `uncorroborated: true` provenance marker
- Note: tier-3 is NOT rejected outright (it's a single manual source) — it must surface the provenance string per SEC-3

**TC-2.4: Claim citing non-existent tier fails**
- Input: citation_ref.trust_tier = 99 (invalid)
- Expected RED: span stripped or RenderViolation thrown

### Property-Based Strategy
- Generate claims with all valid tiers (1, 2, 3), verify tier-3 always carries the warning
- Generate invalid tiers, verify rejection

---

## Validation Concern 3: Source-Document Accessibility (EI-1, AC-4)

**Invariant:** A cited source document must exist in the system and be retrievable. A citation pointing to a deleted, missing, or inaccessible source is invalid.

### RED Test Cases

**TC-3.1: Existing source document passes**
- Input: citation_ref.source_doc_id references a document in the store
- Expected GREEN: span preserved

**TC-3.2: Non-existent source document fails**
- Input: citation_ref.source_doc_id references a UUID not in the store
- Expected RED: span stripped, `source_not_found` logged

**TC-3.3: Deleted/superseded source document fails**
- Input: citation_ref.source_doc_id references a document marked as superseded
- Expected RED: span stripped or flagged with supersession marker (per ADR-017)

### Dependency
- The gate needs access to the document store (`packages/db` or MinIO metadata). Async resolution required.

---

## Validation Concern 4: Corroboration Requirements (SEC-3, EI-5)

**Invariant:** Load-bearing claims (especially defamatory allegations) require sufficient citation coverage. A single-source allegation about a named person must surface the "uncorroborated, single manual source" provenance string.

### RED Test Cases

**TC-4.1: Multi-source corroboration passes**
- Input: claim cited by 2+ independent Tier-1/2 sources
- Expected GREEN: span preserved, `corroborated: true`

**TC-4.2: Single-source allegation flagged**
- Input: defamatory claim cited by exactly 1 Tier-3 source
- Expected GREEN: span preserved, but `uncorroborated: true` + provenance warning

**TC-4.3: Zero-source allegation stripped (already in stub)**
- Input: claim with no citation
- Expected: span stripped (existing stub behavior)

### Note
Corroboration logic is complex — it requires understanding claim semantics (is this a "load-bearing" claim?) and source independence (are two citations from the same upstream source?). Story 2.1 may implement a simplified version (single-source flag) with full corroboration deferred to Epic 4/5. **Scope decision for 2.1 author.**

---

## Validation Concern 5: Expired/Retracted Detection (ADR-017, AR-23)

**Invariant:** Citations past their retention TTL or pointing to retracted/superseded content are invalid and must be rejected or flagged.

### RED Test Cases

**TC-5.1: Fresh citation passes**
- Input: citation within TTL, source not superseded
- Expected GREEN: span preserved

**TC-5.2: Expired citation fails**
- Input: citation.created_at + TTL < now()
- Expected RED: span stripped, `citation_expired` logged

**TC-5.3: Retracted source fails**
- Input: source document has `takedown_trigger` set or `superseded_at` non-null
- Expected RED: span stripped or flagged with retraction marker

**TC-5.4: Superseded source flagged**
- Input: source superseded by a newer version (ADR-017)
- Expected GREEN or RED (scope decision): either reject, or serve with supersession flag

### Dependency
- Requires retention metadata fields (retention_policy, takedown_trigger, superseded_at) from Story 2.6 (Schema). **Story 2.6 may need to land before TC-5.x can go GREEN.**

---

## Validation Concern 6: Runtime Enforcement (VAL-9, AC-2)

**Invariant:** The render gate is invoked on **every served response**. No path exists where a response bypasses the gate.

### RED Test Cases

**TC-6.1: Gate invocation per served response**
- Verify that every API response serving a rendered document passes through `renderGate()`
- This is an integration/contract test, not a unit test

**TC-6.2: Bypass attempt detected and logged**
- If a code path serves content without invoking the gate, the system detects and logs `gate.bypass_attempt` to AC-11

**TC-6.3: Mutation test — removing gate call fails**
- Remove the `renderGate()` call from the serve path → integration test fails red (SEC-8 mutation target)

### Dependency
- Requires the serve-worker render pipeline to be wired (Story 2.1 makes the gate live, but the serve path may need Epic 5 to be fully wired). **TC-6.x may be partially RED until Epic 5.**

---

## INV-001 Promotion Criteria (Yellow → Green)

INV-001 (`docs/invariant-ledger.yaml`) promotes from `yellow` to `green` when ALL of the following are true:

1. **TC-1.x (substring)** — all 5 test cases GREEN
2. **TC-2.x (trust-tier)** — all 4 test cases GREEN
3. **TC-3.x (source accessibility)** — all 3 test cases GREEN
4. **TC-4.x (corroboration)** — TC-4.1 and TC-4.2 GREEN (TC-4.3 already GREEN from stub)
5. **TC-5.x (expired/retracted)** — TC-5.1 and TC-5.2 GREEN (TC-5.3/5.4 may defer to 2.6)
6. **TC-6.x (runtime)** — TC-6.1 and TC-6.3 GREEN (TC-6.2 may defer to Epic 5)
7. **Property-based tests** — all fast-check properties pass at ≥1000 runs
8. **Mutation test** — ≥90% mutation score on the gate file (SEC-8)

**Minimum viable GREEN for 2.1 closure:** TC-1.x, TC-2.x, TC-3.x must all be GREEN. TC-4/5/6 may have scoped deferrals with explicit ADR documentation.

---

## Architecture Dependencies for 2.1

The real gate cannot be synchronous and database-free like the stub. It needs:

1. **Async signature** — `renderGate(input, context): Promise<RenderDocument>` where context provides source-document resolution
2. **Source-document resolver** — a function/dependency that given a `source_doc_id` returns the document text (for substring validation) and metadata (for trust-tier, supersession, TTL)
3. **Citation verification** — integration with `packages/citation` verify API (from Story 1.6) to validate `content_hash`
4. **Logging integration** — gate violations logged to AC-11 editorial log (SEC-6)

**Scope decision for 2.1 author:** The gate may accept a pre-resolved source map (injected dependency) rather than doing direct DB lookups, preserving testability and the package boundary (`packages/render` imports only `@iip/contracts` — per SC-3, the gate must NOT import `@iip/db` directly; resolution happens in the serve-worker before calling the gate).
