---
name: Impeachment Watch
description: Evidence-backed knowledge graph for Philippine impeachment — citation-or-silence, on a shadcn/ui surface with editorial-weight typography.
status: final
updated: 2026-06-19
colors:
  # ── Brand layer (deltas on shadcn defaults) ──────────────────────────────
  # Unlisted tokens inherit shadcn: background, foreground, popover, card,
  # popover-foreground, card-foreground, input, ring, secondary, destructive
  # (overridden below), muted-foreground.
  #
  # Light mode = default. Credible, court-document, warm white base — NOT clinical.
  # Dark mode = user-toggle. Modern, sleek, the interactive surface.

  # Primary — institutional navy ink. Used on primary actions, active nav, links,
  # the essence-sentence banner. NOT used for trust indicators (those have their
  # own semantic tokens). Replaces shadcn default primary.
  primary: '#1E3A5F'
  primary-foreground: '#FFFFFF'

  # Accent — restrained ochre. Used to mark the selected/active graph node, the
  # temporal scrubber handle, the "you are here" marker in timeline. NOT used
  # decoratively, NOT used for trust/state (trust has its own tokens).
  accent: '#B8761E'
  accent-foreground: '#FBF8F2'

  # Surface tokens — warm white parchment family. Light mode reads like a court
  # document filed on a desk, not a SaaS dashboard.
  surface-base: '#FBF8F2'
  surface-raised: '#FFFFFF'
  surface-sunken: '#F0EDE6'
  border: '#E3DED1'
  muted: '#F0EDE6'
  muted-foreground: '#6B6258'

  # ── Trust-tier tokens (domain-critical) ───────────────────────────────────
  # Semantic by meaning, never by raw color. Calibrated to be visible without
  # alarming — a tier-3 source is not an error, it is a provenance fact.
  trust-tier-verified: '#2A6B5E'
  trust-tier-contradicted: '#9B3A2E'
  trust-tier-caution: '#8F5A12'

  # ── Claim tokens (fact vs. attributed claim — EI-2) ───────────────────────
  # Fact = tier-1 primary OR ≥2 independent sources. Attributed claim = a
  # statement made by an actor, not established. Dashed = retracted/superseded.
  claim-fact: '#1B1C19'
  claim-attributed: '#6B6258'
  claim-dashed: '#736B5E'

  # Defamation-risk caution — used on the editorial review risk-tier badge and
  # on any assertion flagged for pre-external legal review. Distinct from
  # trust-tier-contradicted (which is about source disagreement, not legal risk).
  defamation-risk-caution: '#8B2C1F'

  # Destructive — override shadcn default toward a deeper, less alarming red.
  destructive: '#9B2A1A'

  # ── Dark mode pairs ───────────────────────────────────────────────────────
  primary-dark: '#7BA8D4'
  primary-foreground-dark: '#0A1420'
  accent-dark: '#D49A3E'
  accent-foreground-dark: '#131418'
  surface-base-dark: '#131418'
  surface-raised-dark: '#1C1E23'
  surface-sunken-dark: '#0E0F12'
  border-dark: '#2A2C31'
  muted-dark: '#1C1E23'
  muted-foreground-dark: '#9A918A'
  trust-tier-verified-dark: '#4A9D8A'
  trust-tier-contradicted-dark: '#C46B5C'
  trust-tier-caution-dark: '#D49A3E'
  claim-fact-dark: '#E8E4DC'
  claim-attributed-dark: '#9A918A'
  claim-dashed-dark: '#6E655D'
  defamation-risk-caution-dark: '#C45A42'
  destructive-dark: '#C74233'

