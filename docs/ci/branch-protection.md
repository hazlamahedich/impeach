# Branch Protection

> **Authority:** AC-F1-07, SEC-4, ADR-019.
> Branch protection is configured via **GitHub repository settings** (REST
> API / UI) — GitHub does NOT store branch protection as a repo file. This
> document records the required settings so an operator can reproduce them.

## Required settings (`main`)

Navigate to **Settings → Branches → Branch protection rules → main** (or
apply via the REST API / `gh api`):

| Setting                                  | Value      | Why                                            |
| ---------------------------------------- | ---------- | ---------------------------------------------- |
| `required_status_checks.strict`          | `true`     | PR must be up-to-date with base before merge   |
| `required_status_checks.contexts` (UI) / `checks[][context]` (API) | see below  | All CI jobs are required                           |
| `required_status_checks.strict`          | `true`     | PR must be up-to-date with base before merge   |
| `enforce_admins.enabled`                 | `true`     | Admins cannot override the hard gates          |
| `required_pull_request_reviews.dismiss_stale_reviews` | `true` | Re-validate after pushes             |
| `required_linear_history`                | `true`     | Squash/rebase only — no merge commits          |
| `allow_force_pushes.enabled`             | `false`    | History is immutable once pushed               |
| `allow_deletions.enabled`                | `false`    | `main` cannot be deleted                       |
| `block_creations`                        | `true`     | Block branch/tag creation outside the rules    |
| `restrict_pushes`                        | (none)     | Only CI-blessed pushes land on `main`          |

### Required status check contexts

Every CI job in [`.github/workflows/ci.yml`](../../.github/workflows/ci.yml)
MUST appear in `required_status_checks.contexts` (UI) / `required_status_checks.checks[][context]` (API).
Hard-gating means a PR cannot merge until every one is green:

- `install (pnpm frozen-lockfile)`
- `build (AC-F1-01)`
- `test (AC-F1-03 / AC-F1-05)`
- `typecheck (AC-F1-02)`
- `lint (AC-F1-08)`
- `eval gate (SC-7, AC-F1-10)`
- `adr-lint (PC-3, Story 1.10)`
- `chaos gate (deferred → Story 2.9)`

## Hard gates are non-relaxable

- `enforce_admins.enabled=true` means **admins cannot override** the
  required checks. There is no "admin merge" path around a red job.
- `required_status_checks.strict=true` means the branch MUST be up-to-date
  with `main` before merge — no merging a green PR over a newer red commit.
- A failing `eval` or `chaos` job blocks the merge exactly as a failing
  `test` would. The placeholder chaos job is `exit 0` for Epic 1; it will
  become a real gate in Story 2.9.

## Applying via `gh`

```sh
# Required contexts (one --context per job name as it appears in the UI).
# The API field is `required_status_checks[checks][][context]`; the UI displays
# the same strings under `required_status_checks.contexts`.
gh api -X PUT repos/:owner/:repo/branches/main/protection \
  -F required_status_checks[strict]=true \
  -F required_status_checks[checks][][context]='build (AC-F1-01)' \
  -F required_status_checks[checks][][context]='test (AC-F1-03 / AC-F1-05)' \
  -F required_status_checks[checks][][context]='typecheck (AC-F1-02)' \
  -F required_status_checks[checks][][context]='lint (AC-F1-08)' \
  -F required_status_checks[checks][][context]='eval gate (SC-7, AC-F1-10)' \
  -F required_status_checks[checks][][context]='adr-lint (PC-3, Story 1.10)' \
  -F required_status_checks[checks][][context]='chaos gate (deferred → Story 2.9)' \
  -F enforce_admins=true \
  -F required_pull_request_reviews[dismiss_stale_reviews]=true \
  -F restrictions= \
  -F required_linear_history=true \
  -F allow_force_pushes=false \
  -F allow_deletions=false
```

> **Note:** the exact job display names depend on the `name:` field in
> `ci.yml`. Update both files together when renaming a job.

## OIDC trust policy (cloud side)

The runner uses `permissions: id-token: write` (in `ci.yml`) to mint OIDC
ephemeral tokens. The token **lifetime (≤1h)** is controlled by the cloud
provider IAM trust policy — NOT the workflow YAML. Configure the trust
policy to:

1. Restrict the `aud` to your workload identifier.
2. Restrict `sub` to `repo:<org>/<repo>:ref:refs/heads/main` for deploy runs.
3. Set max token lifetime to 3600 seconds (1 hour) or less.
4. Deny PR-triggered runs from minting production-scoped tokens (use the
   `secrets-ok` label + `@security` CODEOWNER approval gate per SEC-4).
