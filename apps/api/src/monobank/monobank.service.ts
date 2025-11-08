import { HttpService } from '@nestjs/axios';
import {
  BadRequestException,
  HttpException,
  HttpStatus,
  Injectable,
  Logger,
} from '@nestjs/common';
import { Account, SyncJobStatus } from '@prisma/client';
import { firstValueFrom } from 'rxjs';
import { ConfigService } from 'src/config/config.service';
import { getErrorMessage } from 'src/lib/error-utils';
import { PrismaService } from '../db/prisma.service';
import { getCurrencyFromCode } from './lib/currency-utils';
import type { MonoBankClientInfo, MonoBankTransaction } from './lib/types';
import { isAxiosErrorWithResponse } from './lib/utils';
import {
  ConnectMonoBankDto,
  MonoBankAccountResponseDto,
  SyncProgressResponseDto,
  SyncResultResponseDto,
  SyncTransactionsDto,
} from './monobank.dto';

@Injectable()
export class MonoBankService {
  private readonly logger = new Logger(MonoBankService.name);
  private readonly apiUrl: string;
  private readonly rateLimitDelay = 60000; // 60 seconds in ms
  private lastRequestTime = 0;

  constructor(
    private readonly httpService: HttpService,
    private readonly prismaService: PrismaService,
    private readonly configService: ConfigService,
  ) {
    this.apiUrl = this.configService.monoApiUrl;
  }

  async connectAccount(
    userId: string,
    { token }: ConnectMonoBankDto,
  ): Promise<MonoBankAccountResponseDto[]> {
    this.logger.log(`Connecting MonoBank account for user: ${userId}`);

    const clientInfo = await this.getClientInfo(token);

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

      savedAccounts.push(this.formatAccountResponse(savedAccount));
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

    return accounts.map((account) => this.formatAccountResponse(account));
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

    const to = dto?.to ? new Date(dto.to) : new Date();

    let from: Date;
    if (dto?.from) {
      from = new Date(dto.from);
    } else if (dto?.fullHistory) {
      // Full history: go back maximum 5 years from 'to' date
      from = new Date(to.getTime() - 5 * 365 * 24 * 60 * 60 * 1000);

      this.logger.log(
        `Full history requested for account ${accountId}: syncing from ${from.toISOString()} to ${to.toISOString()}`,
      );
    } else if (account.lastSyncedAt) {
      // Has previous sync: get transactions since then, but cap at 31 days
      const lastSync = new Date(account.lastSyncedAt);
      const maxFrom = new Date(to.getTime() - 31 * 24 * 60 * 60 * 1000);
      from = lastSync > maxFrom ? lastSync : maxFrom;

      console.log('from lastSyncedAt', from);

      if (lastSync < maxFrom) {
        this.logger.warn(
          `Account ${accountId}: Gap detected. Last sync: ${lastSync.toISOString()}, syncing from: ${from.toISOString()}. Use fullHistory: true to sync all missing transactions.`,
        );
      }
    } else {
      // Never synced: default to last 31 days
      from = new Date(to.getTime() - 31 * 24 * 60 * 60 * 1000);
    }

    console.log('final from', from);

    const daysDiff = Math.ceil(
      (to.getTime() - from.getTime()) / (1000 * 60 * 60 * 24),
    );

    this.logger.log(`Account ${accountId}: daysDiff = ${daysDiff} days`);

    // For large date ranges, use background job
    if (daysDiff > 31) {
      return this.createBackgroundSyncJob(account, from, to);
    }

    // For small date ranges, do immediate sync
    const transactions = await this.getStatement(
      account.monoToken,
      account.accountId,
      from,
      to,
    );

    this.logger.log(
      `Fetched ${transactions.length} transactions from MonoBank`,
    );

    const result = await this.saveTransactions(account.id, transactions);

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
    const job = await this.prismaService.syncJob.findUnique({
      where: { id: jobId },
    });

    if (!job) {
      throw new BadRequestException('Sync job not found');
    }

    return {
      jobId: job.id,
      status: job.status,
      progress: job.progress,
      total: job.total,
      newTransactions: job.newCount,
      updatedTransactions: job.updatedCount,
      errorMessage: job.errorMessage || undefined,
    };
  }

