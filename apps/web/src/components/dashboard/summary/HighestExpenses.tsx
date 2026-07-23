'use client';

import { type Period, periods } from '@pfd/shared';

import QueryState from '#src/components/common/QueryState';
import { SkeletonList } from '#src/components/common/Skeleton';

import { useExpensesByPeriod } from '../lib/useExpensesByPeriod';
import { periodLabels } from '../lib/utils';
import { rowClassName } from './AccountsSummary';

function isPeriod(value: string): value is Period {
  return periods.some(period => period === value);
}

type HighestExpensesProps = {
  globalPeriod: Period;
};

export default function HighestExpenses({ globalPeriod }: HighestExpensesProps) {
  const { period, setPeriod, data, isLoading, error } = useExpensesByPeriod(globalPeriod);

  const handlePeriodChange = ({ target: { value } }: React.ChangeEvent<HTMLSelectElement>) => {
    if (isPeriod(value)) {
      setPeriod(value);
    }
  };

  return (
    <section className={'p-4 border rounded-lg shadow-sm max-h-80 h-full overflow-auto'}>
      <div className={'flex justify-between items-center mb-4'}>
        <h2 className={'text-xl font-bold'}>{'Highest Expenses'}</h2>
        <select
          value={period}
          onChange={handlePeriodChange}
          className={'p-1 border rounded text-sm bg-input cursor-pointer'}
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
