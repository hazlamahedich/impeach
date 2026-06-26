// target-path: tests/ci/ci-pipeline.test.ts
// RED — Story 1.11 CI Pipeline & Gate Artifact Store (AR-20/22, SC-7, SEC-4)
// @rules AC-1, SC-7, SEC-4
// Adversarial review 2026-06-26: fixed branch-protection (docs, not file),
// OIDC (id-token: write, not duration regex), secrets (CLI, not invented env var),
// added decision.json schema validation, iip-eval/iip-config CLI existence.

import { describe, it, expect } from 'vitest';
import { readFileSync, existsSync } from 'node:fs';
import { join } from 'node:path';
import { execaSync } from 'execa';
import { parse as parseYaml } from 'yaml';

const ROOT = join(__dirname, '..', '..');

describe.skip('Story 1.11 — CI pipeline & gate artifact store (AR-20/22, SC-7, SEC-4)', () => {

  // ── AC-F1-07: CI workflow coverage ──────────────────────────────

  it('ci.yml runs build/test/lint/typecheck/eval/adr-lint as parallel jobs (AC-F1-07)', () => {
    const ci = parseYaml(readFileSync(join(ROOT, '.github/workflows/ci.yml'), 'utf8'));
    const jobNames = Object.keys(ci.jobs ?? {});
    const required = ['build', 'test', 'lint', 'typecheck', 'eval', 'adr-lint'];
    for (const job of required) {
      expect(jobNames).toContain(job);
    }
    // Verify parallel: at least one job has no `needs` (independent lane)
    const independentJobs = jobNames.filter(j => !ci.jobs[j].needs);
    expect(independentJobs.length).toBeGreaterThanOrEqual(2);
  });

  it('chaos job exists as deferred placeholder (AC-F1-07, Epic 2 activation)', () => {
    const ci = parseYaml(readFileSync(join(ROOT, '.github/workflows/ci.yml'), 'utf8'));
    expect(ci.jobs?.chaos).toBeDefined();
    const steps = (ci.jobs.chaos.steps ?? []).map((s: any) => s.run ?? '').join('\n');
    expect(steps).toMatch(/chaos.*deferred|exit 0/);
  });

  // ── Branch protection (documented, not a repo file) ──────────────

  it('branch protection settings documented in docs/ci/branch-protection.md', () => {
    const bp = readFileSync(join(ROOT, 'docs/ci/branch-protection.md'), 'utf8');
    expect(bp).toMatch(/required_status_checks.*strict.*true/i);
    expect(bp).toMatch(/enforce_admins.*enabled.*true/i);
    expect(bp).toMatch(/dismiss_stale_reviews/i);
  });

  // ── SEC-4: Runner isolation ─────────────────────────────────────

  it('self-hosted runner provisioned separately from corpus workstation (SEC-4)', () => {
    expect(existsSync(join(ROOT, 'infra/runner/provision.pkr.hcl'))).toBe(true);
    const provision = readFileSync(join(ROOT, 'infra/runner/provision.pkr.hcl'), 'utf8');
    expect(provision).toMatch(/isolated|ephemeral/i);
    // Must NOT mount /corpus or sops keys
    expect(provision).not.toMatch(/\/corpus/);
    expect(provision).not.toMatch(/keys\.txt/);
  });

  // ── SC-7: Content-addressed gate store ──────────────────────────

  it('eval/gates/ content-addressed structure with README (SC-7)', () => {
    expect(existsSync(join(ROOT, 'eval/gates'))).toBe(true);
    const readme = readFileSync(join(ROOT, 'eval/gates/README.md'), 'utf8');
    expect(readme).toMatch(/content-addressed/i);
    expect(readme).toMatch(/supersede|append-only/i);
  });

  // ── AC-F1-10: Corpus freeze ─────────────────────────────────────

  it('corpus freeze emits SHA-256 eval/corpus/<hash>/manifest.json (AC-F1-10)', () => {
    const result = execaSync('pnpm', ['exec', 'iip-eval', 'freeze', '--dry-run'], {
      cwd: ROOT, reject: false,
    });
    expect(result.stdout).toMatch(/eval\/corpus\/sha256:[a-f0-9]+\/manifest\.json/);
  });

  it('corpus freeze accepts --corpus-dir flag', () => {
    const result = execaSync('pnpm', [
      'exec', 'iip-eval', 'freeze', '--corpus-dir', 'eval/corpus/golden', '--dry-run',
    ], { cwd: ROOT, reject: false });
    expect(result.stdout).toMatch(/manifest\.json/);
  });

  // ── AC-F1-10: Gate decision & reproduce ─────────────────────────

  it('gate re-run emits eval/gates/<hash>/decision.json with pass/fail + per-metric (AC-F1-10)', () => {
    const result = execaSync('pnpm', ['exec', 'iip-eval', 'reproduce', '--dry-run', 'latest'], {
      cwd: ROOT, reject: false,
    });
    expect(result.stdout).toMatch(/eval\/gates\/sha256:[a-f0-9]+\/decision\.json/);
    expect(result.stdout).toMatch(/pass|fail/i);
  });

  it('decision.json contains all required schema fields', () => {
    // Verify the output envelope schema is documented/implemented
    const freezeMod = join(ROOT, 'packages/eval/src/reproduce.ts');
    expect(existsSync(freezeMod)).toBe(true);
    const src = readFileSync(freezeMod, 'utf8');
    for (const field of ['schemaVersion', 'corpusHash', 'commit', 'timestamp', 'decision', 'metrics']) {
      expect(src).toContain(field);
    }
  });

  // ── CLI binary existence ────────────────────────────────────────

  it('iip-eval CLI binary is registered in packages/eval/package.json', () => {
    const pkg = JSON.parse(readFileSync(join(ROOT, 'packages/eval/package.json'), 'utf8'));
    expect(pkg.bin?.['iip-eval']).toBeDefined();
  });

  it('iip-config CLI binary is registered in packages/config/package.json', () => {
    const pkg = JSON.parse(readFileSync(join(ROOT, 'packages/config/package.json'), 'utf8'));
    expect(pkg.bin?.['iip-config']).toBeDefined();
  });

  // ── D7 / NFR-S-4: Secrets fail-closed ───────────────────────────

  it('sops 3.x + age 1.x configured in .sops.yaml (D7)', () => {
    expect(existsSync(join(ROOT, '.sops.yaml'))).toBe(true);
    const sops = readFileSync(join(ROOT, '.sops.yaml'), 'utf8');
    expect(sops).toMatch(/age/);
  });

  it('iip-config validate --strict exits non-zero on invalid config (NFR-S-4)', () => {
    // Unset a required secret to trigger fail-closed
    const result = execaSync('pnpm', ['exec', 'iip-config', 'validate', '--strict'], {
      cwd: ROOT,
      reject: false,
      env: { ...process.env, IIP_DATABASE_URL: '' },
    });
    expect(result.exitCode).not.toBe(0);
  });

  // ── SEC-4: OIDC ephemeral tokens ────────────────────────────────

  it('CI workflow uses OIDC id-token: write for ephemeral auth (SEC-4)', () => {
    const ci = readFileSync(join(ROOT, '.github/workflows/ci.yml'), 'utf8');
    const parsed = parseYaml(ci);
    expect(parsed.permissions?.['id-token']).toBe('write');
  });
});
