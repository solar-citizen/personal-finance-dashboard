import { Injectable, Logger } from '@nestjs/common';
import dayjs from 'dayjs';
import { Currency } from 'src/_generated/prisma-client/enums';
import { Decimal } from 'src/_generated/prisma-client/internal/prismaNamespaceBrowser';
import {
  ExchangeRatesDto,
  MonoExchangeRateDto,
} from 'src/_generated/zod/pfd-dtos';
import { currencyToIso4217 } from 'src/monobank/lib/utils';
import { MonoBankApiClient } from 'src/monobank/services';

@Injectable()
export class CurrencyService {
  private readonly logger = new Logger(CurrencyService.name);
  private readonly cacheTtlMs = 60 * 60 * 1000;

  private cachedRates: ExchangeRatesDto | null = null;
  private cacheTimestamp: dayjs.Dayjs | null = null;

  constructor(private readonly monoApiClient: MonoBankApiClient) {}

  async getExchangeRates(): Promise<ExchangeRatesDto> {
    const cached = this.getValidCache();

    if (cached) {
      return cached;
    }

    try {
      const monoExchangeRates = await this.monoApiClient.getExchangeRates();
      const uahIsoCode = currencyToIso4217[Currency.uah];

      const usdUah = this.findCurrencyPair(
        monoExchangeRates,
        currencyToIso4217[Currency.usd],
        uahIsoCode,
      );

      const eurUah = this.findCurrencyPair(
        monoExchangeRates,
        currencyToIso4217[Currency.eur],
        uahIsoCode,
      );

      if (!usdUah) {
        throw new Error('Missing USD/UAH currency pair from Monobank API');
      }

      if (!eurUah) {
        throw new Error('Missing EUR/UAH currency pair from Monobank API');
      }

      const usdMid = new Decimal(usdUah.rateBuy ?? 0)
        .plus(usdUah.rateSell ?? 0)
        .div(2)
        .toNumber();

      const eurMid = new Decimal(eurUah.rateBuy ?? 0)
        .plus(eurUah.rateSell ?? 0)
        .div(2)
        .toNumber();

      const rates: ExchangeRatesDto = {
        UAH: 1,
        USD: new Decimal(1).div(usdMid).toNumber(),
        EUR: new Decimal(1).div(eurMid).toNumber(),
      };

      this.cachedRates = rates;
      this.cacheTimestamp = dayjs();

      return rates;
    } catch (err: unknown) {
      this.logger.error('Failed to fetch Mono exchange rates', err);

      if (this.cachedRates) {
        this.logger.warn('Returning stale cached rates');
        return this.cachedRates;
      }

      throw new Error('Exchange rates unavailable and no cache exists', {
        cause: err,
      });
    }
  }

  private getValidCache(): ExchangeRatesDto | null {
    if (!this.cachedRates || !this.cacheTimestamp) {
      return null;
    }

    return dayjs().diff(this.cacheTimestamp, 'milliseconds') < this.cacheTtlMs
      ? this.cachedRates
      : null;
  }

  private findCurrencyPair(
    rates: MonoExchangeRateDto[],
    currencyCodeA: number,
    currencyCodeB: number,
  ): MonoExchangeRateDto | undefined {
    return rates.find(
      (r) =>
        r.currencyCodeA === currencyCodeA && r.currencyCodeB === currencyCodeB,
    );
  }
}
