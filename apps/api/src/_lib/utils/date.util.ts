/* eslint-disable padding-line-between-statements */
import dayjs from 'dayjs';
import utc from 'dayjs/plugin/utc';

dayjs.extend(utc);

export const minuteMs = 60_000;
export const hourMs = 3_600_000;
export const dayMs = 86_400_000;
export const weekMs = 604_800_000;
export const tenYearsMs = 315_360_000_000;

export function parseDate(
  dateStr: string,
  format = 'DD.MM.YYYY HH:mm:ss',
): Date {
  return dayjs.utc(dateStr, format).toDate();
}

export function toUnixTimestamp(date: Date): number {
  return dayjs(date).unix();
}

export function fromUnixTimestamp(timestamp: number): Date {
  return dayjs.unix(timestamp).toDate();
}

export function formatDateToIso(date: Date): string {
  return dayjs(date).toISOString();
}

export function toYyyymmdd(date: Date): string {
  return dayjs(date).format('YYYYMMDD');
}
