/**
 * <SourceVerbTag> — preserved source-verb tag (UX-DR12, EI-3).
 *
 * Renders the extraction verb verbatim in UPPERCASE, resolved against the
 * `lib/citation/source-verbs.ts` registry. An unregistered verb is rendered in
 * a fallback treatment and surfaced via `console.warn` so it can never silently
 * impersonate a primary source. Risk-variant verbs carry defamation-risk styling.
 *
 * @rules EI-3, STR-10
 */

import type { ReactNode } from 'react';
import { getSourceVerb } from '@/lib/citation/source-verbs';

export interface SourceVerbTagProps {
  verb: string;
}

export function SourceVerbTag({ verb }: SourceVerbTagProps): ReactNode {
  const config = getSourceVerb(verb);

  if (config === undefined) {
    // An unregistered verb must never pass as a primary source. Warn loudly so
    // the gap is visible during dev; render a muted fallback treatment.
    console.warn(`Unregistered source verb rendered: "${verb}"`);
    return (
      <span
        data-testid="source-verb-tag"
        className="border-none bg-transparent text-xs uppercase tracking-wide text-muted-foreground"
      >
        {verb.toUpperCase()}
      </span>
    );
  }

  const tone = config.variant === 'risk' ? 'text-defamation-risk-caution' : 'text-primary';
  return (
    <span
      data-testid="source-verb-tag"
      className={`border-none bg-transparent font-label-caps text-xs uppercase tracking-wide ${tone}`}
    >
      {verb.toUpperCase()}
    </span>
  );
}
