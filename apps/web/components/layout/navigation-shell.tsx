/**
 * NavigationShell — responsive application shell (UX-DR32, UX-DR43).
 *
 * Composes the TopBar + Sidebar + `<main id="content">` in a flex layout. An
 * `<ErrorBoundary>` wraps the main content so an uncaught render error
 * displays a fallback rather than a blank screen. Skeleton placeholders avoid
 * flash-of-unstyled-content during hydration.
 *
 * @rules UX-DR32, UX-DR43
 */

'use client';

import { Component, useEffect, useState, type ErrorInfo, type ReactNode } from 'react';
import { TopBar } from '@/components/layout/top-bar';
import { Sidebar } from '@/components/layout/sidebar';
import { Skeleton } from '@/components/ui/skeleton';

interface ErrorBoundaryState {
  hasError: boolean;
}

class ErrorBoundary extends Component<{ children: ReactNode }, ErrorBoundaryState> {
  override state: ErrorBoundaryState = { hasError: false };

  static getDerivedStateFromError(): ErrorBoundaryState {
    return { hasError: true };
  }

  override componentDidCatch(error: Error, info: ErrorInfo): void {
    // In production this would route to the audit-log / observability layer.
    // Minimal here to avoid coupling Story 1.9 to a logger.
    void error;
    void info;
  }

  override render(): ReactNode {
    if (this.state.hasError) {
      return (
        <div className="flex min-h-[50vh] flex-col items-center justify-center gap-4 p-8 text-center">
          <h2 className="font-display text-xl text-claim-fact">Something went wrong</h2>
          <p className="text-sm text-muted-foreground">
            An unexpected error occurred while rendering this page. Please refresh.
          </p>
        </div>
      );
    }
    return this.props.children;
  }
}

export function NavigationShell({ children }: { children: ReactNode }): ReactNode {
  const [hydrated, setHydrated] = useState(false);

  useEffect(() => {
    setHydrated(true);
  }, []);

  if (!hydrated) {
    // Skeleton placeholders to prevent flash of unstyled content.
    return (
      <div className="flex min-h-screen flex-col">
        <div className="flex h-14 items-center gap-3 border-b border-border px-4">
          <Skeleton className="h-4 w-64" />
          <Skeleton className="ml-auto h-8 w-8 rounded-md" />
        </div>
        <div className="flex flex-1">
          <Skeleton className="hidden h-full w-60 lg:block" />
          <main id="content" className="flex-1 p-6">
            <Skeleton className="h-32 w-full" />
          </main>
        </div>
      </div>
    );
  }

  return (
    <div className="flex min-h-screen flex-col">
      <TopBar />
      <div className="flex flex-1">
        <Sidebar />
        <ErrorBoundary>
          <main id="content" className="flex-1 p-6 outline-none">
            {children}
          </main>
        </ErrorBoundary>
      </div>
    </div>
  );
}
