import dayjs from 'dayjs';

type SyncDateRange = {
  from: Date;
  to: Date;
  daysDiff: number;
};

type DateRangeChunk = {
  from: Date;
  to: Date;
  chunkIndex: number;
};

export function calculateSyncDateRange(
  lastSyncedAt: Date | null,
  to: Date,
  from?: Date,
  fullHistory?: boolean,
): SyncDateRange {
  const toDate = dayjs(to);
  let fromDate: dayjs.Dayjs;

  if (from) {
    fromDate = dayjs(from);
  } else if (fullHistory) {
    // Full history: go back maximum 5 years from 'to' date
    fromDate = toDate.subtract(5, 'years');
  } else if (lastSyncedAt) {
    // Has previous sync: get transactions since then, but cap at 31 days
    const lastSync = dayjs(lastSyncedAt);
    const maxFrom = toDate.subtract(31, 'days');
    fromDate = lastSync.isAfter(maxFrom) ? lastSync : maxFrom;
  } else {
    // Never synced: default to last 31 days
    fromDate = toDate.subtract(31, 'days');
  }

  const daysDiff = toDate.diff(fromDate, 'days');

  return {
    from: fromDate.toDate(),
    to: toDate.toDate(),
    daysDiff: Math.ceil(daysDiff),
  };
}

export function* splitDateRangeIntoChunks(
  from: Date,
  to: Date,
  maxDaysPerChunk: number,
): Generator<DateRangeChunk> {
  let currentFrom = dayjs(from);
  const finalTo = dayjs(to);
  let chunkIndex = 0;

  while (currentFrom.isBefore(finalTo)) {
    const potentialTo = currentFrom.add(maxDaysPerChunk, 'days');
    const currentTo = potentialTo.isAfter(finalTo) ? finalTo : potentialTo;

    yield {
      from: currentFrom.toDate(),
      to: currentTo.toDate(),
      chunkIndex: chunkIndex++,
    };

    currentFrom = currentTo.add(1, 'second');
  }
}

export function calculateChunkCount(
  from: Date,
  to: Date,
  daysPerChunk: number,
): number {
  const totalDays = dayjs(to).diff(dayjs(from), 'days');
  return Math.ceil(totalDays / daysPerChunk);
}
