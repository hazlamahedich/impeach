# Accessibility Review — Impeachment Watch

## Overall verdict

The spine pair takes accessibility more seriously than most product spines: it commits explicitly to WCAG 2.1 AA, enforces color-never-alone on every semantic token, ships a graph list-view alternative rather than treating the canvas as the only path, and specifies focus management for modals. However, two load-bearing color combinations in **light mode** fail the 4.5:1 text-contrast threshold the spine claims to uphold — the trust-tier-**caution** badge and the **active citation chip** — and the fact-vs-claim distinction, the regulatory core, is visually marked but not programmatically conveyed to screen readers. The graph a11y alternative is well-conceived but under-specified at the ARIA-structure level, and three of seven consumer surfaces lack screen-reader announcements. Fixable without rework; the foundations are sound.

## Findings by severity

### Critical (2)

- **Trust-badge-caution text fails 4.5:1 contrast in light mode.** The caution badge (outline style: `surface-sunken` `#F0EDE6` background, `trust-tier-caution` `#B8761E` foreground, 1px `#B8761E` border, `label-caps` 11px/600 text) computes to **~3.2:1** — below the 4.5:1 required for normal-size text. `EXPERIENCE.md:156` claims contrast verification for verified-on-white, contradicted-on-white, claim-attributed, and defamation-risk-caution but **omits the caution badge**, hiding this failure. The caution tier marks tier-3 / single-source warnings — the most vulnerable citations — so illegible caution text undermines the provenance signal where it matters most. (DESIGN.md:183–188, EXPERIENCE.md:156). *Fix:* darken the caution text token for badge use (e.g. `#8F5A12` ≈ 4.6:1 on `#F0EDE6`), or switch the badge to a filled variant with white text on a darker ochre, or bump the badge text to ≥18px bold to qualify as "large text" (3:1 threshold). Add `trust-tier-caution` explicitly to the contrast-verification list in EXPERIENCE.md:156.

- **Citation-chip-active text fails 4.5:1 contrast in light mode.** The active/hover chip (`accent` `#B8761E` fill, `accent-foreground` `#FBF8F2` text, `label-caps` 11px) computes to **~3.5:1** — below 4.5:1 for 11px text. The active chip is the primary provenance entry point; when a keyboard or pointer user focuses a citation, the text becomes hard to read for low-vision users. (DESIGN.md:161–163). Dark mode passes (~7.7:1). *Fix:* use a darker active-chip fill in light mode (e.g. `#8F5A12` with `#FBF8F2` text ≈ 5.4:1), or render active-chip text at ≥18px bold, or invert to `primary` navy fill with white text (which passes at ~10:1).

### High (6)

- **Fact-vs-claim distinction is not programmatically conveyed to screen readers.** The regulatory core (EI-2) marks fact vs. attributed claim via border style (solid vs. dashed) and text style (roman vs. italic) + weight (DESIGN.md:431, EXPERIENCE.md:241). None of these are exposed to assistive technology. No `aria-label`, visually-hidden label, or `role` is specified. For a product where "an allegation stated as fact is a P0 defect," the distinction must be programmatically determinable, not just visually perceived. (EXPERIENCE.md:78, 241). *Fix:* add a visually-hidden prefix or `aria-label` to `<Claim>` — e.g. `aria-label="Fact: …"` / `aria-label="Attributed claim: …"` / `aria-label="Superseded: …"` — and add an `aria-live="polite"` announcement when claim type changes in dynamic contexts.

- **Claim-dashed (superseded) text fails 4.5:1.** Superseded/retracted assertions use `claim-dashed` `#8A8275` with strikethrough on `surface-raised` `#FFFFFF` ≈ **3.8:1** — below 4.5:1 for `body-md` text. STR-6b/ADR-017 require superseded assertions to remain visible for reproducibility; de-emphasis cannot cross into illegibility. (DESIGN.md:209–213). *Fix:* darken `claim-dashed` to ~`#736B5E` (≈4.6:1 on white) while keeping the strikethrough + "Superseded on [date]" flag for the de-emphasis signal.

