'use client';

import { accountTypeNames } from '@pfd/shared';

import { useGetAccounts } from '#src/_generated/api/pfd-components';
import { MonoBankAccountResponseDto } from '#src/_generated/api/pfd-types';
import FetchErrorMessage from '#src/components/common/FetchErrorMessage';
import { SkeletonList } from '#src/components/common/Skeleton';

type AccountsListProps = {
  accounts: MonoBankAccountResponseDto[] | undefined;
};

const rowClassName = 'h-10 p-2';

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
    <div className={'p-4 border rounded-lg shadow-sm min-h-[360px]'}>
      <h2 className={'text-xl font-bold mb-4'}>{'Accounts/Cards'}</h2>
      {isLoading && (
        <div className={'space-y-2'}>
          <SkeletonList length={6} className={`${rowClassName} w-full`} />
        </div>
      )}
      {error && <FetchErrorMessage message={'Failed to load accounts.'} />}
      {!isLoading && !error && <AccountsList accounts={data} />}
    </div>
  );
}
