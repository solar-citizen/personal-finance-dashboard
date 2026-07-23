'use client';

import { type Period, periods } from '@pfd/shared';

import { periodLabels } from './_lib/utils';

type PeriodSwitcherProps = {
  value: Period;
  onChange: (period: Period) => void;
};

export default function PeriodSwitcher({ value, onChange }: PeriodSwitcherProps) {
  return (
    <div className={'flex gap-1 bg-secondary p-1 rounded-lg text-xs'}>
      {periods.map(p => (
        <button
          key={p}
          onClick={() => onChange(p)}
          className={`px-2.5 py-1 rounded-md font-medium transition-colors ${
            value === p
              ? 'bg-primary text-primary-foreground shadow-sm'
              : 'text-muted-foreground hover:text-foreground'
          }`}
        >
          {periodLabels[p]}
        </button>
      ))}
    </div>
  );
}
