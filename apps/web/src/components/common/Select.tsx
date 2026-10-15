import { ChevronDown } from 'lucide-react';
import React from 'react';

import { cn } from '#src/lib/utils';

type Props = React.SelectHTMLAttributes<HTMLSelectElement>;

function Select({ children, className, ...props }: Props) {
  return (
    <div className={cn('relative inline-block', className)}>
      <select
        className={cn(
          'w-full appearance-none border px-3 py-2 pr-10 rounded bg-background text-foreground cursor-pointer',
        )}
        {...props}
      >
        {children}
      </select>
      <div
        className={cn(
          'pointer-events-none absolute inset-y-0 right-0 flex items-center px-2.5 text-muted-foreground',
        )}
      >
        <ChevronDown className={'size-4'} />
      </div>
    </div>
  );
}

export default Select;
