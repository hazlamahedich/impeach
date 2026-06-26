/**
 * <Citation> — the editorial-integrity citation compound primitive (UX-DR9).
 *
 * This is NOT a shadcn atom: it encodes the citation-or-silence invariant at
 * the component boundary (AC-2, STR-8). It renders `<Citation.Empty>` when no
 * provenance is resolved and promotes to `<Citation.Chip>` only when provenance
 * resolves. A chip that claims provenance but cannot link degrades to a
 * non-interactive stub rather than impersonating a real citation.
 *
 * Composition direction: components/iip/* composes components/ui/*, NEVER the
 * reverse (STR-8). Types come from @iip/contracts — no local type definitions.
 *
 * @rules AC-2, AC-4, STR-8, STR-10
 * @adr ADR-001, ADR-010
 */

'use client';

import { useEffect, useRef, useState } from 'react';
import type { MouseEvent as ReactMouseEvent, ReactNode } from 'react';
import type { CitationProvenance } from '@iip/contracts';
import { TrustBadge } from '@/components/iip/trust-badge';
import { SourceVerbTag } from '@/components/iip/source-verb-tag';
import { useCitation } from './citation-provider';
import type { TrustTier } from '@/components/iip/trust-badge';

export { CitationContext, CitationProvider, useCitation } from './citation-provider';

function ariaLabelFor(p: CitationProvenance): string {
  return `Source: ${p.sourceVerb} ${p.sourceTitle} (${p.sourceTier})`;
}

/** <Citation.Empty> — muted, greyed-out chip shown when no provenance resolves. */
function Empty(): ReactNode {
  return (
    <span
      data-testid="citation-empty"
      role="img"
      aria-label="No source"
      className="inline-flex items-center gap-1 rounded-sm bg-surface-sunken px-2 py-0.5 text-xs text-muted-foreground"
    >
      No source
    </span>
  );
}

/** <Citation.Modal> — stubbed detail surface (UX-DR9). */
function Modal({ onClose }: { onClose: () => void }): ReactNode {
  const provenance = useCitation();
  const titleRef = useRef<HTMLHeadingElement>(null);
  const panelRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    titleRef.current?.focus();
  }, []);

  useEffect(() => {
    const onKey = (e: globalThis.KeyboardEvent): void => {
      if (e.key === 'Escape') {
        onClose();
        return;
      }
      if (e.key === 'Tab') {
        // Focus trap: keep Tab cycling inside the modal panel.
        const panel = panelRef.current;
        if (panel === null) return;
        const focusable = Array.from(
          panel.querySelectorAll<HTMLElement>(
            'a[href], button, textarea, input[type="text"], input[type="radio"], input[type="checkbox"], select, [tabindex]:not([tabindex="-1"])',
          ),
        ).filter((el) => !el.hasAttribute('disabled') && el.tabIndex >= 0);
        if (focusable.length === 0) return;
        const first = focusable[0]!;
        const last = focusable[focusable.length - 1]!;
        if (e.shiftKey && document.activeElement === first) {
          e.preventDefault();
          last.focus();
        } else if (!e.shiftKey && document.activeElement === last) {
          e.preventDefault();
          first.focus();
        }
      }
    };
    document.addEventListener('keydown', onKey);
    return () => document.removeEventListener('keydown', onKey);
  }, [onClose]);

  if (provenance === null) {
    return null;
  }

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-labelledby="citation-modal-title"
      data-testid="citation-modal"
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4"
      onClick={(e: ReactMouseEvent<HTMLDivElement>) => {
        // Backdrop click dismisses the modal.
        if (e.target === e.currentTarget) {
          onClose();
        }
      }}
    >
      <div
        ref={panelRef}
        className="w-full max-w-lg rounded-md border border-border bg-surface-raised p-5 shadow-lg"
      >
        <div className="flex items-start justify-between gap-4">
          <h2
            id="citation-modal-title"
            ref={titleRef}
            tabIndex={-1}
            className="font-display text-lg text-claim-fact outline-none"
          >
            {provenance.sourceTitle}
          </h2>
          <button
            type="button"
            onClick={onClose}
            aria-label="Close citation details"
            className="rounded-sm text-muted-foreground hover:text-claim-fact"
          >
            Close
          </button>
        </div>
        <div className="mt-3 flex flex-wrap items-center gap-2">
          <TrustBadge tier={provenance.sourceTier as TrustTier} sourceCount={1} />
          <SourceVerbTag verb={provenance.sourceVerb} />
        </div>
        <p className="mt-4 font-mono text-sm text-muted-foreground">
          Passage text loads from document store
        </p>
        <div className="mt-5">
          <a
            data-testid="citation-modal-view-doc"
            aria-disabled="true"
            className="pointer-events-none cursor-not-allowed text-sm text-muted-foreground underline decoration-dotted"
          >
            View full document
          </a>
        </div>
      </div>
    </div>
  );
}

/** <Citation.Chip> — the resolved citation affordance (UX-DR9, AC-2 boundary). */
function Chip(): ReactNode {
  const provenance = useCitation();
  const [open, setOpen] = useState(false);
  const chipRef = useRef<HTMLAnchorElement>(null);

  if (provenance === null) {
    return <Empty />;
  }

  const baseLabel = ariaLabelFor(provenance);

  // Edge case (UX-DR9): provenance resolved but no linkable url — degrade to a
  // non-interactive chip. A citation that claims provenance but cannot link to
  // it is worse than no citation, so it must be visibly distinct, not a link.
  if (!provenance.url) {
    return (
      <span
        data-testid="citation-chip-no-url"
        aria-label={`${baseLabel} (link unavailable)`}
        className="inline-flex items-center gap-1 rounded-sm border border-dashed border-muted-foreground px-2 py-0.5 text-xs text-muted-foreground"
      >
        <SourceVerbTag verb={provenance.sourceVerb} />
        <span>{provenance.sourceTitle}</span>
      </span>
    );
  }

  return (
    <>
      <a
        ref={chipRef}
        role="link"
        href={provenance.url}
        target="_blank"
        rel="noopener noreferrer"
        data-testid="citation-chip"
        aria-label={`${baseLabel} — opens citation details`}
        aria-haspopup="dialog"
        onClick={(e: ReactMouseEvent<HTMLAnchorElement>) => {
          e.preventDefault();
          setOpen(true);
        }}
        className="inline-flex items-center gap-1 rounded-sm bg-citation-link-default px-2 py-0.5 text-xs text-surface-raised hover:bg-citation-link-hover"
      >
        <SourceVerbTag verb={provenance.sourceVerb} />
        <span>{provenance.sourceTitle}</span>
      </a>
      {open ? (
        <Modal
          onClose={() => {
            setOpen(false);
            chipRef.current?.focus();
          }}
        />
      ) : null}
    </>
  );
}

/** <Citation> — auto-renders Empty or Chip based on resolved provenance. */
function CitationRoot(): ReactNode {
  const provenance = useCitation();
  if (provenance === null) {
    return <Empty />;
  }
  return <Chip />;
}

export const Citation = Object.assign(CitationRoot, {
  Empty,
  Chip,
  Modal,
});
