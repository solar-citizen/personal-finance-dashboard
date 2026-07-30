import { Injectable, Logger } from '@nestjs/common';
import { Cron } from '@nestjs/schedule';
import dayjs from 'dayjs';
import { toYyyymmdd } from 'src/_lib/utils';
import { PrismaService } from 'src/db/prisma.service';

import {
  currencyConfigs,
  fetchNbuRates,
  mapNbuRateToHistoryEntry,
} from './nbu-client.util';

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

  async syncRatesForDate(date: Date): Promise<void> {
    const dateStr = toYyyymmdd(date);

    for (const { currency, valcode } of currencyConfigs) {
      try {
        const rates = await fetchNbuRates(dateStr, dateStr, valcode);

        if (rates.length > 0) {
          const prismaData = mapNbuRateToHistoryEntry(rates[0], currency);

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
            `Synced exchange rate for ${currency.toUpperCase()} on ${rates[0].exchangedate}: ${prismaData.rateToUah} UAH`,
          );
        }
      } catch (err: unknown) {
        this.logger.error(
          `Failed to fetch NBU rate for ${valcode} on ${dateStr}`,
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

    for (const { currency, valcode } of currencyConfigs) {
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
          const rates = await fetchNbuRates(
            chunkStart.format('YYYYMMDD'),
            chunkEnd.format('YYYYMMDD'),
            valcode,
          );

          if (rates.length > 0) {
            await this.prismaService.exchangeRateHistory.createMany({
              data: rates.map((rate) =>
                mapNbuRateToHistoryEntry(rate, currency),
              ),
              skipDuplicates: true,
            });
          }
        } catch (err: unknown) {
          this.logger.error(
            `Failed historical sync chunk for ${valcode} from ${chunkStart.format('YYYYMMDD')} to ${chunkEnd.format('YYYYMMDD')}`,
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
