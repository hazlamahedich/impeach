"""Python-side round-trip fidelity test (AC #11).

Exercises the Eval seam: the generated Pydantic models must parse the same
payloads the TS Zod schemas accept, and serialise back to a shape Zod will
re-accept. The cross-language assertion lives in the TS integration test
(``tests/integration/polyglot-eval-roundtrip.test.ts``); this module
validates the Python side in isolation.
"""

from __future__ import annotations

import json

import pytest
from pydantic import ValidationError

from eval.models import EvalInput, EvalResult


class TestEvalInputParse:
    """EvalInput schema acceptance (mirrors the TS Zod schema)."""

    def test_accepts_valid_input(self) -> None:
        spec = EvalInput.model_validate(
            {
                "schemaVersion": "1.0.0",
                "suite": "smoke",
                "fixtures": [{"id": "f1", "payload": {"q": "a"}}],
            }
        )
        assert spec.schemaVersion == "1.0.0"
        assert spec.suite == "smoke"
        assert len(spec.fixtures) == 1

    def test_rejects_schema_version_mismatch(self) -> None:
        with pytest.raises(ValidationError):
            EvalInput.model_validate(
                {"schemaVersion": "2.0.0", "suite": "smoke", "fixtures": []}
            )

    def test_rejects_unknown_field(self) -> None:
        with pytest.raises(ValidationError):
            EvalInput.model_validate(
                {
                    "schemaVersion": "1.0.0",
                    "suite": "smoke",
                    "fixtures": [],
                    "rogue": "nope",
                }
            )


class TestEvalResultRoundTrip:
    """EvalResult serialise → parse fidelity (AC #11)."""

    def test_result_serialises_to_json(self) -> None:
        result = EvalResult(
            schemaVersion="1.0.0",
            suite="smoke",
            metrics=[
                {"fixture_id": "f1", "metric": "echo", "score": 0.875},
            ],
        )
        payload = json.loads(result.model_dump_json())
        assert payload["schemaVersion"] == "1.0.0"
        assert payload["metrics"][0]["score"] == 0.875

    def test_result_round_trips_through_json(self) -> None:
        original = EvalResult(
            schemaVersion="1.0.0",
            suite="faithfulness",
            metrics=[{"fixture_id": "f1", "metric": "echo", "score": 1.0}],
        )
        wire = original.model_dump_json()
        reparsed = EvalResult.model_validate_json(wire)
        assert reparsed == original

    def test_rejects_score_out_of_range(self) -> None:
        with pytest.raises(ValidationError):
            EvalResult.model_validate(
                {
                    "schemaVersion": "1.0.0",
                    "suite": "smoke",
                    "metrics": [{"fixture_id": "f1", "metric": "m", "score": 1.5}],
                }
            )
