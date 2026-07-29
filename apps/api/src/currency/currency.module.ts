import { HttpModule } from '@nestjs/axios';
import { Module } from '@nestjs/common';
import { ScheduleModule } from '@nestjs/schedule';
import { MonoBankApiClient } from 'src/monobank/services';

import { CurrencyController } from './currency.controller';
import { CurrencyService } from './currency.service';
import { ExchangeRateSyncService } from './services/exchange-rate-sync.service';

@Module({
  imports: [HttpModule, ScheduleModule.forRoot()],
  controllers: [CurrencyController],
  providers: [CurrencyService, ExchangeRateSyncService, MonoBankApiClient],
  exports: [CurrencyService, ExchangeRateSyncService],
})
export class CurrencyModule {}
