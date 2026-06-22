// target-path: tests/integration/compose-stack.health.test.ts
// RED — Story 1.3 Docker Compose Platform Stack
// Refs: AR-1..8, D9, D15, NFR-O-1
// Run: pnpm vitest run --pool=forks --poolOptions.forks.singleFork=true

import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { execaSync } from 'execa';

const COMPOSE_FILE = 'infra/docker-compose.yml';
const SERVICES = [
  'postgres', 'redis', 'minio', 'ollama', 'caddy',
  'api', 'ingest-worker', 'serve-worker', 'audit-worker', 'enqueuer', 'web',
];

describe.skip('Story 1.3 — Docker Compose platform stack health', () => {
  // RED — infra/docker-compose.yml does not exist yet

  beforeAll(() => {
    execaSync('docker', ['compose', '-f', COMPOSE_FILE, 'up', '-d', '--wait'], { timeout: 180_000 });
  }, 200_000);

  afterAll(() => {
    execaSync('docker', ['compose', '-f', COMPOSE_FILE, 'down', '-v'], { reject: false });
  });

  it('compose file exists with all 11 services declared', () => {
    const out = execaSync('docker', ['compose', '-f', COMPOSE_FILE, 'config', '--services']).stdout;
    const declared = out.split('\n').map(s => s.trim()).filter(Boolean);
    for (const svc of SERVICES) {
      expect(declared).toContain(svc);
    }
  });

  it('all services reach healthy status', () => {
    const out = execaSync('docker', ['compose', '-f', COMPOSE_FILE, 'ps', '--format', 'json']).stdout;
    const rows = out.trim().split('\n').map(r => JSON.parse(r));
    for (const row of rows) {
      expect(row.Health ?? row.Status).toMatch(/healthy|running/i);
    }
  });

  it('Caddyfile configured with auto-TLS + rate-limit template (D9)', () => {
    const caddyfile = readFileSync('infra/Caddyfile', 'utf8');
    expect(caddyfile).toMatch(/tls.*\{.*automation/); // auto-ACME
    expect(caddyfile).toMatch(/rate_limit/);
  });

  it('Ollama pre-pulls models via infra/runner/ollama-pull.sh (D15)', () => {
    const script = readFileSync('infra/runner/ollama-pull.sh', 'utf8');
    expect(script).toMatch(/ollama pull/);
    // ADR-005: qwen3:14b is current target — verify tag spelling
    expect(script).toMatch(/qwen3:14b/);
  });

  it('MinIO private bucket exists for raw snapshots', async () => {
    const { Client } = await import('minio');
    const minio = new Client({ endPoint: 'localhost', port: 9000, useSSL: false, accessKey: 'minioadmin', secretKey: 'minioadmin' });
    const exists = await minio.bucketExists('raw-snapshots');
    expect(exists).toBe(true);
  });

  it('Redis configured for BullMQ + Streams (Enqueuer event store)', async () => {
    const { createClient } = await import('redis');
    const redis = createClient({ url: 'redis://localhost:6379' });
    await redis.connect();
    expect(await redis.ping()).toBe('PONG');
    await redis.disconnect();
  });

  it('OpenTelemetry + Prometheus + Grafana wired (NFR-O-1)', () => {
    const out = execaSync('docker', ['compose', '-f', COMPOSE_FILE, 'config', '--services']).stdout;
    expect(out).toMatch(/otel-collector|tempo|jaeger/);
    expect(out).toMatch(/prometheus/);
    expect(out).toMatch(/grafana/);
  });
});

import { readFileSync } from 'node:fs';