- **Document-viewer anchored span is not a focus target.** When a user drills down via citation modal → "View full document" → `/documents/[id]`, the cited passage is highlighted visually (`accent` 0.25) but no focus, skip-link, or `aria-activedescendant` is specified. A screen-reader user lands at page top with no programmatic way to jump to the cited passage — the terminus of the provenance drill-down is inaccessible. (EXPERIENCE.md:84, 251). *Fix:* make the anchored span focusable (`tabindex="-1"`) and move focus to it on load via a route-effect, or render a "Skip to cited passage" skip-link as the first focusable element on `/documents/[id]#span-…`.

- **"No sourced answer found" and no-prediction states are not announced via aria-live.** These are the Journey 1 and Journey 2 climaxes — first-class trust signals — but their dynamic appearance (query resolves to silence / predictive-question refusal) is not specified as `aria-live` announced. A screen-reader user may not learn the platform refused to invent. (EXPERIENCE.md:94, 108). *Fix:* wrap the answer-block region in `aria-live="polite"` (or `assertive` for the silence/no-prediction states) so the answer-or-silence is announced on resolution.

- **Screen-reader surface announcements missing for 3 of 7 consumer surfaces.** `EXPERIENCE.md:152` specifies on-navigation announcements for Graph, Citation modal, Evidence split, and Senator dashboard — but **not** Chat, Timeline, Document viewer, or Claim surface. Chat is the primary entry point. *Fix:* add announcement specs for all seven surfaces (e.g. Chat: "Chat. Ask a question — every answer cites a source or shows nothing."; Timeline: "Timeline, [N] events, [M] narrative beats."; Document viewer: "Document [title], arrived at cited passage."; Claim: "Claim [id], [fact|attributed], [N] citations.").

- **Focus management on graph mode switch unspecified.** Switching Trace ↔ Explore ↔ Query ↔ Temporal re-renders the canvas (`?mode=` updates); focus could be lost to the void. Only node-selection focus management is specified. `aria-live` announces the mode change (EXPERIENCE.md:151) but focus is not managed. *Fix:* on mode switch, move focus to the canvas container or the first node in reading order, and announce "Mode changed to [mode], [N] nodes visible."

### Medium (7)

