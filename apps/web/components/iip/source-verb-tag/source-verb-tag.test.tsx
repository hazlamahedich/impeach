// target-path: apps/web/components/iip/source-verb-tag/source-verb-tag.test.tsx
// Story 1.8 <SourceVerbTag> (UX-DR12, EI-3)
// @rules STR-8, STR-10, EI-3

import { describe, it, expect, vi } from 'vitest';
import { render } from '@testing-library/react';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { SourceVerbTag } from '@/components/iip/source-verb-tag';

// apps/web/ is three levels up from apps/web/components/iip/source-verb-tag/.
const ROOT = join(__dirname, '..', '..', '..');

describe('Story 1.8 — <SourceVerbTag> (UX-DR12)', () => {
  it('renders label-caps in primary variant', () => {
    const { getByTestId } = render(<SourceVerbTag verb="documents" />);
    const tag = getByTestId('source-verb-tag');
    expect(tag.textContent).toMatch(/DOCUMENTS/); // label-caps
  });

  it('source-verbs.ts registry declares bias + floor per verb (EI-3 binding)', () => {
    // Without bias/floor, the verb is decoration and EI-3 is theater.
    const registry = readFileSync(join(ROOT, 'lib/citation/source-verbs.ts'), 'utf8');
    expect(registry).toMatch(/documents.*bias:\s*['"]raise/);
    expect(registry).toMatch(/alleges.*floor:\s*['"]secondary/);
    expect(registry).toMatch(/retracts.*bias:\s*['"]lower/);
  });

  it('unregistered verb renders fallback variant + console warning', () => {
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => {});
    const { getByTestId } = render(<SourceVerbTag verb="bogus_verb" />);
    expect(getByTestId('source-verb-tag').className).toMatch(/text-muted-foreground/);
    expect(warn).toHaveBeenCalled();
    warn.mockRestore();
  });

  it('risk-variant verb carries defamation-risk styling', () => {
    const { getByTestId } = render(<SourceVerbTag verb="retracts" />);
    expect(getByTestId('source-verb-tag').className).toMatch(/defamation-risk-caution/);
  });
});
