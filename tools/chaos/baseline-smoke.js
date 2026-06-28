/**
 * Perf Baseline Smoke — 50 RPS / 30s against compose stack /healthz
 *
 * @rules TD5 (Epic 2 Prep Sprint)
 * @source epic-2-prep-sprint-2026-06-28.md
 *
 * Purpose: Establish a perf baseline reference point for the compose stack
 * before Epic 2 Story 2.9 (unified chaos suite at 500 RPS). This is NOT the
 * chaos suite — just a "where are we today" measurement.
 *
 * Prerequisites:
 *   - Compose stack running: docker compose -f infra/docker-compose.yml up -d --wait
 *   - k6 installed: brew install k6 (or https://k6.io/docs/getting-started/installation/)
 *
 * Usage:
 *   k6 run tools/chaos/baseline-smoke.js
 *
 * Output: p50, p95, p99 latency + error rate. Record in docs/ci/perf-baseline.md
 */

import http from 'k6/http';
import { check, sleep } from 'k6';
import { Rate, Trend } from 'k6/metrics';

const BASE_URL = __ENV.BASE_URL || 'http://localhost:8080';

const failRate = new Rate('failed_requests');
const latency = new Trend('healthz_latency', true);

export const options = {
  scenarios: {
    baseline: {
      executor: 'constant-arrival-rate',
      rate: 50,
      timeUnit: '1s',
      duration: '30s',
      preAllocatedVUs: 10,
      maxVUs: 50,
    },
  },
  thresholds: {
    failed_requests: ['rate<0.01'],
    http_req_duration: ['p(95)<500'],
  },
};

export default function () {
  const res = http.get(`${BASE_URL}/healthz`);

  const ok = check(res, {
    'status is 200': (r) => r.status === 200,
  });

  failRate.add(!ok);
  latency.add(res.timings.duration);

  sleep(0.02);
}
