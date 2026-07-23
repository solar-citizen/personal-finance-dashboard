'use client';

import type { Period } from '@pfd/shared';
import dayjs from 'dayjs';
import { Area, AreaChart, CartesianGrid, XAxis, YAxis } from 'recharts';

import QueryState from '#src/components/common/QueryState';
import PeriodSwitcher from '#src/components/dashboard/PeriodSwitcher';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '#src/components/ui/card';
import {
  type ChartConfig,
  ChartContainer,
  ChartTooltip,
  ChartTooltipContent,
} from '#src/components/ui/chart';

import { useCashFlowByPeriod } from '../lib/useCashFlowByPeriod';

const chartConfig = {
  income: {
    label: 'Income',
    color: 'var(--color-primary, #244A3F)',
  },
  expense: {
    label: 'Expenses',
    color: 'var(--color-accent, #D97757)',
  },
  netBalance: {
    label: 'Net Balance',
    color: 'var(--color-ring, #3B82F6)',
  },
} satisfies ChartConfig;

type Props = {
  globalPeriod: Period;
};

export default function CashFlowNetWorthChart({ globalPeriod }: Props) {
  const { period, setPeriod, data, isLoading, error } = useCashFlowByPeriod(globalPeriod);
  return (
    <Card>
      <CardHeader>
        <div className={'flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4'}>
          <div>
            <CardTitle>{'Cash Flow & Net Worth Trend'}</CardTitle>
            <CardDescription>{'Track income, expenses, and net balance over time'}</CardDescription>
          </div>
          <PeriodSwitcher value={period} onChange={setPeriod} />
        </div>
      </CardHeader>
      <CardContent>
        <QueryState
          isLoading={isLoading}
          error={error}
          data={data}
          errorMessage={'Failed to load cash flow trends.'}
          loadingFallback={<div className={'h-[300px] w-full animate-pulse bg-muted rounded-lg'} />}
        >
          {() => (
            <ChartContainer config={chartConfig} className={'aspect-auto h-[300px] w-full'}>
              <AreaChart data={data} margin={{ top: 10, right: 10, left: 0, bottom: 0 }}>
                <defs>
                  <linearGradient id={'fillIncome'} x1={'0'} y1={'0'} x2={'0'} y2={'1'}>
                    <stop offset={'5%'} stopColor={'var(--color-income)'} stopOpacity={0.8} />
                    <stop offset={'95%'} stopColor={'var(--color-income)'} stopOpacity={0.1} />
                  </linearGradient>

                  <linearGradient id={'fillExpense'} x1={'0'} y1={'0'} x2={'0'} y2={'1'}>
                    <stop offset={'5%'} stopColor={'var(--color-expense)'} stopOpacity={0.8} />
                    <stop offset={'95%'} stopColor={'var(--color-expense)'} stopOpacity={0.1} />
                  </linearGradient>
                </defs>

                <CartesianGrid vertical={false} strokeDasharray={'3 3'} />

                <XAxis
                  dataKey={'date'}
                  tickLine={false}
                  axisLine={false}
                  fontSize={14}
                  tickMargin={8}
                  minTickGap={32}
                  tickFormatter={(value: unknown) => {
                    const str = String(value);

                    if (period === '5years') {
                      return str;
                    }

                    if (period === 'year') {
                      return str.replace('-', ' ');
                    }

                    return dayjs(str).format('MMM D');
                  }}
                />

                <YAxis tickLine={false} axisLine={false} tickMargin={4} fontSize={12} />

                <ChartTooltip
                  cursor={false}
                  content={
                    <ChartTooltipContent
                      labelFormatter={(value: unknown) => {
                        if (typeof value !== 'string' && typeof value !== 'number') {
                          return '';
                        }

                        const str = String(value);

                        if (period === '5years') {
                          return `Year ${str}`;
                        }

                        if (period === 'year') {
                          return str.replace('-', ' ');
                        }

                        return dayjs(str).format('MMMM D, YYYY');
                      }}
                      indicator={'dot'}
                    />
                  }
                />

                <Area
                  type={'monotone'}
                  dataKey={'income'}
                  stroke={'var(--color-income)'}
                  fillOpacity={1}
                  fill={'url(#fillIncome)'}
                  stackId={'a'}
                />

                <Area
                  type={'monotone'}
                  dataKey={'expense'}
                  stroke={'var(--color-expense)'}
                  fillOpacity={1}
                  fill={'url(#fillExpense)'}
                  stackId={'b'}
                />
              </AreaChart>
            </ChartContainer>
          )}
        </QueryState>
      </CardContent>
    </Card>
  );
}
