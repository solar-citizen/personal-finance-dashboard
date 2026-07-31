import { isJsonRecord } from '@pfd/shared';
import { en, uk } from 'chrono-node';
import dayjs from 'dayjs';

import { formatDateToIso, tenYearsMs } from './date.util';

type IsoDateRange = {
  from: string;
  to: string;
};

type TimeEntry = {
  time: Date | string;
};

export type DateRange = {
  from: Date;
  to: Date;
};

type UnitRoot = {
  regex: RegExp;
  days: number;
};

const unitRoots: UnitRoot[] = [
  { regex: /(\d+)\s*дн[\p{L}]*/iu, days: 1 },
  { regex: /(\d+)\s*тижн[\p{L}]*/iu, days: 7 },
  { regex: /(\d+)\s*міся[\p{L}]*/iu, days: 30 },
  { regex: /(\d+)\s*(?:рок|рік)[\p{L}]*/iu, days: 365 },
  { regex: /(\d+)\s*day/i, days: 1 },
  { regex: /(\d+)\s*week/i, days: 7 },
  { regex: /(\d+)\s*month/i, days: 30 },
  { regex: /(\d+)\s*year/i, days: 365 },
  { regex: /(\d+)\s*yrs?\b/i, days: 365 },
];

const relativeSingleUnitPatterns: UnitRoot[] = [
  { regex: /минул[\p{L}]*\s+р(?:ік|оку|оки|оків)/iu, days: 365 },
  { regex: /минул[\p{L}]*\s+місяц[\p{L}]*/iu, days: 30 },
  { regex: /минул[\p{L}]*\s+(?:тижн|тижд)[\p{L}]*/iu, days: 7 },
  { regex: /минул[\p{L}]*\s+дн[\p{L}]*/iu, days: 1 },
  { regex: /останн[\p{L}]*\s+р(?:ік|оку|оки|оків)/iu, days: 365 },
  { regex: /останн[\p{L}]*\s+місяц[\p{L}]*/iu, days: 30 },
  { regex: /останн[\p{L}]*\s+(?:тижн|тижд)[\p{L}]*/iu, days: 7 },
  { regex: /останн[\p{L}]*\s+дн[\p{L}]*/iu, days: 1 },
  { regex: /\blast\s+year\b/i, days: 365 },
  { regex: /\blast\s+month\b/i, days: 30 },
  { regex: /\blast\s+week\b/i, days: 7 },
  { regex: /\blast\s+day\b/i, days: 1 },
  { regex: /\blast\s+yrs?\b/i, days: 365 },
];

function tryYearRange(message: string): DateRange | null {
  // Matches "з 2022 по 2025", "2022-2025", "2022 по 2025 рік", etc.
  const rangeMatch =
    /(?:з\s*)?(20\d{2})\s*(?:по|до|-|–|—)\s*(?:включно\s*)?(20\d{2})/i.exec(
      message,
    );

  if (rangeMatch) {
    const startYear = Number(rangeMatch[1]);
    const endYear = Number(rangeMatch[2]);

    if (startYear <= endYear && startYear >= 2000 && endYear <= 2100) {
      return {
        from: dayjs(`${startYear}-01-01`).startOf('day').toDate(),
        to: dayjs(`${endYear}-12-31`).endOf('day').toDate(),
      };
    }
  }

  // Matches single year like "у 2024 році", "за 2023", "2024"
  const singleYearMatch =
    /(?<!\d[.-/])(?:за\s+|у\s+|в\s+|\b|^)(20\d{2})(?:\s*(?:рік|року|році|роках))?\b(?!\.\d)/i.exec(
      message,
    );

  if (singleYearMatch) {
    const year = Number(singleYearMatch[1]);

    if (year >= 2000 && year <= 2100) {
      return {
        from: dayjs(`${year}-01-01`).startOf('day').toDate(),
        to: dayjs(`${year}-12-31`).endOf('day').toDate(),
      };
    }
  }

  return null;
}

function tryChrono(message: string, referenceDate: Date): DateRange | null {
  const ukResults = uk.parse(message, referenceDate, {
    forwardDate: false,
  });

  const results =
    ukResults.length > 0
      ? ukResults
      : en.casual.parse(message, referenceDate, {
          forwardDate: false,
        });

  if (results.length === 0) {
    return null;
  }

  const [result] = results;
  const { start, end, index } = result;

  let from = start.date();
  let to: Date;

  if (end) {
    to = end.date();
  } else {
    const prefix = message.substring(0, index).toLowerCase();
    const isSince = /(?:з|від|починаючи\s+з|since|from)\s*$/i.test(prefix);

    if (isSince) {
      to = referenceDate;
      from = dayjs(from).startOf('day').toDate();
    } else {
      if (start.isCertain('day')) {
        from = dayjs(from).startOf('day').toDate();
        to = dayjs(from).endOf('day').toDate();
      } else if (start.isCertain('month')) {
        from = dayjs(from).startOf('month').toDate();
        to = dayjs(from).endOf('month').toDate();
      } else if (start.isCertain('year')) {
        from = dayjs(from).startOf('year').toDate();
        to = dayjs(from).endOf('year').toDate();
      } else {
        from = dayjs(from).startOf('day').toDate();
        to = dayjs(from).endOf('day').toDate();
      }
    }
  }

  if (from > referenceDate || to < from) {
    return null;
  }

  if (to.getTime() - from.getTime() > tenYearsMs) {
    return null;
  }

  return {
    from,
    to,
  };
}

function matchAgainstPatterns(
  message: string,
  referenceDate: Date,
  patterns: UnitRoot[],
  requireDigit: boolean,
): DateRange | null {
  for (const { regex, days } of patterns) {
    const match = message.match(regex);

    if (match) {
      const count = requireDigit ? Number(match[1]) : 1;

      return {
        from: dayjs(referenceDate)
          .subtract(count * days, 'day')
          .toDate(),
        to: referenceDate,
      };
    }
  }

  return null;
}

function tryUnitRootFallback(
  message: string,
  referenceDate: Date,
): DateRange | null {
  return matchAgainstPatterns(message, referenceDate, unitRoots, true);
}

function tryRelativeSingleUnitFallback(
  message: string,
  referenceDate: Date,
): DateRange | null {
  return matchAgainstPatterns(
    message,
    referenceDate,
    relativeSingleUnitPatterns,
    false,
  );
}

export function extractDateRangeFromMessage(
  message: string,
  referenceDate: Date = new Date(),
): DateRange | null {
  return (
    tryChrono(message, referenceDate) ??
    tryYearRange(message) ??
    tryUnitRootFallback(message, referenceDate) ??
    tryRelativeSingleUnitFallback(message, referenceDate)
  );
}

export function isStoredDateRange(
  value: unknown,
): value is { from: string; to: string } {
  return (
    isJsonRecord(value) &&
    typeof value.from === 'string' &&
    typeof value.to === 'string'
  );
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
