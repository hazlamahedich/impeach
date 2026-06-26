/**
 * <AnswerBlock> — the answer surface with silence, essence, and no-prediction
 * states (UX-DR18, UX-DR21).
 *
 * The default block carries a 3px primary left rule. `.Silence` renders a
 * sunken block when no sourced answer exists. `.Essence` carries the core IIP
 * verification sentence. `.NoPrediction` is a distinct variant that refuses to
 * extrapolate — IIP surfaces what is on record and lets the reader infer.
 *
 * @rules PD-1, STR-10, UX-DR18, UX-DR21
 */

import type { ReactNode } from 'react';

function AnswerBlockRoot({ children }: { children?: ReactNode }): ReactNode {
  return (
    <div
      data-testid="answer-block"
      className="rounded-md border-l-3 border-primary bg-surface-raised p-5"
    >
      {children}
    </div>
  );
}

function Silence(): ReactNode {
  return (
    <div
      data-testid="answer-block-silence"
      className="rounded-md border-l-3 border-muted-foreground bg-surface-sunken p-5"
    >
      <h3 className="font-display text-base text-claim-fact">No sourced answer found</h3>
      <p className="mt-1 font-sans text-sm text-muted-foreground">
        IIP only answers when a claim can be tied to a source you can open.
      </p>
    </div>
  );
}

function Essence({ children }: { children?: ReactNode }): ReactNode {
  return (
    <p
      data-testid="answer-block-essence"
      className="mt-2 text-xs italic text-muted-foreground"
    >
      {children}
    </p>
  );
}

function NoPrediction(): ReactNode {
  return (
    <div
      data-testid="answer-block-no-prediction"
      className="rounded-md border-l-3 border-accent bg-surface-sunken p-5"
    >
      <h3 className="font-display text-base text-claim-fact">IIP does not make predictions</h3>
      <p className="mt-1 font-sans text-sm text-muted-foreground">
        Here is what is on record: [placeholder for sourced statements]. Draw your own inference.
      </p>
    </div>
  );
}

export const AnswerBlock = Object.assign(AnswerBlockRoot, {
  Silence,
  Essence,
  NoPrediction,
});
