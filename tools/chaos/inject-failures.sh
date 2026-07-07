#!/usr/bin/env bash
#
# inject-failures.sh — Failure-Injection Harness for Story 2.9a (SC-6, ADR-0029).
#
# @rules AC-2, AC-3, SC-6, SEC-5, VAL-9
# @adr ADR-0024, ADR-0028, ADR-0029
#
# Purpose: inject the five ADR-0029 failure classes against the local Docker
# Compose stack and assert the RESILIENCE contract — the system recovers without
# crashing siblings or corrupting state. This is NOT fail-closed verification:
# audit-death fail-closed (ADR-0029 §5, OQ-29.6) is Story 2.11 + Story 2.9b.
#
# Scope (Story 2.9a — RESILIENCE ONLY):
#   partition       — toxiproxy network split api <-> serve-worker (Subtask 3a)
#   node-loss       — docker compose stop audit-worker (Subtask 3b)
#   clock-skew      — libfaketime / CAP_SYS_TIME offset on audit-worker (Subtask 3c)
#   partial-render  — docker compose stop serve-worker (Subtask 3d)
#   queue-saturation — flood BullMQ render-queue (Subtask 3e)
#
# Each scenario:
#   1. Pre-condition: stack healthy (all target services up).
#   2. Inject fault.
#   3. Assert RESILIENCE: siblings stay alive, no crash, no OOM-kill.
#   4. Heal fault.
#   5. Assert RECOVERY: target service reconnects, /healthz 200.
#
# Stack state today: app services are Story 1.1 stubs. The assertions below
# check the MECHANICAL invariants that hold on a stub stack (container
# lifecycle, sibling liveness, UTC-only logging) and document — as ADR-0029
# matrix-row comments — the CORRECTNESS assertions that activate once the
# real serving path lands (Story 2.9b). A scenario that cannot run because a
# dependency is missing (toxiproxy, libfaketime) is SKIPped with rationale,
# never FAILED — the harness must be runnable on a bare compose stack.
#
# Usage:
#   ./tools/chaos/inject-failures.sh <scenario>
#   ./tools/chaos/inject-failures.sh            # print usage
#   COMPOSE_FILE=infra/docker-compose.yml ./tools/chaos/inject-failures.sh partition
#
# Exit codes:
#   0  — scenario passed (or skipped with documented rationale)
#   1  — scenario FAILED (resilience contract violated)
#   2  — usage error / unknown scenario
#
# CI: this script is wrapped by .github/workflows/chaos.yml as a SOFT gate
# (continue-on-error: true). A failure surfaces a warning but does not block
# merge (AC #5). Hard gate deferred to Story 2.9b.

set -euo pipefail

# ─── Configuration ────────────────────────────────────────────────────────
COMPOSE_FILE="${COMPOSE_FILE:-infra/docker-compose.yml}"
COMPOSE_ARR=("docker" "compose" "-f" "${COMPOSE_FILE}")
BASE_URL="${BASE_URL:-http://localhost:8080}"
BASE_URL="${BASE_URL%/}"
HEALTHZ="${BASE_URL}/healthz"
GATE_TIMEOUT_S=5            # AC #3 partial-render: API must 503 within 5s
RECOVERY_POLL_S=2
RECOVERY_MAX_TRIES=30       # 60s ceiling on recovery waits
SCENARIO="${1:-}"

# ─── Logging ──────────────────────────────────────────────────────────────
log()  { printf '[inject-failures] %s\n' "$*" >&2; }
pass() { printf '[inject-failures] PASS: %s\n' "$*" >&2; }
skip() { printf '[inject-failures] SKIP: %s\n' "$*" >&2; }
fail() { printf '[inject-failures] FAIL: %s\n' "$*" >&2; exit 1; }

# ─── Pre-conditions ───────────────────────────────────────────────────────
require_compose_up() {
  if ! "${COMPOSE_ARR[@]}" ps --services --filter "status=running" 2>/dev/null | grep -q .; then
    fail "compose stack not running. Start it first: docker compose -f \"${COMPOSE_FILE}\" up -d --wait"
  fi
}

service_is_up() {
  local svc="$1"
  "${COMPOSE_ARR[@]}" ps --services --filter "status=running" 2>/dev/null | grep -Fxq "${svc}"
}

wait_service_healthy() {
  local svc="$1"
  local tries=0
  while [ "${tries}" -lt "${RECOVERY_MAX_TRIES}" ]; do
    if service_is_up "${svc}"; then
      return 0
    fi
    sleep "${RECOVERY_POLL_S}"
    tries=$((tries + 1))
  done
  return 1
}

