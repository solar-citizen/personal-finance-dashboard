import { Currency } from '../src/_generated/prisma-client/client';
import { prisma } from './client';

const currenciesToBackfill: { currency: Currency; valcode: string }[] = [
  { currency: Currency.usd, valcode: 'usd' },
  { currency: Currency.eur, valcode: 'eur' },
];

type NbuRateRow = {
  exchangedate: string;
  rate: number;
  units: number;
  rate_per_unit: number;
};

function isUnknownArray(value: unknown): value is unknown[] {
  return Array.isArray(value);
}

function isNbuRateRow(value: unknown): value is NbuRateRow {
  return (
    typeof value === 'object' &&
    value !== null &&
    'exchangedate' in value &&
    typeof value.exchangedate === 'string' &&
    'units' in value &&
    typeof value.units === 'number' &&
    value.units !== 0 &&
    'rate' in value &&
    typeof value.rate === 'number'
  );
}

function toYyyymmdd(date: Date): string {
  return date.toISOString().slice(0, 10).replace(/-/g, '');
}

function parseNbuDate(exchangedate: string): Date {
  const [day, month, year] = exchangedate.split('.').map(Number);
  return new Date(Date.UTC(year, month - 1, day));
}

async function fetchRange(
  valcode: string,
  start: Date,
  end: Date,
): Promise<NbuRateRow[]> {
  const res = await fetch(
    `https://bank.gov.ua/NBU_Exchange/exchange_site?start=${toYyyymmdd(start)}&end=${toYyyymmdd(end)}&valcode=${valcode}&sort=exchangedate&order=asc&json`,
  );

  if (!res.ok) {
    throw new Error(`NBU request failed: ${res.status} ${res.statusText}`);
  }

  const data: unknown = await res.json();

  if (!isUnknownArray(data) || !data.every(isNbuRateRow)) {
    throw new Error('Invalid NBU response format');
  }

  return data;
}

function* yearChunks(start: Date, end: Date): Generator<[Date, Date]> {
  let chunkStart = start;

  while (chunkStart <= end) {
    const chunkEnd = new Date(
      Math.min(Date.UTC(chunkStart.getUTCFullYear(), 11, 31), end.getTime()),
    );

    yield [chunkStart, chunkEnd];
    chunkStart = new Date(chunkEnd.getTime() + 24 * 60 * 60 * 1000);
  }
}

async function backfillCurrency(
  currency: Currency,
  valcode: string,
  start: Date,
  end: Date,
): Promise<void> {
  let total = 0;
  let normalizedCount = 0;

  for (const [chunkStart, chunkEnd] of yearChunks(start, end)) {
    console.log(
      `  ${valcode.toUpperCase()}: fetching ${chunkStart.toISOString().slice(0, 10)} → ${chunkEnd.toISOString().slice(0, 10)}`,
    );

    const rows = await fetchRange(valcode, chunkStart, chunkEnd);

    if (rows.length > 0) {
      normalizedCount += rows.filter((row) => row.units !== 1).length;

      await prisma.exchangeRateHistory.createMany({
        data: rows.map((row) => ({
          date: parseNbuDate(row.exchangedate),
          currency,

          /**
           * Archive data before the Dec 2019 classifier change quotes `rate`
           * per `units` currency units (e.g. per 100), not per 1. rate_per_unit
           * is NBU's own already-normalized value, so we store that directly
           * instead of doing our own date-based guessing.
           */
          rateToUah: row.rate_per_unit.toString(),
        })),
        skipDuplicates: true,
      });
      total += rows.length;
    }

    // be polite to the NBU API
    await new Promise((resolve) => setTimeout(resolve, 300));
  }

  console.log(
    `  ✅ ${valcode.toUpperCase()}: ${total} rows upserted (${normalizedCount} had units !== 1)`,
  );
}

async function getDefaultStartDate(): Promise<Date> {
  const earliest = await prisma.transaction.aggregate({
    _min: { time: true },
  });

  if (earliest._min.time) {
    return earliest._min.time;
  }

  const fallback = new Date();
  fallback.setUTCFullYear(fallback.getUTCFullYear() - 5);
  return fallback;
}

async function main(): Promise<void> {
  const startArg = process.argv[2];
  const endArg = process.argv[3];

  const end = endArg ? new Date(endArg) : new Date();
  const start = startArg ? new Date(startArg) : await getDefaultStartDate();

  console.log(
    `🌱 Backfilling exchange rates from ${start.toISOString().slice(0, 10)} to ${end.toISOString().slice(0, 10)}...`,
  );

  for (const { currency, valcode } of currenciesToBackfill) {
    await backfillCurrency(currency, valcode, start, end);
  }

  console.log('🎉 Backfill completed!');
}

main()
  .catch((err: unknown) => {
    console.error('❌ Backfill error:', err);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
