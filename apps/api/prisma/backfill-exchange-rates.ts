import { toYyyymmdd } from 'src/_lib/utils';
import {
  currencyConfigs,
  fetchNbuRates,
  mapNbuRateToHistoryEntry,
} from 'src/currency/services/nbu-client.util';

import { Currency } from '../src/_generated/prisma-client/client';
import { prisma } from './client';

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

    const rates = await fetchNbuRates(
      toYyyymmdd(chunkStart),
      toYyyymmdd(chunkEnd),
      valcode,
    );

    if (rates.length > 0) {
      normalizedCount += rates.filter(({ units }) => units !== 1).length;

      await prisma.exchangeRateHistory.createMany({
        data: rates.map((rate) => mapNbuRateToHistoryEntry(rate, currency)),
        skipDuplicates: true,
      });
      total += rates.length;
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

  for (const { currency, valcode } of currencyConfigs) {
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