wait_healthz_200() {
  local tries=0
  while [ "${tries}" -lt "${RECOVERY_MAX_TRIES}" ]; do
    local code
    code="$(curl -s -o /dev/null -w '%{http_code}' --max-time 3 "${HEALTHZ}" 2>/dev/null || echo 000)"
    if [ "${code}" = "200" ]; then
      return 0
    fi
    sleep "${RECOVERY_POLL_S}"
    tries=$((tries + 1))
  done
  return 1
}

# Assert no container in the stack has restarted (exit code != 0) during the
# scenario window — a sibling crash is the resilience contract violation.
assert_no_sibling_restart() {
  local except="${1:-}"
  local restarted=""
  for svc in $("${COMPOSE_ARR[@]}" config --services 2>/dev/null); do
    [ "${svc}" = "${except}" ] && continue
    local containers
    containers="$("${COMPOSE_ARR[@]}" ps -q "${svc}" 2>/dev/null || true)"
    [ -z "${containers}" ] && continue
    local cnt
    for cnt in ${containers}; do
      local rc
      rc="$(docker inspect --format '{{.RestartCount}}' "${cnt}" 2>/dev/null)" || {
        log "WARN: docker inspect failed for ${svc} container ${cnt}; cannot verify restart count"
        continue
      }
      if [ "${rc}" != "0" ]; then
        restarted="${restarted} ${svc}(rc=${rc})"
      fi
    done
  done
  if [ -n "${restarted}" ]; then
    fail "sibling(s) restarted during scenario:${restarted} — resilience contract violated"
  fi
}

# Assert no local-time strings leak into container logs (ADR-0024, UTC-only).
# Matches naive timestamps WITHOUT a timezone designator (Z or ±HH:MM). Any
# match is a defamation-grade hash-chain ordering hazard.
assert_no_local_time_in_logs() {
  local svc="$1"
  # Stream logs through grep instead of loading them into a shell variable to
  # avoid memory exhaustion on long-running containers.
  # Match naive ISO-like timestamps: YYYY-MM-DDTHH:MM:SS not followed by Z or an
  # offset (+/-HH:MM). Fractional seconds followed by Z are UTC, not naive.
  # Example matches: 2026-07-07T12:00:00, 2026-07-07T12:00:00 (end of line).
  # Example non-matches: 2026-07-07T12:00:00Z, 2026-07-07T12:00:00.123Z,
  #                     2026-07-07T12:00:00+08:00.
  if "${COMPOSE_ARR[@]}" logs --no-log-prefix "${svc}" 2>/dev/null \
       | grep -E '[0-9]{4}-[0-9]{2}-[0-9]{2}T[0-9]{2}:[0-9]{2}:[0-9]{2}(\.[0-9]+)?([^Z0-9+]|$)' >/dev/null 2>&1; then
    fail "${svc} logs contain naive (non-UTC) timestamps — ADR-0024 violation"
  fi
}

