import type { Period } from '@pfd/shared';
import { startTransition, useState } from 'react';

export function useSyncedPeriod(globalPeriod: Period) {
  const [syncedTo, setSyncedTo] = useState<Period>(globalPeriod);
  const [period, setPeriod] = useState<Period>(globalPeriod);

  if (globalPeriod !== syncedTo) {
    setSyncedTo(globalPeriod);
    setPeriod(globalPeriod);
  }

  const setTransitionPeriod = (next: Period) => {
    startTransition(() => setPeriod(next));
  };

  return [period, setTransitionPeriod] as const;
}
