# Dev Agent Record Template

> Formalized per Foundation Action Plan P5 (Paige GAP #10). Every story's
> Dev Agent Record MUST follow this structure. Copy this template into the
> story artifact when implementation begins.

---

## Dev Agent Record

### Agent Model Used

```
<model-name-and-version>
```

### Debug Log References

<!-- Bullet list of significant issues encountered during implementation,
     how they were diagnosed, and how they were resolved. Each entry should
     be specific enough that a future developer can reproduce the diagnosis. -->

- **<issue summary>:** <diagnosis>. Resolved by <fix>.

### Completion Notes List

<!-- Bullet list confirming what was accomplished. Reference AC IDs. -->

- **All N ACs (AC-FX-01…NN) satisfied and verified.** Final gate run:
  - `pnpm build` → X/X turbo tasks OK
  - `pnpm typecheck` → X/X turbo tasks OK
  - `pnpm lint` → zero errors
  - `pnpm test` → smoke X/X + packages X/X OK
  - Additional gates as applicable
- **Deviations from spec (documented):**
  1. <what changed> — <why> — <AC or rule reference>

### File List

<!-- Categorized list of all files created or modified. -->

**New files:**
- `path/to/file.ts` — <one-line description>

**Modified files:**
- `path/to/file.ts` — <what changed>

### Review Findings

<!-- After code review, list findings with tags. -->

- [ ] [Review][Patch] <description> — [<file>:<line>]
- [x] [Review][Defer] <description> — <rationale for deferral>
- [x] [Review][Decision] <description> — Decision: <what was decided>

---

## Template Rules

1. **Every story gets a Dev Agent Record** — no exceptions, no "N/A."
2. **Debug Log entries are specific** — include error messages, version
   numbers, and reproduction steps. "Fixed a bug" is not a debug log entry.
3. **Completion Notes cite AC IDs** — "all ACs satisfied" must list which ACs.
4. **Deviations are explicit** — every spec deviation is listed with rationale
   and AC/rule reference. Silent deviations are defects.
5. **File List is complete** — every file touched by the story is listed.
6. **Review Findings use tags** — [Patch], [Defer], [Decision], [Dismiss].
7. **Format is consistent** — every story uses the same section order. By
   Story 5.0, records are searchable and trustworthy.
