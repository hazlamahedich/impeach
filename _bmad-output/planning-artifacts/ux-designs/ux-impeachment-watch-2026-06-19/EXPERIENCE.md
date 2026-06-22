---
project: Impeachment Watch
status: final
sources:
  - planning-artifacts/prds/prd-impeachment-watch-2026-06-19/prd.md
  - planning-artifacts/prds/prd-impeachment-watch-2026-06-19/addendum.md
  - planning-artifacts/architecture.md
  - planning-artifacts/research/domain-research-philippine-impeachment-mechanics.md
  - planning-artifacts/research/domain-philippine-impeachment-knowledge-representation-standards-research-2026-06-19.md
  - planning-artifacts/research/domain-philippine-sources-and-document-formats-research-2026-06-19.md
  - planning-artifacts/research/domain-philippine-impeachment-intelligence-political-knowledge-graphs-research-2026-06-19.md
  - planning-artifacts/research/market-customer-segments-use-cases-2026-06-19.md
  - planning-artifacts/research/market-competitive-landscape-2026-06-19.md
  - planning-artifacts/research/market-philippine-political-intelligence-civic-tech-2026-06-19.md
  - planning-artifacts/research/industry-research-civic-tech-legal-political-platforms-2026-06-19.md
  - planning-artifacts/research/technical-citation-eval-graph-viz-research-2026-06-19.md
  - planning-artifacts/research/technical-graph-db-apache-age-evaluation-research-2026-06-19.md
  - planning-artifacts/research/technical-iip-technology-stack-validation-research-2026-06-19.md
  - planning-artifacts/research/technical-orchestration-kg-construction-retrieval-research-2026-06-19.md
  - planning-artifacts/ux-designs/ux-impeachment-watch-2026-06-19/.decision-log.md
  - planning-artifacts/ux-designs/ux-impeachment-watch-2026-06-19/DESIGN.md
updated: 2026-06-19
---

# Impeachment Watch — Experience Spine

> Desktop-first responsive web. shadcn/ui on Next.js 15 + Tailwind 4. Paired with `DESIGN.md` (Impeachment Watch DESIGN.md). This spine specifies behavioral deltas on shadcn defaults. Visual specs live in DESIGN.md.Components.

## Foundation

Desktop-first responsive web. shadcn/ui on Next.js 15 (App Router, RSC) + Tailwind 4. The component library does most of the work; brand discipline is "respect the defaults except where the brand layer overrides them" (see DESIGN.md). Single-case v1 (Sara Duterte impeachment); the UI does not surface case selection.

**Rendering model.** RSC `fetch` to `/api/v1` in server components for the initial payload on heavy data-dense pages (graph, timeline, document viewer). React Query 5.x for client-side mutations/refetches. One HTTP wrapper (`lib/api.ts`, AbortController + retry; lint bans raw `fetch`). No SSE streaming in v1 — `/query` returns a complete `QueryAnswer` (simpler contract, deterministic for the eval harness and PD-3 gate-time re-run).

**State management.**
- **React Query 5.x** — server state (query answers, graph neighborhoods, timeline, evidence, senator read-model, document).
- **Zustand 5.x** — ephemeral interaction: graph node selection, timeline filters, citation modal state, chat draft. Stores in `lib/state/{graph-store, timeline-store, chat-store, citation-store}.ts`.
- **nuqs 2.x** — URL-shareable state: active entity, time range, view mode, graph renderer, graph seed. `lib/state/url-keys.ts` is the single nuqs URL-key registry — every param name/parser in one file, no drift.

**URL is a public API for journalists.** Every shareable state is URL-encodable. `/claim/[id]` is addressable. `?seed=`, `?renderer=cytoscape|react-flow|sigma`, `?active=senator-x`, `?from=`, `?to=` are the v1 params. Shareability is a constraint, not a feature. `DESIGN.md` is the visual identity reference.

## Information Architecture

Seven consumer surfaces + six operator surfaces (operator surfaces are internal-first; this spine covers their behavioral shape, not full spec — they are out of external-presentation scope for v1).

| Surface | Route | Reached from | Purpose |
|---|---|---|---|
| Chat | `/chat` | Root nav / direct URL / journey entry | NL Q&A with citation-or-silence; the citizen + journalist entry point |
| Claim | `/claim/[id]` | Citation modal / chat answer / graph node / direct URL | Addressable claim surface; full claim, provenance, source document, shareable URL |
| Graph | `/graph` | Root nav / chat answer / senator dashboard / timeline | Interactive knowledge graph explorer (Trace default, Explore/Query/Temporal advanced) |
| Timeline | `/timeline` | Root nav / graph / case overview | Dated events at day/week/month/year granularity; narrative-beat markers |
| Evidence compare | `/evidence/compare?ids=…` | Chat answer / claim surface / graph | Honest-split evidence explorer (supporting / refuting / contextualizing) |
| Senator dashboard | `/senators/[id]` | Graph node / nav / direct URL | Lightweight v1 read-model: statements, votes, participation, personal timeline |
| Document viewer | `/documents/[id]` | Citation modal "View full document" | Span-anchored document viewer; the terminus of provenance drill-down |

**Operator surfaces (internal-first, out of external-presentation scope):** Source registry, ingestion dashboard/monitoring, **manual document upload**, extraction-quality spot-check, dead-letter triage, Pre-External Gate review, retraction/correction display. These inherit shadcn admin patterns; full behavioral spec deferred except where noted below for manual upload.

