/**
 * Chaos Suite — Baseline Load Characterization (Story 2.9a, SC-6, AC-2).
 *
 * @rules AC-2, SC-6, SEC-5, VAL-9, STR-12
 * @adr ADR-0028, ADR-0029
 *
 * Purpose: establish the serving-path saturation point against the local Docker
 * Compose stack via a phased ramp (10 -> 50 -> 100 RPS, 30s per phase). Records
 * p50/p95/p99 latency, error rates, and the structural citation-shape invariant
 * (every 200 /query response carries a `citations` array). This is
 * CHARACTERIZATION ONLY (soft gate) — semantic citation correctness and full
 * 500 RPS verification are deferred to Story 2.9b.
 *
 * k6 RUNTIME (Goja / ES2015 — load-bearing constraints, see tools/chaos/README.md):
 *   - NO async/await in the default function (k6 VUs block on http.*).
 *   - NO require() / Node APIs / Proxy / Reflect.
 *   - NO external schema libs (Zod, ajv — incompatible with Goja).
 *   - Validation = check() + manual JSON.parse() + property traversal.
 *   - Custom metrics = Trend / Counter / Rate from 'k6/metrics'.
 *
 * Prerequisites:
 *   - Compose stack up: docker compose -f infra/docker-compose.yml up -d --wait
 *   - k6 v0.50.x installed (brew install k6 / go install go.k6.io/k6@v0.50.0).
 *
 * Usage:
 *   k6 run tools/chaos/chaos-suite.js
 *   BASE_URL=http://localhost:3000 k6 run tools/chaos/chaos-suite.js
 *
 * Output: per-phase latency distributions + error rate + structural citation
 * invariant pass-rate. Record the saturation point in docs/ci/perf-baseline.md.
 */

import http from 'k6/http';
import { check, sleep } from 'k6';
import { Counter, Rate, Trend } from 'k6/metrics';

// ─── Configuration ────────────────────────────────────────────────────────
// BASE_URL defaults to Caddy on :8080 (compose stack). Override for direct
// app ingress (e.g. BASE_URL=http://localhost:3000 for the web/API container).
function normalizeBaseUrl(raw) {
  if (!raw || typeof raw !== 'string') return 'http://localhost:8080';
  return raw.replace(/\/+$/, '');
}

var BASE_URL = normalizeBaseUrl(__ENV.BASE_URL);
var PHASE_DURATION = __ENV.PHASE_DURATION || '30s';
// 10 -> 50 -> 100 RPS ramp (AC #2). 2x VU headroom per phase so arrival-rate
// executors never starve (k6 will error if preAllocatedVUs < rate).
var RAMP_STAGES = [
  { target: 10, duration: PHASE_DURATION },
  { target: 50, duration: PHASE_DURATION },
  { target: 100, duration: PHASE_DURATION },
];

// ─── Custom metrics (Trend / Counter / Rate — built-in, ADR-0029 §7) ──────
var healthzLatency = new Trend('healthz_latency', true); // ms, p50/p95/p99
var queryLatency = new Trend('query_latency', true); // ms, p50/p95/p99
var failedRequests = new Rate('failed_requests'); // 0.00-1.00
var citationFieldPresent = new Rate('citation_field_present'); // structural INV-001
var degradedServedAs503 = new Rate('degraded_served_as_503'); // SEC-5 fail-closed shape
var emptyBody200 = new Counter('empty_body_200'); // contract violation (200 w/o body)
var responsesInspected = new Counter('responses_inspected');

// ─── k6 options — ramping-arrival-rate, soft thresholds (AC #4) ───────────
// Thresholds are CHARACTERIZATION-ONLY in 2.9a: k6 reports breaches but the CI
// gate is SOFT (warns, does not block merge — AC #5). Hard gate = Story 2.9b.
// SLO targets follow ADR-0029 §7 (p99 healthz ≤ 100ms) and the render-path
// p99 ≤ 10s gate (ADR-005). failed_requests ≤ 1% per AC #2.
export var options = {
  scenarios: {
    baselineRamp: {
      executor: 'ramping-arrival-rate',
      startRate: 5,
      timeUnit: '1s',
      preAllocatedVUs: 200,
      maxVUs: 400,
      stages: RAMP_STAGES,
    },
  },
  thresholds: {
    // Soft — characterization, not gating (Story 2.9a). CI workflow wraps with
    // continue-on-error so a breach surfaces a warning, not a merge block.
    failed_requests: ['rate<0.01'],
    // NOTE: http_req_duration is intentionally NOT thresholded because it mixes
    // /healthz and /query latencies. Endpoint-specific SLOs are tracked below.
    healthz_latency: ['p(99)<100'],
    query_latency: ['p(99)<10000'],
    // Structural invariants — informational only in 2.9a. A dip here on a
    // stub stack is expected; on a real serving path it is a defamation signal.
    citation_field_present: ['rate>0.99'],
    empty_body_200: ['count<1'],
  },
};

