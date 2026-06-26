# Secrets Management (sops + age)

> **Authority:** D7, NFR-S-4, SEC-4, ADR-019.
> Secrets at-rest use Mozilla SOPS 3.x with the age 1.x backend (X25519).
> CI uses OIDC ephemeral tokens (≤1h) — the private age key NEVER lives on
> PR-triggered runners (SEC-4).

## Key lifecycle

1. **Generate** a key pair locally:

   ```sh
   age-keygen -o ~/.config/sops/age/keys.txt
   # stdout prints: Public key: age1...
   ```

2. **Publish** the public key in [`../../.sops.yaml`](../../.sops.yaml) under
   the `age:` field of the `secrets/.*` rule. Commit only the public key.

3. **Distribute** the private key (`keys.txt`) to:
   - The deploy runner (hardware token / separate keystore, per ADR-019).
   - Local developers who need to decrypt (out-of-band, NOT committed).

4. **Rotate** by generating a new key, updating `.sops.yaml`, and running
   `sops updatekeys secrets/<file>.yaml` for every encrypted file.

## Encrypting a new secret

```sh
# Create a new encrypted file under secrets/
sops secrets/new-secret.yaml
# Edit the decrypted form in $EDITOR; sops re-encrypts on save.
```

Only values are encrypted; keys remain plaintext (SOPS behaviour).

## Required runtime variables

Every IIP process (API, ingest-worker, serve-worker, audit-worker,
enqueuer) calls `bootOrDie()` at startup (Story 1.11, D7). The following
env vars are validated as load-bearing and fail-closed if absent or
malformed:

| Var             | Scheme                          | Purpose                |
| --------------- | ------------------------------- | ---------------------- |
| `DATABASE_URL`  | `postgres://` / `postgresql://` | PG16 + AGE + pgvector  |
| `REDIS_URL`     | `redis://` / `rediss://` (TLS)  | Cache + BullMQ broker  |

Additional process-specific vars (MinIO, Ollama, Grafana) are documented in
[`.env.example`](../../.env.example) and validated by the owning process.

## Fail-closed boot

Any validation failure logs a pino fatal line to stderr containing only the
env-var name and a generic reason (e.g. `"missing"`, `"must start with
postgres://"`) — **never the secret value** — and exits with code 1. No
process can serve traffic with an incomplete configuration (NFR-S-4).

## CI runner isolation (SEC-4, ADR-019)

The self-hosted GitHub Actions runner is logically isolated from the
corpus/GPU workstation:

- No `/corpus` mount.
- No access to `~/.config/sops/age/keys.txt`.
- Egress restricted to named CI registries (GitHub Actions, npm, Docker Hub,
  pypi.org).
- PR-triggered runs are secret-less; secret access requires a merged commit
  or `secrets-ok` label + `@security` CODEOWNER approval.
- Runtime tokens use OIDC ephemeral credentials (≤1h), controlled by the
  cloud provider IAM trust policy — not the workflow YAML.

See [`runner-setup.md`](./runner-setup.md) for the Packer provisioning
template and GPU-passthrough (deferred to Epic 4) documentation.
