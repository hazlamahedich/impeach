---
stepsCompleted: ['step-01-preflight-and-context','step-02-generation-mode','step-03-test-strategy','step-04-generate-tests','step-04c-aggregate']
lastStep: 'step-04c-aggregate'
lastSaved: '2026-07-08'
workflowType: 'testarch-atdd'
storyId: '3.2'
storyKey: '3-2-lawful-access-gate'
storyFile: '_bmad-output/planning-artifacts/epics.md (Epic 3, Story 3.2, lines 751-765)'
atddChecklistPath: '_bmad-output/test-artifacts/atdd/epic-3/story-3-2/atdd-checklist-3-2-lawful-access-gate.md'
generatedTestFiles:
  - 'tests/contract/lawful-access-gate.contract.test.ts'
inputDocuments:
  - '_bmad-output/planning-artifacts/epics.md'
  - '_bmad-output/project-context.md'
  - 'packages/contracts/src/ingest.ts'
  - 'docs/adr/0007-tiered-ingestion-architecture.md'
activationState: 'RED'
activatesIn: 'Story 3.2 implementation (assessLawfulAccess gate module under packages/ingest/src/access/)'
---

# ATDD Checklist — Epic 3, Story 3.2: Lawful-Access Gate

**Date:** 2026-07-08 · **Primary Test Level:** contract (pure gate decision logic) · **Severity:** **T1 — unlawful-ingestion defense**

> RED-phase scaffold. The `assessLawfulAccess` gate module does not exist yet. Tests are quarantined via `describe.skip` and the module is loaded via a variable-specifier dynamic import. At green phase, remove `describe.skip` and the wrapper.

## Story Summary
As an Intake Operator, I want the system to confirm a source is public and lawfully accessible before automating it, so that we never ingest material unlawfully or bypass access controls.

## Acceptance Criteria
1. System confirms the source is public (no paywall, login, or CAPTCHA)
2. robots.txt directives respected (NFR-L-1)
3. Sources behind paywalls/logins/CAPTCHAs or whose ToS forbid scraping are **DISABLED, never bypassed** (FR-1.2)
4. Gate result recorded with timestamp + operator confirmation
5. A disabled source can be manually overridden only with operator justification logged to AC-11

## Red-Phase Scaffolds
**File:** `tests/contract/lawful-access-gate.contract.test.ts` (6 tests, all RED/skipped)

- ⏭️ **[P0] LA-1:** a public source (no paywall, robots allow) → decision: ALLOW — RED
- ⏭️ **[P0] LA-2:** a paywalled source → decision: DISABLE (never bypass) — RED
- ⏭️ **[P0] LA-3:** a login-required source → decision: DISABLE — RED
- ⏭️ **[P0] LA-4:** a CAPTCHA-protected source → decision: DISABLE — RED
- ⏭️ **[P0] LA-5:** a robots.txt-disallowed path → decision: DISABLE (NFR-L-1) — RED
- ⏭️ **[P1] LA-6:** override of a disabled source requires AC-11 justification (no silent bypass) — RED

## Acceptance Criteria Coverage
| AC | Test(s) | Status |
|----|---------|--------|
| public source cleared | LA-1 | RED |
| robots.txt respected | LA-5 | RED |
| paywall → disable | LA-2 | RED |
| login → disable | LA-3 | RED |
| CAPTCHA → disable | LA-4 | RED |
| result recorded w/ timestamp | LA-1 (recordedAt) | RED |
| override requires AC-11 justification | LA-6 | RED |

## Implementation Checklist
- [ ] Create `packages/ingest/src/access/lawful-access-gate.ts` exporting `assessLawfulAccess(input)` + `overrideDisable(sourceId, {justification})`
- [ ] Define the `LawfulAccessInput` shape: source, robotsCheck, paywallDetected, loginRequired, captchaRequired, tosForbidden
- [ ] Define the `LawfulAccessResult` shape: decision ('allow'|'disable'), reason, recordedAt
- [ ] Implement the decision matrix: ALLOW iff (robots allow AND no paywall AND no login AND no CAPTCHA AND not tosForbidden); else DISABLE with typed reason
- [ ] `overrideDisable` REJECTS empty justification; on valid justification, emits an AC-11 editorial-log entry via `makeEntry` (event: `source.access_override`) — editorial repo is boot-wired (TD1/TD5)
- [ ] Add `./access/lawful-access-gate` to `packages/ingest` `package.json` `exports`
- [ ] Remove `describe.skip` + convert dynamic import to direct `import { assessLawfulAccess } from '@iip/ingest/access/lawful-access-gate'`
- [ ] Run `pnpm vitest --project contract -- lawful-access-gate` → all 6 GREEN

## Implementation Guidance
**Module path:** `packages/ingest/src/access/lawful-access-gate.ts`

**Decision logic (pure function):**
```
assessLawfulAccess(input):
  if !robotsCheck.allowed → DISABLE("robots_disallowed")
  if paywallDetected → DISABLE("paywall")
  if loginRequired → DISABLE("login_required")
  if captchaRequired → DISABLE("captcha")
  if tosForbidden → DISABLE("tos_forbidden")
  → ALLOW("public_source_robots_allowed")
```

**Override (requires editorial-log append):**
- `overrideDisable(sourceId, {justification})` → `{ok: false}` if justification empty
- Else `{ok: true, editorialLogEntry: makeEntry({event: 'source.access_override', ...})}`

**Estimated Effort:** Small (pure decision function + AC-11 wiring; the editorial repo boot-wiring is done).

## Notes
- This is defamation-adjacent: crawling a paywalled/ToS-forbidden source contaminates the corpus with unlawfully-obtained evidence, undermining every downstream citation. The "disable, never bypass" property is a T1 invariant.
- The gate input (paywall/login/CAPTCHA/ToS detection) is typically provided by the fetch adapter (Story 3.3) — the gate itself is a pure decision over those signals.
- robots.txt parsing: use an established parser (e.g. `robots-parser`); the gate receives the *result* `{allowed, crawlDelayMs}`, not the raw txt.
- Legal/editorial procurement (TD parallel track) owns the per-source lawful-access *judgment*; the gate encodes the mechanical enforcement of that judgment.

**Generated by BMad TEA Agent** — 2026-07-08