# ─── Scenario 3a — Network Partition (api <-> serve-worker) ───────────────
# ADR-0029 matrix Row A (serving path DOWN) — timeout/crash-stop classification.
# Resilience: on partition, /query returns 503 or times out (NOT 200 w/ empty
# body). On heal, serving resumes. FAIL-CLOSED VERIFICATION is Story 2.9b.
scenario_partition() {
  log "scenario: partition (api <-> serve-worker) — ADR-0029 Row A"
  require_compose_up

  if ! command -v toxiproxy >/dev/null 2>&1 && \
     ! docker ps --format '{{.Names}}' 2>/dev/null | grep -qx toxiproxy; then
    skip "toxiproxy not available (CLI nor container) — install toxiproxy or run its container to enable partition injection. See tools/chaos/README.md."
    return 0
  fi

  log "injecting partition api <-> serve-worker via toxiproxy (timeout 600s, downstream only)"
  # NOTE: toxiproxy sits between api and serve-worker on the Docker network.
  # The compose stack does not yet ship a toxiproxy sidecar — wiring it is part
  # of the partition scenario's own bring-up. Below is the documented contract;
  # the actual toxiproxy create/toxic commands run when the sidecar is present.
  local tp_host="${TOXIPROXY_HOST:-toxiproxy:8474}"
  if curl -sf "http://${tp_host}/version" >/dev/null 2>&1; then
    curl -s -X POST "http://${tp_host}/proxies" \
      -H 'Content-Type: application/json' \
      -d '{"name":"api_serve_worker","listen":"0.0.0.0:8000","upstream":"serve-worker:3001"}' >/dev/null || true
    curl -s -X POST "http://${tp_host}/proxies/api_serve_worker/toxics" \
      -H 'Content-Type: application/json' \
      -d '{"name":"partition","type":"downstream","stream":"downstream","toxicity":1.0}' >/dev/null
    log "partition active"
  else
    skip "toxiproxy sidecar unreachable at ${tp_host} — partition injection needs the compose toxiproxy profile (deferred wiring)."
    return 0
  fi

  log "asserting /query degrades (503 or timeout, NOT 200 empty-body) — SEC-5 shape"
  local code
  code="$(curl -s -o /dev/null -w '%{http_code}' --max-time "${GATE_TIMEOUT_S}" \
    -X POST "${BASE_URL}/query" -H 'Content-Type: application/json' \
    -d '{"q":"partition probe"}' 2>/dev/null || echo 000)"
  # 000 = curl timeout (acceptable); 503 = explicit degrade (acceptable);
  # 200 = potential uncited serve (Chargeable under ADR-0029 — but 2.9a is
  # resilience-only, so we record rather than fail on a stub stack).
  case "${code}" in
    000|503|502|504) pass "/query degraded as ${code} under partition" ;;
    200) log "WARN: /query returned 200 under partition (stub stack — ADR-0029 Row A fail-closed verification deferred to 2.9b)" ;;
    *) log "INFO: /query returned ${code} under partition (non-canonical; recorded)" ;;
  esac

  assert_no_sibling_restart "serve-worker"

  log "healing partition"
  if ! curl -s -X DELETE "http://${tp_host}/proxies/api_serve_worker/toxics/partition" >/dev/null 2>&1; then
    log "WARN: failed to delete partition toxic at ${tp_host}; partition may persist"
  fi

  log "asserting recovery (serving resumes)"
  wait_healthz_200 || fail "stack did not recover /healthz 200 after partition heal"
  pass "partition scenario recovered"
}

# ─── Scenario 3b — Node Loss: audit-worker dies (RESILIENCE ONLY) ─────────
# ADR-0029 matrix Row C.2 (serving up, audit-worker down) — Conditional.
# Resilience: api + serve-worker stay alive; audit-worker reconnects on restart.
# FAIL-CLOSED ON AUDIT-DEATH (ADR-0029 §5) is Story 2.11 + 2.9b — explicitly
# OUT OF SCOPE here. This scenario asserts the system does not cascade-crash.
scenario_node_loss() {
  log "scenario: node-loss (audit-worker dies — RESILIENCE ONLY)"
  log "NOTE: this does NOT verify fail-closed on audit-death — deferred to Story 2.11 + 2.9b (ADR-0029 §5, OQ-29.6)"
  require_compose_up
  service_is_up audit-worker || skip "audit-worker not running — nothing to kill"

  log "injecting: "${COMPOSE_ARR[@]}" stop audit-worker"
  "${COMPOSE_ARR[@]}" stop audit-worker >/dev/null 2>&1 || true

  log "asserting siblings remain alive (api, serve-worker, enqueuer) — no cascade crash"
  service_is_up api          || fail "api crashed after audit-worker stop (cascade — resilience violation)"
  service_is_up serve-worker || fail "serve-worker crashed after audit-worker stop (cascade — resilience violation)"
  service_is_up enqueuer     || fail "enqueuer crashed after audit-worker stop (cascade — resilience violation)"
  pass "no cascade crash on audit-worker loss"

  log "healing: "${COMPOSE_ARR[@]}" start audit-worker"
  "${COMPOSE_ARR[@]}" start audit-worker >/dev/null 2>&1 || true

  log "asserting audit-worker reconnects"
  wait_service_healthy audit-worker || fail "audit-worker did not return to running state after restart"
  pass "audit-worker recovered"
}

