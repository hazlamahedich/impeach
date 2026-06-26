---
id: ADR-006
title: OCR Technology Selection — Docling + PaddleOCR-VL
status: Accepted
date: 2026-06-26
supersedes: null
superseded_by: null
deciders: [Winston (architect), Amelia (developer), user]
related: [SC-9, FR-1.3, NFR-A-2, ADR-005, ADR-007]
evidence:
  - _bmad-output/planning-artifacts/architecture.md (SC-9 ADR-006 seed; §Models — Docling + PaddleOCR-VL, ADR-006)
  - _bmad-output/planning-artifacts/research/domain-philippine-sources-and-document-formats-research-2026-06-19.md (Philippine source formats: scanned fallos, Senate journals, PDFs)
  - _bmad-output/planning-artifacts/research/technical-local-llm-extraction-feasibility-2026-06-19.md
---

# ADR-006: OCR Technology Selection — Docling + PaddleOCR-VL

## Context

Philippine impeachment source material arrives in formats that defeat naive
text extraction: scanned Supreme Court *fallos*, image-only Senate journals,
photographed COMELEC resolutions, and PDFs whose text layer is unreliable.
FR-1.3 requires the ingestion plane to extract clean text + layout structure
from these artifacts before chunking/embedding (ADR-020) and extraction
(ADR-005). A defamation-grade system cannot cite a span it cannot read; OCR
quality is therefore a citation-fidelity precondition (AC-4), not a
convenience.

The constraint conjunction: FOSS (NFR-D-3), local-first (NFR-D-1, runs on the
single workstation), layout-aware (citations need bounding boxes for span
anchoring), and reproducible (AC-6 — OCR output must be deterministic under a
pinned model/pipeline version, stamped in `extractor_version`).

## Decision

**Docling as the document-understanding front end + PaddleOCR-VL as the OCR
engine for image-only pages.**

1. **Docling** parses born-digital and mixed PDFs into a structured layout
   (paragraphs, tables, reading order, bounding boxes). It owns the
   document-model normalization that chunking and span-anchoring depend on.
2. **PaddleOCR-VL** runs only on pages Docling flags as image-only / scanned.
   It is the OCR fallback, not the default path — born-digital text extraction
   is always preferred (lossless, deterministic).
3. The OCR pipeline is a `@iip/llm-router`-adjacent adapter behind an
   `OcrPort` interface (SC-5): `ocr(document) → { pages: { text, spans }[] }`.
   Both engines are pluggable; swapping either is a config change, not a
   schema migration.
4. OCR model + pipeline version are stamped into `extractor_version`
   (`modelId`, `ocrVersion`, `doclingVersion`) on every extraction row so
   re-running OCR under a pinned version reproduces the same spans (AC-6).
5. The pipeline runs **CPU-only on Apple Silicon** (PaddlePaddle has no Metal
   backend for OCR); expected latency is documented so eval CI times are not
   misread as regressions.

## Alternatives

1. **Tesseract (single engine).**
   - Rejected as the sole engine. Tesseract is FOSS and local but has no
     layout-understanding model; table/column/reading-order reconstruction on
     scanned Philippine court PDFs is poor, and span bounding boxes are too
     coarse for AC-4 character-level anchoring. Viable as a future Docling
     backend swap behind `OcrPort`, not as the v1 default.
2. **Cloud OCR (Google Document AI, AWS Textract).**
   - Rejected. Violates NFR-D-1/D-2 (local-first, no proprietary cloud
     dependency) for a workload that does not need it, and ships source
     document text to a third party — a republication/retention risk under PH
     cyberlibel (NFR-L-4).
3. **Docling only (no dedicated OCR engine).**
   - Rejected. Docling's own OCR integration is improving but lagged
     PaddleOCR-VL on low-resolution scanned fallos in the feasibility check.
     PaddleOCR-VL as the image-only fallback closes the gap.
4. **Surya / nougat (academic OCR-layout models).**
   - Deferred. Promising on layout but less battle-tested than PaddleOCR on
     Filipino/English mixed scripts; revisit at F3+ behind the `OcrPort`.

## Consequences

- Two OCR-related dependencies are pinned (Docling, PaddlePaddle). PaddlePaddle
  on Mac arm64 is CPU-only and slow — this is a documented latency cost, not a
  bug; eval CI budgets must account for it.
- The `OcrPort` interface (SC-5) means a future OCR swap (Surya, a Docling OCR
  upgrade) is an adapter change, not a re-extraction of the corpus — spans are
  content-hashed (ADR-010) so re-OCR produces new extraction rows, not in-place
  mutations (AC-4 citation-decoupling).
- OCR is **non-deterministic across versions** by default; the version-stamped
  `extractor_version` envelope + content-hash dedupe anchors make a given
  extraction reproducible-as-was (AC-6 scoped reproducibility).

## Open questions

| # | Question | Owner | Trigger |
|---|----------|-------|---------|
| 1 | At what scanned-document volume does CPU-only PaddleOCR on the build host become an eval-CI bottleneck (GPU offload)? | Architect/Infra | F4 bulk-ingest milestone |
| 2 | Should the `OcrPort` adapter normalize bounding boxes to a canonical coordinate system shared with the citation span model (ADR-010)? | Architect | Story 2-1 / span-anchoring work |
| 3 | Is PaddleOCR-VL's Filipino/Tagalog script accuracy sufficient, or is a language-specific fine-tune needed pre-PD-3? | Analyst/QA | Pre-PD-3 gate (G2 adversarial rerun) |
