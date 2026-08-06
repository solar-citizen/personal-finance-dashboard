'use client';

import { useTranslation } from 'react-i18next';

import { TransactionResponseDto } from '#src/_generated/api/pfd-types';
import QueryState from '#src/components/common/QueryState';
import { SkeletonList } from '#src/components/common/Skeleton';

type Props = {
  data?: TransactionResponseDto[];
  isLoading: boolean;
  error: unknown;
};

export default function LatestTransactions({ data, isLoading, error }: Props) {
  const { t } = useTranslation();

  return (
    <section className={'p-4 border rounded-lg shadow-sm max-h-80 h-full overflow-auto'}>
      <h2 className={'text-xl font-bold mb-4'}>{t('dashboard.latestTransactions')}</h2>
      <QueryState
        isLoading={isLoading}
        error={error}
        data={data}
        errorMessage={t('dashboard.failedTransactions')}
        loadingFallback={
          <div className={'space-y-2'}>
            <SkeletonList length={5} className={'h-12 w-full'} />
          </div>
        }
      >
        {transactions => (
          <div className={'overflow-x-auto'}>
            <table className={'w-full text-left text-sm'}>
              <thead>
                <tr className={'border-b text-gray-500 font-medium'}>
                  <th className={'pb-2 font-medium'}>{t('dashboard.description')}</th>
                  <th className={'pb-2 text-right font-medium'}>{t('dashboard.amount')}</th>
                </tr>
              </thead>
              <tbody className={'divide-y'}>
                {transactions.map(({ id, description, category, amount, currencyCode }) => (
                  <tr key={id} className={'h-10'}>
                    <td className={'py-2'}>
                      <div className={'font-medium'}>{description}</div>
                      <div className={'text-xs text-gray-500'}>
                        {category?.name ?? 'No Category'}
                      </div>
                    </td>
                    <td className={'py-2 text-right font-mono font-medium'}>
                      {amount > 0 ? '+' : ''}
                      {amount.toFixed(2)} {currencyCode.toUpperCase()}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </QueryState>
    </section>
  );
}
