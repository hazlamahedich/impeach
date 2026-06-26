/**
 * Button — shadcn-style button primitive (Tailwind v4).
 */

import type { ButtonHTMLAttributes, ReactNode } from 'react';

type Variant = 'default' | 'ghost' | 'outline';
type Size = 'default' | 'sm' | 'icon';

const variants: Record<Variant, string> = {
  default: 'bg-primary text-primary-foreground hover:opacity-90',
  ghost: 'hover:bg-muted hover:text-claim-fact',
  outline: 'border border-border bg-transparent hover:bg-muted',
};

const sizes: Record<Size, string> = {
  default: 'h-9 px-4 py-2 text-sm',
  sm: 'h-8 px-3 text-xs',
  icon: 'h-9 w-9',
};

export interface ButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: Variant;
  size?: Size;
  children?: ReactNode;
}

export function Button({ variant = 'default', size = 'default', className, children, ...rest }: ButtonProps): ReactNode {
  return (
    <button
      className={`inline-flex items-center justify-center gap-2 whitespace-nowrap rounded-md font-medium transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[--focus-ring-trust] disabled:pointer-events-none disabled:opacity-50 ${variants[variant]} ${sizes[size]} ${className ?? ''}`}
      {...rest}
    >
      {children}
    </button>
  );
}
