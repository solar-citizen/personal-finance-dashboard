import { CACHE_MANAGER } from '@nestjs/cache-manager';
import { Inject, Injectable, Logger } from '@nestjs/common';
import type { Cache } from 'cache-manager';
import { Currency } from 'src/_generated/prisma-client/enums';
import { Decimal } from 'src/_generated/prisma-client/internal/prismaNamespaceBrowser';
import {
  ExchangeRatesDto,
  MonoExchangeRateDto,
} from 'src/_generated/zod/pfd-dtos';
import { hourMs, weekMs } from 'src/_lib/utils/date.util';
import { currencyToIso4217 } from 'src/monobank/lib/utils';
import { MonoBankApiClient } from 'src/monobank/services';

const ratesFreshKey = 'currency:rates:fresh';
const ratesStaleKey = 'currency:rates:stale';

@Injectable()
export class CurrencyService {
  private readonly logger = new Logger(CurrencyService.name);

  constructor(
    private readonly monoApiClient: MonoBankApiClient,
    @Inject(CACHE_MANAGER) private readonly cacheManager: Cache,
  ) {}

  async getExchangeRates(): Promise<ExchangeRatesDto> {
    const fresh = await this.cacheManager.get<ExchangeRatesDto>(ratesFreshKey);

    if (fresh) {
      return fresh;
    }

    try {
      const monoExchangeRates = await this.monoApiClient.getExchangeRates();
      const uahIsoCode = currencyToIso4217[Currency.uah];

      const usdToUah = this.findCurrencyPair(
        monoExchangeRates,
        currencyToIso4217[Currency.usd],
        uahIsoCode,
      );

      const eurToUah = this.findCurrencyPair(
        monoExchangeRates,
        currencyToIso4217[Currency.eur],
        uahIsoCode,
      );

      if (!usdToUah) {
        throw new Error('Missing USD/UAH currency pair from Monobank API');
      }

      if (!eurToUah) {
        throw new Error('Missing EUR/UAH currency pair from Monobank API');
      }

      const usdMid = new Decimal(usdToUah.rateBuy ?? 0)
        .plus(usdToUah.rateSell ?? 0)
        .div(2)
        .toNumber();

      const eurMid = new Decimal(eurToUah.rateBuy ?? 0)
        .plus(eurToUah.rateSell ?? 0)
        .div(2)
        .toNumber();

      const rates: ExchangeRatesDto = {
        usdToUah: usdMid,
        eurToUah: eurMid,
      };

      await Promise.all([
        this.cacheManager.set(ratesFreshKey, rates, hourMs),
        this.cacheManager.set(ratesStaleKey, rates, weekMs),
      ]);

      return rates;
    } catch (err: unknown) {
      this.logger.error('Failed to fetch Mono exchange rates', err);

      const stale =
        await this.cacheManager.get<ExchangeRatesDto>(ratesStaleKey);

      if (stale) {
        this.logger.warn('Returning stale cached rates from Redis');
        return stale;
      }

      throw new Error('Exchange rates unavailable and no cache exists', {
        cause: err,
      });
    }
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
