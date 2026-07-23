import type { Period } from '@pfd/shared';

import { useGetHighestExpenses } from '#src/_generated/api/pfd-components';

import { useSyncedPeriod } from './useSyncedPeriod';

export function useExpensesByPeriod(globalPeriod: Period) {
  const [period, setPeriod] = useSyncedPeriod(globalPeriod);
  return { period, setPeriod, ...useGetHighestExpenses({ queryParams: { period } }) };
}
