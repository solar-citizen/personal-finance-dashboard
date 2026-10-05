'use client';

import { type Period, periods } from '@pfd/shared';
import { useTranslation } from 'react-i18next';

import SegmentedControl, { SegmentedButton } from '../common/SegmentedControl';

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
    <SegmentedControl>
      {periods.map(p => (
        <SegmentedButton key={p} active={value === p} onClick={() => onChange(p)}>
          {t(periodKeys[p])}
        </SegmentedButton>
      ))}
    </SegmentedControl>
  );
}
