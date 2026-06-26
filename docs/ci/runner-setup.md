# Self-hosted GitHub Actions Runner Setup

> **Authority:** SEC-4, ADR-019, AC-F1-07.
> The CI runner is **logically isolated** from the corpus/GPU workstation —
> no shared filesystem, no shared secret store, no shared process namespace.
> GPU passthrough is **deferred to Epic 4** (no model evals in CI yet).

## Packer template

The runner image is built from
[`../../infra/runner/provision.pkr.hcl`](../../infra/runner/provision.pkr.hcl).
Packer is **NOT installed in CI** — validating the template is a pre-flight
**operator task** performed before every runner-image rebuild.

### Validate the template (manual, pre-flight)

Install Packer (1.11+) on your workstation, then from the repo root:

```sh
packer init infra/runner/provision.pkr.hcl
packer validate infra/runner/provision.pkr.hcl
```

A successful `validate` prints `The configuration is valid.` and exits 0.
Any syntax error, unknown variable, or broken source block fails non-zero
— do NOT rebuild the image until validation passes.

### Build the image (operator-only)

```sh
packer build infra/runner/provision.pkr.hcl
```

The build commits a Docker image with the runner agent + toolchain and
writes `infra/runner/manifest.json` (image digest, build metadata).

## What the runner image MUST NOT contain (SEC-4 hard gates)

The Packer template self-checks these at build time:

| Forbidden                                        | Why                                       |
| ------------------------------------------------ | ----------------------------------------- |
| `/corpus` mount                                  | Corpus never leaves the workstation host  |
| `/root/.config/sops/age/keys.txt`                | age private key is deploy-runner-only     |
| Outbound egress beyond the [allowlist](#egress)  | No exfiltration of corpus or secrets      |

## Egress

Outbound network traffic is restricted to a named-host allowlist
(`/etc/iip/egress-allowlist.txt` in the image, enforced by the entrypoint
proxy + UFW). The current allowlist:

- `github.com`, `api.github.com`, `codeload.github.com`,
  `objects.githubusercontent.com` — runner agent + checkout.
- `registry.npmjs.org` — pnpm installs.
- `docker.io`, `registry-1.docker.io`, `auth.docker.io` — Docker Hub pulls.
- `pypi.org`, `files.pythonhosted.org` — Python (uv) installs.
- `astral.sh` — uv toolchain download.

Anything else is denied at the firewall. Adding a host requires a PR to
`infra/runner/provision.pkr.hcl` + security review (SEC-4).

## OIDC tokens

The runner uses OIDC ephemeral tokens (≤1h) configured via
`permissions: id-token: write` in
[`.github/workflows/ci.yml`](../../.github/workflows/ci.yml). The token
lifetime is controlled by the cloud provider IAM trust policy, **not** the
workflow YAML. PR-triggered runs are secret-less; secret access requires a
merged commit OR the `secrets-ok` label + `@security` CODEOWNER approval.

## GPU passthrough (DEFERRED — Epic 4)

The Packer template includes the full NVIDIA Container Toolkit install +
`--gpus all` runner config as **commented-out** blocks. Activation is
deferred until Epic 4 (Story 4.x) when extraction model evals require GPU
access. Before activating:

1. Resolve the open questions in
   [ADR-019](../../docs/adr/0019-gpu-runner-workstation-contradiction.md)
   (MIG vs VFIO-mediated partition; Apple Silicon MLX equivalence).
2. Uncomment the GPU provisioner + GPU source block in
   `infra/runner/provision.pkr.hcl`.
3. Re-run `packer validate` then `packer build`.
4. Confirm the build still passes the SEC-4 hard-gate self-checks
   (GPU access MUST NOT grant corpus/key visibility — it is a device, not
   a trust boundary, per ADR-019).
