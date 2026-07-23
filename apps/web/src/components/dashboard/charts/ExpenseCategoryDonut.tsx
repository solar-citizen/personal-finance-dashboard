'use client';

import type { Period } from '@pfd/shared';
import { Label, Pie, PieChart } from 'recharts';

import QueryState from '#src/components/common/QueryState';
import PeriodSwitcher from '#src/components/dashboard/PeriodSwitcher';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '#src/components/ui/card';
import {
  type ChartConfig,
  ChartContainer,
  ChartTooltip,
  ChartTooltipContent,
} from '#src/components/ui/chart';
import { ChartColors } from '#src/lib/chart-util';

import { useExpensesByPeriod } from '../_lib/useExpensesByPeriod';
import { periodLabels } from '../_lib/utils';

const colors = Object.values(ChartColors);

type ExpenseCategoryDonutProps = {
  globalPeriod: Period;
};

export default function ExpenseCategoryDonut({ globalPeriod }: ExpenseCategoryDonutProps) {
  const { period, setPeriod, data, isLoading, error } = useExpensesByPeriod(globalPeriod);

  const chartData = (data ?? []).map(({ category: { name }, amount, currency }, index) => ({
    name,
    amount,
    currency: currency.toUpperCase(),
    fill: colors[index % colors.length],
  }));

  const totalExpense = chartData.reduce((acc, { amount }) => acc + amount, 0);
  const currencySymbol = chartData[0]?.currency ?? 'UAH';

  const chartConfig = chartData.reduce<ChartConfig>((acc, { name }, index) => {
    acc[name] = {
      label: name,
      color: colors[index % colors.length],
    };
    return acc;
  }, {});

  return (
    <Card className={'flex flex-col'}>
      <CardHeader className={'items-center pb-0'}>
        <div className={'flex w-full justify-between items-center'}>
          <div>
            <CardTitle>{'Expense Breakdown'}</CardTitle>
            <CardDescription>{`Expenses by category for the selected ${periodLabels[period].toLowerCase()}`}</CardDescription>
          </div>
          <PeriodSwitcher value={period} onChange={setPeriod} />
        </div>
      </CardHeader>

      <CardContent className={'flex-1 pb-0'}>
        <QueryState
          isLoading={isLoading}
          error={error}
          data={data}
          errorMessage={'Failed to load expense breakdown.'}
          loadingFallback={<div className={'h-[250px] w-full animate-pulse bg-muted rounded-lg'} />}
        >
          {() => (
            <ChartContainer config={chartConfig} className={'mx-auto aspect-square max-h-[260px]'}>
              <PieChart>
                <ChartTooltip
                  cursor={false}
                  content={
                    <ChartTooltipContent
                      formatter={(value: unknown, name: unknown) => {
                        const amount = Number(value);
                        const percentage =
                          totalExpense > 0 ? ((amount / totalExpense) * 100).toFixed(1) : '0';
                        return (
                          <div className={'flex justify-between gap-4 font-medium'}>
                            <span>{String(name)}</span>
                            <span className={'font-mono'}>
                              {amount.toLocaleString()} {currencySymbol}
                              {' ('}
                              {percentage}
                              {'%)'}
                            </span>
                          </div>
                        );
                      }}
                    />
                  }
                />
                <Pie
                  data={chartData}
                  dataKey={'amount'}
                  nameKey={'name'}
                  innerRadius={65}
                  outerRadius={95}
                  strokeWidth={2}
                >
                  <Label
                    content={({ viewBox }) => {
                      if (viewBox && 'cx' in viewBox && 'cy' in viewBox) {
                        const { cx, cy } = viewBox;
                        return (
                          <text x={cx} y={cy} textAnchor={'middle'} dominantBaseline={'middle'}>
                            <tspan
                              x={cx}
                              y={(cy || 0) - 8}
                              className={'text-xl font-bold fill-foreground font-mono'}
                            >
                              {totalExpense > 1000
                                ? `${(totalExpense / 1000).toFixed(1)}k`
                                : totalExpense.toFixed(0)}
                            </tspan>
                            <tspan
                              x={cx}
                              y={(cy || 0) + 12}
                              className={'text-xs fill-muted-foreground'}
                            >
                              {currencySymbol} {'Total'}
                            </tspan>
                          </text>
                        );
                      }

                      return null;
                    }}
                  />
                </Pie>
              </PieChart>
            </ChartContainer>
          )}
        </QueryState>
      </CardContent>
    </Card>
  );
}
