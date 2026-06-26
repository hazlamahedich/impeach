/**
 * Command — shadcn-style command palette built on cmdk (UX-DR32).
 *
 * Adapted for Tailwind v4 + React 19. The command palette is triggered by
 * `⌘K` in the top bar and offers navigation commands + free-text search.
 */

'use client';

import * as React from 'react';
import { Command as CommandPrimitive } from 'cmdk';
import type { ReactNode } from 'react';

function Command({ className, children }: { className?: string; children: ReactNode }): ReactNode {
  return (
    <CommandPrimitive
      className={`flex h-full w-full flex-col overflow-hidden rounded-md bg-surface-raised text-claim-fact ${
        className ?? ''
      }`}
      label="Command Palette"
    >
      {children}
    </CommandPrimitive>
  );
}

function CommandInput({
  placeholder,
  value,
  onValueChange,
}: {
  placeholder?: string;
  value: string;
  onValueChange: (v: string) => void;
}): ReactNode {
  return (
    <div className="flex items-center border-b px-3">
      <CommandPrimitive.Input
        placeholder={placeholder}
        value={value}
        onValueChange={onValueChange}
        className="flex h-11 w-full rounded-md bg-transparent py-3 text-sm outline-none placeholder:text-muted-foreground disabled:cursor-not-allowed disabled:opacity-50"
      />
    </div>
  );
}

function CommandList({ children, className }: { children: ReactNode; className?: string }): ReactNode {
  return (
    <CommandPrimitive.List className={`max-h-[300px] overflow-y-auto overflow-x-hidden ${className ?? ''}`}>
      {children}
    </CommandPrimitive.List>
  );
}

function CommandEmpty({ children }: { children: ReactNode }): ReactNode {
  return <CommandPrimitive.Empty className="py-6 text-center text-sm text-muted-foreground">{children}</CommandPrimitive.Empty>;
}

function CommandGroup({ heading, children }: { heading?: string; children: ReactNode }): ReactNode {
  return (
    <CommandPrimitive.Group
      heading={heading}
      className="overflow-hidden p-1 text-claim-fact [&_[cmdk-group-heading]]:px-2 [&_[cmdk-group-heading]]:py-1.5 [&_[cmdk-group-heading]]:text-xs [&_[cmdk-group-heading]]:font-medium [&_[cmdk-group-heading]]:text-muted-foreground"
    >
      {children}
    </CommandPrimitive.Group>
  );
}

function CommandItem({
  value,
  onSelect,
  children,
}: {
  value: string;
  onSelect: (value: string) => void;
  children: ReactNode;
}): ReactNode {
  return (
    <CommandPrimitive.Item
      value={value}
      onSelect={onSelect}
      className="relative flex cursor-pointer select-none items-center rounded-sm px-2 py-1.5 text-sm outline-none data-[selected=true]:bg-muted data-[selected=true]:text-claim-fact"
    >
      {children}
    </CommandPrimitive.Item>
  );
}

export { Command, CommandInput, CommandList, CommandEmpty, CommandGroup, CommandItem };
