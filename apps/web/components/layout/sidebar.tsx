/**
 * Sidebar — responsive navigation sidebar (UX-DR32).
 *
 *   - `xl` (1280px+): full icons + text labels.
 *   - `lg` (1024px–1279px): compact icon-rail (labels hidden).
 *   - `md` and below (<1024px): triggerable drawer Sheet.
 *
 * Navigation items link to the five first-class surfaces. Target routes do
 * not exist yet (Epics 5–7) — wiring now means shortcuts are ready.
 *
 * @rules UX-DR32
 */

'use client';

import { useState, type ReactNode } from 'react';
import Link from 'next/link';
import { Sheet, SheetTrigger, SheetContent, SheetClose } from '@/components/ui/sheet';
import { Button } from '@/components/ui/button';

interface NavItem {
  href: string;
  label: string;
  icon: string;
}

const NAV_ITEMS: readonly NavItem[] = [
  { href: '/chat', label: 'Chat', icon: '💬' },
  { href: '/graph', label: 'Graph', icon: '🕸' },
  { href: '/timeline', label: 'Timeline', icon: '📅' },
  { href: '/evidence', label: 'Evidence', icon: '📄' },
  { href: '/senators', label: 'Senators', icon: '🏛' },
] as const;

function NavLinks({ collapsed }: { collapsed: boolean }): ReactNode {
  return (
    <nav aria-label="Main navigation" className="flex flex-col gap-1">
      {NAV_ITEMS.map((item) => (
        <Link
          key={item.href}
          href={item.href}
          className={`flex items-center gap-3 rounded-md px-3 py-2 text-sm font-medium text-muted-foreground transition-colors hover:bg-muted hover:text-claim-fact ${
            collapsed ? 'lg:justify-center' : ''
          }`}
        >
          <span aria-hidden="true">{item.icon}</span>
          <span className={collapsed ? 'lg:hidden' : ''}>{item.label}</span>
        </Link>
      ))}
    </nav>
  );
}

export function Sidebar(): ReactNode {
  const [open, setOpen] = useState(false);

  return (
    <>
      {/* xl: full sidebar with icons + labels */}
      <aside className="hidden xl:flex xl:w-60 xl:flex-col xl:border-r xl:border-border xl:bg-surface-base xl:p-3">
        <NavLinks collapsed={false} />
      </aside>

      {/* lg: compact icon-rail (labels hidden) */}
      <aside className="hidden lg:flex xl:hidden lg:w-16 lg:flex-col lg:border-r lg:border-border lg:bg-surface-base lg:p-3">
        <NavLinks collapsed />
      </aside>

      {/* md and below: triggerable drawer Sheet */}
      <div className="lg:hidden">
        <Sheet open={open} onOpenChange={setOpen}>
          <SheetTrigger asChild>
            <Button variant="ghost" size="icon" aria-label="Open navigation menu">
              <span aria-hidden="true">☰</span>
            </Button>
          </SheetTrigger>
          <SheetContent side="left">
            <SheetClose asChild>
              <Button variant="ghost" size="sm" aria-label="Close menu">
                ✕
              </Button>
            </SheetClose>
            <NavLinks collapsed={false} />
          </SheetContent>
        </Sheet>
      </div>
    </>
  );
}
