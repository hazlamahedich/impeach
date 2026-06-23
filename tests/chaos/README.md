# Chaos Testing

> **EMPTY HULL — Foundation Action Plan P5.**
>
> Authority: SC-6 (chaos at F1), VAL-9 (gate-invocation-per-served-response).
>
> Chaos testing proves the citation-or-silence invariant holds under fault
> injection — not just in the happy path. The chaos suite lives here when
> implemented.
>
> ## Prerequisites (must exist before chaos tests)
>
> 1. **Consumer-driven contracts** (Pact) for all 6 process boundaries —
>    chaos without contracts is arson, not engineering (Murat).
> 2. **k6 0.50.x** — Go binary, NOT npm. Install via `brew install k6` or
>    `go install go.k6.io/k6@latest`.
> 3. **toxiproxy** — network fault injection (DB disconnect, Ollama timeout,
>    Redis eviction).
> 4. **Pumba** — container-level chaos on Docker Compose.
> 5. **Docker Compose stack** — Story 1.3 must be complete.
>
> ## Test Matrix
>
> | Fault | Target | Assertion | Gate |
> |-------|--------|-----------|------|
> | DB disconnect mid-query | postgres | Citation-invariant holds (silence, not uncited) | promotion |
> | Ollama timeout during extraction | ollama | Extraction aborts cleanly, no partial KG write | promotion |
> | Redis eviction (queue loss) | redis | Enqueuer replays from durable stream | nightly |
> | 500 RPS sustained | all | citations_rendered rate == 1.0 | promotion |
> | audit-worker kill mid-append | audit-worker | Hash chain unbroken on restart | promotion |
>
> ## Custom Metrics
>
> k6 custom metric `citations_rendered` is not built-in. Needs:
> ```js
> import { Counter } from 'k6/metrics';
> const citationsRendered = new Counter('citations_rendered');
> // threshold: ['rate==1.0']
> ```
