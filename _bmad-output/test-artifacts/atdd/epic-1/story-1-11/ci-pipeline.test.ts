// target-path: tests/ci/ci-pipeline.test.ts
// RED — Story 1.11 CI Pipeline & Gate Artifact Store (AR-20/22, SC-7, SEC-4)
// @rules AC-1, SC-7, SEC-4

import { describe, it, expect } from 'vitest';
import { readFileSync, existsSync } from 'node:fs';
import { join } from 'node:path';
import { execaSync } from 'execa';
import { parse as parseYaml } from 'yaml';

const ROOT = join(__dirname, '..', '..');

describe.skip('Story 1.11 — CI pipeline & gate artifact store (AR-20/22, SC-7, SEC-4)', () => {
  // RED — .github/workflows/ci.yml absent

  it('ci.yml runs build/test/lint/typecheck/eval/chaos/adr-lint (AC-F1-07)', () => {
    const ci = parseYaml(readFileSync(join(ROOT, '.github/workflows/ci.yml'), 'utf8'));
    const jobNames = Object.keys(ci.jobs ?? {});
    const allSteps = jobNames.flatMap(j => (ci.jobs[j].steps ?? []).map((s: any) => s.name ?? s.run ?? ''));
    const joined = allSteps.join('\n');
    for (const task of ['build', 'test', 'lint', 'typecheck', 'eval', 'chaos', 'adr-lint']) {
      expect(joined.toLowerCase()).toContain(task);
    }
  });

  it('branch protection blocks merge on red; hard gates non-relaxable (AC-2)', () => {
    // RED — branch-protection config (admin enforced)
    const bp = readFileSync(join(ROOT, '.github/branch-protection.json'), 'utf8');
    const cfg = JSON.parse(bp);
    expect(cfg.required_status_checks?.strict).toBe(true);
    expect(cfg.enforce_admins?.enabled).toBe(true); // SEC-6 — admins can't override
    expect(cfg.required_pull_request_reviews?.dismiss_stale_reviews).toBe(true);
  });

  it('self-hosted runner provisioned separately from corpus workstation (SEC-4)', () => {
    // RED — infra/runner/provision.pkr.hcl absent; PR runs on isolated runner
    expect(existsSync(join(ROOT, 'infra/runner/provision.pkr.hcl'))).toBe(true);
    const provision = readFileSync(join(ROOT, 'infra/runner/provision.pkr.hcl'), 'utf8');
    expect(provision).toMatch(/isolated|ephemeral/i);
    expect(provision).not.toMatch(/corpus|gpu/i); // NOT on corpus workstation
  });

  it('eval/gates/<corpus-hash>/ content-addressed structure exists (SC-7)', () => {
    expect(existsSync(join(ROOT, 'eval/gates'))).toBe(true);
    // Content-addressed: each artifact links to predecessor by hash; supersede never overwrite
    const readme = readFileSync(join(ROOT, 'eval/gates/README.md'), 'utf8');
    expect(readme).toMatch(/content-addressed/i);
    expect(readme).toMatch(/supersede|append-only/i);
  });

  it('corpus freeze primitive emits SHA-256 eval/corpus/<hash>/manifest.json (AC-F1-10)', () => {
    const result = execaSync('pnpm', ['exec', 'iip-eval', 'freeze', '--dry-run'], { cwd: ROOT, reject: false });
    expect(result.stdout).toMatch(/eval\/corpus\/sha256:[a-f0-9]+\/manifest\.json/);
  });

  it('gate-time re-run emits eval/gates/<hash>/decision.json with pass/fail + per-metric (AC-F1-10)', () => {
    // SC-7: eval reproduce <run-id> reconstructs (corpus SHA, gate SHA, model digest, harness SHA)
    const result = execaSync('pnpm', ['exec', 'iip-eval', 'reproduce', '--dry-run', 'latest'], { cwd: ROOT, reject: false });
    expect(result.stdout).toMatch(/eval\/gates\/sha256:[a-f0-9]+\/decision\.json/);
    expect(result.stdout).toMatch(/pass|fail/i);
  });

  it('re-run command `eval reproduce <run-id>` exists (SC-7 bisect primitive)', () => {
    const pkg = JSON.parse(readFileSync(join(ROOT, 'package.json'), 'utf8'));
    expect(pkg.bin?.['iip-eval']).toBeDefined();
  });

  it('sops 3.x + age 1.x configured for at-rest secrets; process refuses on invalid config (D7, NFR-S-4)', () => {
    expect(existsSync(join(ROOT, '.sops.yaml'))).toBe(true);
    const sops = readFileSync(join(ROOT, '.sops.yaml'), 'utf8');
    expect(sops).toMatch(/age/);
    // Process refuses on invalid config: simulate
    const result = execaSync('pnpm', ['exec', 'iip-config', 'validate', '--strict'], {
      cwd: ROOT, reject: false, env: { ...process.env, IIP_SECRETS_INVALID: '1' },
    });
    expect(result.exitCode).not.toBe(0); // refuses to start
  });

  it('OIDC ephemeral tokens <=1h replace persistent sops keys at runtime (SEC-4)', () => {
    const ci = readFileSync(join(ROOT, '.github/workflows/ci.yml'), 'utf8');
    expect(ci).toMatch(/id-token:\s*write|oidc/i);
    expect(ci).toMatch(/duration.*[1-9]\s*h|3600/i); // <=1h
  });
});
