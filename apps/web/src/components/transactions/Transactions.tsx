'use client';

import { useTranslation } from 'react-i18next';

import { useGetAccounts, useGetExchangeRates } from '#src/_generated/api/pfd-components';

import AccountAllocationBarChart from './charts/AccountAllocationBarChart';
import MonthlySpendingComparison from './charts/MonthlySpendingComparison';

export default function Transactions() {
  const { t } = useTranslation();
  const { data: accounts, isLoading: accountsLoading, error: accountsError } = useGetAccounts({});
  const { data: rates, isLoading: ratesLoading, error: ratesError } = useGetExchangeRates({});

  return (
    <div className={'p-6 space-y-6'}>
      <div className={'flex justify-between items-center'}>
        <h1 className={'text-3xl font-bold tracking-tight'}>{t('transactions.title')}</h1>
      </div>

      <div className={'grid grid-cols-1 lg:grid-cols-2 gap-6'}>
        <AccountAllocationBarChart
          accounts={accounts}
          accountsLoading={accountsLoading}
          accountsError={accountsError}
          rates={rates}
          ratesLoading={ratesLoading}
          ratesError={ratesError}
        />
        <MonthlySpendingComparison />
      </div>
    </div>
  );
}
