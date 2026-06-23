#!/bin/sh
# init-bucket.sh — Create private raw-snapshots bucket on MinIO startup.
#
# @rules NFR-S-5
#
# This bucket is OFF the serving path — never exposed via Caddy.
# Idempotent: safe to run multiple times (--ignore-existing).
set -eu

MINIO_ENDPOINT="${MINIO_ENDPOINT:-http://localhost:9000}"
MINIO_ROOT_USER="${MINIO_ROOT_USER:-minioadmin}"
MINIO_ROOT_PASSWORD="${MINIO_ROOT_PASSWORD:-minioadmin}"
BUCKET="${RAW_SNAPSHOTS_BUCKET:-raw-snapshots}"

# Wait for MinIO to be ready
echo "init-bucket.sh: waiting for MinIO at ${MINIO_ENDPOINT}..."
for i in $(seq 1 30); do
	if mc alias set local "$MINIO_ENDPOINT" "$MINIO_ROOT_USER" "$MINIO_ROOT_PASSWORD" >/dev/null 2>&1; then
		break
	fi
	echo "  attempt ${i}/30 — MinIO not ready yet..."
	sleep 2
done

# Create bucket (idempotent)
echo "init-bucket.sh: creating bucket '${BUCKET}' (if not exists)..."
mc mb "local/${BUCKET}" --ignore-existing

# Set bucket to private — no public access. Fail closed on error.
echo "init-bucket.sh: setting bucket policy to private..."
mc anonymous set none "local/${BUCKET}"

echo "init-bucket.sh: done. '${BUCKET}' is private and ready for immutable raw snapshots."