typography:
  # Display — serif for editorial weight. The product deals with constitutional
  # text, Articles of Impeachment, Senate verdicts. A serif display signals
  # "this is a document, this is the record" — the way a legal journal or
  # court reporter sets a case title.
  display:
    fontFamily: 'Source Serif 4'
    fontSize: 40px
    fontWeight: '400'
    lineHeight: '1.12'
    letterSpacing: '-0.015em'
  display-sm:
    fontFamily: 'Source Serif 4'
    fontSize: 26px
    fontWeight: '400'
    lineHeight: '1.2'
    letterSpacing: '-0.01em'
  headline:
    fontFamily: 'Source Serif 4'
    fontSize: 22px
    fontWeight: '600'
    lineHeight: '1.25'
  # Body — shadcn default sans inherited (Geist Sans / Inter). Data density
  # surfaces (graph side panels, evidence tables, senator dashboards) need a
  # clean sans. No override unless noted.
  body-lg:
    fontFamily: 'Geist Sans'
    fontSize: 18px
    fontWeight: '400'
    lineHeight: '1.6'
  body-md:
    note: 'shadcn default — inherited'
  # Label-caps — tracked-out caps for section headers, trust-tier labels,
  # source-verb tags. The "airy premiumness" of a legal citation style sheet.
  label-caps:
    fontFamily: 'Geist Sans'
    fontSize: 11px
    fontWeight: '600'
    lineHeight: '1.4'
    letterSpacing: '0.12em'
  caption:
    fontFamily: 'Geist Sans'
    fontSize: 13px
    fontWeight: '400'
    lineHeight: '1.45'
  # Mono — for legal citations, G.R. numbers, AKN fragment URIs, document text
  # excerpts in the citation modal. Institutional/document character.
  mono:
    fontFamily: 'IBM Plex Mono'
    fontSize: 13px
    fontWeight: '400'
    lineHeight: '1.5'
  mono-sm:
    fontFamily: 'IBM Plex Mono'
    fontSize: 11px
    fontWeight: '400'
    lineHeight: '1.4'

rounded:
  # Slightly tighter than shadcn defaults. Reads "investigative tool" and
  # "legal document" rather than "consumer app." shadcn defaults are
  # 6/8/12 (sm/md/lg); Impeachment Watch tightens to 3/5/8.
  sm: 3px
  md: 5px
  lg: 8px
  xl: 12px
  full: 9999px

spacing:
  # shadcn / Tailwind 4-based scale inherited (4, 8, 12, 16, 32, 40, 48, 64).
  # Emitted below: the two inherited values referenced by component specs.
  '20': '20px'
  '24': '24px'
  # Named overrides:
  editorial-gap: 56px
  graph-panel: 320px
  evidence-split-gap: 48px

