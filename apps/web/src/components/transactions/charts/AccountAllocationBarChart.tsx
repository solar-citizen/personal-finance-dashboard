'use client';

import { accountTypeNames } from '@pfd/shared';
import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Bar, BarChart, CartesianGrid, XAxis, YAxis } from 'recharts';

import { MonoBankAccountResponseDto } from '#src/_generated/api/pfd-types';
import QueryState from '#src/components/common/QueryState';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '#src/components/ui/card';
import {
  type ChartConfig,
  ChartContainer,
  ChartTooltip,
  ChartTooltipContent,
} from '#src/components/ui/chart';

type AccountBarPayload = {
  name: string;
  rawBalance: number;
  rawCurrency: string;
};

function isAccountBarPayload(value: unknown): value is AccountBarPayload {
  return (
    typeof value === 'object' &&
    value !== null &&
    'name' in value &&
    'rawBalance' in value &&
    'rawCurrency' in value
  );
}

type CurrencyType = 'UAH' | 'USD' | 'EUR';
const currencyOptions: CurrencyType[] = ['UAH', 'USD', 'EUR'];

type Props = {
  accounts?: MonoBankAccountResponseDto[];
  accountsLoading: boolean;
  accountsError: unknown;
  rates?: Record<string, number>;
  ratesLoading: boolean;
  ratesError: unknown;
};

export default function AccountAllocationBarChart({
  accounts,
  accountsLoading,
  accountsError,
  rates,
  ratesLoading,
  ratesError,
}: Props) {
  const [baseCurrency, setBaseCurrency] = useState<CurrencyType>('UAH');
  const { t } = useTranslation();

  const chartConfig = {
    normalizedBalance: {
      label: t('transactions.normalized'),
      color: 'var(--color-primary, #244A3F)',
    },
  } satisfies ChartConfig;

  const isLoading = accountsLoading || ratesLoading;
  const error = accountsError ?? ratesError;

  const usdToUah = rates?.usdToUah ?? 41.5;
  const eurToUah = rates?.eurToUah ?? 44.2;

  const convertToCurrency = (amount: number, fromCurrency: string, toCurrency: CurrencyType) => {
    let inUah = amount;
    const lowerFrom = fromCurrency.toLowerCase();

    if (lowerFrom === 'usd' || lowerFrom === '840') {
      inUah = amount * usdToUah;
    } else if (lowerFrom === 'eur' || lowerFrom === '978') {
      inUah = amount * eurToUah;
    }

    if (toCurrency === 'UAH') {
      return inUah;
    }

    if (toCurrency === 'USD') {
      return inUah / usdToUah;
    }

    return inUah / eurToUah;
  };

  const chartData = (accounts ?? []).map(acc => {
    const rawBal = Number(acc.balance);
    const currency = acc.currency.toUpperCase();
    const normalized = convertToCurrency(rawBal, currency, baseCurrency);

    return {
      name: `${accountTypeNames[acc.type] || acc.type} (${currency})`,
      rawBalance: rawBal,
      rawCurrency: currency,
      normalizedBalance: Number(normalized.toFixed(2)),
    };
  });

  return (
    <Card>
      <CardHeader>
        <div className={'flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4'}>
          <div>
            <CardTitle>{t('transactions.accountAllocationTitle')}</CardTitle>
            <CardDescription>{t('transactions.accountAllocationDesc')}</CardDescription>
          </div>
          <div className={'flex gap-1 bg-secondary p-1 rounded-lg text-xs self-start'}>
            {currencyOptions.map(currency => (
              <button
                key={currency}
                onClick={() => setBaseCurrency(currency)}
                className={`px-3 py-1 rounded-md font-medium transition-colors ${
                  baseCurrency === currency
                    ? 'bg-primary text-primary-foreground shadow-sm'
                    : 'text-muted-foreground hover:text-foreground'
                }`}
              >
                {currency}
              </button>
            ))}
          </div>
        </div>
      </CardHeader>
      <CardContent>
        <QueryState
          isLoading={isLoading}
          error={error}
          data={accounts}
          errorMessage={t('transactions.failedAllocation')}
          loadingFallback={<div className={'h-[280px] w-full animate-pulse bg-muted rounded-lg'} />}
        >
          {() => (
            <ChartContainer config={chartConfig} className={'aspect-auto h-[280px] w-full'}>
              <BarChart
                data={chartData}
                layout={'vertical'}
                margin={{ top: 5, right: 30, left: 40, bottom: 5 }}
              >
                <CartesianGrid horizontal={false} strokeDasharray={'3 3'} />
                <XAxis type={'number'} tickLine={false} axisLine={false} />
                <YAxis
                  dataKey={'name'}
                  type={'category'}
                  tickLine={false}
                  axisLine={false}
                  width={120}
                  tick={{ fontSize: 12 }}
                />
                <ChartTooltip
                  cursor={false}
                  content={
                    <ChartTooltipContent
                      formatter={(
                        value: unknown,
                        _name: unknown,
                        _item: unknown,
                        _index: number,
                        rawPayload: unknown,
                      ) => {
                        if (!isAccountBarPayload(rawPayload)) {
                          return null;
                        }

                        const { name, rawBalance, rawCurrency } = rawPayload;

                        return (
                          <div className={'flex flex-col gap-1 font-medium'}>
                            <span>{name}</span>
                            <span className={'font-mono text-primary'}>
                              {t('transactions.normalized')}
                              {': '}
                              {Number(value).toLocaleString()} {baseCurrency}
                            </span>
                            <span className={'text-muted-foreground text-xs'}>
                              {t('transactions.original')}
                              {': '}
                              {rawBalance.toLocaleString()} {rawCurrency}
                            </span>
                          </div>
                        );
                      }}
                    />
                  }
                />
                <Bar dataKey={'normalizedBalance'} fill={'var(--color-primary)'} radius={4} />
              </BarChart>
            </ChartContainer>
          )}
        </QueryState>
      </CardContent>
    </Card>
  );
}
