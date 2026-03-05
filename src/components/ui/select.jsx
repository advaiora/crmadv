import React from 'react';
import { ChevronDown } from 'lucide-react';
import { cn } from '../../lib/cn';

const Select = React.forwardRef(({ className, children, ...props }, ref) => (
  <div className="relative">
    <select
      ref={ref}
      className={cn(
        'flex h-10 w-full appearance-none rounded-md border border-cardBorder bg-card px-3 py-2 pr-9 text-sm text-text placeholder:text-textMuted focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-bg disabled:cursor-not-allowed disabled:opacity-60',
        className,
      )}
      {...props}
    >
      {children}
    </select>
    <ChevronDown className="pointer-events-none absolute right-3 top-1/2 h-4 w-4 -translate-y-1/2 text-textMuted" />
  </div>
));
Select.displayName = 'Select';

export { Select };
