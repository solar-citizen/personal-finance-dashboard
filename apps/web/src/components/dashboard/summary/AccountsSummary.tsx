'use client';

import { accountTypeNames } from '@pfd/shared';
import { useTranslation } from 'react-i18next';

import { MonoBankAccountResponseDto } from '#src/_generated/api/pfd-types';
import QueryState from '#src/components/common/QueryState';
import { SkeletonList } from '#src/components/common/Skeleton';

type AccountsListProps = {
  accounts: MonoBankAccountResponseDto[] | undefined;
};

export const rowClassName = 'h-10 p-2';

function AccountsList({ accounts }: AccountsListProps) {
  const { t } = useTranslation();

  if (!accounts || accounts.length === 0) {
    return <div>{t('dashboard.noAccounts')}</div>;
  }

  return (
    <ul className={'space-y-2'}>
      {accounts.map(({ id, type, currency, balance }) => {
        const currencyUpper = currency.toUpperCase();
        return (
          <li
            key={id}
            className={`flex justify-between items-center border-b last:border-b-0 ${rowClassName}`}
          >
            <span>
              {accountTypeNames[type] || type}
              {' ('} {currencyUpper} {')'}
            </span>
            <span className={'font-mono'}>
              {balance} {currencyUpper}
            </span>
          </li>
        );
      })}
    </ul>
  );
}

type Props = {
  data?: MonoBankAccountResponseDto[];
  isLoading: boolean;
  error: unknown;
};

export default function AccountsSummary({ data, isLoading, error }: Props) {
  const { t } = useTranslation();

  return (
    <section className={'p-4 border rounded-lg shadow-sm max-h-80 h-full overflow-auto'}>
      <h2 className={'text-xl font-bold mb-4'}>{t('dashboard.accountsTitle')}</h2>
      <QueryState
        isLoading={isLoading}
        error={error}
        data={data}
        errorMessage={t('dashboard.failedAccounts')}
        loadingFallback={
          <div className={'space-y-2'}>
            <SkeletonList length={6} className={`${rowClassName} w-full`} />
          </div>
        }
      >
        {accounts => <AccountsList accounts={accounts} />}
      </QueryState>
    </section>
  );
}
