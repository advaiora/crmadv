import React from 'react';
import { cva } from 'class-variance-authority';
import { cn } from '../../lib/cn';

const badgeVariants = cva(
  'inline-flex items-center rounded-full border px-2.5 py-0.5 text-xs font-semibold leading-none transition-colors',
  {
    variants: {
      variant: {
        default: 'border-transparent bg-[var(--primary)] text-[var(--primary-foreground)]',
        secondary: 'border-[var(--border)] bg-[var(--muted)] text-[var(--foreground)]',
        outline: 'border-[var(--border)] bg-transparent text-[var(--foreground)]',
        success: 'border-transparent bg-[var(--success)] text-white',
        warning: 'border-transparent bg-[var(--warning)] text-white',
        info: 'border-transparent bg-[var(--info)] text-white',
        destructive: 'border-transparent bg-[var(--destructive)] text-[var(--destructive-foreground)]',
      },
    },
    defaultVariants: {
      variant: 'default',
    },
  },
);

function Badge({ className, variant, ...props }) {
  return <div className={cn(badgeVariants({ variant }), className)} {...props} />;
}

export { Badge, badgeVariants };
