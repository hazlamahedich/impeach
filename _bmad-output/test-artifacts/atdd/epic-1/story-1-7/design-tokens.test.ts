// target-path: apps/web/app/styles/design-tokens.test.ts
// RED — Story 1.7 Design Token System (UX-DR1-8)
// Refs: UX-DR1-8, STR-10
// @rules STR-10

import { describe, it, expect } from 'vitest';
import { readFileSync, existsSync } from 'node:fs';
import { join } from 'node:path';
import { glob } from 'glob';

const ROOT = join(__dirname, '..', '..', '..', '..', '..');
const TOKENS_PATH = join(ROOT, 'app/styles/iip-tokens.css');

const REQUIRED_TOKENS = [
  // Trust tiers (three+ states)
  '--trust-tier-verified', '--trust-tier-contradicted', '--trust-tier-caution',
  '--trust-tier-insufficient', '--trust-tier-disputed', '--trust-tier-retracted',
  // Source tiers
  '--source-tier-primary', '--source-tier-secondary', '--source-tier-tertiary',
  // Claim states
  '--claim-fact', '--claim-attributed', '--claim-dashed', '--claim-dashed-superseded',
  // Defamation risk
  '--defamation-risk-caution', '--defamation-risk-prohibited',
  // Brand + surfaces
  '--primary', '--accent', '--surface-base', '--surface-raised', '--surface-sunken',
  // Citation links
  '--citation-link-default', '--citation-link-hover', '--citation-link-visited',
  // Focus
  '--focus-ring-trust', '--focus-ring-citation',
];

describe.skip('Story 1.7 — Design token system (UX-DR1-8)', () => {
  // RED — app/styles/iip-tokens.css does not exist yet (Tailwind 4 @theme)

  it('iip-tokens.css exists with Tailwind 4 @theme block', () => {
    expect(existsSync(TOKENS_PATH)).toBe(true);
    const css = readFileSync(TOKENS_PATH, 'utf8');
    expect(css).toMatch(/@theme\s*\{/); // Tailwind 4 — NOT @tailwind base
    expect(css).not.toMatch(/@tailwind\s+(base|components|utilities)/); // v3 syntax banned under v4
  });

  it('all required semantic tokens defined', () => {
    const css = readFileSync(TOKENS_PATH, 'utf8');
    for (const token of REQUIRED_TOKENS) {
      expect(css).toContain(token);
    }
  });

  it('both light AND dark mode pairs defined', () => {
    const css = readFileSync(TOKENS_PATH, 'utf8');
    expect(css).toMatch(/:root|@media\s*\(prefers-color-scheme:\s*light\)/);
    expect(css).toMatch(/\.dark|@media\s*\(prefers-color-scheme:\s*dark\)/);
  });

  it('Tailwind 4 consumes the tokens (postcss plugin = @tailwindcss/postcss)', () => {
    const postcss = JSON.parse(readFileSync(join(ROOT, 'postcss.config.json'), 'utf8'));
    expect(JSON.stringify(postcss)).toMatch(/@tailwindcss\/postcss/);
    expect(JSON.stringify(postcss)).not.toMatch(/"tailwindcss"/); // v3 plugin name banned
  });

  it('typography loaded: Source Serif 4 (display), Geist Sans (body), IBM Plex Mono (citations) (UX-DR5)', () => {
    const css = readFileSync(TOKENS_PATH, 'utf8');
    expect(css).toMatch(/Source Serif 4/);
    expect(css).toMatch(/Geist Sans/);
    expect(css).toMatch(/IBM Plex Mono/);
  });

  it('rounded scale tightened: 3/5/8 px (UX-DR6)', () => {
    const css = readFileSync(TOKENS_PATH, 'utf8');
    expect(css).toMatch(/--radius[^:]*:\s*3px/);
    expect(css).toMatch(/--radius[^:]*:\s*5px/);
    expect(css).toMatch(/--radius[^:]*:\s*8px/);
  });

  it('spacing overrides exist: editorial-gap (56px), graph-panel (320px), evidence-split-gap (48px) (UX-DR7)', () => {
    const css = readFileSync(TOKENS_PATH, 'utf8');
    expect(css).toMatch(/--editorial-gap:\s*56px/);
    expect(css).toMatch(/--graph-panel:\s*320px/);
    expect(css).toMatch(/--evidence-split-gap:\s*48px/);
  });

  it('no raw hex / scale tokens (e.g. --green-500) in components/iip/ (STR-10 CI gate)', async () => {
    // RED — positive invariant: every color ref in components/iip/ resolves to semantic token
    const files = await glob('components/iip/**/*.{ts,tsx,css}', { cwd: ROOT });
    for (const f of files) {
      const src = readFileSync(join(ROOT, f), 'utf8');
      // raw hex (#abcdef) or tailwind scale (--green-500) = lint failure
      expect(src).not.toMatch(/#[0-9a-fA-F]{3,8}\b/);
      expect(src).not.toMatch(/--(?:green|red|blue|gray|slate|zinc)-\d{3}/);
    }
  });
});
