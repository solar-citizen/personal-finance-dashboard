import { Controller, Post } from '@nestjs/common';
import { ApiTags } from '@nestjs/swagger';
import dayjs from 'dayjs';

import { ExchangeRateSyncService } from './services/exchange-rate-sync.service';

type SyncRatesResponse = { success: boolean; message: string };

const syncRatesSuccessMessage = 'Exchange rates synchronized successfully';

@ApiTags('currency')
@Controller('api/currency')
export class CurrencyController {
  constructor(
    private readonly exchangeRateSyncService: ExchangeRateSyncService,
  ) {}

  @Post('sync-rates')
  async syncRates(): Promise<SyncRatesResponse> {
    await this.exchangeRateSyncService.syncRates();
    return {
      success: true,
      message: syncRatesSuccessMessage,
    };
  }

  @Post('sync-rates-for-date')
  async syncRatesForDate(): Promise<SyncRatesResponse> {
    await this.exchangeRateSyncService.syncRatesForDate(dayjs().toDate());
    return {
      success: true,
      message: syncRatesSuccessMessage,
    };
  }
}
