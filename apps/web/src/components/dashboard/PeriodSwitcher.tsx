'use client';

import { type Period, periods } from '@pfd/shared';
import { useTranslation } from 'react-i18next';
import { tv } from 'tailwind-variants';

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

const periodSwitcher = tv({
  slots: {
    root: 'flex gap-1 bg-secondary p-1 rounded-lg text-xs',
    button: 'px-2.5 py-1 rounded-md font-medium transition-colors cursor-pointer',
  },
  variants: {
    active: {
      true: {
        button: 'bg-primary text-primary-foreground shadow-sm',
      },
      false: {
        button: 'text-muted-foreground hover:text-foreground',
      },
    },
  },
  defaultVariants: {
    active: false,
  },
});

export default function PeriodSwitcher({ value, onChange }: PeriodSwitcherProps) {
  const { t } = useTranslation();
  const { root, button } = periodSwitcher();

  return (
    <div className={root()}>
      {periods.map(p => (
        <button key={p} onClick={() => onChange(p)} className={button({ active: value === p })}>
          {t(periodKeys[p])}
        </button>
      ))}
    </div>
  );
}
