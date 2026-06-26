---
id: ADR-010
title: Citation Hash Algorithm — SHA-256 via Web Crypto API
status: Accepted
date: 2026-06-25
supersedes: null
superseded_by: null
deciders: [Winston (architect), Amelia (developer), Murat (test architect), user]
related: [AC-4, SC-2, SEC-2, SEC-6, NFR-A-1, ADR-001, ADR-008, ADR-017]
evidence:
  - _bmad-output/test-artifacts/atdd/epic-1/story-1-6/citation-tuple.test.ts (test 3: hash algorithm defined per ADR-010)
  - _bmad-output/project-context.md (line 38: crypto.subtle.digest, NOT node:crypto)
  - packages/contracts/src/citation.ts (CitationTuple schema)
  - packages/citation/src/index.ts (emit/verify implementation)
---

# ADR-010: Citation Hash Algorithm — SHA-256 via Web Crypto API

## Context

Story 1.6 (Citation Package, SC-2/AC-4) requires a content hash as part of the
`CitationTuple` — the provenance data structure that binds every claim to its
source span. The hash must:

1. **Detect tampering** — `verify(citation, source)` must return `false` if the
   source text has been altered (SEC-2, SEC-6: citation-swap is a defamation
   attack vector).
2. **Survive re-indexing** — the hash binds to span text, not embedding vectors
   (AC-4 essence). Re-embedding the same document must produce the same hash.
3. **Be deterministic across process boundaries** — no salt, no nonce, no
   runtime-dependent state.
4. **Be portable** — the citation package may run in Node.js, edge workers, and
   browser contexts (Next.js RSC).

Two candidate algorithms were considered: **xxhash** (non-cryptographic, fast)
and **SHA-256** (cryptographic, slower).

## Decision

**SHA-256 via the Web Crypto API (`crypto.subtle.digest`).**

The hash is computed as:

```
SHA-256(canonicalizedSpanText)
```

Where `canonicalizedSpanText` is `source.text.slice(span.start, span.end)`
with Unicode normalization (NFC) applied.

The output is a 64-character lowercase hex string.

## Alternatives

### Why SHA-256 over xxhash

| Concern | xxhash | SHA-256 |
|---------|--------|---------|
| Tamper detection | None — xxhash is not collision-resistant; a motivated adversary can craft a collision | Cryptographic collision resistance |
| Defamation-grade | Insufficient for SEC-2/SEC-6 threat model | Meets the bar |
| Performance | ~10 GB/s | ~200 MB/s (still negligible for span-sized inputs) |
| Standardization | No FIPS/NIST recognition | FIPS 180-4, universally available |

For a defamation-grade system where citation-swap is a documented attack vector
(SEC-2, SEC-6), a non-cryptographic hash is indefensible. The performance
difference is irrelevant: citation hashes are computed on span-sized text
(typically < 1 KB), not bulk data.

### Why Web Crypto API over node:crypto

| Concern | node:crypto | Web Crypto (crypto.subtle) |
|---------|-------------|---------------------------|
| Node.js | Yes | Yes (Node 19+) |
| Edge workers | No | Yes |
| Browsers | No | Yes |
| Next.js RSC | Conditional | Yes |
| API style | Synchronous | Async (Promise-based) |

The Web Crypto API is the portable choice. `crypto.subtle.digest('SHA-256', data)`
works in every runtime the citation package may target. `node:crypto` is
Node-only and would break in edge/browser contexts.

### Why no salt/nonce

The hash must be deterministic across process restarts and across re-indexing
events. A salt or nonce would make the hash non-reproducible, breaking the
`verify()` contract and the AC-4 requirement that content_hash survives
re-indexing.

## Consequences

- `packages/citation/src/index.ts` implements `emit()` and `verify()` using
  `crypto.subtle.digest('SHA-256', encoder.encode(text))`.
- `CitationTuple.content_hash` is a 64-char hex string validated by zod regex.
- `CorpusHash` branded type prevents accidental assignment of non-hash strings.
- `node:crypto` is NOT imported anywhere in the citation package.
- The hash is NOT a cryptographic signature — it provides tamper detection
  (integrity), not non-repudiation. Digital signatures are a separate concern
  (ADR-007, deferred to Epic 3).

## Open questions

| # | Question | Owner | Trigger |
|---|----------|-------|---------|
| 1 | Should the citation hash additionally cover surrounding context (sentence/paragraph) to resist truncation attacks, or remain span-only? | Architect | Pre-PD-3 launch gate (VAL-7) |
| 2 | At what corpus scale does SHA-256 of span-sized text become a measurable bottleneck worth profiling? | Developer | F4 bulk-embed milestone |
| 3 | Is a parallel Ed25519 signature over the citation tuple required for non-repudiation (ADR-007 / Epic 3)? | Architect | When two-person intake state machine lands (Story 2-3) |