components:
  # ── Citation compound (first-class) ──────────────────────────────────────
  citation-chip:
    background: '{colors.surface-sunken}'
    foreground: '{colors.claim-attributed}'
    border: '1px solid {colors.border}'
    radius: '{rounded.full}'
    padding: '2px 10px'
    font: '{typography.label-caps}'
    # Inline in answer text; superscript numeral + source-verb on hover
  citation-chip-active:
    background: '#8F5A12'
    foreground: '{colors.accent-foreground}'
  citation-modal:
    background: '{colors.surface-raised}'
    border: '1px solid {colors.border}'
    radius: '{rounded.lg}'
    # Verbatim quoted passage in mono, trust tier visible, source-verb tag,
    # "View full document" link
    quote-text-font: '{typography.mono}'

  # ── Trust badge ──────────────────────────────────────────────────────────
  trust-badge-verified:
    background: '{colors.trust-tier-verified}'
    foreground: '#FFFFFF'
    radius: '{rounded.sm}'
    font: '{typography.label-caps}'
  trust-badge-contradicted:
    background: '{colors.trust-tier-contradicted}'
    foreground: '#FFFFFF'
    radius: '{rounded.sm}'
    font: '{typography.label-caps}'
  trust-badge-caution:
    background: '{colors.surface-sunken}'
    foreground: '{colors.trust-tier-caution}'
    border: '1px solid {colors.trust-tier-caution}'
    radius: '{rounded.sm}'
    font: '{typography.label-caps}'

  # ── Source-verb tag (EI-3 — verbatim verbs preserved) ─────────────────────
  source-verb-tag:
    background: 'transparent'
    foreground: '{colors.primary}'
    border: 'none'
    font: '{typography.label-caps}'
    # "ALLEGED", "TESTIFIED", "VOTED", "DENIED", "CLAIMED" — never paraphrased
  source-verb-tag-risk:
    foreground: '{colors.defamation-risk-caution}'

  # ── Claim component (fact vs. attributed — EI-2) ──────────────────────────
  claim-fact:
    foreground: '{colors.claim-fact}'
    border-left: '3px solid {colors.claim-fact}'
    font: '{typography.body-md}'
  claim-attributed:
    foreground: '{colors.claim-attributed}'
    border-left: '3px dashed {colors.claim-attributed}'
    font-style: 'italic'
  claim-dashed:
    foreground: '{colors.claim-dashed}'
    border-left: '3px dashed {colors.claim-dashed}'
    text-decoration: 'line-through'
    # Superseded/retracted — STR-6b/ADR-017

  # ── Graph nodes (by entity type) ──────────────────────────────────────────
  graph-node-person:
    fill: '{colors.primary}'
    border: '2px solid {colors.primary}'
    radius: '{rounded.full}'
    # Circular — persons are the primary navigational anchor
  graph-node-respondent:
    fill: '{colors.accent}'
    border: '3px solid {colors.accent}'
    radius: '{rounded.full}'
    # The case respondent (Sara Duterte v1) is visually distinct — larger,
    # accent-colored, the default Trace seed
  graph-node-document:
    fill: '{colors.surface-sunken}'
    border: '1px solid {colors.border}'
    radius: '{rounded.md}'
    # Rounded rectangle — documents are artifacts, not actors
  graph-node-claim:
    fill: '{colors.surface-raised}'
    border: '1px solid {colors.claim-attributed}'
    radius: '{rounded.sm}'
    # Claims are assertions; the dashed-attributed border carries the
    # fact-vs-claim distinction into the graph
  graph-node-evidence:
    fill: '{colors.trust-tier-verified}'
    border: '1px solid {colors.trust-tier-verified}'
    radius: '{rounded.sm}'
  graph-node-selected:
    border: '3px solid {colors.accent}'
    # Selection state — accent ring, applies to any node type

  # ── Graph edges (by relationship type, AIF-aware) ─────────────────────────
  graph-edge-default:
    stroke: '{colors.muted-foreground}'
    stroke-width: '1px'
  graph-edge-support:
    stroke: '{colors.trust-tier-verified}'
    stroke-width: '1.5px'
    # AIF support relation — solid
  graph-edge-attack:
    stroke: '{colors.trust-tier-contradicted}'
    stroke-width: '1.5px'
    stroke-dasharray: '4 3'
    # AIF attack relation — dashed red
  graph-edge-premise:
    stroke: '{colors.primary}'
    stroke-width: '2px'
    # AIF premise — bold
  graph-edge-temporal-faded:
    stroke: '{colors.border}'
    opacity: '0.4'
    # Edges outside the current temporal scrubber window fade

  # ── Timeline scrubber ──────────────────────────────────────────────────────
  timeline-scrubber-track:
    background: '{colors.surface-sunken}'
    height: '6px'
    radius: '{rounded.full}'
  timeline-scrubber-handle:
    background: '{colors.accent}'
    border: '2px solid {colors.surface-raised}'
    radius: '{rounded.full}'
  timeline-scrubber-window:
    background: '{colors.accent}'
    opacity: '0.15'
  timeline-marker:
    # Narrative beat markers along the track
    background: '{colors.primary}'
    radius: '{rounded.full}'
    width: '8px'
    height: '8px'

  # ── Evidence split panel ──────────────────────────────────────────────────
  evidence-panel-supporting:
    border-top: '2px solid {colors.trust-tier-verified}'
    background: '{colors.surface-raised}'
  evidence-panel-refuting:
    border-top: '2px solid {colors.trust-tier-contradicted}'
    background: '{colors.surface-raised}'
  evidence-panel-contextualizing:
    border-top: '2px solid {colors.muted-foreground}'
    background: '{colors.surface-raised}'
  evidence-panel-empty-one-sided:
    # The honest one-sided empty state — "Only supporting evidence detected in v1"
    background: '{colors.surface-sunken}'
    border: '1px dashed {colors.border}'
    font: '{typography.body-md}'

  # ── Senator dashboard card ────────────────────────────────────────────────
  senator-card:
    background: '{colors.surface-raised}'
    border: '1px solid {colors.border}'
    radius: '{rounded.lg}'
    padding: '{spacing.24}'
  senator-card-header:
    font: '{typography.headline}'
  senator-card-stat-label:
    font: '{typography.label-caps}'
    foreground: '{colors.muted-foreground}'
  senator-card-stat-value:
    font: '{typography.body-lg}'
    foreground: '{colors.claim-fact}'

  # ── Chat answer block ─────────────────────────────────────────────────────
  answer-block:
    background: '{colors.surface-raised}'
    border-left: '3px solid {colors.primary}'
    padding: '{spacing.20}'
    radius: '{rounded.md}'
  answer-block-silence:
    # The "No sourced answer found" state — quiet, not punitive
    background: '{colors.surface-sunken}'
    border-left: '3px solid {colors.muted-foreground}'
    font: '{typography.display-sm}'
    foreground: '{colors.muted-foreground}'
  answer-block-essence:
    # PD-1 essence sentence renders on every answer surface
    font: '{typography.caption}'
    foreground: '{colors.muted-foreground}'
    font-style: 'italic'

  # ── Document viewer ───────────────────────────────────────────────────────
  document-viewer:
    background: '{colors.surface-raised}'
    font: '{typography.mono}'
    # Legal documents read in mono — preserves formatting, signals "this is
    # the raw record"
  document-viewer-highlight:
    background: '{colors.accent}'
    opacity: '0.25'
    # The anchored citation span is highlighted when arrived via citation drill-down
  document-viewer-superseded:
    # Superseded/retracted passages carry a visible flag
    border-left: '3px solid {colors.claim-dashed}'

  # ── Empty state ────────────────────────────────────────────────────────────
  empty-state-headline:
    font: '{typography.display-sm}'
    foreground: '{colors.muted-foreground}'
  empty-state-body:
    font: '{typography.body-md}'
    foreground: '{colors.muted-foreground}'