  private async createBackgroundSyncJob(
    account: Account,
    from: Date,
    to: Date,
  ): Promise<{ jobId: string; message: string }> {
    const totalDays = Math.ceil(
      (to.getTime() - from.getTime()) / (1000 * 60 * 60 * 24),
    );
    const chunks = Math.ceil(totalDays / 31);

    const syncJob = await this.prismaService.syncJob.create({
      data: {
        accountId: account.id,
        status: SyncJobStatus.pending,
        from,
        to,
        total: chunks,
        progress: 0,
      },
    });

    this.processSyncJob(syncJob.id, account, from, to).catch((error) => {
      this.logger.error(`Background sync job ${syncJob.id} failed:`, error);
    });

    const estimatedTime = chunks * 60;

    return {
      jobId: syncJob.id,
      message: `Date range exceeds 31 days. Background sync started. Estimated time: ~${Math.ceil(estimatedTime / 60)} minutes. Track progress at GET /api/mono/sync-status/${syncJob.id}`,
    };
  }

  private async processSyncJob(
    jobId: string,
    account: Account,
    from: Date,
    to: Date,
  ): Promise<void> {
    try {
      await this.prismaService.syncJob.update({
        where: { id: jobId },
        data: { status: SyncJobStatus.running },
      });

      const allTransactions = await this.fetchAllTransactionsWithProgress(
        jobId,
        account.monoToken!,
        account.accountId,
        from,
        to,
      );

      this.logger.log(
        `Job ${jobId}: Fetched ${allTransactions.length} total transactions`,
      );

      const result = await this.saveTransactions(account.id, allTransactions);

      await this.prismaService.account.update({
        where: { id: account.id },
        data: { lastSyncedAt: new Date() },
      });

      await this.prismaService.syncJob.update({
        where: { id: jobId },
        data: {
          status: SyncJobStatus.completed,
          newCount: result.newTransactions,
          updatedCount: result.updatedTransactions,
          errorMessage:
            result.errors.length > 0 ? result.errors.join('; ') : null,
        },
      });

      this.logger.log(`Job ${jobId}: Completed successfully`);
    } catch (error) {
      this.logger.error(`Job ${jobId}: Failed with error:`, error);

      await this.prismaService.syncJob.update({
        where: { id: jobId },
        data: {
          status: SyncJobStatus.failed,
          errorMessage: getErrorMessage(error),
        },
      });
    }
  }

  private async fetchAllTransactionsWithProgress(
    jobId: string,
    token: string,
    accountId: string,
    from: Date,
    to: Date,
  ): Promise<MonoBankTransaction[]> {
    const allTransactions: MonoBankTransaction[] = [];
    const maxDaysPerRequest = 31;

    let currentFrom = new Date(from);
    const finalTo = new Date(to);
    let chunkIndex = 0;

    while (currentFrom < finalTo) {
      const currentTo = new Date(
        Math.min(
          currentFrom.getTime() + maxDaysPerRequest * 24 * 60 * 60 * 1000,
          finalTo.getTime(),
        ),
      );

      this.logger.log(
        `Job ${jobId}: Fetching chunk ${chunkIndex + 1} from ${currentFrom.toISOString()} to ${currentTo.toISOString()}`,
      );

      const transactions = await this.getStatement(
        token,
        accountId,
        currentFrom,
        currentTo,
      );

      allTransactions.push(...transactions);
      chunkIndex++;

      await this.prismaService.syncJob.update({
        where: { id: jobId },
        data: { progress: chunkIndex },
      });

      this.logger.log(
        `Job ${jobId}: Chunk ${chunkIndex} completed, fetched ${transactions.length} transactions`,
      );

      currentFrom = new Date(currentTo.getTime() + 1000);
    }

    return allTransactions;
  }

