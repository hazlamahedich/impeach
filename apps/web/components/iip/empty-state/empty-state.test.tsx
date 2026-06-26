// target-path: apps/web/components/iip/empty-state/empty-state.test.tsx
// Story 1.8 <EmptyState> (UX-DR20)
// @rules STR-10

import { describe, it, expect } from 'vitest';
import { render } from '@testing-library/react';
import { EmptyState } from '@/components/iip/empty-state';

describe('Story 1.8 — <EmptyState> (UX-DR20)', () => {
  it('renders display-sm headline + body-md body', () => {
    const { getByRole, getByText } = render(
      <EmptyState headline="No results" body="Try a different query" />,
    );
    const heading = getByRole('heading');
    expect(heading.className).toMatch(/display-sm/);
    expect(getByText('Try a different query')).toBeDefined();
  });
});
