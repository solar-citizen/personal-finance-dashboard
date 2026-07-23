'use client';

import type { Period } from '@pfd/shared';
import { useState } from 'react';

import {
  useGetAccounts,
  useGetExchangeRates,
  useGetLatestTransactions,
} from '#src/_generated/api/pfd-components';
import PeriodSwitcher from '#src/components/dashboard/PeriodSwitcher';

import CashFlowNetWorthChart from './charts/CashFlowNetWorthChart';
import ExpenseCategoryDonut from './charts/ExpenseCategoryDonut';
import AccountsSummary from './summary/AccountsSummary';
import ExchangeRates from './summary/ExchangeRates';
import HighestExpenses from './summary/HighestExpenses';
import LatestTransactions from './summary/LatestTransactions';

export default function Dashboard() {
  const [globalPeriod, setGlobalPeriod] = useState<Period>('month');

  const { data: accounts, isLoading: accountsLoading, error: accountsError } = useGetAccounts({});
  const { data: rates, isLoading: ratesLoading, error: ratesError } = useGetExchangeRates({});
  const {
    data: transactions,
    isLoading: txLoading,
    error: txError,
  } = useGetLatestTransactions({ queryParams: { limit: 10000 } });

  const slicedTransactions = transactions?.slice(0, 10);

  return (
    <div className={'p-6 space-y-6'}>
      <ExchangeRates data={rates} isLoading={ratesLoading} error={ratesError} />

      <div className={'flex justify-between items-center'}>
        <h1 className={'text-3xl font-bold tracking-tight'}>{'Dashboard'}</h1>
        <PeriodSwitcher value={globalPeriod} onChange={setGlobalPeriod} />
      </div>

      {/* Charts */}
      <div className={'grid grid-cols-1 lg:grid-cols-2 gap-6'}>
        <CashFlowNetWorthChart
          globalPeriod={globalPeriod}
          data={transactions}
          isLoading={txLoading}
          error={txError}
        />

        <ExpenseCategoryDonut globalPeriod={globalPeriod} />
      </div>

      {/* Summary Cards & Lists */}
      <div className={'grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6'}>
        <AccountsSummary data={accounts} isLoading={accountsLoading} error={accountsError} />
        <HighestExpenses globalPeriod={globalPeriod} />
        <LatestTransactions data={slicedTransactions} isLoading={txLoading} error={txError} />
      </div>
    </div>
  );
}
