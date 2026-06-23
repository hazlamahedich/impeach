#!/bin/sh
# ollama-pull.sh — Pre-pull model to named volume so container starts with model present.
#
# @rules D15, ADR-005
#
# ADR-005 target: qwen3:14b
# Do NOT substitute qwen2.5:14b-instruct — different model (silent substitution in eval runs).
# Exit non-zero on pull failure so container fails closed.
set -eu

MODEL="${OLLAMA_MODEL:-qwen3:14b}"

# ADR-005 enforcement: default model must be qwen3:14b unless explicitly overridden.
if [ "$MODEL" != "qwen3:14b" ] && [ "${IIP_ALLOW_NON_ADR005_MODEL:-}" != "1" ]; then
	echo "ollama-pull.sh: refusing to pull non-ADR-005 model '${MODEL}'" >&2
	echo "  ADR-005 target is qwen3:14b. Set IIP_ALLOW_NON_ADR005_MODEL=1 to override." >&2
	exit 1
fi

# Verify ollama binary is reachable
if ! command -v ollama >/dev/null 2>&1; then
	echo "ollama-pull.sh: ollama binary not found in PATH" >&2
	exit 1
fi

echo "ollama-pull.sh: pulling ${MODEL}..."

# Pull the model — fail closed if pull fails
if ! ollama pull "$MODEL"; then
	echo "ollama-pull.sh: FAILED to pull ${MODEL}" >&2
	echo "  Verify network connectivity and tag spelling (ADR-005: qwen3:14b)." >&2
	exit 1
fi

echo "ollama-pull.sh: ${MODEL} pulled successfully."