---

## Brand & Style

Impeachment Watch is an evidence-backed knowledge graph for Philippine impeachment — a product where every factual assertion carries a citation or is not returned at all. The aesthetic posture is **legal journal crossed with modern investigative tool**: credible, precise, with a narrative voice. It should feel like the thing a Senate reporter opens at 2 a.m. to trace a claim to its source — not like a SaaS dashboard, not like a consumer app, not like an AI demo.

The user's direction cues — "clean, modern, sleek," "interactive, especially the knowledge graph," "tells a story," "not AI-generated," "unique," "logical" — resolve into a coherent posture: **regulated civic-tech with editorial weight**. The product deals with constitutional law, Senate trials, and evidence. The visual language earns trust by looking like it belongs in that world — a serif display for case titles and narrative beats (the way a legal journal sets a case header), a clean sans for the data-dense surfaces (graph side panels, evidence tables, senator dashboards), and a mono for legal citations and raw document text (the way a court reporter sets a quote). The knowledge graph is the interactive centerpiece and the one place the product leans into "sleek" — but even there, the restraint of a legal-investigative tool holds.

Impeachment Watch inherits shadcn/ui defaults wholesale. This DESIGN.md specifies only the brand-layer deltas: primary/accent colors, the semantic trust-tier and claim tokens (domain-critical — these do not exist in shadcn), the display serif, the tightened corners, and the compound components that shadcn does not ship (Citation, TrustBadge, SourceVerbTag, Claim, graph nodes/edges, timeline scrubber, evidence split, senator card, answer block). The 80% of components that ship from shadcn (Button, Card, Dialog, Sheet, Command, Popover, Toast, Tabs, Avatar, Separator) inherit shadcn's visual specs as-is. Customizing those is explicitly against brand discipline — shadcn's defaults are the contract.

