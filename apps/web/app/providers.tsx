'use client';

/**
 * Client-side providers — React Query + (future) theme.
 *
 * `QueryClient` is instantiated at module scope with a stable instance so SSR
 * and CSR share the same configuration. Explicit defaults satisfy UX-DR31:
 *   - `staleTime: 30_000` (30s) — avoids hammering the API on rapid refocus.
 *   - `retry: 3` with exponential backoff capped at 10s.
 *
 * @rules UX-DR31
 */

import { useState, type ReactNode } from 'react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { ReactQueryDevtools } from '@tanstack/react-query-devtools';

export function Providers({ children }: { children: ReactNode }): ReactNode {
  // Stable QueryClient per browser session (not recreated on every render).
  const [queryClient] = useState(
    () =>
      new QueryClient({
        defaultOptions: {
          queries: {
            staleTime: 30_000, // 30s
            retry: 3,
            retryDelay: (attempt: number) => Math.min(1000 * 2 ** attempt, 10_000),
          },
        },
      }),
  );

  return (
    <QueryClientProvider client={queryClient}>
      {children}
      {process.env.NODE_ENV === 'development' ? <ReactQueryDevtools initialIsOpen={false} /> : null}
    </QueryClientProvider>
  );
}
