# Reconciliation Review — TDD ↔ Internal-First PRD

**SOURCE:** `IIP_Technical_Design_Document.docx` (Draft v1.0, 2026-06-16)
**TARGETS:** `prd.md` + `addendum.md` (internal-first PRD, 2026-06-19)

**VERDICT:** The PRD preserves the TDD's integrity spirit faithfully (citation-or-silence, P0=crash, conservative-merge, FOSS/local-first all land well), but **mischaracterizes one core invariant** (the deterministic-projection rebuild path in FR-2.4), **under-represents the extraction-time anti-hallucination gate and the CI quality-gate thresholds**, and carries a **phasing discrepancy** on the senator dashboard. One real contradiction, several medium gaps.

---

## Gaps

### G1 — FR-2.4 mischaracterizes the deterministic-projection rebuild path *(also a Contradiction; see C1)*
**What:** FR-2.4 states the graph is reproducible by *"Dropping the graph and replaying **extractions**."* The TDD's data flow is strictly layered: `staging_extractions` (raw LLM output) → Graph Builder **resolve+merge** → canonical `entities`/`relationships` → AGE projection. The AGE graph is a projection of the **canonical relational tables**, NOT of raw extractions. Replaying "extractions" silently skips entity resolution/merging.
**TDD authority:** §5 ("relational tables are the system of record; the AGE graph … are derived projections"), §6.2 ("replay **from relational**"), §9.3 ("replaying **from relational tables**"), §16.3 ("replays **relational data** into AGE").
**Why it matters:** Deterministic projection is a flagship reproducibility/audit invariant. Naming the wrong source data undermines the claim's credibility and could mislead a builder into projecting directly from staging.
**Internal inconsistency:** The PRD's own glossary says it correctly ("a tested function of the **relational data**"), so FR-2.4 contradicts both the TDD and the PRD glossary.
**Severity:** Medium-High.
**Fix:** Reword FR-2.4 to *"Dropping the graph and replaying the canonical relational entities/relationships reproduces an isomorphic graph."* Align with the glossary.

### G2 — Extraction-time mechanical substring gate is under-represented
**What:** The TDD enforces a **mechanical substring check during extraction** (§8.3: "Validate every evidenceQuote / sourceQuote against the chunk text … not a literal substring → invalidate the item and trigger one retry; persistent failure drops the item"). This is distinct from the serving-time citation gate and is what makes extraction "never trusted blind" (§8). It produces the `droppedForUnverifiedQuote` job metric and the `quote_validation_drops_total` Prometheus metric. The PRD frames substring validation **only at serving** (FR-3.2, EI-6: "before it may be served").
**Why it matters:** A PRD-only reader would not know the *extraction* pipeline itself rejects hallucinated relations/claims mechanically — a core reason the knowledge graph is trustworthy at rest, not just at answer time.
**Severity:** Medium.
**Fix:** Add to FG2 (e.g., FR-2.x): "Every extracted relation/claim's source quote is mechanically substring-validated against its chunk at extraction time; non-literal quotes are dropped (with a metric), never patched in." Cross-link EI-6.

### G3 — CI hard/soft quality-gate thresholds are not surfaced as capabilities/NFRs
**What:** TDD §15.2 defines the readiness bar with **hard gates** (citation coverage 100%, quote validity 100%, projection determinism = exact) and **soft gates** (extraction precision ≥ 0.85, recall ≥ 0.75, answer groundedness ≥ 0.95, entity-resolution accuracy ≥ 0.90). The PRD's NFR-O-2 only says "hard/soft CI gates" generically; SM-4 surfaces only extraction accuracy >85%. The hard-gate set (esp. quote-validity 100% and projection-determinism exact) is the objective proof of the integrity claim and is absent from §9/§10.
**Why it matters:** These thresholds *are* the product's quality contract; a PRD that omits them lets "done" be subjective on the most safety-critical dimensions.
**Severity:** Medium.
**Fix:** Add an NFR-EI sub-table or expand NFR-O-2 to enumerate: hard = citation coverage 100%, quote validity 100%, projection determinism exact; soft = precision ≥0.85, recall ≥0.75, groundedness ≥0.95, entity-resolution ≥0.90.

### G4 — Senator dashboard phasing discrepancy (v1 vs Phase 2)
**What:** PRD §5.1 + FR-4.2 put the **senator/entity dashboard in v1**, and the PRD header defines v1 = "Phase 0 + Phase 1 core." But the TDD places the senator dashboard read model + route at **Phase 2, task D1** ("Senator dashboard read model + route"), and Phase-1 task P10 exposes only entity/timeline/evidence/graph endpoints (not `/senators/:id/dashboard`). The addendum's §Deferred-scope list also omits the senator dashboard, implying it's in v1.
**Why it matters:** This is an internal PRD tension (v1 = P0+P1, yet a P2 item is in scope) *and* a phasing mismatch with the TDD. Either the PRD is silently pulling D1 forward (product intent — allowed) or it's an oversight.
**Severity:** Medium.
**Fix:** Either (a) explicitly note FR-4.2 pulls TDD task D1 forward into v1 and why (product reason: senators-as-subjects navigation is demo-critical), or (b) defer it to match TDD phasing. Reconcile the "v1 = Phase 0 + Phase 1 core" label either way.