The product is single-case v1 (Sara Duterte impeachment). The visual system does not surface case selection; it is built around one case and may generalize later.

## Colors

The palette is a warm-white institutional base, a deep navy ink, a restrained ochre accent, and a family of semantic tokens for trust tiers, claim types, and defamation risk. The semantic tokens are the domain-critical layer — fact-vs-claim and trust-tier distinctions must be visible without being alarming, and must never rely on color alone (icons and labels accompany every semantic color; see Accessibility Floor in EXPERIENCE.md).

- **Primary Navy (`#1E3A5F` light / `#7BA8D4` dark)** — the institutional ink. Used on primary actions, active nav items, links, the essence-sentence banner, graph person nodes, AIF premise edges. NOT used for trust indicators or claim states — those have their own semantic tokens. Replaces shadcn's default `primary`.
- **Accent Ochre (`#B8761E` light / `#D49A3E` dark)** — the "you are here" marker. Used on the selected graph node, the temporal scrubber handle, the active citation chip, the document-viewer citation highlight. NOT used decoratively, NOT used for trust/state, NOT used for chrome. Ochre means "this is where your attention is."
- **Surface Base (`#FBF8F2` light / `#131418` dark)** — warm parchment white in light mode, modern dark in dark mode. Light reads like a court document filed on a desk, not a clinical SaaS canvas. Dark is the "interactive" surface — the mode a user toggles for the graph at night.
- **Trust-tier-Verified (`#2A6B5E` / `#4A9D8A`)** — a calm teal-green, deliberately muted. Used on tier-1 source badges, AIF support edges, evidence panel supporting header. NOT bright green — bright green reads "approved/safe," which overstates what a tier-1 source means. A tier-1 source is "primary, on the record," not "true."
- **Trust-tier-Contradicted (`#9B3A2E` / `#C46B5C`)** — a muted brick red. Used when sources disagree, on AIF attack edges, on the refuting evidence panel header. NOT alarm red — disagreement is a provenance fact, not an error.
- **Trust-tier-Caution (`#8F5A12` / `#D49A3E`)** — a darker ochre in light mode (AA-compliant on `surface-sunken` at 4.5:1), sharing the accent family in dark. Used on tier-3/low-confidence source markers, single-source warnings. Caution is "look closer," not "stop."
- **Claim-fact (`#1B1C19` / `#E8E4DC`)** — near-black in light mode, near-white in dark. Established facts (tier-1 primary OR ≥2 independent sources) render in full ink with a solid left border. This is the strongest visual weight an assertion carries.
- **Claim-attributed (`#6B6258` / `#9A918A`)** — muted warm gray, italic, with a dashed left border. Attributed claims ("Senator X *stated* Y") are visually lighter than facts — they are what someone said, not what is established.
- **Claim-dashed (`#736B5E` / `#6E655D`)** — strikethrough, darkened to AA 4.5:1 on `surface-raised` in light mode. Used on superseded/retracted assertions (STR-6b/ADR-017). The passage remains visible for reproducibility but is marked gone — de-emphasis cannot cross into illegibility.
- **Defamation-risk-caution (`#8B2C1F` / `#C45A42`)** — a deeper, distinct red. Used on the editorial-review risk-tier badge and on any assertion flagged for pre-external legal clearance. Distinct from trust-tier-contradicted (source disagreement) — this is *legal risk*, a different signal.
- **Destructive (`#9B2A1A` / `#C74233`)** — overrides shadcn default toward a deeper, less alarming red. Used for destructive actions only.
- **Border (`#E3DED1` / `#2A2C31`)** — warm dust in light, cool graphite in dark. 1px, never thicker; borders separate, they do not enclose.

