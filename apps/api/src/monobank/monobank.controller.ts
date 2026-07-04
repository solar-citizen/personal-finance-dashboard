import { Body, Controller, Get, Param, Post, Query } from '@nestjs/common';
import { ApiTags } from '@nestjs/swagger';
import { Throttle } from '@nestjs/throttler';
import {
  ConnectMonoBankDto,
  ExchangeRatesDto,
  ExpenseCategoryResponseDto,
  GetExpensesQueryDto,
  GetTransactionsQueryDto,
  MonoBankAccountResponseDto,
  SyncJobResponseDto,
  SyncProgressResponseDto,
  SyncResultResponseDto,
  SyncTransactionsDto,
  TransactionResponseDto,
} from 'src/_generated/zod/pfd-dtos';
import { CurrentUser } from 'src/auth/decorators/current-user.decorator';
import { CurrencyService } from 'src/currency/currency.service';

import { MonoBankService } from './monobank.service';

@ApiTags('Mono')
@Throttle({ default: { limit: 10, ttl: 60_000 } })
@Controller('api/mono')
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

  @Get('transactions')
  async getLatestTransactions(
    @CurrentUser('id') userId: string,
    @Query() { limit }: GetTransactionsQueryDto,
  ): Promise<TransactionResponseDto[]> {
    return await this.monoBankService.getLatestTransactions(userId, limit);
  }

  @Get('expenses')
  async getHighestExpenses(
    @CurrentUser('id') userId: string,
    @Query() { period }: GetExpensesQueryDto,
  ): Promise<ExpenseCategoryResponseDto[]> {
    return await this.monoBankService.getHighestExpenses(userId, period);
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