  private async saveTransactions(
    accountId: string,
    transactions: MonoBankTransaction[],
  ): Promise<{
    newTransactions: number;
    updatedTransactions: number;
    errors: string[];
  }> {
    const results = await Promise.all(
      transactions.map(async (tx) => {
        try {
          const category = await this.getCategoryByMcc(tx.mcc);

          const saved = await this.prismaService.transaction.upsert({
            where: {
              accountId_externalId: {
                accountId,
                externalId: tx.id,
              },
            },
            create: {
              accountId,
              externalId: tx.id,
              time: new Date(tx.time * 1000),
              description: tx.description,
              mcc: tx.mcc,
              originalMcc: tx.originalMcc,
              hold: tx.hold,
              amount: BigInt(tx.amount),
              operationAmount: BigInt(tx.operationAmount),
              currencyCode: tx.currencyCode,
              commissionRate: BigInt(tx.commissionRate),
              cashbackAmount: BigInt(tx.cashbackAmount),
              balance: BigInt(tx.balance),
              comment: tx.comment,
              receiptId: tx.receiptId,
              invoiceId: tx.invoiceId,
              counterEdrpou: tx.counterEdrpou,
              counterIban: tx.counterIban,
              counterName: tx.counterName,
              categoryId: category?.id,
            },
            update: {
              hold: tx.hold,
              balance: BigInt(tx.balance),
              comment: tx.comment,
              categoryId: category?.id,
            },
          });

          const isNew = saved.createdAt.getTime() > Date.now() - 1000;
          return { success: true, isNew };
        } catch (error) {
          this.logger.error(`Error saving transaction ${tx.id}:`, error);
          return {
            success: false,
            error: `Transaction ${tx.id}: ${getErrorMessage(error)}`,
          };
        }
      }),
    );

    const newTransactions = results.filter((r) => r.success && r.isNew).length;
    const updatedTransactions = results.filter(
      (r) => r.success && !r.isNew,
    ).length;
    const errors = results
      .filter((r) => !r.success)
      .map((r) => r.error)
      .filter((e): e is string => e !== undefined);

    return { newTransactions, updatedTransactions, errors };
  }

  private async getClientInfo(token: string): Promise<MonoBankClientInfo> {
    await this.waitForRateLimit();

    try {
      const response = await firstValueFrom(
        this.httpService.get<MonoBankClientInfo>(
          `${this.apiUrl}/personal/client-info`,
          {
            headers: { 'X-Token': token },
          },
        ),
      );

      return response.data;
    } catch (error) {
      this.handleMonoBankError(error);
    }
  }

  private async getStatement(
    token: string,
    accountId: string,
    from: Date,
    to: Date,
  ): Promise<MonoBankTransaction[]> {
    await this.waitForRateLimit();

    const fromTimestamp = Math.floor(from.getTime() / 1000);
    const toTimestamp = Math.floor(to.getTime() / 1000);

    try {
      const response = await firstValueFrom(
        this.httpService.get<MonoBankTransaction[]>(
          `${this.apiUrl}/personal/statement/${accountId}/${fromTimestamp}/${toTimestamp}`,
          {
            headers: { 'X-Token': token },
          },
        ),
      );

      return response.data;
    } catch (error) {
      this.handleMonoBankError(error);
    }
  }

  private async getCategoryByMcc(mcc: number): Promise<{ id: string } | null> {
    const category = await this.prismaService.category.findUnique({
      where: { mcc },
      select: { id: true },
    });

    if (category) {
      return category;
    }

    return this.prismaService.category.findUnique({
      where: { mcc: 0 },
      select: { id: true },
    });
  }

  private async waitForRateLimit(): Promise<void> {
    const timeSinceLastRequest = Date.now() - this.lastRequestTime;

    if (timeSinceLastRequest < this.rateLimitDelay) {
      const waitTime = this.rateLimitDelay - timeSinceLastRequest;
      this.logger.log(`Rate limit: waiting ${Math.ceil(waitTime / 1000)}s`);
      await new Promise((resolve) => setTimeout(resolve, waitTime));
    }

    this.lastRequestTime = Date.now();
  }

  private handleMonoBankError(error: unknown): never {
    if (isAxiosErrorWithResponse(error)) {
      const status = error.response.status;
      const data = error.response.data;

      this.logger.error(`MonoBank API error (${status}):`, data);

      if (status === 429) {
        throw new HttpException(
          'Too many requests to MonoBank API. Please wait 60 seconds.',
          HttpStatus.TOO_MANY_REQUESTS,
        );
      }

      if (status === 403) {
        throw new HttpException(
          'Invalid MonoBank token or insufficient permissions',
          HttpStatus.FORBIDDEN,
        );
      }

      throw new HttpException(
        data.errorDescription || 'MonoBank API error',
        status,
      );
    }

    this.logger.error('Unexpected error:', error);
    throw new HttpException(
      'Failed to connect to MonoBank API',
      HttpStatus.INTERNAL_SERVER_ERROR,
    );
  }

  private formatAccountResponse({
    id,
    accountId,
    iban,
    type,
    currency,
    balance,
    creditLimit,
    lastSyncedAt,
  }: Account): MonoBankAccountResponseDto {
    return {
      id,
      accountId,
      iban: iban || '',
      type,
      currency,
      balance: (Number(balance) / 100).toFixed(2),
      creditLimit: (Number(creditLimit) / 100).toFixed(2),
      lastSyncedAt,
    };
  }
}
