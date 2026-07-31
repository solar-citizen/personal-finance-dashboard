import { isRecord } from '@pfd/shared';

import { CachedBundle } from './context-builder.types';

type AggregatesWithByCurrency = Record<string, unknown> & {
  byCurrency: unknown[];
};

function hasByCurrencyArray(
  aggregates: Record<string, unknown>,
): aggregates is AggregatesWithByCurrency {
  return Array.isArray(aggregates.byCurrency);
}

export function assertIsCachedBundle(
  value: unknown,
): asserts value is CachedBundle {
  if (!isRecord(value)) {
    throw new Error(
      'Sanitizing the context bundle for caching produced an invalid value',
    );
  }

  // Schema version guard: reject stale bundles that pre-date the
  // incoming/outgoing per-currency fields. A missing `incoming` on the first
  // byCurrency entry means the bundle was cached before this change and must
  // be recomputed.
  const aggregates = value.aggregates;

  if (!isRecord(aggregates) || !hasByCurrencyArray(aggregates)) {
    return;
  }

  const firstEntry = aggregates.byCurrency[0];

  if (firstEntry === undefined) {
    return;
  }

  if (!isRecord(firstEntry) || !('incoming' in firstEntry)) {
    throw new Error(
      'Stale cache bundle detected (missing incoming/outgoing per-currency fields); recomputing.',
    );
  }
}
