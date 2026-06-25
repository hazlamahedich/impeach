"""Polyglot eval CLI entrypoint (ADR-014, AC #6, #7, #8).

Protocol (JSON-lines over stdin/stdout):
  * Input:  one JSON object on stdin  → parsed as EvalInput.
  * Output: one JSON object on stdout → serialised EvalResult.
  * Errors: serialised as {"error": true, "code": "...", "message": "..."}
    on stdout — NEVER raw tracebacks. stderr is for logging only.

The subprocess is stateless and isolated: one invocation per call, no
daemon, no pool, no filesystem writes outside /tmp (AC #9).

@rules SC-1, AC-6, AC-7, AC-8
@adr ADR-014
"""

from __future__ import annotations

import json
import sys
import traceback
from typing import Any, cast

from pydantic import ValidationError

from eval.models import EvalInput, EvalResult
from eval.runner import run_suite

EVAL_SCHEMA_VERSION = "1.0.0"

_ERROR_CODES: dict[str, str] = {
    "SCHEMA_VERSION_MISMATCH": "schemaVersion does not match the expected protocol version",
    "VALIDATION_ERROR": "input failed schema validation",
    "INTERNAL_ERROR": "unexpected error during evaluation",
}


def _emit_error(code: str, message: str) -> None:
    """Write a single error-envelope JSON line to stdout (AC #8)."""
    payload = {"error": True, "code": code, "message": message}
    sys.stdout.write(json.dumps(payload) + "\n")
    sys.stdout.flush()


def _emit_result(result: EvalResult) -> None:
    """Write a single EvalResult JSON line to stdout."""
    sys.stdout.write(result.model_dump_json() + "\n")
    sys.stdout.flush()


def _read_input() -> dict[str, Any]:
    """Read one JSON object from stdin."""
    line = sys.stdin.readline()
    if not line:
        return {}
    parsed: object = json.loads(line)
    if not isinstance(parsed, dict):
        raise ValueError("stdin JSON must be a single object")
    return cast(dict[str, Any], parsed)


def main() -> int:
    """Entry point for ``python -m eval``."""
    try:
        raw = _read_input()
    except json.JSONDecodeError as exc:
        _emit_error("VALIDATION_ERROR", f"stdin was not valid JSON: {exc}")
        return 0

    # Schema version assertion (AC #7) — checked before full validation so a
    # version mismatch is a precise error, not a generic validation failure.
    received_version = raw.get("schemaVersion")
    if received_version != EVAL_SCHEMA_VERSION:
        _emit_error(
            "SCHEMA_VERSION_MISMATCH",
            f"expected schemaVersion={EVAL_SCHEMA_VERSION!r}, got {received_version!r}",
        )
        return 0

    try:
        spec = EvalInput.model_validate(raw)
    except ValidationError as exc:
        _emit_error("VALIDATION_ERROR", str(exc))
        return 0

    try:
        result = run_suite(spec)
    except Exception as exc:  # noqa: BLE001 — subprocess boundary; all errors wrapped
        # Raw tracebacks NEVER reach stdout (AC #8). stderr is for logs only.
        sys.stderr.write(traceback.format_exc())
        _emit_error("INTERNAL_ERROR", str(exc))
        return 0

    _emit_result(result)
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