- **Trust-tier-caution omitted from contrast-verification claim.** EXPERIENCE.md:156 lists verified/contradicted/claim-attributed/defamation-risk as verified to 4.5:1 but does not list the caution badge — the combination that fails (Critical #1). The omission is itself a process gap. *Fix:* enumerate every load-bearing text/background pair in the contrast-verification list, including outline-style badges and active states.

- **Touch target sizes not specified for mobile-degraded surfaces.** WCAG 2.5.5/2.5.8 (AA in 2.2) requires ≥44×44 CSS px touch targets. The mobile graph list view, senator stack, and evidence tabbed stack don't specify minimum target sizes. (EXPERIENCE.md:160–170). *Fix:* add a touch-target minimum to the Responsive & Platform table for `md`/`sm` breakpoints.

- **No plain-language / glossary layer for the "engaged citizen" persona.** Legal terms (`fallo`, `certiorari`, `Articles of Impeachment`, `G.R. No.`, `AKN`, `SO ORDERED`) appear throughout without glossary linking, hover definitions, or readability-level targets. The institutional voice (EXPERIENCE.md:69) may exclude the citizen audience the product is partly for. *Fix:* specify a glossary-tooltip pattern on first-use legal terms and a plain-language summary on the case overview; set a target reading level for citizen-facing surfaces.

- **Operator/editorial-review surface a11y unspecified.** The defamation-risk risk-tier badges are described as "green/amber/red" (EXPERIENCE.md:253) — color-named. Operator surfaces are "out of external-presentation scope" (EXPERIENCE.md:47) but editorial reviewers still need accessible interfaces. *Fix:* add an a11y note that operator surfaces inherit the same color-never-alone + contrast floor even though full behavioral spec is deferred.

- **Graph list-view ARIA structure unspecified.** The list-view alternative is the a11y-compliant path (EXPERIENCE.md:151) but its semantic structure (`<table>`? `<ul>` with `role="listitem"`? `treegrid`?), per-row `aria-label` pattern, and node/edge announcement granularity are not defined. *Fix:* specify the list view as a `<table>` with columns (Node, Type, Trust Tier, Relationships) or a `<ul role="list">` with `aria-label` per row, and define the announcement unit (node + its edges as one row).

- **Skip-to-content link not specified.** A data-dense product with a persistent sidebar/nav benefits from a skip link; shadcn does not ship one by default. *Fix:* add a visually-hidden-until-focused "Skip to main content" link as the first focusable element in the layout.

- **Error-state announcements not specified as aria-live.** The fail-closed degraded-service message and query-timeout message are surface text (EXPERIENCE.md:99, 101) but not specified as `aria-live`. Rate-limited uses shadcn `Toast` (which has aria-live). *Fix:* wrap the degraded/timeout surface regions in `aria-live="assertive"`.

### Low (3)

- **`prefers-contrast` media query not addressed.** Only `prefers-reduced-motion` is handled (EXPERIENCE.md:157). *Fix:* add a `prefers-contrast: more` override that darkens semantic tokens and thickens borders.

- **Faded temporal edges likely fail 1.4.11 (non-text contrast).** `graph-edge-temporal-faded` uses `border` `#E3DED1` at 0.4 opacity — likely below 3:1 as a graphical object. Arguably intentional de-emphasis, but edges outside the window still convey "relationship exists." *Fix:* confirm the faded edge is decorative (not required for comprehension) or raise its contrast to 3:1.

- **Page landmarks not explicitly specified.** `header`/`nav`/`main`/`footer` roles rely on shadcn defaults; not called out in the spine. *Fix:* add a landmarks note to the IA section.

## Strengths

- **Explicit WCAG 2.1 AA commitment**, stated as non-negotiable for a regulated-leaning product (EXPERIENCE.md:148).
- **Color-never-alone is a stated, enforced principle** — trust badges always pair color with an icon (check/split/eye) and a label (DESIGN.md:429, EXPERIENCE.md:86); fact-vs-claim uses border style + text style + weight, not color (EXPERIENCE.md:150, 241); source-verb tags are text, not swatches (EXPERIENCE.md:150). This is the single most important a11y decision and it is consistently applied across both spines.
- **Graph list-view alternative is honest, not an afterthought** — `aria-describedby` link to "View as list," tabular node/edge list operable by keyboard and screen reader, with the explicit note that the list is "a functional, a11y-compliant alternative — not a degraded afterthought" (EXPERIENCE.md:151). Few products with interactive graphs attempt this.
- **Focus management for modals is specified** — open → focus to modal title; close → focus returns to trigger; graph node select → focus to side-panel citation context (EXPERIENCE.md:154).
- **Keyboard shortcuts are documented with discoverable help** — `?` opens the shortcut overlay; `Esc` always closes the topmost modal/popover; no keyboard trap stated (EXPERIENCE.md:130–136, 153).
- **`prefers-reduced-motion` is handled** — temporal-scrub animation degrades to a fade, not a slide; no autoplay motion (EXPERIENCE.md:157).
- **Semantic tokens shift value not hue between light/dark** — maintains perceptual hierarchy and contrast in both modes (DESIGN.md:386).
- **Citation drill-down depth is capped** — no modal stack >1 level, browser-back returns to originating surface with URL state preserved (EXPERIENCE.md:105), reducing focus-loss risk.
- **Screen-reader announcements are specified for four surfaces** — Graph, Citation modal, Evidence split, Senator dashboard (EXPERIENCE.md:152) — with meaningful, content-aware copy, not generic labels.
- **The Do/Don't table in DESIGN.md explicitly bans color-alone** for trust-tier and fact-vs-claim (DESIGN.md:455), making the a11y rule a design-discipline issue, not just an a11y afterthought.