import { HttpService } from '@nestjs/axios';
import { Injectable, Logger } from '@nestjs/common';
import dayjs from 'dayjs';
import { firstValueFrom } from 'rxjs';
import { ExchangeRatesDto } from 'src/@generated/zod/pfd-dtos';
import { ConfigService } from 'src/config/config.service';
import { ExchangeRateApiResponseSchema } from './currency.schema';

@Injectable()
export class CurrencyService {
  private readonly logger = new Logger(CurrencyService.name);
  private readonly apiUrl: string;
  private readonly cacheTtlMs = 60 * 60 * 1000;

  private cachedRates: ExchangeRatesDto | null = null;
  private cacheTimestamp: dayjs.Dayjs | null = null;

  constructor(
    private readonly httpService: HttpService,
    private readonly configService: ConfigService,
  ) {
    this.apiUrl = this.configService.exchangeApiUrl;
  }

  async getExchangeRates(): Promise<ExchangeRatesDto> {
    if (this.isCacheValid()) {
      this.logger.debug('Returning cached exchange rates');
      return this.cachedRates!;
    }

    try {
      const { data } = await firstValueFrom(
        this.httpService.get<unknown>(this.apiUrl),
      );

      const { rates } = ExchangeRateApiResponseSchema.parse(data);
      const { EUR, USD } = rates;

      this.cachedRates = rates;
      this.cacheTimestamp = dayjs();

      this.logger.log(
        `Fresh exchange rates fetched: 1 UAH = ${USD} USD, ${EUR} EUR`,
      );

      return this.cachedRates;
    } catch (error) {
      this.logger.error('Failed to fetch exchange rates', error);

      if (this.cachedRates) {
        this.logger.warn('Returning stale cached rates due to API error');
        return this.cachedRates;
      }

      return this.getFallbackRates();
    }
  }

  private isCacheValid(): boolean {
    if (!this.cachedRates || !this.cacheTimestamp) {
      return false;
    }

    return dayjs().diff(this.cacheTimestamp, 'milliseconds') < this.cacheTtlMs;
  }

  private getFallbackRates(): ExchangeRatesDto {
    this.logger.warn('Using hardcoded fallback rates');

    return {
      UAH: 1,
      USD: 0.024,
      EUR: 0.022,
    };
  }

  // TODO: Use this method
  clearCache(): void {
    this.cachedRates = null;
    this.cacheTimestamp = null;
    this.logger.log('Exchange rates cache cleared');
  }
}
