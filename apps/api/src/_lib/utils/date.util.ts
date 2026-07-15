/* eslint-disable padding-line-between-statements */
import dayjs from 'dayjs';

type IsoDateRange = {
  from: string;
  to: string;
};

type TimeEntry = {
  time: Date | string;
};

export const hourMs = 3_600_000;
export const dayMs = 86_400_000;
export const weekMs = 604_800_000;
export const tenYearsMs = 315_360_000_000;

export function toUnixTimestamp(date: Date): number {
  return dayjs(date).unix();
}

export function fromUnixTimestamp(timestamp: number): Date {
  return dayjs.unix(timestamp).toDate();
}

export function formatDateToIso(date: Date): string {
  return dayjs(date).toISOString();
}

export function getDateRange(items: TimeEntry[]): IsoDateRange {
  if (items.length === 0) {
    const now = dayjs();
    return {
      from: formatDateToIso(now.toDate()),
      to: formatDateToIso(now.toDate()),
    };
  }

  const dates = items.map(({ time }) => dayjs(time).valueOf());

  return {
    from: formatDateToIso(dayjs(Math.min(...dates)).toDate()),
    to: formatDateToIso(dayjs(Math.max(...dates)).toDate()),
  };
}
