// target-path: apps/web/components/iip/answer-block/answer-block.test.tsx
// Story 1.8 <AnswerBlock> (UX-DR18, UX-DR21)
// @rules PD-1, STR-10

import { describe, it, expect } from 'vitest';
import { render } from '@testing-library/react';
import { AnswerBlock } from '@/components/iip/answer-block';

describe('Story 1.8 — <AnswerBlock> (UX-DR18)', () => {
  it('renders answer-block with a 3px left rule (token class, not raw width)', () => {
    const { getByTestId } = render(<AnswerBlock>Answer text</AnswerBlock>);
    // jsdom does not compute Tailwind into computed style; assert the tokenized
    // 3px border utility is applied.
    expect(getByTestId('answer-block').className).toMatch(/border-l-3/);
  });

  it('renders answer-block-silence ("No sourced answer found") when no answer', () => {
    const { getByTestId } = render(<AnswerBlock.Silence />);
    expect(getByTestId('answer-block-silence').textContent).toMatch(/No sourced answer found/i);
  });

  it('renders answer-block-essence (PD-1 sentence)', () => {
    const { getByTestId } = render(
      <AnswerBlock.Essence>The system cites a source you can open.</AnswerBlock.Essence>,
    );
    expect(getByTestId('answer-block-essence').textContent).toContain('cites a source you can open');
  });

  it('renders the no-prediction variant (UX-DR21)', () => {
    const { getByTestId } = render(<AnswerBlock.NoPrediction />);
    const block = getByTestId('answer-block-no-prediction');
    expect(block.textContent).toMatch(/IIP does not make predictions/i);
    expect(block.className).toMatch(/border-accent/);
  });
});
