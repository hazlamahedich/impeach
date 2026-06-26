/**
 * Sheet — shadcn-style slide-over panel built on Radix Dialog.
 *
 * Adapted for Tailwind v4 + React 19. Used by the mobile navigation drawer
 * in the sidebar (UX-DR32).
 */

'use client';

import * as React from 'react';
import * as SheetPrimitive from '@radix-ui/react-dialog';
import type { ReactNode } from 'react';

const Sheet = SheetPrimitive.Root;
const SheetTrigger = SheetPrimitive.Trigger;

function SheetOverlay({ className }: { className?: string }): ReactNode {
  return (
    <SheetPrimitive.Overlay
      className={`fixed inset-0 z-50 bg-black/50 data-[state=open]:animate-in data-[state=closed]:animate-out ${
        className ?? ''
      }`}
    />
  );
}

function SheetContent({
  children,
  className,
  side = 'left',
}: {
  children: ReactNode;
  className?: string;
  side?: 'left' | 'right';
}): ReactNode {
  const sideClass =
    side === 'left'
      ? 'inset-y-0 left-0 h-full w-3/4 border-r data-[state=closed]:slide-out-to-left data-[state=open]:slide-in-from-left'
      : 'inset-y-0 right-0 h-full w-3/4 border-l data-[state=closed]:slide-out-to-right data-[state=open]:slide-in-from-right';
  return (
    <SheetPrimitive.Portal>
      <SheetOverlay />
      <SheetPrimitive.Content
        className={`fixed z-50 flex flex-col gap-4 bg-surface-raised p-6 shadow-lg outline-none ${sideClass} ${className ?? ''}`}
      >
        {children}
      </SheetPrimitive.Content>
    </SheetPrimitive.Portal>
  );
}

function SheetClose({ children, asChild }: { children: ReactNode; asChild?: boolean }): ReactNode {
  return asChild ? (
    <SheetPrimitive.Close asChild>{children}</SheetPrimitive.Close>
  ) : (
    <SheetPrimitive.Close>{children}</SheetPrimitive.Close>
  );
}

export { Sheet, SheetTrigger, SheetContent, SheetClose };
