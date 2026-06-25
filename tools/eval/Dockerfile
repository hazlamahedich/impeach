# IIP polyglot eval harness container (Story 1.5, ADR-014).
#
# Security baseline (AC #12): the eval subprocess runs with no network
# access, no filesystem write access outside /tmp, a 30s CPU timeout, and
# a 512MB memory limit. The network/read-only-rootfs constraints are
# enforced here + in docker-compose (--network=none, --read-only);
# timeout/memory are enforced by the TS bridge (packages/eval/src/bridge.ts).
#
# Python pinned to 3.12.x exact (AC #10, PC-8). Do NOT use a floating tag.
FROM python:3.12-slim

# uv — installed once at build time; runtime invokes it via the project shim.
COPY --from=ghcr.io/astral-sh/uv:0.9.17 /uv /uvx /bin/

WORKDIR /app

# Install dependencies first (cache layer) then copy source.
COPY pyproject.toml uv.lock ./
RUN uv sync --frozen --no-dev --no-install-project

COPY src/ ./src/
COPY tests/ ./tests/

# Default entrypoint: `python -m eval` reads one JSON line from stdin and
# writes one JSON line to stdout (ADR-014 protocol).
ENTRYPOINT ["uv", "run", "--no-sync", "python", "-m", "eval"]