### G5 — "Hard gates are non-relaxable; weakening one to ship is a defect" rigor posture is missing
**What:** The TDD's engineering tone is explicit and binding: "Agents must never relax these to make a feature pass" (§1.4 callout); "disabling [the substring check] to raise recall is **forbidden**" (§8.3); Definition of Done — "A task that **weakens a hard gate to pass is rejected, not merged**" (§18); glossary "Hard gate: a CI check whose failure blocks merge **unconditionally**." The PRD captures the *integrity spirit* (P0=crash, EI invariants) but not the *enforcement posture* — that relaxing a hard gate to ship is itself a defect.
**Why it matters:** The integrity claim is only as strong as the rule that you cannot trade it away for throughput/recall/latency (CM-2 gestures at this for latency only). Without the non-relaxable posture, RK-1/RK-2 mitigations read as aspirations.
**Severity:** Medium-Low.
**Fix:** Add a one-line NFR-EI or a §6 governance line: "Hard gates block merge unconditionally; weakening a hard gate (citation coverage, quote validity, projection determinism) to make a feature pass is itself a P0 defect."

### G6 (minor) — Single-system-of-record backup posture under-represented
**What:** TDD §16.3: "Postgres is the only stateful system of record to back up; the AGE graph and Meilisearch indexes are rebuildable projections … MinIO snapshots are append-only … not on the serving path." The PRD's NFR-A-1/A-2 cover auditability/reproducibility but not the operational corollary (one stateful store to back up; all else rebuildable; raw store off the serving path). Relevant to disaster recovery and the audit/replay story.
**Severity:** Low.
**Fix:** Fold into NFR-A: "Postgres is the sole stateful system of record (backed up); AGE/search indexes are rebuildable projections; raw snapshots are append-only and off the serving path."

---

## Contradictions

### C1 — FR-2.4 "replaying extractions" vs TDD "replaying relational tables" *(see G1)*
- **PRD (FR-2.4):** "Dropping the graph and replaying **extractions** reproduces an isomorphic graph."
- **TDD (§9.3 / §6.2 / §16.3):** "dropping iip_graph and replaying **from relational tables** yields an isomorphic graph"; "replays **relational data** into AGE."
- **Note:** The PRD glossary agrees with the TDD ("a tested function of the **relational data**"), so FR-2.4 is also internally inconsistent. The AGE graph is projected from *canonical entities/relationships*, which are the output of resolution/merge over staged extractions — not from extractions directly.

No other hard contradictions found. The senator-dashboard phasing (G4) is a scope/phasing mismatch rather than a direct factual contradiction.

---

## Correctly captured — no action

- **Citation-or-silence (EI-1)** — matches TDD §1.4 + §10 no-evidence path; "no uncited-answer code path" preserved.
- **Fact-vs-claim + P0=crash (EI-2)** — TDD's "an unproven allegation as fact is a P0 defect, identical in severity to a crash" is preserved verbatim in spirit (§2, EI-2) and even foregrounded.
- **Source-verb preservation (EI-3)** — "alleged/testified/voted preserved verbatim, never paraphrased" matches TDD §1.4/§10.3.
- **Provenance everywhere (EI-4)** — source doc + character span matches TDD §1.4/§5.2.
- **Conservative merge (EI-5)** — the exact "duplicate node is cosmetic; wrong merge corrupts every downstream answer" language is preserved (TDD §9.1).
- **Anti-hallucination substring gate (EI-6/FR-3.2)** — serving-time gate correct; only the *extraction-time* twin is missing (G2).
- **Idempotent writers (NFR-A-3)** — "upsert on dedupe anchors, never blind inserts" matches TDD §5.2 idempotency anchors.
- **Deterministic projection (glossary)** — correct in glossary; only FR-2.4 wording is wrong (G1/C1).
- **Read-only public API v1 (NFR-S-1)** — matches TDD §12/§13.4; UUID validation + parameterized queries (NFR-S-2) match §13.4.
- **Single-node best-effort (NFR-R-1)** — matches TDD §17.1.
- **Batch, not streaming** — matches TDD §1.3 (Phase 4+).
- **Hop/count caps (NFR-P-3)** — matches TDD §6.3 (1-hop, LIMIT 100) + §17.2.
- **Robots-respect / disable-not-bypass (FR-1.2, NFR-L-1)** — matches TDD §7.2 legal/ethical boundary.
- **Trust tiers (FR-1.1, glossary)** — matches TDD `sources.trust_tier` 1..3.
- **Open questions** — embedding lock (OQ-1 ↔ TDD §17.3), AGE vs Neo4j (OQ-2), retention (OQ-5/NFR-L-4), HITL on high-severity contradictions (§6.2/RK-8/OQ-6 ↔ TDD §17.3 "recommended yes for launch") all surfaced.
- **FOSS + local-first posture (NFR-D-1…D-3)** — matches TDD §1.4/§16; cloud as optional pluggable tier, never required, recorded for provenance.
- **No-evidence path as a feature** — TDD §10 "a valid, desirable response" preserved (FR-5.3, §3.2 "honest silence").
- **Agents communicate only via DB+queue** — captured in addendum §Orchestration (correctly treated as implementation).
- **date_precision** — TDD `timeline_events.date_precision` captured as FR-4.1 ("March 2026 ≠ March 1, 2026").
- **extractor_version provenance** — FR-2.1 "change in extractor version recorded" matches TDD §8.2/§13.3.

---

### Summary of actions (by severity)
1. **G1/C1 (Med-High):** Fix FR-2.4 — graph rebuilds from canonical relational data, not "extractions."
2. **G2 (Med):** Surface the extraction-time substring gate as an FG2 capability.
3. **G3 (Med):** Enumerate the TDD §15.2 hard/soft gate thresholds in §9 or §10.
4. **G4 (Med):** Reconcile senator-dashboard phasing (pull-forward note or defer).
5. **G5 (Med-Low):** Add the "hard gates are non-relaxable" enforcement posture.
6. **G6 (Low):** Fold the single-system-of-record backup posture into NFR-A.
