/**
 * SkipToContent — accessibility skip link (UX-DR43).
 *
 * Must be the first focusable element on every surface. Visually hidden until
 * focused; targets `<main id="content">`.
 *
 * @rules UX-DR43
 */

import type { ReactNode } from 'react';

export function SkipToContent(): ReactNode {
  return (
    <a
      href="#content"
      className="sr-only focus:not-sr-only focus:fixed focus:left-4 focus:top-4 focus:z-[100] focus:rounded-md focus:bg-surface-raised focus:px-4 focus:py-2 focus:text-sm focus:font-medium focus:shadow-lg"
    >
      Skip to content
    </a>
  );
}
