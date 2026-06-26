/**
 * Skeleton — loading placeholder (shadcn-style, Tailwind v4).
 */

import type { HTMLAttributes, ReactNode } from 'react';

export function Skeleton({ className, ...rest }: HTMLAttributes<HTMLDivElement>): ReactNode {
  return (
    <div className={`animate-pulse rounded-md bg-muted ${className ?? ''}`} {...rest} />
  );
}
