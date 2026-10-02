'use client';

import { accountTypeNames, bankNames } from '@pfd/shared';
import { useQueryClient } from '@tanstack/react-query';
import { useState } from 'react';
import { useTranslation } from 'react-i18next';

import { MonoBankAccountResponseDto } from '#src/_generated/api/pfd-types';
import QueryState from '#src/components/common/QueryState';
import { SkeletonList } from '#src/components/common/Skeleton';
import PrivatBankUploadModal from '#src/components/privatbank/PrivatBankUploadModal';

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
      {accounts.map(({ id, type, bank, name, currency, balance }) => {
        const currencyUpper = currency.toUpperCase();
        const displayName = name ?? (type ? accountTypeNames[type] : null) ?? type ?? 'Account';
        const bankName = bank ? (bankNames[bank] ?? bank) : 'Monobank';

        return (
          <li
            key={id}
            className={`flex justify-between items-center border-b last:border-b-0 ${rowClassName}`}
          >
            <div className={'flex items-center gap-2 min-w-0'}>
              <span
                className={
                  'text-xs px-1.5 py-0.5 rounded bg-muted text-muted-foreground font-medium shrink-0'
                }
              >
                {bankName}
              </span>
              <span className={'truncate'}>
                {displayName}
                {' ('}
                {currencyUpper}
                {')'}
              </span>
            </div>
            <span className={'font-mono shrink-0 ml-2'}>
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
  const queryClient = useQueryClient();
  const [isUploadOpen, setIsUploadOpen] = useState(false);

  const handleSuccess = () => {
    void queryClient.invalidateQueries();
  };

  return (
    <section className={'p-4 border rounded-lg shadow-sm max-h-80 h-full overflow-auto'}>
      <div className={'flex justify-between items-center mb-4'}>
        <h2 className={'text-xl font-bold'}>{t('dashboard.accountsTitle')}</h2>
        <button
          type={'button'}
          onClick={() => setIsUploadOpen(true)}
          className={
            'px-2.5 py-1 text-xs font-medium rounded border border-input bg-background hover:bg-accent hover:text-accent-foreground transition-colors'
          }
        >
          {t('privatbank.importButton')}
        </button>
      </div>
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
      <PrivatBankUploadModal
        isOpen={isUploadOpen}
        onClose={() => setIsUploadOpen(false)}
        onSuccess={handleSuccess}
      />
    </section>
  );
}
