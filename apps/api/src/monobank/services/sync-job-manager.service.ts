import { BadRequestException, Injectable, Logger } from '@nestjs/common';
import { Account, SyncJobStatus } from '@prisma/client';
import dayjs from 'dayjs';
import {
  SyncJobResponseDto,
  SyncProgressResponseDto,
} from 'src/@generated/zod/pfd-dtos';
import { ContextBuilderService } from 'src/ai/services/context-builder.service';
import { PrismaService } from 'src/db/prisma.service';
import { formatDateToIso } from 'src/lib/utils/date.util';
import { getErrorMessage } from 'src/lib/utils/error.util';
import { MonoBankTransaction } from '../lib/monobank.types';
import {
  calculateChunkCount,
  splitDateRangeIntoChunks,
} from '../lib/utils/date.util';
import { MonoBankApiClient } from './monobank-api-client.service';
import { TransactionProcessor } from './transaction-processor.service';

type FetchTransactionsParams = {
  jobId: string;
  token: string;
  accountId: string;
  from: Date;
  to: Date;
};

@Injectable()
export class SyncJobManager {
  private readonly logger = new Logger(SyncJobManager.name);
  private readonly maxDaysPerRequest = 31;

  constructor(
    private readonly prismaService: PrismaService,
    private readonly apiClient: MonoBankApiClient,
    private readonly transactionProcessor: TransactionProcessor,
    private readonly contextBuilder: ContextBuilderService,
  ) {}

  async createBackgroundSyncJob(
    account: Account,
    from: Date,
    to: Date,
  ): Promise<SyncJobResponseDto> {
    const chunks = calculateChunkCount(from, to, this.maxDaysPerRequest);

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

    const estimatedTime = chunks * 60; // seconds

    return {
      jobId: syncJob.id,
      message: `Date range exceeds 31 days. Background sync started. Estimated time: ~${Math.ceil(estimatedTime / 60)} minutes. Track progress at GET /api/mono/sync-status/${syncJob.id}`,
    };
  }

  async getJobStatus(jobId: string): Promise<SyncProgressResponseDto> {
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

  private async processSyncJob(
    jobId: string,
    { monoToken, accountId, id, userId }: Account,
    from: Date,
    to: Date,
  ): Promise<void> {
    try {
      await this.prismaService.syncJob.update({
        where: { id: jobId },
        data: { status: SyncJobStatus.running },
      });

      const allTransactions = await this.fetchAllTransactionsWithProgress({
        jobId,
        token: monoToken,
        accountId,
        from,
        to,
      });

      this.logger.log(
        `Job ${jobId}: Fetched ${allTransactions.length} total transactions`,
      );

      const result = await this.transactionProcessor.saveTransactions(
        id,
        allTransactions,
      );

      await this.prismaService.account.update({
        where: { id },
        data: { lastSyncedAt: dayjs().toDate() },
      });

      this.contextBuilder.clearCache(userId);
      this.logger.log(
        `Cleared context cache for user ${userId} after background sync`,
      );

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

  private async fetchAllTransactionsWithProgress({
    jobId,
    token,
    accountId,
    from,
    to,
  }: FetchTransactionsParams) {
    const allTransactions: MonoBankTransaction[] = [];

    for (const chunk of splitDateRangeIntoChunks(
      from,
      to,
      this.maxDaysPerRequest,
    )) {
      this.logger.log(
        `Job ${jobId}: Fetching chunk ${chunk.chunkIndex + 1} from ${formatDateToIso(chunk.from)} to ${formatDateToIso(chunk.to)}`,
      );

      const transactions = await this.apiClient.getStatement(
        token,
        accountId,
        chunk.from,
        chunk.to,
      );

      allTransactions.push(...transactions);

      await this.prismaService.syncJob.update({
        where: { id: jobId },
        data: { progress: chunk.chunkIndex + 1 },
      });

      this.logger.log(
        `Job ${jobId}: Chunk ${chunk.chunkIndex + 1} completed, fetched ${transactions.length} transactions`,
      );
    }

    return allTransactions;
  }
}
