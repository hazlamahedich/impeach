/**
 * <EmptyState> — display headline + body for empty surfaces (UX-DR20).
 *
 * @rules STR-10, UX-DR20
 */

import type { ReactNode } from 'react';

export interface EmptyStateProps {
  headline: string;
  body: string;
}

export function EmptyState({ headline, body }: EmptyStateProps): ReactNode {
  return (
    <div className="py-6">
      <h2 className="text-display-sm font-display text-claim-fact">{headline}</h2>
      <p className="mt-2 text-body-md font-sans text-muted-foreground">{body}</p>
    </div>
  );
}
