#!/bin/sh
# init-bucket.sh — Create private raw-snapshots bucket on MinIO startup.
#
# @rules NFR-S-5
#
# This bucket is OFF the serving path — never exposed via Caddy.
# Object Lock (GOVERNANCE mode) + versioning make every snapshot an
# immutable evidence artifact: a cited PDF cannot be silently swapped
# (NFR-S-5). Idempotent: safe to run multiple times.
#
# NOTE: `--with-lock` can only be specified at bucket CREATION time
# (S3 Object Lock constraint). If the bucket already exists without
# Object Lock, `mc mb --ignore-existing --with-lock` is a no-op — the
# lock cannot be retrofitted. For existing deployments the bucket must
# be recreated. Versioning, by contrast, can be toggled on an existing
# bucket.
set -eu

MINIO_ENDPOINT="${MINIO_ENDPOINT:-http://localhost:9000}"
MINIO_ROOT_USER="${MINIO_ROOT_USER:-minioadmin}"
MINIO_ROOT_PASSWORD="${MINIO_ROOT_PASSWORD:-minioadmin}"
BUCKET="${RAW_SNAPSHOTS_BUCKET:-raw-snapshots}"

# Wait for MinIO to be ready
echo "init-bucket.sh: waiting for MinIO at ${MINIO_ENDPOINT}..."
ALIAS_OK=false
for i in $(seq 1 30); do
  if mc alias set local "$MINIO_ENDPOINT" "$MINIO_ROOT_USER" "$MINIO_ROOT_PASSWORD" >/dev/null 2>&1; then
    ALIAS_OK=true
    break
  fi
  echo "  attempt ${i}/30 — MinIO not ready yet..."
  sleep 2
done
if [ "$ALIAS_OK" != "true" ]; then
  echo "init-bucket.sh: FATAL — MinIO alias could not be configured after 30 attempts" >&2
  exit 1
fi

# Create bucket with Object Lock enabled (--with-lock auto-enables versioning).
# --ignore-existing makes this idempotent: if the bucket already exists, the
# command succeeds without error (but cannot retroactively add Object Lock).
echo "init-bucket.sh: creating bucket '${BUCKET}' with Object Lock (if not exists)..."
mc mb "local/${BUCKET}" --ignore-existing --with-lock

# Verify Object Lock is actually enabled. If the bucket pre-existed without
# lock, `mc mb --with-lock` is a no-op and the retention step below would fail
# with a confusing error. Fail closed here with a clear message.
LOCK_STATUS=$(mc lock info "local/${BUCKET}" 2>/dev/null || true)
if ! echo "$LOCK_STATUS" | grep -qiE 'object.lock.*enabled|enabled'; then
  echo "init-bucket.sh: FATAL — bucket '${BUCKET}' exists without Object Lock; recreate it to enable locking" >&2
  exit 1
fi

# Explicitly enable versioning (idempotent — safe even if already enabled).
echo "init-bucket.sh: enabling versioning on '${BUCKET}'..."
mc version enable "local/${BUCKET}"

# Set default governance-mode retention policy (30 days).
# GOVERNANCE mode allows admin override (with mc retention clear);
# COMPLIANCE mode does not. The 30-day default is a v1 operational
# default, not a legal policy — must be reviewed by cyberlibel-aware
# counsel before broad public launch (PD-3).
echo "init-bucket.sh: setting GOVERNANCE 30d default retention on '${BUCKET}'..."
mc retention set GOVERNANCE 30d "local/${BUCKET}" --default

# Set bucket to private — no public access. Fail closed on error.
echo "init-bucket.sh: setting bucket policy to private..."
mc anonymous set none "local/${BUCKET}"

echo "init-bucket.sh: done. '${BUCKET}' is private, versioned, object-locked (GOVERNANCE 30d) and ready for immutable raw snapshots."