// ─── Helpers (Goja-safe — no Node APIs) ───────────────────────────────────

/**
 * Structural citation-shape check for /query 200 responses (INV-001 / AC-2).
 * Returns true iff body parses as JSON AND carries a `citations` Array field.
 * Semantic correctness (citations match source spans) is deferred to 2.9b.
 *
 * NOTE: this is intentionally permissive about content — under the stub stack
 * a 200 may legitimately lack citations; the metric records the rate, the
 * threshold above only fires on a real serving path. The defamation-grade
 * contract is that an UNDEFINABLE shape (string body, no JSON) never reaches
 * a user as a 200 — that's the empty_body_200 counter's job.
 */
function hasCitationsArray(res) {
  if (!res.body || typeof res.body !== 'string' || res.body.length === 0) {
    return false;
  }
  try {
    var parsed = JSON.parse(res.body);
    return parsed !== null && typeof parsed === 'object' &&
      Array.isArray(parsed.citations);
  } catch (e) {
    return false;
  }
}

function isEmpty200(res) {
  if (res.status !== 200) return false;
  if (!res.body || typeof res.body !== 'string') return true;
  return res.body.trim().length === 0;
}

// ─── Default VU loop — alternating /healthz and /query (AC #2) ────────────
// Sleep keeps the per-VU request rate bounded; ramping-arrival-rate controls
// the aggregate. Two endpoints exercised per iteration so latency metrics
// separate cleanly by tag (k6 http.setResponseCallback is heavier than needed
// here — tags via params.tags do the job).
export default function () {
  // /healthz — baseline dependency-check latency (ADR-0029 §7, target p99 ≤ 100ms).
  var hz = http.get(BASE_URL + '/healthz', { tags: { endpoint: 'healthz' }, timeout: '5s' });
  var hzOk = check(hz, {
    'healthz status is 200': function (r) { return r.status === 200; },
  });
  healthzLatency.add(hz.timings.duration);
  failedRequests.add(!hzOk);
  responsesInspected.add(1);

  // /query — claim-serving path, structural citation-shape only (AC #2, AC #4).
  // POST per the future QueryAnswer contract (D10: /query returns a complete
  // QueryAnswer, no SSE in v1). Body is illustrative — the stub stack will
  // 404/503; that is expected and recorded, not a test failure.
  var qRes = http.post(
    BASE_URL + '/query',
    JSON.stringify({ q: 'baseline chaos probe' }),
    {
      headers: { 'Content-Type': 'application/json' },
      tags: { endpoint: 'query' },
      timeout: '12s', // > 10s render-path p99 gate so a real timeout is the SUT's fault
    },
  );

  queryLatency.add(qRes.timings.duration);
  responsesInspected.add(1);

  // Structural citation-shape invariant (INV-001). On a real serving path this
  // MUST be 1.00 — a 200 /query without a citations array is a defamation
  // signal (an uncited allegation may have been served). On the stub stack the
  // rate will be near 0; the metric records the gap, the threshold is advisory.
  if (qRes.status === 200) {
    citationFieldPresent.add(hasCitationsArray(qRes));
    if (isEmpty200(qRes)) {
      // SEC-5 violation shape: a 200 with empty body is the precise failure
      // mode that "no 200-with-empty-body when degraded" (AC #2) forbids.
      emptyBody200.add(1);
    }
  } else if (qRes.status === 503) {
    // Degraded-path correctness: 503 (not 200-with-empty-body). AC #2.
    degradedServedAs503.add(1);
  } else {
    // 404 / 405 / 500 on the stub stack — expected, not a contract violation
    // for 2.9a. Recorded via failed_requests implicitly (no 200 check passed).
  }

  check(qRes, {
    'query responds (not 200-empty)': function (r) { return !isEmpty200(r); },
  });

  failedRequests.add(qRes.status === 0 || qRes.status >= 500);

  // Pacing — small sleep keeps VU loops from tight-spinning on the stub stack.
  sleep(0.05);
}

// ─── Setup/teardown — compose-stack liveness precondition ─────────────────
// Fail loud and early if the stack isn't up: a chaos run against a dead stack
// produces noise indistinguishable from a real regression.
export function setup() {
  var probe = http.get(BASE_URL + '/healthz', { timeout: '5s' });
  if (probe.status !== 200) {
    throw new Error(
      'chaos-suite.js setup: ' + BASE_URL + '/healthz did not return 200 (got ' +
      probe.status + '). Start the compose stack first: ' +
      'docker compose -f infra/docker-compose.yml up -d --wait',
    );
  }
  return { baseUrl: BASE_URL, startedAt: Date.now() };
}

export function teardown(data) {
  // Sanity log — k6 surfaces this in the run summary. Informational only.
  console.log(
    'chaos-suite teardown: ran against ' + data.baseUrl +
    ' (started ' + new Date(data.startedAt).toISOString() + ')',
  );
}
