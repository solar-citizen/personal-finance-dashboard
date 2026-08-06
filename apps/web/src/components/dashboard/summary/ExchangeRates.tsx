'use client';

import { useTranslation } from 'react-i18next';

import QueryState from '#src/components/common/QueryState';
import { SkeletonList } from '#src/components/common/Skeleton';

const currencyPairLabels: Record<string, string> = {
  usdToUah: 'USD/UAH',
  eurToUah: 'EUR/UAH',
};

type Props = {
  data?: Record<string, number>;
  isLoading: boolean;
  error: unknown;
};

export default function ExchangeRates({ data, isLoading, error }: Props) {
  const { t } = useTranslation();

  return (
    <section
      className={
        'w-full py-1 px-4 bg-gray-100 dark:bg-gray-800 rounded flex items-center justify-center gap-6 text-xs'
      }
    >
      <h2 className={'font-bold text-gray-700 dark:text-gray-300'}>
        {t('dashboard.exchangeRates')}
      </h2>
      <QueryState
        isLoading={isLoading}
        error={error}
        data={data}
        errorMessage={t('dashboard.failedExchangeRates')}
        loadingFallback={
          <div className={'flex gap-4'}>
            <SkeletonList length={2} className={'h-4 w-20'} />
          </div>
        }
      >
        {rates => (
          <div className={'flex gap-4'}>
            {Object.entries(rates).map(([pair, value]) => (
              <div key={pair} className={'flex items-center gap-1'}>
                <span className={'text-gray-500 dark:text-gray-400 font-medium'}>
                  {currencyPairLabels[pair] || pair}
                </span>
                <span className={'font-bold text-gray-900 dark:text-gray-100'}>
                  {value.toFixed(2)}
                </span>
              </div>
            ))}
          </div>
        )}
      </QueryState>
    </section>
  );
}