### Operator surface: Manual document upload

Because several tier-1 sources (House, Senate, Supreme Court, PNA, ABS-CBN) block automated access via Cloudflare, the Intake Operator must be able to upload public documents manually and attach the provenance metadata required by FR-1.4/FR-1.5.

**Route:** `/admin/upload` (or surfaced inside the source registry as "Upload to source").

**Key flow:**

1. **Select source.** Operator picks an existing registered source (e.g., "House of Representatives"), or creates a one-off `manual` source entry. The source's `trust_tier` and `source_type` are locked before upload.
2. **Attach file(s).** Drag-and-drop or file picker; supported types: HTML, PDF, plain text. Each file is hashed (SHA-256) immediately on the client.
3. **Fill provenance form (mandatory).** The form enforces the provenance contract:
   - `source_url` — original public URL, or "manual" + agency/contact if no URL exists.
   - `obtained_via` — dropdown: `scrape`, `manual_download`, `foirequest`, `partnership`, `other`.
   - `retrieved_at` — date/time the operator obtained the document.
   - `uploader_id` — acting principal (from auth middleware).
   - `legal_basis` — short note on why the document is public/lawfully accessible (e.g., "public House press release").
   - `access_notes` — optional: Cloudflare block, robots.txt status, paywall check.
4. **Two-person review trigger (SEC-2).** For sensitive/defamation-adjacent documents, the upload enters `staging` state; a second distinct principal must review and approve before extraction runs. For low-risk reference documents (e.g., Lawphil rules), a single operator + auto-approval may be configurable.
5. **Store raw snapshot.** On submit, the raw file is written to MinIO under `raw/{source}/{yyyymmdd}/{sha256}`; a `documents` row is created with `content_checksum`, `raw_snapshot_key`, `source_id`, and provenance metadata.
6. **Enqueue extraction.** If the document is approved, an `extract:queue` job is emitted via the Enqueuer. If staged, it waits for second approval.
7. **Audit trail.** Every action is recorded in the AC-11 editorial log: `intake.manual_upload`, `intake.reviewed_once`, `intake.approved`, `intake.extract_queued`.

**Behavioral rules:**
- The upload UI refuses to submit if any provenance field is missing or if `source_url` is not a valid URL (except for the special "manual" token).
- The UI shows the computed SHA-256 and warns if the same checksum already exists (deduplication).
- The UI does not allow upload if the source is marked `enabled: false` without an explicit override reason logged to AC-11.
- The operator can upload multiple files in one batch; each file becomes a separate `documents` row with shared provenance defaults but individually editable source URLs.

Spines win on conflict with any mock or import in `imports/`.

→ Visual references: `mockups/graph-trace.html` (Graph in Trace default), `mockups/chat-answer.html` (Chat — sourced answer + silence), `mockups/evidence-compare.html` (Evidence compare — honest split + one-sided empty), `mockups/senator-dashboard.html` (Senator dashboard — lightweight v1). Spines win on conflict.

**Navigation model.** Left sidebar on `xl` (icons + labels), collapses to icon-rail on `lg`, becomes a `Sheet` on `md` and below. Top bar holds: the essence sentence (truncated), dark-mode toggle, and a persistent search/command entry (`⌘K` → routes to `/chat?q=`). No case selector (single-case v1). The graph, timeline, evidence, and senator surfaces interlink bidirectionally: graph node click → citation modal → document viewer; timeline event click → graph `?seed=`; senator dashboard → graph `?seed=senator-x`; claim surface → evidence `?ids=`.

**URL params (centralized in `lib/state/url-keys.ts`).** `?seed=` (graph center entity), `?renderer=cytoscape|react-flow|sigma`, `?active=` (selected node, drives citation modal), `?mode=trace|explore|query|temporal` (graph mode), `?from=` / `?to=` (temporal scrubber window, ISO-8601), `?q=` (chat query). `/claim/[id]` and `/documents/[id]` and `/senators/[id]` are path-addressable.

## Voice and Tone

Microcopy. Brand voice and aesthetic posture live in `DESIGN.md`.

| Do | Don't |
|---|---|
| "What allegations have been made about the confidential funds, and who made them?" (user, echoed back as the query) | Rephrase the user's question to "soften" it |
| "No sourced answer found." (verbatim — FR-5.3) | "I couldn't find anything," "No results," "Try rephrasing" (implies the question was wrong) |
| "Only supporting evidence detected in v1; refuting evidence was not surfaced — v1 does not detect contradictions." (verbatim — PRD §6.3) | "No refuting evidence found" (implies absence = consistency — banned, FR-5.4) |
| "Senator Hontiveros stated X on [date]." (attributed, source-verb preserved) | "Senator Hontiveros said X" (paraphrased — banned, EI-3) |
| "IIP does not make predictions. Here is what is on record: [sourced statements, voting history, relationships]. Draw your own inference." (verbatim — decision log Journey 2 climax) | "Senator X is likely to vote to convict" (predictive — banned) |
| "Alleged" framing on all unproven charges (EI-3, domain rule 9) | "Proven," "confirmed," "true," "verified" (banned, FR-5.4) |
| "Superseded on [date]. The original assertion is preserved for reproducibility." | Silently remove or hide retracted assertions (STR-6b) |
| "Convicted (impeachment standard — 2/3 Senate vote). The respondent remains liable to criminal/civil prosecution in regular courts." (domain rule 6) | "Guilty," "criminal conviction," or any implication of criminal guilt from an impeachment verdict |
| Preserve official titles verbatim: "Chief Justice," "Senate President," "Ombudsman," "Presiding Officer" | Editorialize or abbreviate titles |
| Distinguish "acquitted," "resigned," "voided by SC" as separate outcomes (domain rule 12) | Collapse them into "case closed" |
| Neutral, precise, institutional | Warm, casual, conversational, emoji, exclamation marks |

