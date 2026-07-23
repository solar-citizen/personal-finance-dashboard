'use client';

import { Bar, BarChart, CartesianGrid, XAxis, YAxis } from 'recharts';

import { useGetHighestExpenses } from '#src/_generated/api/pfd-components';
import QueryState from '#src/components/common/QueryState';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '#src/components/ui/card';
import {
  type ChartConfig,
  ChartContainer,
  ChartTooltip,
  ChartTooltipContent,
} from '#src/components/ui/chart';

const chartConfig = {
  amount: {
    label: 'Spending',
    color: 'var(--color-accent, #D97757)',
  },
} satisfies ChartConfig;

export default function MonthlySpendingComparison() {
  const { data, isLoading, error } = useGetHighestExpenses({ queryParams: { period: 'month' } });

  const chartData = (data ?? []).slice(0, 6).map(item => ({
    category: item.category.name,
    amount: item.amount,
    currency: item.currency.toUpperCase(),
  }));

  const currencySymbol = chartData[0]?.currency ?? 'UAH';

  return (
    <Card>
      <CardHeader>
        <CardTitle>{'Monthly Spending Comparison'}</CardTitle>
        <CardDescription>{'Top spending categories for the current month'}</CardDescription>
      </CardHeader>
      <CardContent>
        <QueryState
          isLoading={isLoading}
          error={error}
          data={data}
          errorMessage={'Failed to load spending comparison.'}
          loadingFallback={<div className={'h-[280px] w-full animate-pulse bg-muted rounded-lg'} />}
        >
          {() => (
            <ChartContainer config={chartConfig} className={'aspect-auto h-[280px] w-full'}>
              <BarChart data={chartData} margin={{ top: 20, right: 20, left: 0, bottom: 20 }}>
                <CartesianGrid vertical={false} strokeDasharray={'3 3'} />

                <XAxis
                  dataKey={'category'}
                  tickLine={false}
                  axisLine={false}
                  tickMargin={8}
                  interval={0}
                  tick={{ fontSize: 11 }}
                />

                <YAxis tickLine={false} axisLine={false} tickMargin={8} />

                <ChartTooltip
                  cursor={false}
                  content={
                    <ChartTooltipContent
                      formatter={(value: unknown, name: unknown) => (
                        <div className={'flex justify-between gap-4 font-medium'}>
                          <span>{String(name)}</span>
                          <span className={'font-mono'}>
                            {Number(value).toLocaleString()} {currencySymbol}
                          </span>
                        </div>
                      )}
                    />
                  }
                />

                <Bar dataKey={'amount'} fill={'var(--color-accent)'} radius={[4, 4, 0, 0]} />
              </BarChart>
            </ChartContainer>
          )}
        </QueryState>
      </CardContent>
    </Card>
  );
}
