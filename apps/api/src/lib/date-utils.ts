import dayjs from 'dayjs';

export function toUnixTimestamp(date: Date): number {
  return dayjs(date).unix();
}

export function fromUnixTimestamp(timestamp: number): Date {
  return dayjs.unix(timestamp).toDate();
}

export const formatDateToIso = (date: Date): string => {
  return dayjs(date).toISOString();
};
