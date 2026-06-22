# Google Stitch Producer Prompt — Impeachment Watch (IIP)

> Paste this entire prompt into Google Stitch (https://stitch.withgoogle.com). Save outputs to `imports/` in the UX workspace. The spines (DESIGN.md + EXPERIENCE.md) win on conflict with any Stitch output.

---

## Product overview

**Impeachment Watch** (IIP — Impeachment Intelligence Platform) is an evidence-backed knowledge graph for Philippine impeachment. It turns scattered government documents — hearing transcripts, court records, official filings, press releases — into a single queryable knowledge graph where every factual assertion carries a citation or is not returned at all. This is a **regulated-leaning civic-tech product** dealing with constitutional law, Senate trials, and political intelligence.

**Single case v1:** The Sara Duterte impeachment (first VP ever impeached in Philippine history). The UI does not surface case selection.

**Users:** Investigative journalists (primary), political-risk analysts, legal researchers, engaged citizens. All expect polished, English-only, credible interfaces.

## Aesthetic posture — CRITICAL

**Legal journal crossed with modern investigative tool.** Credible, precise, with a narrative voice. It should feel like the thing a Senate reporter opens at 2 a.m. to trace a claim to its source.

**NOT AI-generated.** No generic gradient hero. No purple-blue SaaS palette. No rounded-everything consumer-app look. No emoji-as-icons. No floating glassmorphism cards. No aurora blobs. The product deals with constitutional law, Senate trials, and evidence. It earns trust by looking like it belongs in that world.

**Unique, not generic.** This is not another dashboard. It is an investigative tool with editorial weight — the visual language signals "this is the record" the way a legal journal or court reporter sets a case header.

**Keywords:** Clean. Modern. Sleek. Interactive (especially the knowledge graph). Tells a story. User-friendly. Logical. Regulated. Credible.

## Color system (light mode = default, dark mode = user toggle)

**Light mode** — warm parchment white base, like a court document filed on a desk. NOT clinical SaaS white.

| Token | Hex | Use |
|---|---|---|
| surface-base | `#FBF8F2` | Page background — warm parchment |
| surface-raised | `#FFFFFF` | Cards, modals, raised surfaces |
| surface-sunken | `#F0EDE6` | Inset areas, citation chip background |
| primary | `#1E3A5F` | Institutional navy ink — buttons, active nav, links, graph person nodes, AIF premise edges |
| primary-foreground | `#FFFFFF` | Text on primary |
| accent | `#B8761E` | Ochre — selected graph node, temporal scrubber handle, "you are here" marker. NOT decorative, NOT for trust/state |
| accent-foreground | `#FBF8F2` | Text on accent |
| border | `#E3DED1` | Warm dust — 1px, never thicker |
| muted | `#F0EDE6` | Muted backgrounds |
| muted-foreground | `#6B6258` | Secondary text |
| trust-tier-verified | `#2A6B5E` | Calm teal-green — tier-1 source badges, AIF support edges, evidence "supporting" header. NOT bright green. |
| trust-tier-contradicted | `#9B3A2E` | Muted brick red — source disagreement, AIF attack edges, evidence "refuting" header. NOT alarm red. |
| trust-tier-caution | `#8F5A12` | Darker ochre — tier-3/low-confidence source warnings, single-source markers. "Look closer," not "stop." |
| claim-fact | `#1B1C19` | Near-black — established facts (tier-1 OR ≥2 independent sources). Solid left border. |
| claim-attributed | `#6B6258` | Muted warm gray — attributed claims ("Senator X *stated* Y"). Italic, dashed left border. |
| claim-dashed | `#736B5E` | Darkened warm gray — superseded/retracted assertions. Strikethrough, dashed border. |
| defamation-risk-caution | `#8B2C1F` | Deep distinct red — legal-risk flag on editorial review. Different from trust-tier-contradicted. |
| destructive | `#9B2A1A` | Deep red — destructive actions only |

**Dark mode** — modern, sleek, the "interactive" surface. Same hues, shifted values:

| Token | Hex |
|---|---|
| surface-base-dark | `#131418` |
| surface-raised-dark | `#1C1E23` |
| surface-sunken-dark | `#0E0F12` |
| primary-dark | `#7BA8D4` |
| accent-dark | `#D49A3E` |
| border-dark | `#2A2C31` |
| muted-dark | `#1C1E23` |
| muted-foreground-dark | `#9A918A` |
| trust-tier-verified-dark | `#4A9D8A` |
| trust-tier-contradicted-dark | `#C46B5C` |
| trust-tier-caution-dark | `#D49A3E` |
| claim-fact-dark | `#E8E4DC` |
| claim-attributed-dark | `#9A918A` |
| claim-dashed-dark | `#6E655D` |
| defamation-risk-caution-dark | `#C45A42` |
| destructive-dark | `#C74233` |

**Rule: color is never the only signal.** Every semantic color (trust tier, claim type, defamation risk) pairs with an icon AND a text label. Trust-tier badges: verified = check icon + "TIER 1" label; contradicted = split icon + "DISAGREEMENT" label; caution = eye icon + "TIER 3" label. Fact-vs-claim uses border style (solid vs dashed) + text style (roman vs italic) + weight, not color alone.

## Typography

**Three type roles:**

1. **Source Serif 4** (display) — the editorial voice. Classic serif proportions. Used for: case titles, narrative-beat markers on timeline, empty-state headlines (including "No sourced answer found"), section headers on senator dashboards, document-viewer document title. The serif is a punctuation mark — appears where the product is *naming a thing*, not everywhere. At most once per surface.
   - display: 40px / 400 / 1.12 / -0.015em
   - display-sm: 26px / 400 / 1.2 / -0.01em
   - headline: 22px / 600 / 1.25

2. **Geist Sans** (body / UI, shadcn default inherited) — the data-density voice. Handles: answer-block text, graph side-panel labels, evidence table rows, senator dashboard stats, navigation, microcopy.
   - body-lg: 18px / 400 / 1.6
   - body-md: 16px / 400 / 1.6 (shadcn default)
   - label-caps: 11px / 600 / 1.4 / 0.12em tracking — tracked-out caps for section headers, trust-tier labels, source-verb tags, evidence panel headers ("SUPPORTING / REFUTING / CONTEXTUALIZING")
   - caption: 13px / 400 / 1.45

3. **IBM Plex Mono** (citations / documents) — the raw-record voice. Used for: inline legal citations (`G.R. No. 127255`), AKN fragment URIs, verbatim quoted passages in citation modals, document-viewer body text. Signals "this is the raw record, unparaphrased."
   - mono: 13px / 400 / 1.5
   - mono-sm: 11px / 400 / 1.4

**Rules:** Serif appears at most once per surface. Body text is never set in serif. Mono is never set in serif. Labels are always caps-tracked; sentence-case labels are a bug.

## Corner radii

Tighter than shadcn defaults — reads "investigative tool" and "legal document" rather than "consumer app."

- sm: 3px (inputs, trust badges)
- md: 5px (cards, buttons, citation chips)
- lg: 8px (dialogs, modals, evidence panels)
- xl: 12px (large containers — use sparingly)
- full: 9999px (status badges only, citation chips)

## Layout & spacing

Desktop-first responsive web. shadcn / Tailwind 4-based spacing scale (4, 8, 12, 16, 20, 24, 32, 40, 48, 64).

Named overrides:
- **editorial-gap: 56px** — vertical breathing room between major narrative sections. Wider than default because the product is read, not scanned.
- **graph-panel: 320px** — fixed-width side panel on the graph surface. Holds selected-node citation context, filter controls, mode switcher.
- **evidence-split-gap: 48px** — gap between supporting/refuting/contextualizing columns. The gap is the honest-split signal.

**Surface layouts:**
- **Graph** — full-bleed canvas + 320px side panel pinned left + temporal scrubber pinned bottom
- **Document viewer** — centered reading column (max-w-3xl) + citation-context side rail on xl
- **Evidence compare** — three-column grid on xl, stacked + tabbed on lg and below
- **Senator dashboard** — 12-column grid with stat cards
- **Chat** — single centered column (max-w-2xl). The answer is the product, not the chrome.

## Shadows

shadcn defaults inherited (subtle on hover/active). One delta: citation modal and graph selected-node carry a slightly warmer shadow (`rgba(30, 58, 95, 0.08)` light, `rgba(0, 0, 0, 0.4)` dark) — "lifted off the record," like a document sits on a desk. No drop shadows on cards. No floating toolbars. No elevation as hierarchy.

## Components to design

### Citation compound (first-class — the regulatory core)

A compound component: `<Citation><Citation.Chip/><Citation.Modal/></Citation>`. Appears inline in answer text, claim text, evidence rows, senator dashboard statements.

- **Citation.Chip** — pill shape (rounded.full), `surface-sunken` background, `claim-attributed` text, 1px border, label-caps font, padding 2px 10px. Shows a superscript numeral. Hover/active state: darker ochre fill (`#8F5A12`) with `accent-foreground` text.
- **Citation.Modal** — `surface-raised` background, 1px border, rounded.lg. Contains: verbatim quoted passage in IBM Plex Mono, trust-tier badge, source-verb tag, "View full document" link. Opens on chip click. Modal stacks one level deep only.
- **Citation.Empty** — default render when no provenance resolves. `display-sm` muted headline: "No evidence on record."

### Trust badge (3 variants)

- **Verified** — `trust-tier-verified` fill, white text, check icon, "TIER 1" label, rounded.sm
- **Contradicted** — `trust-tier-contradicted` fill, white text, split icon, "DISAGREEMENT" label, rounded.sm
- **Caution** — `surface-sunken` fill, `trust-tier-caution` text + 1px border, eye icon, "TIER 3" label, rounded.sm

### Source-verb tag (EI-3 — verbatim verbs preserved)

Transparent background, `primary` text, no border, label-caps font. Displays legal verbs verbatim: "ALLEGED", "TESTIFIED", "VOTED", "DENIED", "CLAIMED". Never paraphrased. Risk variant uses `defamation-risk-caution` text.

### Claim component (fact vs. attributed — EI-2)

Three states, visually distinct:
- **Fact** — `claim-fact` text (near-black), 3px solid left border, body-md roman. Established facts only (tier-1 OR ≥2 sources).
- **Attributed** — `claim-attributed` text (muted gray), 3px dashed left border, body-md italic. What someone said, not what is established.
- **Dashed/Superseded** — `claim-dashed` text, 3px dashed left border, strikethrough, "Superseded on [date]" flag. Preserved for reproducibility.

### Graph nodes (by entity type)

- **Person** — `primary` fill, 2px `primary` border, circular. Senators, complainants, witnesses.
- **Respondent** — `accent` fill, 3px `accent` border, circular, slightly larger. The focal entity in Trace mode.
- **Document** — `surface-raised` fill, 1px `border`, rounded.md rectangle. Source documents.
- **Claim** — `claim-attributed` fill, 1px `claim-attributed` border, rounded.sm. Italic to signal "attributed."
- **Evidence** — `trust-tier-verified` fill (supporting) or `trust-tier-contradicted` fill (refuting), rounded.sm. Small.
- **Selected node** — `accent` ring (3px), warmer shadow. nuqs `?active=` updates.

### Graph edges

- **Standard** — 1px `border` color, solid. Typed labels on hover (e.g., "FILED", "VOTED_AGAINST", "TESTIFIED_IN").
- **AIF support** — `trust-tier-verified` color, 2px solid. Green = support.
- **AIF attack** — `trust-tier-contradicted` color, 2px dashed. Red dashed = attack.
- **AIF premise** — `primary` color, 2px solid, bold. Navy = premise.
- **Temporal-faded** — `border` at 0.4 opacity. Edges outside the temporal window.

### Timeline scrubber

Pinned to bottom of graph surface. Track in `surface-sunken`, handles in `accent`, window band in `accent` at 0.15 opacity. Scrub updates `?from=` / `?to=`. Imprecise dates render as range bands, not points.

### Evidence split panel

Three columns (xl) or stacked+tabbed (lg/below):
- **Supporting** — `trust-tier-verified` header, `trust-tier-verified` left border
- **Refuting** — `trust-tier-contradicted` header, `trust-tier-contradicted` left border
- **Contextualizing** — `muted-foreground` header, `border` left border
- **One-sided empty** — dashed border panel, muted text, verbatim copy: "Only supporting evidence detected in v1; refuting evidence was not surfaced — v1 does not detect contradictions."

### Senator dashboard card

Lightweight v1 read-model. Header (name + role in `headline`), stat cards (label-caps label + body-lg value), statements on record (attributed claims + citation chips + source-verb tags), past votes, committee participation, personal timeline entries. Honest-absence treatment for thin data — no "no data" apology, just shows what it has.

### Answer block (chat)

Single centered column (max-w-2xl). Contains:
- Query echo at top
- Answer text with inline citation chips (superscript numerals)
- Source-verb tags inline (ALLEGED, TESTIFIED, etc.)
- Fact-vs-claim visual distinction on each assertion
- Trust badges on citations
- **Essence sentence** below every answer: "Every claim IIP shows you cites a source you can open — or IIP shows you nothing." In caption text, muted-foreground.
- **Silence state** — `display-sm` headline: "No sourced answer found." No suggested next steps. Essence sentence still renders. This is a trust signal, not a failure.
- **No-prediction state** — "IIP does not make predictions. Here is what is on record: [sourced statements, voting history, relationships]. Draw your own inference."

### Document viewer

Centered reading column (max-w-3xl). IBM Plex Mono body text (the raw record). Citation highlight: `accent` at 0.25 opacity on the anchored passage. Superseded passages: `claim-dashed` styling. Citation-context side rail on xl. "Skip to cited passage" skip-link when arriving via citation drill-down.

### Empty state

`display-sm` serif headline + body text + single primary action (when applicable). Headlines:
- "No sourced answer found." (chat silence)
- "No evidence on record." (evidence/graph/claim empty)
- "Nothing here yet." (thin senator dashboard)

## Screens to produce

Design these 7 consumer surfaces in both light and dark mode:

1. **`/chat`** — NL Q&A with citation-or-silence. Single centered column (max-w-2xl). Show: a sourced answer with inline citation chips, source-verb tags, fact-vs-claim distinction, trust badges, essence sentence. Also show the silence state ("No sourced answer found") and the no-prediction state.

2. **`/graph`** — Interactive knowledge graph explorer. Full-bleed canvas + 320px left side panel + temporal scrubber at bottom. Default mode = Trace (centered on respondent, immediate neighbors). Mode tabs: Trace / Explore / Query / Temporal. Side panel shows: selected-node citation context, filter checkboxes (entity types, relationship types, trust tiers), mode tabs. Graph has ~10-12 nodes with typed edges. Show a selected node with accent ring.

3. **`/timeline`** — Dated events at day/week/month/year granularity. Narrative-beat markers (filing, endorsement threshold, sufficiency tests, pleading duel, committee vote, plenary vote, service on Senate, swearing-in, summons, trial, senator explanations, verdict, fallo, SC intervention, one-year bar). Imprecise dates as range bands. Click event → graph `?seed=`.

4. **`/evidence/compare`** — Honest three-way split: Supporting / Refuting / Contextualizing. Three columns on xl, stacked+tabbed on lg. Each row: citation chip, trust badge, source-verb tag, claim text. Show the one-sided empty state in refuting panel with verbatim copy.

5. **`/senators/[id]`** — Lightweight v1 dashboard. Header (name + role), stat cards (statements count, votes count, committees count), statements on record (attributed claims + citations), past votes, committee participation, personal timeline. Show honest-absence treatment for a thin section.

6. **`/claim/[id]`** — Addressable claim surface. Full claim text with fact-vs-claim distinction. Provenance chain (source document, character span, trust tier). Citation chips inline. Shareable URL displayed. Links to evidence compare, graph, and document viewer.

7. **`/documents/[id]`** — Document viewer. Centered reading column (max-w-3xl). IBM Plex Mono body. Citation highlight on anchored passage (accent at 0.25 opacity). Superseded passages with claim-dashed styling. Citation-context side rail on xl. Document title in Source Serif 4 display.

## Navigation

Left sidebar on xl (icons + labels), collapses to icon-rail on lg, becomes a Sheet on md and below. Top bar holds: truncated essence sentence, dark-mode toggle, persistent search/command entry (⌘K → routes to /chat?q=). No case selector (single-case v1).

## Key constraints (non-negotiable)

1. **Citation-or-silence.** Every factual assertion carries a citation chip or is not shown. No uncited answers. The silence state ("No sourced answer found") is a first-class, trust-building state — not an error.

2. **Fact vs. attributed claim.** Facts (tier-1 OR ≥2 sources) render in near-black with solid border. Attributed claims (what someone said) render in muted gray italic with dashed border. An allegation stated as fact is a P0 defect.

3. **Source-verb preservation.** Legal verbs (ALLEGED, TESTIFIED, VOTED, DENIED, CLAIMED) are preserved verbatim, never paraphrased stronger or weaker. They render as label-caps tags inline.

4. **Trust tiers visible.** Every citation shows its trust tier as a badge (verified/contradicted/caution) with icon + label, not color alone.

5. **No oversell.** No "verified," "confirmed," "true," "no contradiction found" labels. The product surfaces what is on record, not what it has "verified." No predictions. No narrative generation (deferred).

6. **WCAG 2.1 AA.** All text/background combinations verified to 4.5:1 (text) and 3:1 (UI). Color is never the only signal. Graph has a list-view alternative. All dynamic states (answers, silence, no-prediction, errors) are aria-live. Skip-to-content link on every surface. Touch targets ≥44×44px on mobile.

7. **Desktop-first.** Graph, evidence, and document viewer are desktop experiences. Mobile degrades gracefully (chat, timeline, senator profiles work; graph → list view). No native app v1.

8. **URL is a public API.** Every shareable state is URL-encodable: `?seed=`, `?mode=trace|explore|query|temporal`, `?renderer=cytoscape|react-flow|sigma`, `?active=`, `?from=`, `?to=`. `/claim/[id]` is addressable.

## Aesthetic guardrails

- **Do:** serif display for case titles and narrative beats, warm parchment base in light mode, restrained institutional palette, mono for legal citations, tight corners (3/5/8px), editorial spacing (56px gaps), warm shadow on citation modal, honest empty states.
- **Don't:** gradient heroes, purple-blue SaaS palettes, rounded-everything consumer look, emoji icons, glassmorphism, aurora blobs, bright green for "verified" (use muted teal), alarm red for disagreement (use muted brick), floating toolbars, drop shadows on cards, sentence-case labels (always caps-tracked).