**Light/dark rationale.** Light is default because the product's tone is court-document credibility — warm parchment, serif display, ink text. Dark is the user-toggle for the "sleek interactive" surface — the graph at night, the long analysis session. The semantic tokens shift value (not hue) between modes to maintain AA contrast and the same perceptual hierarchy: verified stays teal, contradicted stays red, caution stays ochre, fact stays high-contrast, attributed stays muted.

**Contrast targets.** All load-bearing text/background combinations verified to WCAG 2.1 AA: 4.5:1 for text, 3:1 for UI components and graphical objects. Verified pairs include: `primary` on `surface-base`, `muted-foreground` on `surface-base`, `trust-tier-verified` on `surface-raised`, `trust-tier-contradicted` on `surface-raised`, `trust-tier-caution` on `surface-sunken`, `claim-attributed` on `surface-raised`, `claim-dashed` on `surface-raised`, `defamation-risk-caution` on `surface-raised`, `citation-chip-active` foreground on fill. Both modes verified. See EXPERIENCE.md → Accessibility Floor for the behavioral contract.

## Typography

Type is the primary vehicle for the "tells a story" cue. A serif display signals "this is the record" — the way a legal journal sets a case header or a Senate journal opens a session. The sans body handles data density. The mono handles legal citations and raw document text.

- **Source Serif 4** is the display voice. Classic proportions, designed for screens, open-source. Appears in: case titles on the case overview, narrative-beat markers on the timeline, empty-state headlines (including "No sourced answer found"), section headers on senator dashboards, the document-viewer document title. The serif is a punctuation mark — it appears where the product is *naming a thing*, not everywhere.
- **Geist Sans** (shadcn default, inherited) is the body and UI voice. Handles answer-block text, graph side-panel labels, evidence table rows, senator dashboard stats, navigation, microcopy. No override unless noted.
- **IBM Plex Mono** is the citation and document voice. Used for: inline legal citations (`G.R. No. 127255`), AKN fragment URIs, verbatim quoted passages in the citation modal, document-viewer body text. Mono preserves document formatting and signals "this is the raw record, unparaphrased." Institutional character — IBM Plex was designed for technical and civic contexts.
- **Label-caps** (Geist Sans, 11px, 600 weight, 0.12em tracking) — tracked-out caps for section headers, trust-tier labels, source-verb tags, the "SUPPORTING / REFUTING / CONTEXTUALIZING" evidence panel headers. The tracked-out caps are the legal-style-sheet signal.

Rules: the serif appears at most once per surface (the case title, the empty-state headline, the section header — not all three). Body text is never set in serif. Mono is never set in serif. Labels are always caps-tracked; sentence-case labels are a bug.

## Layout & Spacing

shadcn / Tailwind 4-based spacing scale inherited (4, 8, 12, 16, 20, 24, 32, 40, 48, 64). Three named overrides:

- **`editorial-gap` (56px)** — the vertical breathing room between major narrative sections on the case overview, timeline, and senator dashboard. Wider than shadcn's default section gap because the product is read, not scanned.
- **`graph-panel` (320px)** — the fixed-width side panel on the graph surface. Holds the selected-node citation context, the filter controls, and the mode switcher. Wide enough for a citation chip + source-verb tag row, narrow enough to leave the canvas dominant.
- **`evidence-split-gap` (48px)** — the gap between supporting / refuting / contextualizing columns in the evidence split. The gap is the honest-split signal — these are separate, not blended.

Desktop-first layout. The graph surface is full-bleed canvas with the `graph-panel` pinned left and the temporal scrubber pinned bottom. The document viewer is a centered reading column (`max-w-3xl`) with a citation-context side rail on `xl`. The evidence split is a three-column grid on `xl`, stacked on `lg` and below. The senator dashboard is a 12-column grid with stats cards. The chat surface is a single centered column (`max-w-2xl`) — the answer is the product, not the chrome.

## Elevation & Depth

shadcn defaults inherited (subtle shadow on hover/active, no elevation-as-hierarchy). Impeachment Watch adds one delta: the **citation modal** and the **graph selected-node** carry a slightly warmer shadow (`rgba(30, 58, 95, 0.08)` in light, `rgba(0, 0, 0, 0.4)` in dark) to read as "lifted off the record" — the way a document sits on a desk. All other surfaces inherit shadcn's shadow language. No drop shadows on cards, no elevation on nav, no floating toolbars.

