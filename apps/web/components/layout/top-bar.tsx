/**
 * TopBar — responsive top bar (UX-DR32).
 *
 *   - Essence sentence (truncated via `line-clamp-1`) — the editorial contract.
 *   - Dark-mode toggle (`next-themes` `useTheme`).
 *   - Command palette trigger (cmdk-based, `⌘K`).
 *
 * @rules UX-DR32
 */

'use client';

import { useEffect, useState, useCallback, type ReactNode } from 'react';
import { useRouter } from 'next/navigation';
import { useTheme } from 'next-themes';
import { Button } from '@/components/ui/button';

export const PALETTE_OPEN_EVENT = 'iip:open-command-palette';
import {
  Command,
  CommandInput,
  CommandList,
  CommandEmpty,
  CommandGroup,
  CommandItem,
} from '@/components/ui/command';
import { Sheet, SheetTrigger, SheetContent, SheetClose } from '@/components/ui/sheet';

const ESSENCE_SENTENCE =
  'Every claim IIP shows you cites a source you can open — or IIP shows you nothing.';

const NAV_COMMANDS = [
  { label: 'Go to Chat', route: '/chat' },
  { label: 'Go to Graph', route: '/graph' },
  { label: 'Go to Timeline', route: '/timeline' },
  { label: 'Go to Evidence', route: '/evidence' },
  { label: 'Go to Senators', route: '/senators' },
] as const;

export function TopBar(): ReactNode {
  const { setTheme, resolvedTheme } = useTheme();
  const router = useRouter();
  const [paletteOpen, setPaletteOpen] = useState(false);
  const [query, setQuery] = useState('');

  useEffect(() => {
    const openPalette = () => setPaletteOpen(true);
    window.addEventListener(PALETTE_OPEN_EVENT, openPalette);
    return () => window.removeEventListener(PALETTE_OPEN_EVENT, openPalette);
  }, []);

  const toggleTheme = useCallback(() => {
    const next = resolvedTheme === 'dark' ? 'light' : 'dark';
    setTheme(next);
  }, [resolvedTheme, setTheme]);

  const handleNav = useCallback(
    (route: string) => {
      setPaletteOpen(false);
      router.push(route);
    },
    [router],
  );

  const handleSearch = useCallback(() => {
    if (query.trim() !== '') {
      setPaletteOpen(false);
      router.push(`/chat?q=${encodeURIComponent(query.trim())}`);
    }
  }, [query, router]);

  return (
    <header className="flex h-14 items-center gap-3 border-b border-border bg-surface-base px-4">
      {/* Essence sentence — truncated at all breakpoints */}
      <p className="line-clamp-1 flex-1 overflow-hidden text-ellipsis font-mono text-xs text-muted-foreground">
        {ESSENCE_SENTENCE}
      </p>

      {/* Dark-mode toggle */}
      <Button
        variant="ghost"
        size="icon"
        onClick={toggleTheme}
        aria-label={`Switch to ${resolvedTheme === 'dark' ? 'light' : 'dark'} mode`}
      >
        <span aria-hidden="true">{resolvedTheme === 'dark' ? '☀' : '☾'}</span>
      </Button>

      {/* Command palette trigger */}
      <Sheet open={paletteOpen} onOpenChange={setPaletteOpen}>
        <SheetTrigger asChild>
          <Button variant="outline" size="sm" aria-label="Open command palette">
            <span aria-hidden="true">⌘K</span>
          </Button>
        </SheetTrigger>
        <SheetContent side="right" className="w-full max-w-md p-0">
          <Command>
            <CommandInput
              placeholder="Search or type a command…"
              value={query}
              onValueChange={setQuery}
            />
            <CommandList>
              <CommandEmpty>No results found.</CommandEmpty>
              <CommandGroup heading="Navigation">
                {NAV_COMMANDS.map((cmd) => (
                  <CommandItem
                    key={cmd.route}
                    value={cmd.label}
                    onSelect={() => handleNav(cmd.route)}
                  >
                    {cmd.label}
                  </CommandItem>
                ))}
              </CommandGroup>
              <CommandGroup heading="Search">
                <CommandItem value="search query" onSelect={handleSearch}>
                  Search for: {query || '…'}
                </CommandItem>
              </CommandGroup>
            </CommandList>
          </Command>
          <SheetClose asChild>
            <Button variant="ghost" size="sm" className="absolute right-2 top-2" aria-label="Close palette">
              ✕
            </Button>
          </SheetClose>
        </SheetContent>
      </Sheet>
    </header>
  );
}
