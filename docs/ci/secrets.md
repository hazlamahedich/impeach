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

## Operator bootstrap runbook (TD2 — Epic 2 Prep Sprint)

The following steps complete the deferred sops integration (Story 1.11 →
TD2). Until these are done, `tests/integration/sops-decryption.test.ts`
skips with a tool-availability message.

### 1. Install tools

```sh
brew install age sops
```

### 2. Generate or recover the age keypair

A public key already exists in `.sops.yaml` (`age13yvp...`). If the
private key exists on another machine, copy it to
`~/.config/sops/age/keys.txt`. If lost, generate a new keypair and update
`.sops.yaml`:

```sh
mkdir -p ~/.config/sops/age
age-keygen -o ~/.config/sops/age/keys.txt
# Copy the "Public key:" line into .sops.yaml → age: field
```

### 3. Create and encrypt the dev secrets file

```sh
cp secrets/.env.sops.template secrets/dev.sops.yaml
# Edit secrets/dev.sops.yaml — fill in real values for local dev
$EDITOR secrets/dev.sops.yaml  # or: sops secrets/dev.sops.yaml
sops --encrypt --in-place secrets/dev.sops.yaml
```

Verify the file is encrypted (should contain `sops:` metadata block, not
plaintext values):

```sh
head -5 secrets/dev.sops.yaml
```

### 4. Activate the integration test

```sh
pnpm test:integration -- sops-decryption
```

The test decrypts `secrets/dev.sops.yaml`, feeds the values to
`validateConfig()`, and asserts the config is valid. If it passes, TD2
is complete.

### 5. Verify fail-closed boot

```sh
# With key present → boots successfully
IIP_SOPS_AGE_KEY=$(cat ~/.config/sops/age/keys.txt) pnpm --filter @iip/config exec node --import tsx/esm src/cli.ts validate --strict

# Without key → fails closed (exit 1, logs var name only)
pnpm --filter @iip/config exec node --import tsx/esm src/cli.ts validate --strict
```

---

## Epic 3 prep — API server bootstrap keys (TD1 + TD5)

The real API server bootstrap (`apps/api/src/server.ts`) reads additional env
vars not covered by the original sops template. Generate these keys and add
them to `secrets/dev.sops.yaml` under the new `jwt`, `api`, and
`system_signing` sections (see `secrets/.env.sops.template`).

### System signing key (TD5 — editorial-log system events)

System-emitted editorial events (audit circuit-breaker transitions, auth
events) have no client signer, so the server holds a dedicated Ed25519 key.
This is the sanctioned exception to "server never holds private keys" — that
rule governs OPERATOR keys; a service-owned key for platform-integrity events
is a distinct custody domain (precedent: intake's `systemSignKey`).

```sh
# Generate the Ed25519 keypair
openssl genpkey -algorithm Ed25519 -out /tmp/sys.key

# Private key (PKCS#8 DER, base64) — for SYSTEM_SIGNING_PRIVATE_KEY
openssl pkey -in /tmp/sys.key -outform DER | base64 | tr -d '\n'

# Public key (SPKI DER, base64) — for SYSTEM_SIGNING_PUBLIC_KEY
openssl pkey -in /tmp/sys.key -pubout -outform DER | base64 | tr -d '\n'
```

Both values go in `secrets/dev.sops.yaml` under `system_signing:`. The public
key is also registered in the editorial-log key lookup so `verifyChain` resolves
`__system__` entries.

### JWT issuer keys (TD1 — auth verification)

The API verifies JWTs signed by the issuer keyring. These are DISTINCT from
intake operator keys (which sign intake transitions). Generate an issuer keypair
and register the public key:

```sh
openssl genpkey -algorithm Ed25519 -out /tmp/issuer.key
# Public key (SPKI DER, base64) — for JWT_ISSUER_PUBLIC_KEYS
openssl pkey -in /tmp/issuer.key -pubout -outform DER | base64 | tr -d '\n'
```

Set `JWT_ISSUER_PUBLIC_KEYS` to `{"issuer-1":"<base64>"}`. The private key
stays with the token issuer (a separate service or CLI; not the API server).

### After generating all keys

Re-encrypt and verify:

```sh
sops --encrypt --in-place secrets/dev.sops.yaml
pnpm --filter @iip/api typecheck   # confirms the bootstrap compiles
pnpm --filter @iip/api dev         # boots the real server (needs Docker compose up)
```