## Shapes

Tighter than shadcn defaults (3 / 5 / 8 vs shadcn's 6 / 8 / 12). The crispness reads "investigative tool" and "legal document" — sharp enough to feel precise, soft enough not to feel hostile. Exceptions:

- **Graph nodes** are `rounded.full` (circular) for persons, `rounded.md` for documents, `rounded.sm` for claims/evidence. Shape encodes entity type — a person is a node, a document is a card, a claim is a block.
- **Citation chips** are `rounded.full` (pill) — they sit inline in answer text and need to read as "a thing you can click," not a tag.
- **Trust badges** are `rounded.sm` — they are labels, not buttons.
- **Evidence panels** are `rounded.lg` with a colored top border (2px) — the top border is the semantic signal, the radius is containment.
- **Document viewer** has no radius — it is the raw record.

## Components

Visual specs. Behavioral specs live in EXPERIENCE.md → Component Patterns.

- **Citation chip** — inline pill in answer text. `{colors.surface-sunken}` fill, `{colors.claim-attributed}` text, 1px `{colors.border}`. Shows a superscript numeral and the source-verb on hover. Active/hover state: `{colors.accent}` fill. Clicking opens the Citation modal. Never appears without a backing citation (the component renders `<Citation.Empty>` by default and promotes to `<Citation.Chip>` only when provenance resolves — AC-2 at the component boundary).
- **Citation modal** — `{colors.surface-raised}`, `{rounded.lg}`, 1px border. Anatomy: document title (display-sm), trust-tier badge, source-verb tag, verbatim quoted passage in `{typography.mono}` with the cited span highlighted, "View full document" link. The quoted passage is the visual center — it is the evidence, unparaphrased. Modal stacks one level deep.
- **Trust badge** — `label-caps` text on a semantic fill. Three variants: `trust-badge-verified` (teal), `trust-badge-contradicted` (brick), `trust-badge-caution` (ochre on sunken surface with ochre border — outline style, not filled, so caution reads as "look closer" not "warning"). Always accompanied by an icon (check / split / eye) and a label — never color alone.
- **Source-verb tag** — `label-caps` in `{colors.primary}`, no background, no border. Renders the preserved verb verbatim: "ALLEGED", "TESTIFIED", "VOTED", "DENIED", "CLAIMED". The risk variant (`source-verb-tag-risk`) uses `{colors.defamation-risk-caution}` for verbs flagged in editorial review. Never paraphrased, never capitalized differently from the source.
- **Claim component** — renders an assertion with the fact-vs-claim distinction (EI-2). Three variants: `claim-fact` (solid left border, full-ink text), `claim-attributed` (dashed left border, italic, muted text), `claim-dashed` (dashed left border, strikethrough, faded — superseded/retracted). The visual distinction is the regulatory core — an allegation stated as fact is a P0 defect.
- **Graph node** — circular for persons, rounded rectangle for documents, small rounded square for claims/evidence. The respondent node (case default seed) is accent-colored and larger. The selected node carries a 3px accent ring. Node size scales by degree (connectedness) within a bounded range — a high-degree senator reads larger, but no node is so large it dominates the canvas.
- **Graph edge** — solid for default, solid teal for AIF support, dashed red for AIF attack, bold navy for AIF premise. Edges outside the temporal scrubber window fade to `{colors.border}` at 0.4 opacity. Edge labels (the relationship type, UPPERCASE: `VOTED_AGAINST`, `FILED`, `TESTIFIED_IN`) render in `mono-sm` and truncate with ellipsis past a length threshold.
- **Timeline scrubber** — `{colors.surface-sunken}` track (6px, `rounded.full`), `{colors.accent}` handle, `{colors.accent}` at 0.15 opacity window. Narrative-beat markers (`timeline-marker`) sit on the track as 8px navy dots. The scrubber is persistent on the graph surface (bottom-pinned) and the primary control on the timeline surface. Imprecise dates (date_precision = month/year/approx) render as a range, not a point — "March 2026" spans the March band, not March 1.
- **Evidence split panel** — three panels (supporting / refuting / contextualizing) in a three-column grid on `xl`, stacked on `lg`. Each panel: `{colors.surface-raised}`, 2px semantic top border (`trust-tier-verified` / `trust-tier-contradicted` / `muted-foreground`), `label-caps` header. The one-sided empty panel (`evidence-panel-empty-one-sided`) uses a dashed border and the verbatim copy: *"Only supporting evidence detected in v1; refuting evidence was not surfaced — v1 does not detect contradictions."*
- **Senator dashboard card** — `{colors.surface-raised}`, 1px border, `{rounded.lg}`, `{spacing.24}` padding. Header in `headline` serif. Stat labels in `label-caps` muted, stat values in `body-lg` ink. The "lightweight v1" dashboard shows: statements on record, past votes, committee participation, personal timeline entries tied to the case. Full dashboard deferred to Phase 2.
- **Answer block (chat)** — `{colors.surface-raised}`, 3px `{colors.primary}` left border, `{spacing.20}` padding, `{rounded.md}`. Answer text in `body-md`. Inline citation chips. The essence sentence (`answer-block-essence`) renders below every answer in `caption` italic muted: *"Every claim IIP shows you cites a source you can open — or IIP shows you nothing."* The silence state (`answer-block-silence`) uses `{colors.surface-sunken}`, a muted-foreground left border, and `display-sm` headline: "No sourced answer found."
- **Document viewer** — centered reading column, `{colors.surface-raised}`, `mono` body text. The anchored citation span (arrived via citation drill-down) is highlighted in `{colors.accent}` at 0.25 opacity. Superseded passages carry a 3px `{colors.claim-dashed}` left border and a "Superseded" flag.
- **Empty state** — `display-sm` muted headline, `body-md` muted body, at most one primary action. The "No sourced answer found" empty state is first-class: no suggested next steps that would tempt invention, no "try rephrasing" that implies the question was wrong. The silence is the answer.

## Do's and Don'ts

| Do | Don't |
|---|---|
| Inherit shadcn defaults for everything not in the brand layer | Override shadcn's structural tokens (background, foreground, card, popover, input, ring) beyond `primary`, `accent`, `destructive` |
| Use semantic tokens by meaning (`{colors.trust-tier-verified}`) | Use raw color values or generic color names (`--green-500`) |
| Render the fact-vs-claim distinction on every served assertion | Label an attributed claim as "verified," "confirmed," or "true" (FR-5.4 — banned) |
| Preserve source verbs verbatim — "ALLEGED," "TESTIFIED," "VOTED" | Paraphrase verbs stronger or weaker ("said" → "alleged," "claimed" → "admitted") |
| Use the serif display at most once per surface | Set body text in serif to "make it look editorial" |
| Use mono for legal citations and document text | Use sans for G.R. numbers, AKN URIs, or quoted passages |
| Light mode by default; dark as user toggle | Ship dark-only — the court-document tone is light |
| Tighter corners (3/5/8) — reads "tool," not "consumer app" | Use shadcn's default 6/8/12 — Impeachment Watch reads sharper |
| Let the silence state be quiet (`answer-block-silence`) | Animate, celebrate, or apologize for "No sourced answer found" |
| Use ochre accent only for "where your attention is" (selected node, scrubber, active chip) | Use accent for state, trust, chrome, or decoration |
| Pair every semantic color with an icon + label | Rely on color alone for trust-tier or fact-vs-claim (a11y — see EXPERIENCE.md) |
| Distinguish "acquitted," "resigned," and "voided" as separate outcome states | Collapse them into a single "closed" state (domain rule 12) |
| Mark superseded/retracted assertions with `claim-dashed` | Delete or silently hide retracted assertions (STR-6b — reproducibility requires they remain) |