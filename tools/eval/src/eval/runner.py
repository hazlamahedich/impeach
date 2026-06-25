"""Eval suite runner — stub (Story 1.5 seam; real metrics in Epic 4+).

The seam itself is verified by a deterministic echo suite: every fixture's
payload (if numeric in [0,1]) is echoed back as a metric score. This lets
the round-trip fidelity test exercise the full Zod→Pydantic→Zod path
without depending on unimplemented metric algorithms.

@rules SC-1
@adr ADR-014
"""

from __future__ import annotations

from eval.models import EvalInput, EvalResult, Metric

EVAL_SCHEMA_VERSION = "1.0.0"


def run_suite(spec: EvalInput) -> EvalResult:
    """Run the eval suite against the provided fixtures.

    Story 1.5 stub: echoes a deterministic ``echo`` metric per fixture so
    the seam's round-trip is exercised end-to-end. Real metric logic
    (faithfulness, citation fidelity, etc.) arrives in Epic 4+.
    """
    metrics: list[Metric] = []
    for fixture in spec.fixtures:
        payload = fixture.payload
        score = _coerce_score(payload)
        metrics.append(
            Metric(
                fixture_id=fixture.id,
                metric="echo",
                score=score,
            )
        )

    return EvalResult(
        schemaVersion=EVAL_SCHEMA_VERSION,
        suite=spec.suite,
        metrics=metrics,
    )


def _coerce_score(payload: object) -> float:
    """Best-effort coerce a fixture payload into a [0, 1] score."""
    if isinstance(payload, (int, float)) and 0.0 <= payload <= 1.0:
        return round(float(payload), 3)
    return 0.0
