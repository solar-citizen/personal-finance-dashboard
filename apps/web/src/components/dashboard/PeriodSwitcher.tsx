'use client';

import { type Period, periods } from '@pfd/shared';
import { useTranslation } from 'react-i18next';

type PeriodSwitcherProps = {
  value: Period;
  onChange: (period: Period) => void;
};

const periodKeys: Record<Period, string> = {
  day: 'periods.day',
  week: 'periods.week',
  month: 'periods.month',
  year: 'periods.year',
  '5years': 'periods.fiveYears',
};

export default function PeriodSwitcher({ value, onChange }: PeriodSwitcherProps) {
  const { t } = useTranslation();

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
          {t(periodKeys[p])}
        </button>
      ))}
    </div>
  );
}
