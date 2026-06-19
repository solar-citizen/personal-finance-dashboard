'use client';

import { type Period, periods } from '@pfd/shared';
import { useState } from 'react';

import { useGetHighestExpenses } from '#src/_generated/api/pfd-components';
import QueryState from '#src/components/common/QueryState';
import { SkeletonList } from '#src/components/common/Skeleton';

import { rowClassName } from './AccountsSummary';

const periodLabels: Record<Period, string> = {
  day: 'Day',
  week: 'Week',
  month: 'Month',
  year: 'Year',
};

function isPeriod(value: string): value is Period {
  return periods.some(p => p === value);
}

export default function HighestExpenses() {
  const [period, setPeriod] = useState<Period>('month');
  const { data, isLoading, error } = useGetHighestExpenses({ queryParams: { period } });

  const handlePeriodChange = ({ target }: React.ChangeEvent<HTMLSelectElement>) => {
    const { value } = target;

    if (isPeriod(value)) {
      setPeriod(value);
    }
  };

  return (
    <section className={'p-4 border rounded-lg shadow-sm max-h-[360px] h-full overflow-auto'}>
      <div className={'flex justify-between items-center mb-4'}>
        <h2 className={'text-xl font-bold'}>{'Highest Expenses'}</h2>
        <select
          value={period}
          onChange={handlePeriodChange}
          className={'p-1 border rounded text-sm bg-input'}
        >
          {periods.map(value => (
            <option key={value} value={value}>
              {periodLabels[value]}
            </option>
          ))}
        </select>
      </div>
      <QueryState
        isLoading={isLoading}
        error={error}
        data={data}
        errorMessage={'Failed to load expenses.'}
        loadingFallback={
          <div className={'space-y-2'}>
            <SkeletonList length={6} className={`${rowClassName} w-full`} />
          </div>
        }
      >
        {expenses => (
          <ul className={'space-y-2'}>
            {expenses.map(({ category, amount, currency }) => {
              const { id, name, icon } = category;

              return (
                <li
                  key={id}
                  className={`flex justify-between items-center border-b last:border-b-0 ${rowClassName}`}
                >
                  <div className={'flex items-center gap-2'}>
                    <span className={'text-lg'}>{icon}</span>
                    <div className={'font-medium'}>{name}</div>
                  </div>
                  <div className={'font-mono font-medium'}>
                    {amount.toFixed(2)} {currency.toUpperCase()}
                  </div>
                </li>
              );
            })}
          </ul>
        )}
      </QueryState>
    </section>
  );
}