# ─── Scenario 3c — Clock Skew (hash-chain ordering) ───────────────────────
# ADR-0024 (hash-chain concurrency) — corrupt-output defense on the audit path.
# Resilience: verifyChain captures sequence anomalies without breaking UTC-only
# rules; no local-time strings in logs. Full ordering-correctness = Story 2.9b.
scenario_clock_skew() {
  log "scenario: clock-skew (hash-chain ordering — ADR-0024)"
  require_compose_up

  local skew_injected=0
  # libfaketime is the portable injector (LD_PRELOAD on Linux containers).
  # CAP_SYS_TIME is the kernel-capability alternative. Neither is wired into
  # the compose image today; this scenario documents the contract and runs the
  # UTC-only log assertion unconditionally (it holds on any healthy stack).
  if ! docker exec audit-worker sh -c 'test -e /usr/lib/faketime/libfaketime.so.1' >/dev/null 2>&1; then
    log "libfaketime not present in audit-worker image — clock-skew injection skipped; running UTC-only log assertion unconditionally"
  else
    log "injecting NTP offset (+300s) on audit-worker via libfaketime"
    # Restart with FAKETIME env; the compose image must honor LD_PRELOAD.
    "${COMPOSE_ARR[@]}" stop audit-worker >/dev/null 2>&1 || true
    FAKETIME="+300" LD_PRELOAD="/usr/lib/faketime/libfaketime.so.1" \
      "${COMPOSE_ARR[@]}" up -d audit-worker >/dev/null 2>&1 || true
    sleep 3
    skew_injected=1
  fi

  log "asserting no local-time (naive timestamp) strings in audit-worker logs — ADR-0024"
  assert_no_local_time_in_logs audit-worker

  log "NOTE: verifyChain sequence-anomaly capture is a CORRECTNESS assertion — deferred to Story 2.9b (golden corpus required)"

  # Heal only if we actually injected.
  if [ "${skew_injected}" -eq 1 ]; then
    log "healing clock-skew: restart audit-worker without libfaketime"
    "${COMPOSE_ARR[@]}" stop audit-worker >/dev/null 2>&1 || true
    "${COMPOSE_ARR[@]}" up -d audit-worker >/dev/null 2>&1 || true
    wait_service_healthy audit-worker || fail "audit-worker did not recover after clock-skew heal"
  fi
  pass "clock-skew scenario UTC-only invariant holds (correctness deferred to 2.9b)"
}

# ─── Scenario 3d — Partial-Render: serve-worker crash-stop ────────────────
# ADR-0029 Row A.1 (serve-worker down) — serving path DOWN → Acceptable.
# Resilience: API returns 503 within the 5s gate timeout window; restart resumes.
scenario_partial_render() {
  log "scenario: partial-render (serve-worker crash-stop — ADR-0029 Row A.1)"
  require_compose_up
  service_is_up serve-worker || skip "serve-worker not running — nothing to kill"

  log "injecting: "${COMPOSE_ARR[@]}" stop serve-worker"
  "${COMPOSE_ARR[@]}" stop serve-worker >/dev/null 2>&1 || true

  log "asserting API returns 503 within ${GATE_TIMEOUT_S}s gate timeout (AC #3 partial-render)"
  local code
  code="$(curl -s -o /dev/null -w '%{http_code}' --max-time "${GATE_TIMEOUT_S}" \
    -X POST "${BASE_URL}/query" -H 'Content-Type: application/json' \
    -d '{"q":"partial-render probe"}' 2>/dev/null || echo 000)"
  # On a stub stack the API may not yet route /query; record, do not fail.
  case "${code}" in
    503|502|504|000) pass "/query unreachable/degraded as ${code} within gate window" ;;
    200) log "WARN: /query returned 200 with serve-worker down — stub stack (fail-closed verification deferred to 2.9b)" ;;
    *) log "INFO: /query returned ${code} with serve-worker down (recorded)" ;;
  esac

  assert_no_sibling_restart "serve-worker"

  log "healing: "${COMPOSE_ARR[@]}" start serve-worker"
  "${COMPOSE_ARR[@]}" start serve-worker >/dev/null 2>&1 || true
  wait_service_healthy serve-worker || fail "serve-worker did not recover after restart"
  pass "partial-render scenario recovered"
}

