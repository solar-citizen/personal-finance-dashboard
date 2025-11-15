import { BadRequestException, Injectable, Logger } from '@nestjs/common';
import {
  ConnectMonoBankDto,
  MonoBankAccountResponseDto,
  SyncProgressResponseDto,
  SyncResultResponseDto,
  SyncTransactionsDto,
} from 'src/@generated/zod/pfd-dtos';
import { formatDateToIso } from 'src/lib/utils/date.util';
import { PrismaService } from '../db/prisma.service';
import { formatAccountResponse } from './lib/utils/account.util';
import { getCurrencyFromCode } from './lib/utils/currency.util';
import { calculateSyncDateRange } from './lib/utils/date.util';
import { MonoBankApiClient } from './services/monobank-api-client.service';
import { SyncJobManager } from './services/sync-job-manager.service';
import { TransactionProcessor } from './services/transaction-processor.service';

@Injectable()
export class MonoBankService {
  private readonly logger = new Logger(MonoBankService.name);

  constructor(
    private readonly prismaService: PrismaService,
    private readonly apiClient: MonoBankApiClient,
    private readonly syncJobManager: SyncJobManager,
    private readonly transactionProcessor: TransactionProcessor,
  ) {}

  async connectAccount(
    userId: string,
    { token }: ConnectMonoBankDto,
  ): Promise<MonoBankAccountResponseDto[]> {
    this.logger.log(`Connecting MonoBank account for user: ${userId}`);

    const clientInfo = await this.apiClient.getClientInfo(token);

    if (!clientInfo.accounts || clientInfo.accounts.length === 0) {
      throw new BadRequestException('No accounts found for this token');
    }

    const savedAccounts: MonoBankAccountResponseDto[] = [];

    for (const account of clientInfo.accounts) {
      const currency = getCurrencyFromCode(account.currencyCode);

      const savedAccount = await this.prismaService.account.upsert({
        where: {
          userId_accountId: {
            userId,
            accountId: account.id,
          },
        },
        create: {
          userId,
          accountId: account.id,
          iban: account.iban,
          type: account.type,
          currency,
          balance: BigInt(account.balance),
          creditLimit: BigInt(account.creditLimit),
          monoToken: token, // TODO: Encrypt in production
          webHookUrl: clientInfo.webHookUrl || null,
        },
        update: {
          iban: account.iban,
          type: account.type,
          currency,
          balance: BigInt(account.balance),
          creditLimit: BigInt(account.creditLimit),
          monoToken: token,
          webHookUrl: clientInfo.webHookUrl || null,
        },
      });

      savedAccounts.push(formatAccountResponse(savedAccount));
    }

    this.logger.log(
      `Connected ${savedAccounts.length} accounts for user: ${userId}`,
    );

    return savedAccounts;
  }

  async getUserAccounts(userId: string): Promise<MonoBankAccountResponseDto[]> {
    const accounts = await this.prismaService.account.findMany({
      where: { userId },
      orderBy: { createdAt: 'asc' },
    });

    return accounts.map(formatAccountResponse);
  }

  async syncTransactions(
    userId: string,
    accountId: string,
    dto?: SyncTransactionsDto,
  ): Promise<SyncResultResponseDto | { jobId: string; message: string }> {
    this.logger.log(`Syncing transactions for account: ${accountId}`);

    const account = await this.prismaService.account.findFirst({
      where: { id: accountId, userId },
    });

    if (!account) {
      throw new BadRequestException('Account not found');
    }

    if (!account.monoToken) {
      throw new BadRequestException('Account not connected to MonoBank');
    }

    const toDate = dto?.to ? new Date(dto.to) : new Date();
    const { from, to, daysDiff } = calculateSyncDateRange(
      account.lastSyncedAt,
      toDate,
      dto?.from ? new Date(dto.from) : undefined,
      dto?.fullHistory,
    );

    this.logger.log(`Account ${accountId}: daysDiff = ${daysDiff} days`);

    // Check if there's a gap in sync history
    if (
      account.lastSyncedAt &&
      !dto?.from &&
      !dto?.fullHistory &&
      daysDiff === 31
    ) {
      const lastSyncDaysDiff = Math.ceil(
        (toDate.getTime() - account.lastSyncedAt.getTime()) /
          (1000 * 60 * 60 * 24),
      );

      if (lastSyncDaysDiff > 31) {
        this.logger.warn(
          `Account ${accountId}: Gap detected. Last sync: ${formatDateToIso(account.lastSyncedAt)}, syncing from: ${formatDateToIso(from)}. Use fullHistory: true to sync all missing transactions.`,
        );
      }
    }

    // For large date ranges, use background job
    if (daysDiff > 31) {
      return this.syncJobManager.createBackgroundSyncJob(account, from, to);
    }

    // For small date ranges, do immediate sync
    const transactions = await this.apiClient.getStatement(
      account.monoToken,
      account.accountId,
      from,
      to,
    );

    this.logger.log(
      `Fetched ${transactions.length} transactions from MonoBank`,
    );

    const result = await this.transactionProcessor.saveTransactions(
      account.id,
      transactions,
    );

    await this.prismaService.account.update({
      where: { id: account.id },
      data: { lastSyncedAt: new Date() },
    });

    this.logger.log(
      `Sync complete: ${result.newTransactions} new, ${result.updatedTransactions} updated, ${result.errors.length} errors`,
    );

    return {
      success: true,
      synced: transactions.length,
      newTransactions: result.newTransactions,
      updatedTransactions: result.updatedTransactions,
      errors: result.errors.length > 0 ? result.errors : undefined,
    };
  }

  async getSyncJobStatus(jobId: string): Promise<SyncProgressResponseDto> {
    return this.syncJobManager.getJobStatus(jobId);
  }
}
