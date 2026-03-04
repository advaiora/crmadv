import React from 'react';
import { cn } from '../../lib/cn';

const Skeleton = React.forwardRef(({ className, ...props }, ref) => (
  <div
    ref={ref}
    className={cn('animate-pulse rounded-md bg-[var(--muted)]', className)}
    {...props}
  />
));

Skeleton.displayName = 'Skeleton';

export { Skeleton };
