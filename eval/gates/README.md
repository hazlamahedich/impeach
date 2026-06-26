# Gate Artifact Store

> **Authority:** SC-7, AC-F1-10.
> A content-addressed, append-only directory hierarchy that stores every
> gate execution decision and its metrics so any past run can be reproduced
> bit-for-bit.

## Layout

```
eval/gates/
└── <runId>/                       ← sha256:<64-hex> of the composite key
    └── decision.json              ← the decision envelope (schema below)
```

The sibling `eval/corpus/<corpusHash>/manifest.json` (produced by
`iip-eval freeze`) records the per-file SHA-256 of the golden corpus the
gate ran against. A gate run references its corpus by `corpusHash`, so the
`(runId, corpusHash)` pair is fully reproducible from the store alone.

## Composite key

`runId = sha256( corpusHash | commit | modelDigest | harnessSha )`

| Field          | Source                                           |
| -------------- | ------------------------------------------------ |
| `corpusHash`   | `iip-eval freeze` — `sha256:<64-hex>`            |
| `commit`       | Git SHA the gate ran against                     |
| `modelDigest`  | `sha256:<64-hex>` of the model + prompt bundle   |
| `harnessSha`   | `sha256:<64-hex>` of the eval harness source     |

Length-prefixed canonicalisation (`len:value`) prevents prefix collisions
between fields. Re-recording under the same `runId` supersedes the prior
`decision.json` in place — the inputs are immutable, so the lookup id is
stable; only the decision/metrics payload is mutable for replay.

## `decision.json` envelope

```json
{
  "schemaVersion": "1.0.0",
  "corpusHash": "sha256:<64-hex>",
  "commit": "<git-sha>",
  "timestamp": "2026-06-26T19:25:22.000Z",
  "decision": "pass",
  "metrics": {
    "faithfulness": 0.98,
    "citation_fidelity": 1.0
  }
}
```

- `schemaVersion` — pinned; both TS and Python sides assert equality.
- `decision` — closed two-element union: `"pass"` or `"fail"`. No third state.
- `metrics` — non-empty record of metric name → score. Real metric
  semantics arrive in Epic 4+; the v1 harness emits `{ "echo": 1.0 }` for
  the smoke suite.
- `timestamp` — ISO-8601 UTC; display-only, not an ordering key (the
  composite key is the canonical id).

## Reproduction

```sh
iip-eval reproduce <runId>
```

Reads `eval/gates/<runId>/decision.json` and re-emits the decision. Errors
are typed:

| `kind`              | Cause                                         |
| ------------------- | --------------------------------------------- |
| `MALFORMED_RUN_ID`  | Not a `sha256:<64-hex>`                       |
| `UNKNOWN_RUN`       | No `decision.json` at the resolved path       |
| `CORRUPT_DECISION`  | File present but missing required fields      |

## Append-only semantics

The store is append-only **by run**: every distinct composite key gets its
own directory and never references another run's directory in a mutable
way. Replays under the same `runId` overwrite that run's `decision.json`
in place — this is "supersede, never overwrite across runs": the inputs
hash is the immovable lookup id, so cross-run tampering would change
`runId` and create a new directory, not corrupt an existing one.

A future Epic may add a predecessor link (`previous: <runId>`) inside the
envelope to make the chain explicit; for v1 the per-hash directory
hierarchy is the canonical structure.
