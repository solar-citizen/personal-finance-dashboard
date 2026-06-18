'use client';

import { useGetExchangeRates } from '#src/_generated/api/pfd-components';
import FetchErrorMessage from '#src/components/common/FetchErrorMessage';
import { SkeletonList } from '#src/components/common/Skeleton';

const currencyPairsDisplayMap: Record<string, string> = {
  uahToUah: 'UAH/UAH',
  usdToUah: 'USD/UAH',
  eurToUah: 'EUR/UAH',
};

export default function ExchangeRates() {
  const { data, isLoading, error } = useGetExchangeRates({});

  return (
    <div
      className={
        'w-full py-1 px-4 bg-gray-100 dark:bg-gray-800 rounded flex items-center justify-center gap-6 text-xs'
      }
    >
      <h2 className={'font-bold text-gray-700 dark:text-gray-300'}>{'Exchange Rates:'}</h2>
      {isLoading && (
        <div className={'flex gap-4'}>
          <SkeletonList length={2} className={'h-4 w-20'} />
        </div>
      )}
      {error && <FetchErrorMessage message={'Failed to load exchange rates.'} />}
      {!isLoading && !error && data && (
        <div className={'flex gap-4'}>
          {Object.entries(data).map(([pair, value]) => (
            <div key={pair} className={'flex items-center gap-1'}>
              <span className={'text-gray-500 dark:text-gray-400 font-medium'}>
                {currencyPairsDisplayMap[pair] || pair}
              </span>
              <span className={'font-bold text-gray-900 dark:text-gray-100'}>
                {value.toFixed(2)}
              </span>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
