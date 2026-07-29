import { Injectable, Logger } from '@nestjs/common';
import { Cron } from '@nestjs/schedule';
import axios from 'axios';
import dayjs from 'dayjs';
import { Currency } from 'src/_generated/prisma-client/enums';
import { PrismaService } from 'src/db/prisma.service';

type NbuRateRow = {
  exchangedate: string;
  rate: number;
  units: number;
  rate_per_unit: number;
};

type CurrencyConfig = {
  currency: Currency;
  code: string;
};

const currencyConfigs: CurrencyConfig[] = [
  { currency: Currency.usd, code: 'usd' },
  { currency: Currency.eur, code: 'eur' },
];

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
  return dayjs(date).format('YYYYMMDD');
}

function parseNbuDate(exchangeDate: string): Date {
  const [day, month, year] = exchangeDate.split('.').map(Number);
  return new Date(Date.UTC(year, month - 1, day));
}

function mapRowToPrismaData(row: NbuRateRow, currency: Currency) {
  return {
    date: parseNbuDate(row.exchangedate),
    currency,
    rateToUah: row.rate_per_unit.toString(),
  };
}

@Injectable()
export class ExchangeRateSyncService {
  private readonly logger = new Logger(ExchangeRateSyncService.name);

  constructor(private readonly prismaService: PrismaService) {}

  @Cron('0 1 * * *')
  async handleDailySync(): Promise<void> {
    this.logger.log('Starting daily exchange rates sync...');
    try {
      await this.syncRates();
      this.logger.log('Daily exchange rates sync completed successfully.');
    } catch (err: unknown) {
      this.logger.error('Failed to execute daily exchange rates sync', err);
    }
  }

  private async fetchNbuRates(
    startDate: string,
    endDate: string,
    code: string,
  ): Promise<NbuRateRow[]> {
    const url = `https://bank.gov.ua/NBU_Exchange/exchange_site?start=${startDate}&end=${endDate}&valcode=${code}&sort=exchangedate&order=asc&json`;
    const response = await axios.get(url);
    const data: unknown = response.data;

    if (!isUnknownArray(data) || !data.every(isNbuRateRow)) {
      throw new Error('Invalid NBU response format');
    }

    return data;
  }

  async syncRatesForDate(date: Date): Promise<void> {
    const dateStr = toYyyymmdd(date);

    for (const { currency, code } of currencyConfigs) {
      try {
        const rows = await this.fetchNbuRates(dateStr, dateStr, code);

        if (rows.length > 0) {
          const prismaData = mapRowToPrismaData(rows[0], currency);

          await this.prismaService.exchangeRateHistory.upsert({
            where: {
              date_currency: {
                date: prismaData.date,
                currency: prismaData.currency,
              },
            },
            update: {
              rateToUah: prismaData.rateToUah,
            },
            create: prismaData,
          });

          this.logger.log(
            `Synced exchange rate for ${currency.toUpperCase()} on ${rows[0].exchangedate}: ${prismaData.rateToUah} UAH`,
          );
        }
      } catch (err: unknown) {
        this.logger.error(
          `Failed to fetch NBU rate for ${code} on ${dateStr}`,
          err,
        );
        throw err;
      }
    }
  }

  async syncRates(): Promise<void> {
    const endDate = dayjs().startOf('day').toDate();

    const latestRecord = await this.prismaService.exchangeRateHistory.findFirst(
      {
        orderBy: {
          date: 'desc',
        },
        select: {
          date: true,
        },
      },
    );

    let startDate: Date;

    if (!latestRecord) {
      this.logger.log('No latest record to sync.');
      return;
    } else {
      startDate = dayjs(latestRecord.date)
        .add(1, 'day')
        .startOf('day')
        .toDate();
    }

    const startDayjs = dayjs(startDate);
    const endDayjs = dayjs(endDate);

    if (startDayjs.isAfter(endDayjs)) {
      this.logger.log('Exchange rates are already up to date.');
      return;
    }

    this.logger.log(
      `Syncing missing/historical rates from ${startDayjs.format('YYYY-MM-DD')} to ${endDayjs.format('YYYY-MM-DD')}...`,
    );

    for (const { currency, code } of currencyConfigs) {
      let chunkStart = dayjs(startDate);
      const finalEndDate = dayjs(endDate);

      while (
        chunkStart.isBefore(finalEndDate) ||
        chunkStart.isSame(finalEndDate, 'day')
      ) {
        const potentialChunkEnd =
          chunkStart.year() === finalEndDate.year()
            ? finalEndDate
            : dayjs(`${chunkStart.year()}-12-31`);

        const chunkEnd = potentialChunkEnd.isAfter(finalEndDate)
          ? finalEndDate
          : potentialChunkEnd;

        try {
          const rows = await this.fetchNbuRates(
            chunkStart.format('YYYYMMDD'),
            chunkEnd.format('YYYYMMDD'),
            code,
          );

          if (rows.length > 0) {
            await this.prismaService.exchangeRateHistory.createMany({
              data: rows.map((row) => mapRowToPrismaData(row, currency)),
              skipDuplicates: true,
            });
          }
        } catch (err: unknown) {
          this.logger.error(
            `Failed historical sync chunk for ${code} from ${chunkStart.format('YYYYMMDD')} to ${chunkEnd.format('YYYYMMDD')}`,
            err,
          );
          throw err;
        }

        chunkStart = chunkEnd.add(1, 'day');
        await new Promise((resolve) => setTimeout(resolve, 200));
      }
    }

    this.logger.log('Historical exchange rates sync completed.');
  }
}