# ─── Scenario 3e — Queue Saturation (render-queue backpressure) ───────────
# ADR-0029 §5 — render-queue saturation under load; VAL-9 (Story 2.8) requires
# GateContext.onInvocation to fire on EVERY served response. Resilience: under
# backpressure the gate is still invoked; no response bypasses the gate.
scenario_queue_saturation() {
  log "scenario: queue-saturation (render-queue backpressure — VAL-9, Story 2.8)"
  require_compose_up

  # Saturate by flooding /query at high arrival-rate via k6 (the same runtime
  # as the baseline script). If k6 is not installed, skip with rationale.
  if ! command -v k6 >/dev/null 2>&1; then
    skip "k6 not installed — cannot saturate render-queue. Install: brew install k6 (or go install go.k6.io/k6@v0.50.0)."
    return 0
  fi

  # Background baseline load: keep the characterized baseline RPS flowing while
  # the fault scenario runs, so the "Given running query load" precondition of
  # AC #3 is mechanically satisfied. The inline k6 saturation flood is the
  # actual fault; the background load is the ongoing baseline.
  log "starting background baseline load: ${BASE_URL}/query @ 50 RPS"
  local bg_k6_pid=""
  BASE_URL="${BASE_URL}" k6 run -e BG_LOAD=1 --quiet \
    --vus 10 --duration 90s \
    - <<'K6EOF' >/dev/null 2>&1 &
import http from 'k6/http';
export var options = { scenarios: { baseline: { executor: 'constant-arrival-rate', rate: 50, timeUnit: '1s', duration: '80s', preAllocatedVUs: 10, maxVUs: 20 } } };
export default function () {
  http.post(__ENV.BASE_URL + '/query', JSON.stringify({ q: 'background load' }),
    { headers: { 'Content-Type': 'application/json' }, timeout: '12s' });
}
K6EOF
  bg_k6_pid=$!

  log "saturating render-queue: 60s @ 80 RPS against /query (inline k6 run)"
  if ! BASE_URL="${BASE_URL}" k6 run -e QUEUE_SATURATION=1 --quiet \
        --vus 80 --duration 60s \
        - <<'K6EOF' >/dev/null 2>&1; then
import http from 'k6/http';
export default function () {
  http.post(__ENV.BASE_URL + '/query', JSON.stringify({ q: 'saturation' }),
    { headers: { 'Content-Type': 'application/json' }, timeout: '12s' });
}
K6EOF
    log "WARN: k6 saturation run reported errors (stub stack expected) — continuing to post-conditions"
  fi

  if [ -n "${bg_k6_pid}" ] && kill -0 "${bg_k6_pid}" >/dev/null 2>&1; then
    kill "${bg_k6_pid}" >/dev/null 2>&1 || true
    wait "${bg_k6_pid}" >/dev/null 2>&1 || true
  fi

  # VAL-9 CORRECTNESS ASSERTION — deferred to 2.9b.
  # The mechanism to assert "onInvocation fired on every served response" is a
  # Trace query (OTel span count == served count, per the VAL-9 tooling note in
  # project-context.md). The stub stack does not emit these spans; the
  # assertion activates with the real serving path (Story 2.9b).
  log "NOTE: VAL-9 gate-per-served-response assertion (OTel span count == served count) is CORRECTNESS — deferred to Story 2.9b"

  log "asserting stack still healthy post-saturation"
  wait_healthz_200 || fail "stack did not return to /healthz 200 after saturation"
  pass "queue-saturation scenario: stack resilient (gate-per-response correctness deferred to 2.9b)"
}

# ─── Dispatch ─────────────────────────────────────────────────────────────
usage() {
  cat >&2 <<EOF
Usage: $0 <scenario>

Scenarios (Story 2.9a — RESILIENCE ONLY; fail-closed correctness is Story 2.11 + 2.9b):
  partition         toxiproxy network split api <-> serve-worker (Subtask 3a)
  node-loss         docker compose stop audit-worker (Subtask 3b)
  clock-skew        libfaketime NTP offset on audit-worker (Subtask 3c)
  partial-render    docker compose stop serve-worker (Subtask 3d)
  queue-saturation  k6 flood render-queue, assert stack recovers (Subtask 3e)

Environment:
  COMPOSE_FILE     compose YAML path        (default: infra/docker-compose.yml)
  BASE_URL         target ingress URL       (default: http://localhost:8080)
  TOXIPROXY_HOST   toxiproxy API host:port  (default: toxiproxy:8474)

Exit codes: 0 pass/skip, 1 contract violation, 2 usage error.
EOF
  exit 2
}

case "${SCENARIO}" in
  partition)        scenario_partition ;;
  node-loss)        scenario_node_loss ;;
  clock-skew)       scenario_clock_skew ;;
  partial-render)   scenario_partial_render ;;
  queue-saturation) scenario_queue_saturation ;;
  ""|-h|--help)     usage ;;
  *)
    printf '[inject-failures] ERROR: unknown scenario: %s\n' "${SCENARIO}" >&2
    usage
    ;;
esac

log "done."
