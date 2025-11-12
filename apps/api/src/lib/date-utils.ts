import dayjs from 'dayjs';

type IsoDateRange = {
  from: string;
  to: string;
};

export function toUnixTimestamp(date: Date): number {
  return dayjs(date).unix();
}

export function fromUnixTimestamp(timestamp: number): Date {
  return dayjs.unix(timestamp).toDate();
}

export function formatDateToIso(date: Date): string {
  return dayjs(date).toISOString();
}

export function getDateRange<T extends { time: Date | string }>(
  items: T[],
): IsoDateRange {
  if (items.length === 0) {
    const now = dayjs();
    return {
      from: formatDateToIso(now.toDate()),
      to: formatDateToIso(now.toDate()),
    };
  }

  const dates = items.map(({ time }) => dayjs(time).valueOf());
  const earliest = dayjs(Math.min(...dates));
  const latest = dayjs(Math.max(...dates));

  return {
    from: formatDateToIso(earliest.toDate()),
    to: formatDateToIso(latest.toDate()),
  };
}
