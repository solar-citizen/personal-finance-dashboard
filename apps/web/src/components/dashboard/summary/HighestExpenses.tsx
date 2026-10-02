import type { Period } from '@pfd/shared';
import { useTranslation } from 'react-i18next';

import QueryState from '#src/components/common/QueryState';
import { SkeletonList } from '#src/components/common/Skeleton';
import PeriodSwitcher from '#src/components/dashboard/PeriodSwitcher';

import { useExpensesByPeriod } from '../lib/useExpensesByPeriod';
import { rowClassName } from './AccountsSummary';

type HighestExpensesProps = {
  globalPeriod: Period;
};

export default function HighestExpenses({ globalPeriod }: HighestExpensesProps) {
  const { period, setPeriod, data, isLoading, error } = useExpensesByPeriod(globalPeriod);
  const { t } = useTranslation();

  return (
    <section className={'p-4 border rounded-lg shadow-sm max-h-80 h-full overflow-auto'}>
      <div className={'flex justify-between items-center mb-4'}>
        <h2 className={'text-xl font-bold'}>{t('dashboard.highestExpenses')}</h2>
        <PeriodSwitcher value={period} onChange={setPeriod} />
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
