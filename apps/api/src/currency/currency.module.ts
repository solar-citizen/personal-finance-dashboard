import { HttpModule } from '@nestjs/axios';
import { Module } from '@nestjs/common';
import { MonoBankApiClient } from 'src/monobank/services';

import { CurrencyService } from './currency.service';

@Module({
  imports: [HttpModule],
  providers: [CurrencyService, MonoBankApiClient],
  exports: [CurrencyService],
})
export class CurrencyModule {}
