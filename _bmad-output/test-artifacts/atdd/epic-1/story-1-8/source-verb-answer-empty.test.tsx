// target-path: apps/web/components/iip/source-verb-tag/source-verb-tag.test.tsx
// + apps/web/components/iip/answer-block/answer-block.test.tsx
// + apps/web/components/iip/empty-state/empty-state.test.tsx
// RED — Story 1.8 remaining compound components (UX-DR12/18/20)
// @rules STR-8, STR-10, EI-3

import { describe, it, expect } from 'vitest';
import { render } from '@testing-library/react';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';

const ROOT = join(__dirname, '..', '..', '..', '..', '..');

describe.skip('Story 1.8 — <SourceVerbTag> (UX-DR12)', () => {
  // RED — components/iip/source-verb-tag + lib/citation/source-verbs.ts absent

  it('renders label-caps in primary variant', () => {
    const { SourceVerbTag } = require('@/components/iip/source-verb-tag');
    const { getByTestId } = render(<SourceVerbTag verb="documents" />);
    const tag = getByTestId('source-verb-tag');
    expect(tag.textContent).toMatch(/DOCUMENTS/); // label-caps
  });

  it('source-verbs.ts registry declares bias + floor per verb (EI-3 binding)', () => {
    // Without bias/floor, the verb is decoration and EI-3 is theater
    const registry = readFileSync(join(ROOT, 'lib/citation/source-verbs.ts'), 'utf8');
    expect(registry).toMatch(/documents.*bias:\s*['"]raise/);
    expect(registry).toMatch(/alleges.*floor:\s*['"]secondary/);
    expect(registry).toMatch(/retracts.*bias:\s*['"]lower/);
  });

  it('unregistered verb renders fallback variant + console warning', () => {
    const { SourceVerbTag } = require('@/components/iip/source-verb-tag');
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => {});
    const { getByTestId } = render(<SourceVerbTag verb="bogus_verb" />);
    expect(getByTestId('source-verb-tag').className).toMatch(/fallback/);
    expect(warn).toHaveBeenCalled();
    warn.mockRestore();
  });
});

describe.skip('Story 1.8 — <AnswerBlock> (UX-DR18)', () => {
  it('renders answer-block (3px primary border) by default', () => {
    const { AnswerBlock } = require('@/components/iip/answer-block');
    const { getByTestId } = render(<AnswerBlock>Answer text</AnswerBlock>);
    const style = window.getComputedStyle(getByTestId('answer-block'));
    expect(style.borderLeftWidth || style.borderWidth).toMatch(/3px/);
  });

  it('renders answer-block-silence ("No sourced answer found") when no answer', () => {
    const { AnswerBlock } = require('@/components/iip/answer-block');
    const { getByTestId } = render(<AnswerBlock.Silence />);
    expect(getByTestId('answer-block').textContent).toMatch(/No sourced answer found/i);
  });

  it('renders answer-block-essence (PD-1 sentence)', () => {
    const { AnswerBlock } = require('@/components/iip/answer-block');
    const { getByTestId } = render(<AnswerBlock.Essence>The system cites a source you can open.</AnswerBlock.Essence>);
    expect(getByTestId('answer-block').textContent).toContain('cites a source you can open');
  });
});

describe.skip('Story 1.8 — <EmptyState> (UX-DR20)', () => {
  it('renders display-sm headline + body-md body', () => {
    const { EmptyState } = require('@/components/iip/empty-state');
    const { getByRole } = render(
      <EmptyState headline="No results" body="Try a different query" />,
    );
    const heading = getByRole('heading');
    expect(heading.className).toMatch(/display-sm/);
  });
});

import { vi } from 'vitest';