## Component Patterns

Behavioral. Visual specs live in `DESIGN.md.Components` (or in shadcn defaults, when inherited).

| Component | Use | Behavioral rules |
|---|---|---|
| Citation compound (`<Citation><Citation.Chip/><Citation.Modal/></Citation>`) | Every served assertion; graph nodes; claim surface; chat answers | Chip renders inline in answer text. Click → modal opens (one level deep). Modal shows verbatim quoted passage (`mono`), trust-tier badge, source-verb tag, "View full document" link. Click link → `/documents/[id]` scrolled to anchored span. `<Citation.Empty>` renders by default; promotes to `<Citation.Chip>` only when provenance resolves (AC-2 enforced at component boundary, not at code review). `CitationContext` provider at root layout so a graph node selected at 2am flows to the modal without prop-drilling. |
| Claim (`<Claim>`) | Chat answers; claim surface; graph side panel; evidence rows | Renders the fact-vs-claim distinction. `variant="fact"` → solid border, full ink. `variant="attributed"` → dashed border, italic, muted. `variant="dashed"` → strikethrough, faded (superseded). Every served assertion passes through `<Claim>` — it is the EI-2 gate at the render layer. |
| Graph explorer | `/graph` | One shell, renderer swaps by node count: Cytoscape default; Sigma swap at >10K nodes; React Flow for curated sub-views <2K. `tier-router.ts` is a pure function `(nodeCount, mode) → renderer`, URL-encodable `?renderer=`. Default mode = Trace (opens centered on respondent or `?seed=` actor with immediate neighbors + persistent temporal scrubber). Explore = free-form neighborhood expansion. Query = structured Cypher-backed search. Temporal = scrubber-driven animation. Click node → Zustand graph-store → nuqs URL (`?active=`) → `CitationContext` → citation modal. Hop-capped (NFR-P-3). |
| Timeline scrubber | `/graph` (bottom-pinned), `/timeline` (primary) | Drag handles to set window; window drives `?from=` / `?to=`. Imprecise dates (date_precision ∈ {day, month, year, approx}) render as ranges, not points — "March 2026" spans the March band. Narrative-beat markers (see Narrative Beats section) sit on the track. Scrubbing in Temporal mode animates the graph — edges outside the window fade to `{colors.border}` 0.4 opacity. |
| Evidence split | `/evidence/compare?ids=…` | Three panels: Supporting / Refuting / Contextualizing. Each panel lists evidence rows (claim + citation chip + trust badge). One-sided empty panel uses the verbatim copy (PRD §6.3): *"Only supporting evidence detected in v1; refuting evidence was not surfaced — v1 does not detect contradictions."* Never silently empty — the honest split is a first-class FR (FR-5.4, EI-7). |
| Senator dashboard | `/senators/[id]` | Lightweight v1 read-model (full dashboard deferred to Phase 2). Shows: statements on record (attributed claims with citation chips), past votes (roll-call, per-article), committee participation, personal timeline entries tied to the case. Thin dashboard (publicly-undecided senator) shows what it has and is honest about what it doesn't — no "no data" apology, just absence. |
| Chat answer | `/chat` | `answer-block` with 3px primary left border. Answer text + inline citation chips. Essence sentence renders below every answer (caption italic muted). Silence state: `answer-block-silence` — "No sourced answer found." No "try rephrasing," no suggested next steps that tempt invention. The silence is the answer. |
| Document viewer | `/documents/[id]` | Span-anchored. Arrived via citation modal "View full document" → scrolled to the anchored span, highlighted in `{colors.accent}` 0.25. Superseded passages carry a 3px `{colors.claim-dashed}` left border + "Superseded" flag. Body in `mono` — the raw record, unparaphrased. |
| Empty states | Everywhere | `display-sm` muted headline + `body-md` muted body + at most one primary action. The "No sourced answer found" empty state is first-class and carries no suggested next steps that would tempt invention. The "No evidence" state (backing service returned `noEvidence: true`) is equally first-class. |
| Trust badge | Citation modal, evidence rows, claim surface, senator dashboard | Three variants: verified (tier-1 primary), contradicted (sources disagree), caution (tier-3 / single-source). Always paired with an icon (check / split / eye) and a label — never color alone (a11y). |
| Source-verb tag | Citation modal, claim component, evidence rows, chat answers | Renders the preserved verb verbatim from `lib/citation/source-verbs.ts` (EI-3 — adding a verb is a one-line edit). Never paraphrased stronger/weaker. Risk variant (`source-verb-tag-risk`) for verbs flagged in editorial review. |

## State Patterns

