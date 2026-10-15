import { Body, Controller, Get, Param, Post, Query } from '@nestjs/common';
import { ApiTags } from '@nestjs/swagger';
import { Throttle } from '@nestjs/throttler';
import {
  CashFlowPointResponseDto,
  ConnectMonoBankDto,
  ExchangeRatesDto,
  ExpenseCategoryResponseDto,
  GetCashFlowQueryDto,
  GetExpensesQueryDto,
  GetJobsQueryDto,
  GetTransactionsQueryDto,
  MonoBankAccountResponseDto,
  SyncJobResponseDto,
  SyncJobsPageResponseDto,
  SyncProgressResponseDto,
  SyncResultResponseDto,
  SyncTransactionsDto,
  TransactionResponseDto,
} from 'src/_generated/zod/pfd-dtos';
import { minuteMs } from 'src/_lib/utils';
import { CurrentUser } from 'src/auth/decorators/current-user.decorator';
import { CurrencyService } from 'src/currency/currency.service';

import { MonoBankService } from './monobank.service';

@ApiTags('Mono')
@Throttle({ default: { limit: 50, ttl: minuteMs } })
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

  @Get('cash-flow')
  async getCashFlowTrend(
    @CurrentUser('id') userId: string,
    @Query() { period }: GetCashFlowQueryDto,
  ): Promise<CashFlowPointResponseDto[]> {
    return await this.monoBankService.getCashFlowTrend(userId, period);
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

  @Get('jobs')
  async getSyncJobs(
    @CurrentUser('id') userId: string,
    @Query() { page, limit }: GetJobsQueryDto,
  ): Promise<SyncJobsPageResponseDto> {
    return await this.monoBankService.getSyncJobs(userId, page, limit);
  }

  @Post('jobs/:jobId/cancel')
  async cancelSyncJob(
    @CurrentUser('id') userId: string,
    @Param('jobId') jobId: string,
  ): Promise<SyncJobResponseDto> {
    return await this.monoBankService.cancelSyncJob(userId, jobId);
  }

  @Post('jobs/:jobId/retry')
  async retrySyncJob(
    @CurrentUser('id') userId: string,
    @Param('jobId') jobId: string,
  ): Promise<SyncResultResponseDto | SyncJobResponseDto> {
    return await this.monoBankService.retrySyncJob(userId, jobId);
  }

  @Post('jobs/:jobId/pause')
  async pauseSyncJob(
    @CurrentUser('id') userId: string,
    @Param('jobId') jobId: string,
  ): Promise<SyncJobResponseDto> {
    return await this.monoBankService.pauseSyncJob(userId, jobId);
  }

  @Post('jobs/:jobId/resume')
  async resumeSyncJob(
    @CurrentUser('id') userId: string,
    @Param('jobId') jobId: string,
  ): Promise<SyncJobResponseDto> {
    return await this.monoBankService.resumeSyncJob(userId, jobId);
  }

  @Get('exchange-rates')
  async getExchangeRates(): Promise<ExchangeRatesDto> {
    return await this.currencyService.getExchangeRates();
  }
}
