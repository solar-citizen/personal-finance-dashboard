import { Body, Controller, Get, Param, Post, UseGuards } from '@nestjs/common';
import { ApiTags } from '@nestjs/swagger';
import {
  ConnectMonoBankDto,
  ExchangeRatesDto,
  MonoBankAccountResponseDto,
  SyncJobResponseDto,
  SyncProgressResponseDto,
  SyncResultResponseDto,
  SyncTransactionsDto,
} from 'src/_generated/zod/pfd-dtos';
import { CurrentUser } from 'src/auth/decorators/current-user.decorator';
import { CurrencyService } from 'src/currency/currency.service';

import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { MonoBankService } from './monobank.service';

@ApiTags('Mono')
@Controller('api/mono')
@UseGuards(JwtAuthGuard)
export class MonoBankController {
  constructor(
    private readonly monoBankService: MonoBankService,
    private readonly currencyService: CurrencyService,
  ) {}

  @Post('connect')
  async connectAccount(
    @CurrentUser('id') userId: string,
    @Body() dto: ConnectMonoBankDto,
  ): Promise<MonoBankAccountResponseDto[]> {
    return await this.monoBankService.connectAccount(userId, dto);
  }

  @Get('accounts')
  async getAccounts(
    @CurrentUser('id') userId: string,
  ): Promise<MonoBankAccountResponseDto[]> {
    return await this.monoBankService.getUserAccounts(userId);
  }

  @Post('sync/:accountId')
  async syncTransactions(
    @CurrentUser('id') userId: string,
    @Param('accountId') accountId: string,
    @Body() dto?: SyncTransactionsDto,
  ): Promise<SyncResultResponseDto | SyncJobResponseDto> {
    return await this.monoBankService.syncTransactions(userId, accountId, dto);
  }

  @Get('sync-status/:jobId')
  async getSyncStatus(
    @Param('jobId') jobId: string,
  ): Promise<SyncProgressResponseDto> {
    return await this.monoBankService.getSyncJobStatus(jobId);
  }

  @Get('exchange-rates')
  async getExchangeRates(): Promise<ExchangeRatesDto> {
    return await this.currencyService.getExchangeRates();
  }
}