| State | Surface | Treatment |
|---|---|---|
| Cold-load | Graph, timeline, evidence, document | shadcn `Skeleton` matching expected layout. Graph shows canvas + skeleton side panel. Timeline shows skeleton track + markers. Resolves on data. |
| Empty — no sourced answer | `/chat` | First-class. `answer-block-silence`: "No sourced answer found." No suggested next steps that tempt invention. Essence sentence still renders below. This state is a trust signal, not a failure — the platform refused to invent (Journey 1 climax). |
| Empty — no evidence | `/evidence/compare`, graph, claim | `<Citation.Empty>` renders. `display-sm` muted headline: "No evidence on record." Body: honest framing — what the platform has vs. what it doesn't. No apology, no "try again." |
| Empty — one-sided evidence | `/evidence/compare` | The refuting/contextualizing panel shows the verbatim copy (PRD §6.3): *"Only supporting evidence detected in v1; refuting evidence was not surfaced — v1 does not detect contradictions."* Dashed-border panel, muted text. Never silently empty. |
| Empty — thin senator dashboard | `/senators/[id]` | Shows what it has (may be few statements, no past impeachment votes). No "no data" apology. The absence is the signal — a publicly-undecided senator has less on record. |
| Focus | Graph, timeline, document, evidence | Selected node/event/row carries accent ring (`graph-node-selected`). nuqs `?active=` updates. Citation modal reflects the focused artifact. |
| Error — backing service degraded | All | Fail-closed (AC-2/SEC-5): refuse to serve. Unavailability > wrongness. Surface: "IIP cannot reach its backing services right now. No answer is safer than a wrong one." Rendered as `answer-block-silence` on `/chat`; full-surface replacement on data-dense surfaces. `aria-live="assertive"`. No retry-loop, no cached stale answer. |
| Error — rate-limited | All (per-IP, NFR-S-3) | shadcn `Toast`: "Rate limited. Retry after {Retry-After}s." No silent drop. |
| Error — query timeout | `/chat` | "This query did not complete within the time limit. No answer was generated." `aria-live="assertive"`. Never a partial/hallucinated answer. |
| Error — citation drill-down depth | Citation modal → document | If the document is unavailable (retracted source, broken span), the modal shows "This source could not be reached. The citation is preserved for reproducibility." The assertion is not served without its citation. |
| Degraded — renderer fallback | `/graph` | If WebGPU unavailable (Cosmograph path) → precompute layout server-side or fall back to Sigma. If WebGL unavailable (Sigma path) → fall back to Cytoscape with a node-count warning. If all fail → filtered list view (see Responsive & Platform). |
| Supersession / retraction | Anywhere a superseded assertion appears | `claim-dashed` styling: strikethrough, darkened to AA 4.5:1, 3px dashed left border. "Superseded on [date]" flag. Original preserved for reproducibility (STR-6b/ADR-017). Cache-bust on supersession event. |
| Citation drill-down depth | Citation modal → document → return | Modal → "View full document" → `/documents/[id]` scrolled to span (focus moves to anchored passage via `tabindex="-1"` + route effect) → browser back returns to the originating surface. No modal stack > 1 level. |
| Graph capped-rendering | `/graph` | When hop/count caps (NFR-P-3) hit, the graph shows what loaded + a non-blocking banner: "Showing immediate neighbors. Explore mode for further expansion." Never silently truncated. |
| Timeline imprecise date | `/timeline`, `/graph` temporal | date_precision ∈ {day, month, year, approx} → renders as a range band on the scrubber, not a point. "March 2026" ≠ "March 1, 2026." The precision is preserved, never inflated. |
| No-prediction response | `/chat` | First-class state. `aria-live="assertive"`. When the user asks a predictive question (Journey 2 climax): *"IIP does not make predictions. Here is what is on record: [sourced statements, voting history, relationships]. Draw your own inference."* The raw material is served; the platform does not overstep. |
| Offline | Global | Out of v1 scope (decision log). Batch ingestion; no live write surface. If a user loses connectivity mid-session, shadcn `Toast`: "You're offline. This page may not reflect the latest data." |
| Permission denied | N/A v1 | Operator surfaces are internal-first; no consumer-facing auth gate in v1 (JWT-protected during internal period, per architecture STR-11). |

## Interaction Primitives

**Graph interactions (desktop-first, mouse + keyboard):**
- Pan: drag canvas, or `arrow keys` when canvas is focused.
- Zoom: scroll wheel, or `+` / `-`, or pinch on trackpad.
- Filter by type: side panel checkboxes (entity types, relationship types, trust tiers). Updates `?filters=` (URL-encodable).
- One-hop expand: double-click a node, or `Enter` when node is focused. Hop-capped (NFR-P-3).
- Mode switch: Trace ↔ Explore ↔ Query ↔ Temporal. Mode tabs in the side panel; updates `?mode=`. Trace = default.
- Temporal scrub: drag scrubber handles; graph edges outside window fade. `?from=` / `?to=` update.
- Click node → `?active=` updates → `CitationContext` → citation modal opens with the node's provenance.
- Keyboard: `Tab` cycles nodes in graph-reading order (a11y — see Accessibility Floor). `Esc` closes modal/panel. `?` opens keyboard shortcut help.

**Citation drill-down flow:**
1. Click citation chip in chat answer / claim / evidence row / graph node.
2. Citation modal opens (one level deep): verbatim quoted passage (`mono`), trust-tier badge, source-verb tag, document title.
3. Click "View full document" → `/documents/[id]` scrolled to anchored span, highlighted.
4. Browser back → returns to originating surface with state preserved (nuqs URL).

**URL shareability.** Every graph/timeline/evidence state is URL-encodable via nuqs. A journalist copies the URL; a colleague opens the exact same view. `/claim/[id]` is addressable and shareable. This is a constraint, not a feature.

