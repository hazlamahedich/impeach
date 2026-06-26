// Story 1.11 — Packer runner provisioning + CI infra structural checks.
// @rules SEC-4, ADR-019, AC-F1-07

import { describe, it, expect } from 'vitest';
import { readFileSync, existsSync } from 'node:fs';
import { resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = resolve(fileURLToPath(import.meta.url), '..', '..', '..');
const PKR = resolve(ROOT, 'infra/runner/provision.pkr.hcl');
const RUNNER_DOCS = resolve(ROOT, 'docs/ci/runner-setup.md');
const SECRETS_DOCS = resolve(ROOT, 'docs/ci/secrets.md');
const SOPS_YAML = resolve(ROOT, '.sops.yaml');

describe('Story 1.11 — Task 2: Packer runner template (SEC-4, ADR-019)', () => {
  it('infra/runner/provision.pkr.hcl exists', () => {
    expect(existsSync(PKR)).toBe(true);
  });

  const hcl = existsSync(PKR) ? readFileSync(PKR, 'utf8') : '';

  it('does NOT mount /corpus into the runner image (SEC-4)', () => {
    // Strip HCL/Shell comments first — the Packer template deliberately
    // documents the forbidden mount inside a `# FORBIDDEN` comment block.
    const active = hcl
      .split('\n')
      .filter((l) => !l.trim().startsWith('#'))
      .join('\n');
    expect(active).not.toMatch(/volumes\s*=\s*\{[^}]*\/corpus/s);
  });

  it('does NOT actively provision or mount the sops age key path (SEC-4)', () => {
    // The template MAY (and should) include a `test ! -f .../keys.txt`
    // self-check asserting the key is absent. What is forbidden is an active
    // mount/copy/provision that ships the key into the image.
    const active = hcl
      .split('\n')
      .filter((l) => !l.trim().startsWith('#'))
      .join('\n');
    // Strip the legitimate SEC-4 self-check before asserting no key reference.
    const withoutSelfCheck = active.replace(
      /test ! -f [^\n]*keys\.txt[^\n]*/g,
      '',
    );
    expect(withoutSelfCheck).not.toMatch(/sops\/age\/keys\.txt/);
  });

  it('documents GPU passthrough as DEFERRED (commented-out config)', () => {
    expect(hcl).toMatch(/GPU passthrough.*DEFERRED/i);
    expect(hcl).toMatch(/Epic 4/i);
    // The NVIDIA provisioner must be commented-out in Epic 1.
    const uncommentedNvidia = hcl
      .split('\n')
      .filter((l) => !l.trim().startsWith('#'))
      .some((l) => /nvidia-container-toolkit/.test(l));
    expect(uncommentedNvidia).toBe(false);
  });

  it('declares an egress allowlist (SEC-4)', () => {
    expect(hcl).toMatch(/egress[- ]allowlist/i);
    // Named CI registries (exact set, per ADR-019/SEC-4).
    expect(hcl).toMatch(/github\.com/);
    expect(hcl).toMatch(/registry\.npmjs\.org/);
    expect(hcl).toMatch(/docker\.io/);
    expect(hcl).toMatch(/pypi\.org/);
  });

  it('self-checks the SEC-4 hard gates at build time', () => {
    expect(hcl).toMatch(/test ! -d \/corpus/);
    expect(hcl).toMatch(/test ! -f .*keys\.txt/);
  });
});

describe('Story 1.11 — Task 2: runner-setup.md documentation', () => {
  it('docs/ci/runner-setup.md exists', () => {
    expect(existsSync(RUNNER_DOCS)).toBe(true);
  });

  const md = existsSync(RUNNER_DOCS) ? readFileSync(RUNNER_DOCS, 'utf8') : '';

  it('documents `packer validate` as a pre-flight operator step', () => {
    expect(md).toMatch(/packer validate/);
  });

  it('documents the GPU-passthrough deferral to Epic 4', () => {
    expect(md).toMatch(/Epic 4/i);
    expect(md).toMatch(/ADR-019/);
  });

  it('documents the egress allowlist hostnames', () => {
    expect(md).toMatch(/registry\.npmjs\.org/);
    expect(md).toMatch(/pypi\.org/);
  });

  it('documents SEC-4 forbidden mounts (/corpus, sops age key)', () => {
    expect(md).toMatch(/\/corpus/);
    expect(md).toMatch(/sops\/age\/keys\.txt/);
  });
});

describe('Story 1.11 — Task 1: secrets docs + .sops.yaml exist', () => {
  it('docs/ci/secrets.md exists', () => {
    expect(existsSync(SECRETS_DOCS)).toBe(true);
  });

  it('.sops.yaml exists with age backend', () => {
    expect(existsSync(SOPS_YAML)).toBe(true);
    const yaml = readFileSync(SOPS_YAML, 'utf8');
    expect(yaml).toMatch(/age:/);
    expect(yaml).toMatch(/creation_rules/);
  });
});

describe('Story 1.11 — Task 6: GitHub Actions CI workflow (AC-F1-07)', () => {
  const CI_YML = resolve(ROOT, '.github/workflows/ci.yml');
  const BRANCH_DOCS = resolve(ROOT, 'docs/ci/branch-protection.md');

  it('.github/workflows/ci.yml exists', () => {
    expect(existsSync(CI_YML)).toBe(true);
  });

  const yml = existsSync(CI_YML) ? readFileSync(CI_YML, 'utf8') : '';

  it('declares permissions.id-token: write (SEC-4 / ADR-019 OIDC)', () => {
    expect(yml).toMatch(/id-token:\s*write/);
  });

  it('runs on Linux only (ubuntu-latest)', () => {
    expect(yml).toMatch(/runs-on:\s*ubuntu-latest/);
    expect(yml).not.toMatch(/runs-on:\s*macos/);
    expect(yml).not.toMatch(/runs-on:\s*windows/);
  });

  it('has the seven required parallel jobs (AC-F1-07)', () => {
    const required = ['build', 'test', 'lint', 'typecheck', 'eval', 'adr-lint', 'chaos'];
    for (const job of required) {
      // Match `  <job>:` at the start of a line (job key in the jobs map).
      expect(yml).toMatch(new RegExp(`^  ${job}:`, 'm'));
    }
  });

  it('the eval job invokes iip-eval / the polyglot bridge (SC-7, AC-F1-10)', () => {
    expect(yml).toMatch(/iip-eval|packages\/eval\/src\/cli\.ts/);
    expect(yml).toMatch(/freeze/);
  });

  it('documents hard-gating + branch protection enforcement', () => {
    expect(yml).toMatch(/enforce_admins/);
    expect(yml).toMatch(/required_status_checks/);
  });

  it('docs/ci/branch-protection.md exists with required settings', () => {
    expect(existsSync(BRANCH_DOCS)).toBe(true);
    const md = readFileSync(BRANCH_DOCS, 'utf8');
    expect(md).toMatch(/required_status_checks\.strict\s*=\s*true/);
    expect(md).toMatch(/enforce_admins\.enabled\s*=\s*true/);
    expect(md).toMatch(/dismiss_stale_reviews/);
  });
});

describe('Story 1.11 — Task 7: chaos gate placeholder (deferred → Story 2.9)', () => {
  const CI_YML = resolve(ROOT, '.github/workflows/ci.yml');
  const yml = existsSync(CI_YML) ? readFileSync(CI_YML, 'utf8') : '';

  it('has a chaos job that exits 0 with a deferral note', () => {
    expect(yml).toMatch(/\bchaos:\s/m);
    expect(yml).toMatch(/chaos gate deferred to Epic 2 \(Story 2\.9\)/);
    expect(yml).toMatch(/exit 0/);
  });
});
