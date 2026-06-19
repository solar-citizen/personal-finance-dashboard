'use client';

import { accountTypeNames } from '@pfd/shared';

import { useGetAccounts } from '#src/_generated/api/pfd-components';
import { MonoBankAccountResponseDto } from '#src/_generated/api/pfd-types';
import QueryState from '#src/components/common/QueryState';
import { SkeletonList } from '#src/components/common/Skeleton';

type AccountsListProps = {
  accounts: MonoBankAccountResponseDto[] | undefined;
};

export const rowClassName = 'h-10 p-2';

function AccountsList({ accounts }: AccountsListProps) {
  if (!accounts || accounts.length === 0) {
    return <div>{'No accounts found.'}</div>;
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

export default function AccountsSummary() {
  const { data, isLoading, error } = useGetAccounts({});

  return (
    <section className={'p-4 border rounded-lg shadow-sm max-h-[360px] h-full overflow-auto'}>
      <h2 className={'text-xl font-bold mb-4'}>{'Accounts/Cards'}</h2>
      <QueryState
        isLoading={isLoading}
        error={error}
        data={data}
        errorMessage={'Failed to load accounts.'}
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
