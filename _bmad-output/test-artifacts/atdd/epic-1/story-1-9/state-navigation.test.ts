// target-path: apps/web/lib/state/url-keys.test.ts (and friends)
// RED — Story 1.9 State Mgmt & Navigation Shell (UX-DR28-34/43)
// @rules STR-10, UX-DR31

import { describe, it, expect } from 'vitest';
import { render } from '@testing-library/react';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { execaSync } from 'execa';

const ROOT = join(__dirname, '..', '..', '..', '..', '..');

describe.skip('Story 1.9 — URL keys registry (UX-DR30, STR-10)', () => {
  // RED — lib/state/url-keys.ts absent

  it('lib/state/url-keys.ts is the single nuqs registry', () => {
    const registry = readFileSync(join(ROOT, 'lib/state/url-keys.ts'), 'utf8');
    // Required URL params (STR-10): ?seed=, ?renderer=, ?active=, ?mode=, ?from=, ?to=, ?q=
    for (const key of ['seed', 'renderer', 'active', 'mode', 'from', 'to', 'q']) {
      expect(registry).toContain(key);
    }
  });

  it('parsers are typed and stable (one-line edit to add a param)', async () => {
    const { urlKeys } = await import('@/lib/state/url-keys');
    expect(urlKeys.q.parse('hello')).toBe('hello');
    expect(urlKeys.mode.parse('trace')).toBe('trace');
  });
});

describe.skip('Story 1.9 — lib/api.ts HTTP wrapper (UX-DR31)', () => {
  it('lib/api.ts exists with AbortController + retry', () => {
    const api = readFileSync(join(ROOT, 'lib/api.ts'), 'utf8');
    expect(api).toMatch(/AbortController/);
    expect(api).toMatch(/retry/i);
  });

  it('ESLint bans raw fetch outside lib/api.ts (one HTTP wrapper)', () => {
    // RED — eslint config absent; raw fetch scattered = uncontrolled HTTP
    const ci = readFileSync(join(ROOT, '.github/workflows/ci.yml'), 'utf8');
    expect(ci).toMatch(/no-restricted-syntax.*fetch/);
  });
});

describe.skip('Story 1.9 — Zustand stores (UX-DR29)', () => {
  it('graph-store, timeline-store, chat-store, citation-store exist', async () => {
    for (const store of ['graph-store', 'timeline-store', 'chat-store', 'citation-store']) {
      const mod = await import(`@/lib/state/${store}`);
      expect(mod.default).toBeDefined();
      expect(typeof mod.default.getState).toBe('function');
    }
  });
});

describe.skip('Story 1.9 — Navigation shell (UX-DR32/43)', () => {
  it('skip-to-content link is the FIRST focusable element on every surface (UX-DR43)', () => {
    const { Page } = require('@/app/layout');
    const { container } = render(<Page>body</Page>);
    const focusables = container.querySelectorAll('a, button, input, [tabindex]');
    expect(focusables[0]?.textContent).toMatch(/skip to content/i);
  });

  it('left sidebar: icons + labels on xl, icon-rail on lg, Sheet on md/below (UX-DR32)', () => {
    // RED — responsive behavior; verify CSS class hooks exist
    const sidebar = readFileSync(join(ROOT, 'components/layout/sidebar.tsx'), 'utf8');
    expect(sidebar).toMatch(/xl:|@media.*xl/);
    expect(sidebar).toMatch(/Sheet|sheet/i);
  });

  it('top bar holds essence sentence (truncated), dark-mode toggle, command palette entry (UX-DR32)', () => {
    const topbar = readFileSync(join(ROOT, 'components/layout/top-bar.tsx'), 'utf8');
    expect(topbar).toMatch(/essence|truncate/i);
    expect(topbar).toMatch(/dark.*mode|theme/i);
    expect(topbar).toMatch(/command.*palette|cmdk/i);
  });
});

describe.skip('Story 1.9 — React Query 5.x wired (UX-DR31)', () => {
  it('QueryClient configured with default options (retry, staleTime)', () => {
    const providers = readFileSync(join(ROOT, 'app/providers.tsx'), 'utf8');
    expect(providers).toMatch(/QueryClient/);
    expect(providers).toMatch(/staleTime|retry/);
  });
});
