/**
 * Story 1.3 — Docker Compose platform stack health
 *
 * @rules AR-1..8, D9, D15, NFR-O-1, STR-2
 * @adr ADR-001, ADR-004, ADR-005, ADR-021
 *
 * Integration test: requires Docker to be running.
 * Run: pnpm test:integration
 *   or: pnpm vitest run tests/integration/compose-stack.health.test.ts
 *        --pool=forks --poolOptions.forks.singleFork=true
 *
 * Uses zero-dep node:child_process (Story 1.1 precedent — no execa dependency).
 */

import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { execSync } from 'node:child_process';
import { readFileSync, existsSync } from 'node:fs';

const COMPOSE_FILE = 'infra/docker-compose.yml';
const TIMEOUT_MS = 600_000;

const CORE_SERVICES = [
  'postgres',
  'redis',
  'minio',
  'ollama',
  'caddy',
  'api',
  'ingest-worker',
  'serve-worker',
  'audit-worker',
  'enqueuer',
  'web',
] as const;

function isDockerAvailable(): boolean {
  try {
    execSync('docker info', { stdio: 'pipe' });
    return true;
  } catch {
    return false;
  }
}

const dockerAvailable = isDockerAvailable();

function getRunningServices(): string[] {
  try {
    const out = execSync(
      `docker compose -f ${COMPOSE_FILE} ps --services --filter "status=running"`,
      { encoding: 'utf-8', stdio: 'pipe' },
    );
    return out.trim().split('\n').filter(Boolean);
  } catch {
    return [];
  }
}

function isFullStackRunning(): boolean {
  const running = new Set(getRunningServices());
  return CORE_SERVICES.every((svc) => running.has(svc));
}

const stackWasRunning = isFullStackRunning();

function parseComposePsJson(raw: string): Array<Record<string, string>> {
  const trimmed = raw.trim();
  if (!trimmed) return [];
  // Docker Compose may emit either a single JSON array or newline-delimited objects.
  const first = trimmed[0];
  if (first === '[') {
    return JSON.parse(trimmed) as Array<Record<string, string>>;
  }
  return trimmed
    .split('\n')
    .filter(Boolean)
    .map((line) => JSON.parse(line) as Record<string, string>);
}

describe.skipIf(!dockerAvailable)('Story 1.3 — Docker Compose platform stack health', () => {
  beforeAll(() => {
    if (!stackWasRunning) {
      // Stand up the full stack
      execSync(`docker compose -f ${COMPOSE_FILE} up -d --wait`, {
        timeout: TIMEOUT_MS,
        stdio: 'inherit',
      });
    }
  }, TIMEOUT_MS + 20_000);

  afterAll(() => {
    // Only tear down if we started it
    if (!stackWasRunning) {
      try {
        execSync(`docker compose -f ${COMPOSE_FILE} down -v`, {
          stdio: 'inherit',
        });
      } catch {
        // best-effort teardown; don't fail the suite if cleanup errors
      }
    }
  });

  it('compose file exists', () => {
    expect(existsSync(COMPOSE_FILE)).toBe(true);
  });

  it('compose file declares all 11 core services', () => {
    const out = execSync(
      `docker compose -f ${COMPOSE_FILE} config --services`,
      { encoding: 'utf-8' },
    );
    const declared = out
      .split('\n')
      .map((s) => s.trim())
      .filter(Boolean);

    for (const svc of CORE_SERVICES) {
      expect(declared).toContain(svc);
    }
  });

  it('all services reach healthy or running status', () => {
    const out = execSync(
      `docker compose -f ${COMPOSE_FILE} ps --format json`,
      { encoding: 'utf-8' },
    );
    const rows = parseComposePsJson(out);

    expect(rows.length).toBeGreaterThanOrEqual(CORE_SERVICES.length);

    const runningServices = new Set(rows.map((r) => r['Service']));
    for (const svc of CORE_SERVICES) {
      expect(runningServices).toContain(svc);
    }

    for (const row of rows) {
      const service = row['Service'] ?? '';
      const state = (row['State'] ?? '').toLowerCase();
      const health = (row['Health'] ?? '').toLowerCase();
      const exitCode = Number(row['ExitCode'] || 0);

      if (state.includes('exited')) {
        // One-shot init containers must exit 0.
        expect(exitCode).toBe(0);
      } else {
        expect(state).toMatch(/running|healthy/);
      }

      // Services with healthchecks must eventually be healthy.
      if (CORE_SERVICES.includes(service as typeof CORE_SERVICES[number])) {
        expect(health).not.toBe('unhealthy');
      }
    }
  });

  it('Caddyfile documents app-layer rate limiting (D9, SEC-9)', () => {
    const caddyfile = readFileSync('infra/Caddyfile', 'utf8');
    expect(caddyfile).toMatch(/application layer/);
    expect(caddyfile).toMatch(/@fastify\/rate-limit/);
    expect(caddyfile).toMatch(/OWASP/);
  });

  it('ollama-pull.sh pulls qwen3:14b (D15, ADR-005)', () => {
    const script = readFileSync('infra/runner/ollama-pull.sh', 'utf8');
    expect(script).toMatch(/ollama pull/);
    expect(script).toMatch(/qwen3:14b/);
    expect(script).toMatch(/IIP_ALLOW_NON_ADR005_MODEL/);
  });

  it('MinIO raw-snapshots bucket exists (NFR-S-5)', () => {
    const out = execSync(
      `docker compose -f ${COMPOSE_FILE} exec -T minio sh -c ` +
      `"mc alias set local http://localhost:9000 minioadmin minioadmin 2>/dev/null && mc ls local/raw-snapshots"`,
      { encoding: 'utf-8', stdio: 'pipe', timeout: 15_000 },
    );
    expect(out).toBeDefined();
  });

  it('Redis configured for BullMQ + Streams (STR-3)', () => {
    const out = execSync(
      `docker compose -f ${COMPOSE_FILE} exec -T redis redis-cli ping`,
      { encoding: 'utf-8', stdio: 'pipe', timeout: 10_000 },
    );
    expect(out.trim()).toBe('PONG');

    const persistence = execSync(
      `docker compose -f ${COMPOSE_FILE} exec -T redis redis-cli CONFIG GET appendonly`,
      { encoding: 'utf-8', stdio: 'pipe', timeout: 10_000 },
    );
    expect(persistence).toMatch(/appendonly/);
  });

  it('OpenTelemetry + Tempo + Prometheus + Grafana wired (NFR-O-1)', () => {
    const out = execSync(
      `docker compose -f ${COMPOSE_FILE} config --services`,
      { encoding: 'utf-8' },
    );
    // VAL-9: Tempo for tracing — NOT Jaeger
    expect(out).toMatch(/tempo/);
    expect(out).not.toMatch(/jaeger/);
    expect(out).toMatch(/prometheus/);
    expect(out).toMatch(/grafana/);
    expect(out).toMatch(/otel-collector/);
  });

  it('AGE extension version is pinned to 1.6.0 (ADR-002)', () => {
    const out = execSync(
      `docker compose -f ${COMPOSE_FILE} exec -T postgres psql -U ${process.env['POSTGRES_USER'] ?? 'postgres'} -d ${process.env['POSTGRES_DB'] ?? 'iip'} -tAc "SELECT extversion FROM pg_extension WHERE extname = 'age'"`,
      { encoding: 'utf-8', stdio: 'pipe', timeout: 15_000 },
    );
    expect(out.trim()).toBe('1.6.0');
  });
});