**Keyboard shortcuts (desktop-first):**
- `⌘K` / `Ctrl+K` — Command palette (routes to `/chat?q=`, navigates surfaces, acts).
- `g c` — Go to Chat. `g g` — Graph. `g t` — Timeline. `g e` — Evidence. `g s` — Senators list.
- `Enter` — Open focused node/row (graph, evidence, senator list).
- `Esc` — Close modal, panel, or exit edit.
- `?` — Keyboard shortcut help.
- `/` — Focus search in current surface.

**Banned interactions:**
- Drag-to-reorder (not a v1 interaction model).
- Infinite scroll (pagination only).
- Hover-only affordances on `md` and below (touch users tap to reveal).
- Modal stacks > 1 level deep.
- Predictive/suggestive autocomplete in the chat query bar that implies the platform "knows" the answer before it returns one.
- Any interaction that paraphrases a source verb or labels an attributed claim as "verified."

## Accessibility Floor

WCAG 2.1 AA across the responsive web surface. Regulated-leaning product → this is non-negotiable. Behavioral. Visual contrast lives in `DESIGN.md` (inherits shadcn's WCAG AA-compliant defaults; brand overrides verified to maintain ratios).

- **Color is never the only signal.** Trust-tier badges pair color with an icon (check / split / eye) and a label. Fact-vs-claim distinction uses border style (solid vs. dashed) + text style (roman vs. italic) + weight, not color alone. Source-verb tags are text, not color swatches.
- **Fact-vs-claim is programmatically conveyed.** `<Claim>` renders a visually-hidden prefix or `aria-label` — e.g. `aria-label="Fact: …"` / `aria-label="Attributed claim: …"` / `aria-label="Superseded: …"` — so screen readers announce the distinction, not just the visual style. `aria-live="polite"` announces claim-type changes in dynamic contexts (e.g., when a claim is newly superseded).
- **Graph accessibility is hard** and gets a specific approach: the graph surface provides a list-view alternative (`aria-describedby` link: "View as list") that renders the current neighborhood as a `<table>` with columns (Node, Type, Trust Tier, Relationships) — operable by keyboard and screen reader. Tab cycles nodes in reading order. Arrow keys pan when canvas is focused. `aria-live` announces node selection and mode changes. On mode switch (Trace ↔ Explore ↔ Query ↔ Temporal), focus moves to the canvas container or the first node in reading order, with announcement "Mode changed to [mode], [N] nodes visible." The graph is not fully equivalent to the list view, but the list view is a functional, a11y-compliant alternative — not a degraded afterthought.
- **Screen reader announcements.** Page surface announced on navigation for all seven consumer surfaces: Chat — "Chat. Ask a question — every answer cites a source or shows nothing."; Graph — "Graph, Trace mode, centered on [entity], [N] neighbors visible."; Timeline — "Timeline, [N] events, [M] narrative beats."; Evidence compare — "Supporting evidence, [N] items. Refuting evidence, [N] items or one-sided note."; Senator dashboard — "Senator [name], [N] statements on record, [N] past votes."; Document viewer — "Document [title], arrived at cited passage."; Claim — "Claim [id], [fact|attributed], [N] citations." Citation modal announced: "Citation from [document title], trust tier [label], source verb [verb]."
- **Keyboard operability.** `Tab` order matches reading order on every surface. `Esc` always closes the topmost modal/popover. Graph nodes are tabbable in reading order. Command palette fully keyboard-operable; results announce via `aria-live`. No keyboard trap.
- **Focus management.** Modal open → focus moves to modal title. Modal close → focus returns to the trigger. Graph node select → focus moves to the side-panel citation context. Graph mode switch → focus moves to canvas container or first node in reading order. Never lose focus to the void.
- **Document-viewer anchored span is focusable.** When arriving at `/documents/[id]` via citation drill-down, the cited passage receives `tabindex="-1"` and focus moves to it on load via a route effect. A "Skip to cited passage" skip-link renders as the first focusable element on the page when a citation anchor is present.
- **Dynamic states are aria-live.** The answer-block region on `/chat` is wrapped in `aria-live="polite"` (escalated to `assertive` for the "No sourced answer found" and no-prediction states) so the answer-or-silence is announced on resolution. Fail-closed degraded-service and query-timeout surface regions are `aria-live="assertive"`.
- **Focus rings** inherit shadcn's `ring` token — visible at AA contrast against `background`.
- **Skip-to-content link.** A visually-hidden-until-focused "Skip to main content" link is the first focusable element in the layout, present on every surface.
- **Contrast.** All load-bearing text/background pairs verified to AA 4.5:1 (text) and 3:1 (UI components / graphical objects): `primary` on `surface-base`, `muted-foreground` on `surface-base`, `trust-tier-verified` on `surface-raised`, `trust-tier-contradicted` on `surface-raised`, `trust-tier-caution` on `surface-sunken`, `claim-attributed` on `surface-raised`, `claim-dashed` on `surface-raised`, `defamation-risk-caution` on `surface-raised`, `citation-chip-active` foreground on fill. Both modes verified.
- **Motion.** Temporal scrub animation respects `prefers-reduced-motion` — the graph animates the window change as a fade, not a slide. No autoplay motion anywhere. `prefers-contrast: more` darkens semantic tokens and thickens borders for users who need higher contrast.
- **Touch targets.** Mobile-degraded surfaces (`md`/`sm` breakpoints) maintain ≥44×44 CSS px touch targets per WCAG 2.5.5/2.5.8. Graph list-view rows, senator stack cards, and evidence tabbed stack all meet this minimum.
- **Plain-language layer.** Legal terms (`fallo`, `certiorari`, `Articles of Impeachment`, `G.R. No.`, `SO ORDERED`) render with glossary-tooltip patterns on first use. A plain-language summary is available on the case overview for the "engaged citizen" persona; citizen-facing surfaces target a reading level accessible to non-specialists without dropping the integrity bar.
- **Operator surfaces.** Operator/editorial-review surfaces inherit the same color-never-alone + contrast floor even though full behavioral spec is deferred. Defamation-risk risk-tier badges use icons + labels alongside color, not color alone.

## Responsive & Platform

Desktop-first. The graph, evidence split, and document viewer are fundamentally desktop experiences. Mobile degrades gracefully — chat, timeline, and senator profiles work; graph degrades to a filtered list or simplified radial.

| Breakpoint | Behavior |
|---|---|
| `≥ xl` (1280px+) | Full graph canvas + side panel + temporal scrubber. Evidence split = 3 columns. Document viewer = reading column + citation side rail. Senator dashboard = 12-col grid. Sidebar expanded (icons + labels). |
| `lg` (1024–1279px) | Graph canvas + side panel (side panel narrows). Evidence split = stacked (1 col, tabbed). Document viewer = reading column only. Senator dashboard = 2-col grid. Sidebar = icon rail. |
| `md` (768–1023px) | Graph → simplified radial (immediate neighbors only, no further expansion) OR filtered list view (toggle). Evidence = stacked + tabbed. Document viewer = reading column, citation context in a bottom sheet. Senator dashboard = 1-col stack. Sidebar = `Sheet` from top bar. |
| `< md` (sm, <768px) | Graph → filtered list view only (no canvas). Chat, timeline, senator profiles, claim surface = full functional. Document viewer = mobile-optimized reading column. Command palette opens fullscreen. |

No native app in v1 (deferred to Phase 2). The product is responsive web. Touch users on `md`/`sm` get a read-optimized experience; graph exploration is a desktop-first act.

[ASSUMPTION] The mobile graph "simplified radial" (md breakpoint) is an approach, not a final spec — Google Stitch mocks in `imports/` will confirm or revise this.

## Inspiration & Anti-patterns

**Lifted from:**
- **PRS India** — the IA taxonomy. "Study PRS India's product taxonomy before designing IIP's IA" (market research). Structured representative tracking, session diaries, committee tracking, Vital Stats. The template for how a legislative-tracking product organizes its surfaces.
- **PCIJ** — interactive vote maps ("Who voted to impeach VP Sara Duterte"), ICC-tracker-style timelines, topic microsites. The template for interactive civic journalism visuals.
- **VERA Files SEEK** — citation-grounding UX. RAG-with-citations is the standard; SEEK's inline-citation pattern is the direct inspiration for the `<Citation>` compound component.
- **GovTrack / TheyWorkForYou** — representative profile pages. Per-senator queryable vote/statement/relationship view. The template for the senator dashboard.
- **shadcn** — the entire surface vocabulary. Impeachment Watch's brand is *what it adds to shadcn*, not a from-scratch design system. Deliberate posture, not a shortcut.

**Rejected:**
- AI-generated aesthetic (no generic gradient hero, no purple-blue SaaS palette, no rounded-everything consumer-app look, no emoji-as-icons).
- Partisan color coding — no red/blue for "pro/anti" stance. Stance is encoded in the source-verb and the AIF edge style, not in node color.
- "Verified" / "confirmed" / "true" labels (FR-5.4 — banned). The product surfaces what is on record, not what it has "verified."
- Predictive features (vote/sentiment forecasting — banned, PRD §5.2). The no-prediction response is a first-class state, not a gap.
- Contradiction labeling (v1 does not detect contradictions — PRD §6.3 copy surfaces this honestly). Contradiction detection engine deferred to Phase 3.
- Media framing comparison view (deferred to Phase 2).
- Narrative generation / story generation (deferred to Phase 2). The product surfaces narrative beats as timeline markers and graph highlights, not generated prose.
- Influence analytics (PageRank, betweenness, centrality — deferred to Phase 3).
- Drag-to-reorder, infinite scroll, hover-only affordances on mobile.

## Key Flows

### Flow 1 — Maya Reyes, investigative journalist (the case spine; top-down)

> From PRD §7.2 and the decision log. Climax = citation-or-silence refusal.

1. Maya lands on `/chat`, types: *"What allegations have been made about the confidential funds, and who made them?"*
2. Platform returns a sourced answer — each assertion carries inline `<Citation.Chip>` chips. She clicks one.
3. Citation modal opens: verbatim quoted passage in `mono`, trust-tier badge visible, source-verb preserved ("ALLEGED"). She clicks "View full document."
4. Lands on `/documents/[id]`, scrolled to the exact passage, highlighted in `{colors.accent}` 0.25. Reads surrounding context in the document viewer.
5. Goes to `/evidence/compare?ids=…` — sees the honest split: supporting / refuting / contextualizing. It's one-sided; the refuting panel shows the verbatim copy: *"Only supporting evidence detected in v1; refuting evidence was not surfaced — v1 does not detect contradictions."*
6. Opens `/graph?seed=respondent` — graph opens centered on Sara Duterte (Trace default), immediate neighbors, temporal scrubber pinned bottom. Clicks through to a senator who voted against her — `?active=` updates, citation modal opens with the senator's statement provenance.
7. Checks `/timeline` — scrubs to filing date, watches procedural stages unfold as narrative-beat markers. The "filing" → "endorsement threshold" → "three sufficiency tests" beats appear as markers on the track.
8. **Climax:** She asks an adversarial question the corpus can't support. Platform responds: **"No sourced answer found."** Her trust goes *up* — it refused to invent. She cites the platform in her story.

**Surfaces exercised:** `/chat`, `<Citation>` modal, `/documents/[id]`, `/evidence/compare`, `/graph` (Trace), `/timeline`.

**Failure paths:**
- Query timeout → "This query did not complete within the time limit. No answer was generated." (no partial/hallucinated answer).
- Backing service degraded → fail-closed: "IIP cannot reach its backing services right now. No answer is safer than a wrong one."
- Document unavailable (retracted source) → citation modal: "This source could not be reached. The citation is preserved for reproducibility."

### Flow 2 — Renz Aquino, political-risk analyst (the actor spine; bottom-up)

> From the decision log (Journey 2, accepted). Climax = no-prediction honesty.

1. Renz lands on `/senators/[id]` for Senator Risa Hontiveros. Lightweight dashboard: statements on record (attributed claims with citation chips), past votes (roll-call, per-article), committee participation, personal timeline entries tied to the case.
2. He sees a claim: "Senator Hontiveros stated X on [date]." Tagged as `claim-attributed` (dashed border, italic, muted — not fact), with `<Citation.Chip>`. He clicks it.
3. Lands on `/claim/[id]` — addressable claim surface. Sees full claim, provenance, source document. Copies the URL, sends to a colleague: *"here's the exact claim, sourced."*
4. Opens `/graph?seed=senator-hontiveros` — graph opens centered on her (Trace default): committee memberships, votes, statements, co-sponsors. Switches to Temporal mode (`?mode=temporal`), scrubs the timeline — watches her statements cluster around key hearing dates as edges fade in/out.
5. Queries in `/chat`: *"What statements has Senator Hontiveros made about the confidential funds issue?"* Gets sourced answer with inline citation chips.
6. Pivots to another senator-judge — publicly undecided. Opens `/senators/[id]`. Dashboard is thinner: fewer statements, no past impeachment votes. Platform shows what it has and is honest about what it doesn't — no "no data" apology, just absence.
7. **Climax:** He asks: *"Will Senator X vote to convict?"* — a predictive question. Platform responds: **"IIP does not make predictions. Here is what is on record: [sourced statements, voting history, relationships]. Draw your own inference."** Renz respects this — the platform gave him raw material for analysis without overstepping. He writes his briefing citing the platform's sourced data, noting explicitly that it refused to predict.

**Surfaces exercised:** `/senators/[id]`, `/claim/[id]`, `/graph` (Trace + Temporal), `/chat`.

**Failure paths:**
- Thin senator dashboard (publicly-undecided senator) → not a failure; the absence is the signal. No "no data" apology.
- Predictive question → no-prediction response state (first-class, not an error).
- Graph hop-cap hit → "Showing immediate neighbors. Explore mode for further expansion." (non-blocking banner, not a silent truncation).

## Editorial Integrity Surface

The visual and behavioral rules for the regulated-leaning core. This section cross-references `DESIGN.md` tokens by name.

- **Citation-or-silence (EI-1).** Every served factual assertion carries ≥1 citation or is not returned. The `<Claim>` component renders `<Citation.Empty>` by default and promotes to `<Citation.Chip>` only when provenance resolves — enforced at the component boundary (AC-2), not at code review. The silence state (`answer-block-silence`) uses `{colors.surface-sunken}` and a muted-foreground left border — quiet, not punitive. The essence sentence renders below every answer: *"Every claim IIP shows you cites a source you can open — or IIP shows you nothing."*

- **Fact vs. attributed claim (EI-2).** Every served assertion is tagged fact or attributed claim; visually marked; fact = tier-1 primary OR ≥2 independent sources. An allegation stated as fact is a P0 defect, equal in severity to a crash. The `claim-fact` variant uses `{colors.claim-fact}` with a solid left border; `claim-attributed` uses `{colors.claim-attributed}` with a dashed left border + italic. The distinction is never color alone (solid vs. dashed border, roman vs. italic text). The `<Claim>` component is the render-layer gate — 100% of served assertions pass through it.

- **Source-verb preservation (EI-3).** Verbs with legal/epistemic weight ("alleged," "testified," "voted," "denied," "claimed") are preserved verbatim, never paraphrased stronger/weaker. The `source-verb-tag` renders the verb in `label-caps` (`{colors.primary}`), drawn from `lib/citation/source-verbs.ts` (one-line edit to add a verb, not a grep-and-hunt). The risk variant (`source-verb-tag-risk`) uses `{colors.defamation-risk-caution}` for verbs flagged in editorial review.

- **Trust-tier display (FR-5.6, EI-8).** Trust tier is visible on every citation. Three tiers: `trust-badge-verified` (tier-1 primary, `{colors.trust-tier-verified}`), `trust-badge-contradicted` (sources disagree, `{colors.trust-tier-contradicted}`), `trust-badge-caution` (tier-3 / single-source, `{colors.trust-tier-caution}` outline style). A lone tier-3 allegation about a named person is not served as established; the caution badge + a provenance string ("uncorroborated, single manual source") survives the full RAG pipeline end-to-end (SEC-3). Trust tier is a structural graph property — it travels with every edge.

- **No-oversell (FR-5.4).** No "verified," "confirmed," "true" labels. No implication that absence of contradiction means consistency. The evidence split one-sided state says *"Only supporting evidence detected in v1; refuting evidence was not surfaced — v1 does not detect contradictions"* — it does not say "no contradiction found." The no-prediction response is a first-class state, not a gap. The product states what v1 does NOT do as clearly as what it does (DR-4).

- **Retraction / supersession (FR-5.7, STR-6b/ADR-017).** A superseded node is never deleted, only marked. The `claim-dashed` variant uses `{colors.claim-dashed}` with strikethrough, a dashed left border, and a "Superseded on [date]" flag. The original assertion is preserved for reproducibility — every render that cited the superseded node must be reproducible-as-was and flagged-going-forward. Cache-bust on supersession event. The document viewer flags superseded passages with a `{colors.claim-dashed}` left border.

- **Provenance drill-down (EI-4, DR-3).** Every entity/relationship/claim/evidence traces to raw snapshot + character span. The drill-down path: assertion → `<Citation.Chip>` → `<Citation.Modal>` (verbatim quoted passage, trust tier, source verb) → `/documents/[id]` (scrolled to anchored span, highlighted in `{colors.accent}` 0.25) → raw source. One level of modal, then full page. No modal stack.

- **Defamation-risk awareness (NFR-L-3).** Per-answer risk tiers (green/amber/red) in editorial review. The `defamation-risk-caution` token (`{colors.defamation-risk-caution}`) is distinct from `trust-tier-contradicted` — legal risk is a different signal from source disagreement. All red-tier answers removed before exposure; amber carry a written counsel note. Republication-aware (*Disini*): surfacing a defamatory allegation can carry liability; the product quotes rather than paraphrases defamatory imputations and anchors every claim to a primary-source document.

## Narrative Beats

The 15 domain narrative beats (from domain research), mapped to where they surface in the UX. These are the "tells a story" cues — the product highlights them as timeline markers, graph highlights, and case-overview beats, not as generated prose (narrative generation is deferred to Phase 2).

| # | Beat | UX surface | Treatment |
|---|---|---|---|
| 1 | The filing — verified complaint sworn and filed | `/timeline` marker, `/graph` node highlight | `timeline-marker` dot + `display-sm` label "Filed [date]" |
| 2 | The endorsement threshold — 1/3 signatures → fast path (bypasses committee) | `/timeline` marker (highlighted), `/case` overview | Accent-colored marker; `display-sm`: "Endorsement threshold reached — fast path to Senate" |
| 3 | The three sufficiency tests — form → substance → gates | `/timeline` markers (3 sequential) | Three `timeline-marker` dots in sequence; each a gate that can dismiss |
| 4 | The pleading duel — Answer → Reply → Rejoinder | `/timeline` markers, `/evidence/compare` | Markers + evidence panel rows for each pleading |
| 5 | The committee vote — probable cause | `/timeline` marker, `/graph` (committee → report edge) | Marker + edge highlight |
| 6 | The plenary override — 1/3 overrides dismissal | `/timeline` marker (reversal beat) | Accent marker + `display-sm`: "Plenary override — Articles forced" |
| 7 | Service on the Senate — physical transmittal | `/timeline` marker | Marker + edge (House → Senate) |
| 8 | The swearing-in — oath of impartial justice | `/timeline` marker, `/graph` (senator nodes → oath event) | Marker + `display-sm` label |
| 9 | The summons and the Answer — 10-day window | `/timeline` marker, `/claim/[id]` (respondent Answer) | Marker + claim surface for the Answer |
| 10 | The trial — opening statements, testimony, exhibits | `/timeline` (extended period), `/graph` (witness/evidence nodes) | Period band on scrubber + witness/evidence node cluster |
| 11 | The 2-minute senator explanations | `/senators/[id]`, `/timeline` (per-senator) | Senator dashboard "explanation" row + timeline marker per senator |
| 12 | The verdict roll-call per article | `/timeline` marker (climactic), `/graph` (senator → article vote edges) | Accent-colored climactic marker + per-article vote edge highlights |
| 13 | The fallo — "judgment of conviction" / "acquittal" | `/timeline` marker, `/case` overview | `display-sm` label with the exact legal term (verbatim, not editorialized) |
| 14 | The SC intervention — *certiorari* halts/voids | `/timeline` marker (external reversal), case state → "voided by SC" | Marker + case state badge "Voided by SC" (distinct from "acquitted" — domain rule 12) |
| 15 | The one-year bar expiry — eligibility for new proceedings | `/timeline` marker (future "watch this date"), `/senators/[id]` (respondent) | Future-dated marker + "One-year bar expires [date]" on respondent dashboard |

**Rules:** Beats surface as markers and highlights, not generated narrative (narrative generation deferred to Phase 2). Verdict language is formulaic and preserved verbatim — "guilty," "not guilty," "judgment of conviction," "acquittal," "SO ORDERED" (domain research §9). The product never editorializes these terms. Outcome states "acquitted," "resigned," "voided by SC" are distinct and never collapsed (domain rule 12). Proof-standard distinctions surface where relevant — "allegation X is *not* proven to criminal standard but *is* sufficient for impeachment" (domain research §9, Carneades proof standards) — rendered in the claim component's provenance context, not as a label.