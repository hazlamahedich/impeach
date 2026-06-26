/**
 * KeyboardShortcuts — global keyboard handler (UX-DR43).
 *
 * Wires `g <key>` sequence navigation, `⌘K` palette, `Esc` modal dismissal,
 * `/` focus search, and `?` help overlay. Target routes do not exist yet
 * (Epics 5–7) — wiring shortcuts now means they are ready when surfaces ship.
 *
 * @rules UX-DR43
 */

'use client';

import { useEffect, useRef, useState, type ReactNode } from 'react';
import { useRouter } from 'next/navigation';
import { Button } from '@/components/ui/button';
import { Sheet, SheetContent, SheetClose } from '@/components/ui/sheet';
import useCitationStore from '@/lib/state/citation-store';
import { PALETTE_OPEN_EVENT } from '@/components/layout/top-bar';

const G_PREFIX_MAP: Record<string, string> = {
  c: '/chat',
  g: '/graph',
  t: '/timeline',
  e: '/evidence',
  s: '/senators',
} as const;

const SHORTCUT_HELP: readonly { keys: string; action: string }[] = [
  { keys: 'g c', action: 'Go to Chat' },
  { keys: 'g g', action: 'Go to Graph' },
  { keys: 'g t', action: 'Go to Timeline' },
  { keys: 'g e', action: 'Go to Evidence' },
  { keys: 'g s', action: 'Go to Senators' },
  { keys: '⌘K', action: 'Command palette' },
  { keys: 'Esc', action: 'Close modal' },
  { keys: '/', action: 'Focus search' },
  { keys: '?', action: 'Toggle this help' },
] as const;

export function KeyboardShortcuts(): ReactNode {
  const router = useRouter();
  const closeCitation = useCitationStore((s) => s.closeCitation);
  const [gPrefix, setGPrefix] = useState(false);
  const [helpOpen, setHelpOpen] = useState(false);
  const gPrefixTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    const onKeyDown = (e: KeyboardEvent): void => {
      const target = e.target as HTMLElement | null;
      const isTyping =
        target?.tagName === 'INPUT' ||
        target?.tagName === 'TEXTAREA' ||
        target?.isContentEditable === true;

      // Esc — always works, even while typing.
      if (e.key === 'Escape') {
        closeCitation();
        setHelpOpen(false);
        setGPrefix(false);
        return;
      }

      // Don't trigger navigation shortcuts while typing.
      if (isTyping) return;

      // `g` prefix sequence.
      if (gPrefix) {
        const route = G_PREFIX_MAP[e.key];
        if (route !== undefined) {
          e.preventDefault();
          router.push(route);
        }
        setGPrefix(false);
        return;
      }

      if (e.key === 'g') {
        setGPrefix(true);
        // Auto-reset the prefix if no second key follows.
        if (gPrefixTimer.current) clearTimeout(gPrefixTimer.current);
        gPrefixTimer.current = setTimeout(() => setGPrefix(false), 1000);
        return;
      }

      // `⌘K` / `Ctrl+K` — open the command palette.
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === 'k') {
        e.preventDefault();
        window.dispatchEvent(new CustomEvent(PALETTE_OPEN_EVENT));
        return;
      }

      // `/` — focus the search/command input if present.
      if (e.key === '/') {
        e.preventDefault();
        const searchInput = document.querySelector<HTMLInputElement>(
          '[cmdk-input], input[type="search"], [data-search-input]',
        );
        searchInput?.focus();
        return;
      }

      // `?` — toggle help overlay.
      if (e.key === '?') {
        e.preventDefault();
        setHelpOpen((prev) => !prev);
        return;
      }
    };

    document.addEventListener('keydown', onKeyDown);
    return () => {
      document.removeEventListener('keydown', onKeyDown);
      if (gPrefixTimer.current) clearTimeout(gPrefixTimer.current);
    };
  }, [router, closeCitation, gPrefix]);

  if (!helpOpen) return null;

  return (
    <Sheet open={helpOpen} onOpenChange={setHelpOpen}>
      <SheetContent side="right" className="w-full max-w-sm">
        <h2 className="font-display text-lg">Keyboard Shortcuts</h2>
        <SheetClose asChild>
          <Button variant="ghost" size="sm" className="absolute right-2 top-2" aria-label="Close help">
            ✕
          </Button>
        </SheetClose>
        <dl className="mt-4 flex flex-col gap-2 text-sm">
          {SHORTCUT_HELP.map((item) => (
            <div key={item.keys} className="flex items-center justify-between">
              <dt className="font-mono text-xs text-muted-foreground">{item.keys}</dt>
              <dd>{item.action}</dd>
            </div>
          ))}
        </dl>
      </SheetContent>
    </Sheet>
  );
}
