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
      className={'w-full py-1 px-4 bg-card rounded flex items-center justify-center gap-6 text-xs'}
    >
      <h2 className={'font-bold text-muted-foreground'}>{t('dashboard.exchangeRates')}</h2>
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
                <span className={'text-muted-foreground font-medium'}>
                  {currencyPairLabels[pair] || pair}
                </span>
                <span className={'font-bold text-foreground'}>{value.toFixed(2)}</span>
              </div>
            ))}
          </div>
        )}
      </QueryState>
    </section>
  );
}
