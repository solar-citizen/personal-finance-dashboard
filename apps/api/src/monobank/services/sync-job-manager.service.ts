import { BadRequestException, Injectable, Logger } from '@nestjs/common';
import dayjs from 'dayjs';
import { Account, SyncJobStatus } from 'src/_generated/prisma-client/client';
import {
  SyncJobResponseDto,
  SyncProgressResponseDto,
} from 'src/_generated/zod/pfd-dtos';
import { decrypt, formatDateToIso, getErrorMessage } from 'src/_lib/utils';
import { ContextBuilderService } from 'src/ai/services/context-builder/context-builder.service';
import { PrismaService } from 'src/db/prisma.service';

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

    const { id } = await this.prismaService.syncJob.create({
      data: {
        accountId: account.id,
        status: SyncJobStatus.pending,
        from,
        to,
        total: chunks,
        progress: 0,
      },
    });

    this.processSyncJob(id, account, from, to).catch((err: unknown) => {
      this.logger.error(`Background sync job ${id} failed:`, err);
    });

    const estimatedTime = chunks * 60; // seconds

    return {
      jobId: id,
      message: `Date range exceeds 31 days. Background sync started. Estimated time: ~${Math.ceil(estimatedTime / 60)} minutes. Track progress at GET /api/mono/sync-status/${id}`,
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
      errorMessage: job.errorMessage ?? undefined,
    };
  }

  async claimJobForSaving(jobId: string): Promise<boolean> {
    while (await this.waitForRunningJob(jobId)) {
      const { count } = await this.prismaService.syncJob.updateMany({
        where: { id: jobId, status: SyncJobStatus.running },
        data: { status: SyncJobStatus.saving },
      });

      if (count === 1) {
        return true;
      }
    }

    return false;
  }

  private async processSyncJob(
    jobId: string,
    { monoToken, accountId, id, userId }: Account,
    from: Date,
    to: Date,
  ): Promise<void> {
    try {
      const started = await this.prismaService.syncJob.updateMany({
        where: { id: jobId, status: SyncJobStatus.pending },
        data: { status: SyncJobStatus.running },
      });

      if (started.count === 0) {
        return;
      }

      if (!monoToken) {
        throw new Error('MonoBank token is missing for the account');
      }

      const allTransactions = await this.fetchAllTransactionsWithProgress({
        jobId,
        token: decrypt(monoToken),
        accountId,
        from,
        to,
      });

      if (!(await this.claimJobForSaving(jobId))) {
        this.logger.log(`Job ${jobId} stopped before saving transactions.`);
        return;
      }

      this.logger.log(
        `Job ${jobId}: Fetched ${allTransactions.length} total transactions`,
      );

      const { newTransactions, updatedTransactions, errors } =
        await this.transactionProcessor.saveTransactions(id, allTransactions);

      await this.prismaService.account.update({
        where: { id },
        data: { lastSyncedAt: dayjs().toDate() },
      });

      await this.contextBuilder.clearCache(userId);

      this.logger.log(
        `Cleared context cache for user ${userId} after background sync`,
      );

      const completed = await this.prismaService.syncJob.updateMany({
        where: { id: jobId, status: SyncJobStatus.saving },
        data: {
          status: SyncJobStatus.completed,
          newCount: newTransactions,
          updatedCount: updatedTransactions,
          errorMessage: errors.length > 0 ? errors.join('; ') : null,
        },
      });

      if (completed.count === 0) {
        throw new Error(`Sync job ${jobId} could not be marked completed`);
      }

      this.logger.log(`Job ${jobId}: Completed successfully`);
    } catch (err: unknown) {
      this.logger.error(`Job ${jobId}: Failed with error:`, err);

      await this.prismaService.syncJob.updateMany({
        where: {
          id: jobId,
          status: {
            in: [
              SyncJobStatus.pending,
              SyncJobStatus.running,
              SyncJobStatus.paused,
              SyncJobStatus.saving,
            ],
          },
        },
        data: {
          status: SyncJobStatus.failed,
          errorMessage: getErrorMessage(err),
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
      if (!(await this.waitForRunningJob(jobId))) {
        break;
      }

      this.logger.log(
        `Job ${jobId}: Fetching chunk ${chunk.chunkIndex + 1} from ${formatDateToIso(chunk.from)} to ${formatDateToIso(chunk.to)}`,
      );

      const transactions = await this.apiClient.getStatement({
        accountId,
        token,
        from: chunk.from,
        to: chunk.to,
      });

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

  private async waitForRunningJob(jobId: string): Promise<boolean> {
    let job = await this.prismaService.syncJob.findUnique({
      where: { id: jobId },
      select: { status: true },
    });

    while (job?.status === SyncJobStatus.paused) {
      this.logger.log(`Job ${jobId} is paused. Waiting...`);
      await new Promise((resolve) => setTimeout(resolve, 5000));
      job = await this.prismaService.syncJob.findUnique({
        where: { id: jobId },
        select: { status: true },
      });
    }

    return job?.status === SyncJobStatus.running;
  }
}
