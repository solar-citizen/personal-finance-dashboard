'use client';

import { type Period, periods } from '@pfd/shared';
import { useTranslation } from 'react-i18next';

import QueryState from '#src/components/common/QueryState';
import { SkeletonList } from '#src/components/common/Skeleton';

import { useExpensesByPeriod } from '../lib/useExpensesByPeriod';
import { rowClassName } from './AccountsSummary';

function isPeriod(value: string): value is Period {
  return periods.some(period => period === value);
}

const periodKeys: Record<Period, string> = {
  day: 'periods.day',
  week: 'periods.week',
  month: 'periods.month',
  year: 'periods.year',
  '5years': 'periods.fiveYears',
};

type HighestExpensesProps = {
  globalPeriod: Period;
};

export default function HighestExpenses({ globalPeriod }: HighestExpensesProps) {
  const { period, setPeriod, data, isLoading, error } = useExpensesByPeriod(globalPeriod);
  const { t } = useTranslation();

  const handlePeriodChange = ({ target: { value } }: React.ChangeEvent<HTMLSelectElement>) => {
    if (isPeriod(value)) {
      setPeriod(value);
    }
  };

  return (
    <section className={'p-4 border rounded-lg shadow-sm max-h-80 h-full overflow-auto'}>
      <div className={'flex justify-between items-center mb-4'}>
        <h2 className={'text-xl font-bold'}>{t('dashboard.highestExpenses')}</h2>
        <select
          value={period}
          onChange={handlePeriodChange}
          className={'p-1 border rounded text-sm bg-input cursor-pointer'}
        >
          {periods.map(value => (
            <option key={value} value={value}>
              {t(periodKeys[value])}
            </option>
          ))}
        </select>
      </div>
      <QueryState
        isLoading={isLoading}
        error={error}
        data={data}
        errorMessage={t('dashboard.failedExpenses')}
        loadingFallback={
          <div className={'space-y-2'}>
            <SkeletonList length={6} className={`${rowClassName} w-full`} />
          </div>
        }
      >
        {expenses => (
          <ul className={'space-y-2'}>
            {expenses.map(({ category, amount, currency }) => (
              <li
                key={category.id}
                className={`flex justify-between items-center border-b last:border-b-0 ${rowClassName}`}
              >
                <div className={'flex items-center gap-2'}>
                  <span className={'text-lg'}>{category.icon}</span>
                  <div className={'font-medium'}>{category.name}</div>
                </div>
                <div className={'font-mono font-medium'}>
                  {amount.toFixed(2)} {currency.toUpperCase()}
                </div>
              </li>
            ))}
          </ul>
        )}
      </QueryState>
    </section>
  );
}
