import type { Period } from '@pfd/shared';

import { useGetCashFlowTrend } from '#src/_generated/api/pfd-components';

import { useSyncedPeriod } from './useSyncedPeriod';

export function useCashFlowByPeriod(globalPeriod: Period) {
  const [period, setPeriod] = useSyncedPeriod(globalPeriod);
  return { period, setPeriod, ...useGetCashFlowTrend({ queryParams: { period } }) };
}
