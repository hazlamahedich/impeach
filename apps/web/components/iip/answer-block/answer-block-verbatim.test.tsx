/**
 * AnswerBlock — verbatim silence microcopy (EXPANSION).
 *
 * Expands Story 1.8 coverage: the silence-state headline MUST match the
 * legally-reviewed FR-5.3 / UX-DR50 microcopy VERBATIM (including the
 * trailing period). Paraphrasing the silence copy is a republication risk.
 *
 * @rules PD-1, FR-5.3, UX-DR18, UX-DR50
 */

import { describe, it, expect } from 'vitest';
import { render } from '@testing-library/react';
import { AnswerBlock } from '@/components/iip/answer-block';

describe('Story 1.8 — <AnswerBlock.Silence> verbatim microcopy (FR-5.3, UX-DR50)', () => {
  it('[P0] renders the silence headline EXACTLY as specified — "No sourced answer found." with trailing period', () => {
    // GIVEN the silence variant renders (no sourced answer exists)
    const { getByTestId } = render(<AnswerBlock.Silence />);

    // WHEN the headline text is read
    const headline = getByTestId('answer-block-silence');

    // THEN the copy is verbatim per UX-DR50 / FR-5.3 — period included
    // (paraphrasing or dropping the period is a divergence from legal-reviewed microcopy)
    expect(headline.textContent).toContain('No sourced answer found.');
  });

  it('[P0] does NOT use a hedged or paraphrased silence phrase', () => {
    // GIVEN the silence variant
    const { getByTestId } = render(<AnswerBlock.Silence />);
    const text = getByTestId('answer-block-silence').textContent ?? '';

    // THEN banned phrasings are absent (FR-5.4 honest non-claims)
    expect(text).not.toMatch(/try rephrasing/i);
    expect(text).not.toMatch(/no results? found/i);
    expect(text).not.toMatch(/nothing here/i);
  });

  it('[P1] carries the explanatory subtext that IIP only answers with a source', () => {
    // GIVEN the silence variant
    const { getByTestId } = render(<AnswerBlock.Silence />);

    // WHEN inspected
    const block = getByTestId('answer-block-silence');

    // THEN the essence subtext ties silence to the citation-or-silence invariant
    expect(block.textContent).toMatch(/source you can open/i);
  });
});
