'use client';

import type { Period } from '@pfd/shared';
import dayjs from 'dayjs';
import { Area, AreaChart, CartesianGrid, XAxis, YAxis } from 'recharts';

import type { TransactionResponseDto } from '#src/_generated/api/pfd-types';
import QueryState from '#src/components/common/QueryState';
import PeriodSwitcher from '#src/components/dashboard/PeriodSwitcher';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '#src/components/ui/card';
import {
  type ChartConfig,
  ChartContainer,
  ChartTooltip,
  ChartTooltipContent,
} from '#src/components/ui/chart';

import { useSyncedPeriod } from '../_lib/useSyncedPeriod';

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
  data?: TransactionResponseDto[];
  isLoading: boolean;
  error: unknown;
  globalPeriod: Period;
};

function getCutoff(period: Period) {
  const now = dayjs();

  switch (period) {
    case 'day':
      return now.subtract(1, 'day').startOf('day');
    case 'week':
      return now.subtract(7, 'day').startOf('day');
    case 'month':
      return now.subtract(30, 'day').startOf('day');
    case 'year':
      return now.startOf('year');
    case '5years':
      return now.subtract(5, 'year').startOf('day');
  }
}

export default function CashFlowNetWorthChart({ data, isLoading, error, globalPeriod }: Props) {
  const [period, setPeriod] = useSyncedPeriod(globalPeriod);

  const rawTransactions = data ?? [];
  const currentYear = dayjs().year();
  const timelineMap = new Map<
    string,
    { date: string; label: string; income: number; expense: number; netBalance: number }
  >();

  if (period === 'year') {
    for (let q = 1; q <= 4; q++) {
      const key = `${currentYear}-Q${q}`;
      timelineMap.set(key, {
        date: key,
        label: `${currentYear} Q${q}`,
        income: 0,
        expense: 0,
        netBalance: 0,
      });
    }
  } else if (period === '5years') {
    for (let i = 4; i >= 0; i--) {
      const y = currentYear - i;
      const key = String(y);
      timelineMap.set(key, {
        date: key,
        label: String(y),
        income: 0,
        expense: 0,
        netBalance: 0,
      });
    }
  }

  const sorted = [...rawTransactions].sort(
    (a, b) => dayjs(a.time).valueOf() - dayjs(b.time).valueOf(),
  );

  let initialCarryNet = 0;
  let runningNet = 0;

  sorted.forEach(({ time, amount }) => {
    const t = dayjs(time);
    let key: string;
    let label: string;

    if (period === '5years') {
      key = t.format('YYYY');
      label = t.format('YYYY');
    } else if (period === 'year') {
      const quarter = Math.ceil((t.month() + 1) / 3);
      key = `${t.format('YYYY')}-Q${quarter}`;
      label = `${t.format('YYYY')} Q${quarter}`;
    } else {
      key = t.format('YYYY-MM-DD');
      label = t.format('YYYY-MM-DD');
    }

    runningNet += amount;

    if (period === 'year' || period === '5years') {
      const existing = timelineMap.get(key);

      if (existing) {
        if (amount > 0) {
          existing.income += amount;
        } else {
          existing.expense += Math.abs(amount);
        }
        existing.netBalance = runningNet;
      } else {
        initialCarryNet = runningNet;
      }
    } else {
      let existing = timelineMap.get(key);

      if (!existing) {
        existing = {
          date: key,
          label,
          income: 0,
          expense: 0,
          netBalance: 0,
        };
        timelineMap.set(key, existing);
      }

      if (amount > 0) {
        existing.income += amount;
      } else {
        existing.expense += Math.abs(amount);
      }
      existing.netBalance = runningNet;
    }
  });

  let carryNet = initialCarryNet;
  const chartData = Array.from(timelineMap.entries())
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([, item]) => {
      if (item.netBalance === 0 && item.income === 0 && item.expense === 0) {
        item.netBalance = carryNet;
      } else {
        carryNet = item.netBalance;
      }

      return item;
    });

  const cutoff = getCutoff(period);
  const displayData =
    period === 'year' || period === '5years'
      ? chartData
      : chartData.filter(({ date }) => dayjs(date).valueOf() >= cutoff.valueOf());

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
              <AreaChart data={displayData} margin={{ top: 10, right: 10, left: 0, bottom: 0 }}>
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
