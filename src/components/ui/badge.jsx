import React from 'react';
import { cva } from 'class-variance-authority';
import { cn } from '../../lib/cn';

const badgeVariants = cva(
  'inline-flex items-center rounded-full border px-2.5 py-0.5 text-xs font-semibold leading-none transition-colors',
  {
    variants: {
      variant: {
        default: 'border-transparent bg-primary text-primary-foreground',
        secondary: 'border-cardBorder bg-bgSecondary text-text',
        outline: 'border-cardBorder bg-transparent text-text',
        success: 'border-transparent bg-success text-primary-foreground',
        warning: 'border-transparent bg-warning text-primary-foreground',
        info: 'border-transparent bg-info text-primary-foreground',
        destructive: 'border-transparent bg-destructive text-destructive-foreground',
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
