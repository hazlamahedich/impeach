import type { Metadata } from 'next';
import type { ReactNode } from 'react';
import { Source_Serif_4, Geist, IBM_Plex_Mono } from 'next/font/google';
import { CitationProvider } from '@/components/iip/citation/citation-provider';
import './styles/iip-tokens.css';

/**
 * Typography — Story 1.7 AC #4 (UX-DR5).
 *
 * Loaded via `next/font/google` (NOT a render-blocking Google Fonts `@import`):
 * automatic subsetting, no Cumulative Layout Shift, and client IPs are not
 * leaked to Google — important for a platform handling politically sensitive
 * content. Each instance exposes a CSS variable that the Tailwind theme in
 * `app/styles/iip-tokens.css` composes with named system fallbacks so the
 * interface degrades gracefully while fonts load.
 */
const fontDisplay = Source_Serif_4({
  variable: '--font-display-loaded',
  display: 'swap',
  subsets: ['latin'],
});

const fontSans = Geist({
  variable: '--font-sans-loaded',
  display: 'swap',
  subsets: ['latin'],
});

const fontMono = IBM_Plex_Mono({
  variable: '--font-mono-loaded',
  display: 'swap',
  weight: ['400', '500', '600'],
  subsets: ['latin'],
});

export const metadata: Metadata = {
  title: 'Impeachment Intelligence Platform',
  description: 'Editorial-integrity-first knowledge platform for Philippine impeachment proceedings.',
};

export default function RootLayout({ children }: { children: ReactNode }) {
  return (
    <html lang="en" className={`${fontDisplay.variable} ${fontSans.variable} ${fontMono.variable}`}>
      <body className="bg-surface-base text-claim-fact font-sans antialiased">
        {/*
          CitationContext provider at the root (UX-DR9, AC-8). Defaults to null
          (no provenance resolved at the shell); leaf citation surfaces resolve
          and provide provenance where a source is available.
        */}
        <CitationProvider>{children}</CitationProvider>
      </body>
    </html>
  );
}
