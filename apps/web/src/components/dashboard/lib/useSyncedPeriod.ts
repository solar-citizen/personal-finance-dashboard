import type { Period } from '@pfd/shared';
import { useState } from 'react';

export function useSyncedPeriod(globalPeriod: Period) {
  const [syncedTo, setSyncedTo] = useState<Period>(globalPeriod);
  const [period, setPeriod] = useState<Period>(globalPeriod);

  if (globalPeriod !== syncedTo) {
    setSyncedTo(globalPeriod);
    setPeriod(globalPeriod);
  }

  return [period, setPeriod] as const;
}
