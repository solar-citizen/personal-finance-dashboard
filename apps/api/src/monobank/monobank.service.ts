import { BadRequestException, Injectable, Logger } from '@nestjs/common';
import { type Period } from '@pfd/shared';
import dayjs from 'dayjs';
import { SyncJobStatus } from 'src/_generated/prisma-client/client';
import { Bank, Currency } from 'src/_generated/prisma-client/enums';
import {
  CashFlowPointResponseDto,
  ConnectMonoBankDto,
  ExpenseCategoryResponseDto,
  MonoBankAccountResponseDto,
  SyncJobResponseDto,
  SyncJobsPageResponseDto,
  SyncProgressResponseDto,
  SyncResultResponseDto,
  SyncTransactionsDto,
  TransactionResponseDto,
} from 'src/_generated/zod/pfd-dtos';
import { formatDateToIso, getErrorMessage } from 'src/_lib/utils';
import { decrypt, encrypt } from 'src/_lib/utils/encryption.util';

import { ContextBuilderService } from '../ai/services/context-builder/context-builder.service';
import { PrismaService } from '../db/prisma.service';
import {
  calculateSyncDateRange,
  formatAccountResponse,
  iso4217ToCurrency,
} from './lib/utils';
import {
  MonoBankApiClient,
  SyncJobManager,
  TransactionProcessor,
} from './services/';

@Injectable()
export class MonoBankService {
  private readonly logger = new Logger(MonoBankService.name);

  constructor(
    private readonly prismaService: PrismaService,
    private readonly apiClient: MonoBankApiClient,
    private readonly syncJobManager: SyncJobManager,
    private readonly transactionProcessor: TransactionProcessor,
    private readonly contextBuilder: ContextBuilderService,
  ) {}

  async connectAccount(
    userId: string,
    { token }: ConnectMonoBankDto,
  ): Promise<MonoBankAccountResponseDto[]> {
    const iso4217ToCurrency: Record<number, Currency> = {
      980: Currency.uah,
      840: Currency.usd,
      978: Currency.eur,
    };

    this.logger.log(`Connecting MonoBank account for user: ${userId}`);

    const { accounts } = await this.apiClient.getClientInfo(token);

    if (accounts.length === 0) {
      throw new BadRequestException('No accounts found for this token');
    }

    const savedAccounts: MonoBankAccountResponseDto[] = [];
    const encryptedToken = encrypt(token);

    for (const {
      currencyCode,
      id,
      iban,
      type,
      balance,
      creditLimit,
    } of accounts) {
      const currency = iso4217ToCurrency[currencyCode];

      const savedAccount = await this.prismaService.account.upsert({
        where: {
          userId_accountId: {
            userId,
            accountId: id,
          },
        },
        create: {
          userId,
          accountId: id,
          iban,
          type,
          currency,
          balance: BigInt(balance),
          creditLimit: BigInt(creditLimit),
          monoToken: encryptedToken,
        },
        update: {
          iban,
          type,
          currency,
          balance: BigInt(balance),
          creditLimit: BigInt(creditLimit),
          monoToken: encryptedToken,
        },
      });

      savedAccounts.push(formatAccountResponse(savedAccount));
    }

    this.logger.log(
      `Connected ${savedAccounts.length} accounts for user: ${userId}`,
    );

    await this.contextBuilder.clearCache(userId);

    return savedAccounts;
  }

  async getUserAccounts(userId: string): Promise<MonoBankAccountResponseDto[]> {
    const accounts = await this.prismaService.account.findMany({
      where: { userId, bank: Bank.monobank },
      orderBy: { createdAt: 'asc' },
    });

    return accounts.map(formatAccountResponse);
  }

  async syncTransactions(
    userId: string,
    accountId: string,
    dto?: SyncTransactionsDto,
  ): Promise<SyncResultResponseDto | SyncJobResponseDto> {
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

    const toDate = dto?.to ? dayjs(dto.to).toDate() : dayjs().toDate();
    const { from, to, daysDiff } = calculateSyncDateRange(
      account.lastSyncedAt,
      toDate,
      dto?.from ? dayjs(dto.from).toDate() : undefined,
      dto?.fullHistory,
    );

    this.logger.log(`Account ${accountId}: daysDiff = ${daysDiff} days`);

    if (
      account.lastSyncedAt &&
      !dto?.from &&
      !dto?.fullHistory &&
      daysDiff === 31
    ) {
      const lastSyncDaysDiff = dayjs(toDate).diff(
        dayjs(account.lastSyncedAt),
        'day',
      );

      if (lastSyncDaysDiff > 31) {
        this.logger.warn(
          `Account ${accountId}: Gap detected. Last sync: ${formatDateToIso(account.lastSyncedAt)}, syncing from: ${formatDateToIso(from)}. Use fullHistory: true to sync all missing transactions.`,
        );
      }
    }

    if (daysDiff > 31) {
      return this.syncJobManager.createBackgroundSyncJob(account, from, to);
    }

    const job = await this.prismaService.syncJob.create({
      data: {
        accountId: account.id,
        status: SyncJobStatus.running,
        from,
        to,
        total: 1,
        progress: 0,
      },
    });

    try {
      const transactions = await this.apiClient.getStatement({
        accountId: account.accountId,
        token: decrypt(account.monoToken),
        from,
        to,
      });

      this.logger.log(
        `Fetched ${transactions.length} transactions from MonoBank`,
      );

      if (!(await this.syncJobManager.claimJobForSaving(job.id))) {
        return {
          jobId: job.id,
          message: `Sync job ${job.id} was cancelled before saving transactions.`,
        };
      }

      const { newTransactions, updatedTransactions, errors } =
        await this.transactionProcessor.saveTransactions(
          account.id,
          transactions,
        );

      await this.prismaService.account.update({
        where: { id: account.id },
        data: { lastSyncedAt: dayjs().toDate() },
      });

      await this.contextBuilder.clearCache(userId);
      this.logger.log(`Cleared context cache for user ${userId} after sync`);

      const completed = await this.prismaService.syncJob.updateMany({
        where: { id: job.id, status: SyncJobStatus.saving },
        data: {
          status: SyncJobStatus.completed,
          progress: 1,
          newCount: newTransactions,
          updatedCount: updatedTransactions,
          errorMessage: errors.length > 0 ? errors.join('; ') : null,
        },
      });

      if (completed.count === 0) {
        throw new Error(`Sync job ${job.id} could not be marked completed`);
      }

      this.logger.log(
        `Sync complete: ${newTransactions} new, ${updatedTransactions} updated, ${errors.length} errors`,
      );

      return {
        success: true,
        synced: transactions.length,
        newTransactions,
        updatedTransactions,
        errors: errors.length > 0 ? errors : undefined,
      };
    } catch (err: unknown) {
      await this.prismaService.syncJob.updateMany({
        where: {
          id: job.id,
          status: {
            in: [
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
      throw err;
    }
  }

  async getSyncJobStatus(jobId: string): Promise<SyncProgressResponseDto> {
    return await this.syncJobManager.getJobStatus(jobId);
  }

  async getSyncJobs(
    userId: string,
    page: number,
    limit: number,
  ): Promise<SyncJobsPageResponseDto> {
    const accounts = await this.prismaService.account.findMany({
      where: { userId },
      select: { id: true },
    });
    const accountIds = accounts.map((a) => a.id);

    if (accountIds.length === 0) {
      return { items: [], total: 0, page, limit };
    }

    const [total, jobs] = await this.prismaService.$transaction([
      this.prismaService.syncJob.count({
        where: { accountId: { in: accountIds } },
      }),
      this.prismaService.syncJob.findMany({
        where: { accountId: { in: accountIds } },
        orderBy: { createdAt: 'desc' },
        skip: (page - 1) * limit,
        take: limit,
      }),
    ]);

    return {
      items: jobs.map((job) => ({
        ...job,
        from: job.from.toISOString(),
        to: job.to.toISOString(),
        createdAt: job.createdAt.toISOString(),
        updatedAt: job.updatedAt.toISOString(),
        errorMessage: job.errorMessage ?? null,
      })),
      total,
      page,
      limit,
    };
  }

  async cancelSyncJob(
    userId: string,
    jobId: string,
  ): Promise<SyncJobResponseDto> {
    await this.getUserSyncJob(userId, jobId);

    const { count } = await this.prismaService.syncJob.updateMany({
      where: {
        id: jobId,
        status: {
          in: [
            SyncJobStatus.pending,
            SyncJobStatus.running,
            SyncJobStatus.paused,
          ],
        },
      },
      data: { status: SyncJobStatus.cancelled },
    });

    if (count === 0) {
      throw new BadRequestException('Only active sync jobs can be cancelled');
    }

    return {
      jobId,
      message: `Sync job ${jobId} cancelled.`,
    };
  }

  async pauseSyncJob(
    userId: string,
    jobId: string,
  ): Promise<SyncJobResponseDto> {
    await this.getUserSyncJob(userId, jobId);

    const { count } = await this.prismaService.syncJob.updateMany({
      where: { id: jobId, status: SyncJobStatus.running },
      data: { status: SyncJobStatus.paused },
    });

    if (count === 0) {
      throw new BadRequestException('Only running sync jobs can be paused');
    }

    return {
      jobId,
      message: `Sync job ${jobId} paused.`,
    };
  }

  async resumeSyncJob(
    userId: string,
    jobId: string,
  ): Promise<SyncJobResponseDto> {
    await this.getUserSyncJob(userId, jobId);

    const { count } = await this.prismaService.syncJob.updateMany({
      where: { id: jobId, status: SyncJobStatus.paused },
      data: { status: SyncJobStatus.running },
    });

    if (count === 0) {
      throw new BadRequestException('Only paused sync jobs can be resumed');
    }

    return {
      jobId,
      message: `Sync job ${jobId} resumed.`,
    };
  }

  async retrySyncJob(
    userId: string,
    jobId: string,
  ): Promise<SyncResultResponseDto | SyncJobResponseDto> {
    const job = await this.getUserSyncJob(userId, jobId);

    if (
      job.status !== SyncJobStatus.failed &&
      job.status !== SyncJobStatus.cancelled
    ) {
      throw new BadRequestException(
        'Only failed or cancelled jobs can be retried',
      );
    }

    return this.syncTransactions(userId, job.accountId, {
      from: job.from.toISOString(),
      to: job.to.toISOString(),
    });
  }

  private async getUserSyncJob(userId: string, jobId: string) {
    const job = await this.prismaService.syncJob.findUnique({
      where: { id: jobId },
      include: { account: true },
    });

    if (job?.account.userId !== userId) {
      throw new BadRequestException('Sync job not found');
    }

    return job;
  }

  async getLatestTransactions(
    userId: string,
    limit: number,
  ): Promise<TransactionResponseDto[]> {
    const transactions = await this.prismaService.transaction.findMany({
      where: { account: { userId } },
      orderBy: { time: 'desc' },
      take: limit,
      include: {
        category: {
          select: { id: true, name: true, icon: true },
        },
        account: {
          select: { id: true, type: true },
        },
      },
    });

    return transactions.map(
      ({ id, category, account, amount, currencyCode, time, description }) => ({
        id,
        category: category
          ? { id: category.id, name: category.name, icon: category.icon }
          : null,
        account: { id: account.id, type: account.type },
        amount: Number(amount) / 100,
        currencyCode: iso4217ToCurrency[currencyCode],
        time: time.toISOString(),
        description,
      }),
    );
  }

  async getHighestExpenses(
    userId: string,
    period: Period,
  ): Promise<ExpenseCategoryResponseDto[]> {
    const from =
      period === '5years'
        ? dayjs().subtract(5, 'year').toDate()
        : dayjs().subtract(1, period).toDate();

    const transactions = await this.prismaService.transaction.findMany({
      where: {
        account: { userId },
        time: { gte: from },
        amount: { lt: 0 },
        category: { isNot: null },
      },
      include: {
        category: { select: { id: true, name: true, icon: true } },
      },
    });

    const expensesByCategory = transactions.reduce<
      Record<string, ExpenseCategoryResponseDto | undefined>
    >((acc, { category, amount, currencyCode }) => {
      if (!category) {
        return acc;
      }

      const { id, name, icon } = category;

      let entry = acc[id];

      if (!entry) {
        entry = {
          category: {
            id,
            name,
            icon,
          },
          amount: 0,
          currency: iso4217ToCurrency[currencyCode],
        };
        acc[id] = entry;
      }
      entry.amount += Math.abs(Number(amount)) / 100;

      return acc;
    }, {});

    return Object.values(expensesByCategory)
      .filter((val): val is ExpenseCategoryResponseDto => val !== undefined)
      .sort((a, b) => b.amount - a.amount);
  }

  async getCashFlowTrend(
    userId: string,
    period: Period,
  ): Promise<CashFlowPointResponseDto[]> {
    const transactions = await this.prismaService.transaction.findMany({
      where: { account: { userId } },
      orderBy: { time: 'asc' },
    });

    const currentYear = dayjs().year();
    const timelineMap = new Map<
      string,
      {
        date: string;
        label: string;
        income: number;
        expense: number;
        netBalance: number;
      }
    >();

    if (period === 'year') {
      for (let q = 1; q <= 4; q++) {
        const key = `${currentYear}-Q${q}`;
        timelineMap.set(key, {
          date: key,
          label: `${currentYear} Q${q}`,
          income: 0,
          expense: 0,
          netBalance: 0,
        });
      }
    } else if (period === '5years') {
      for (let i = 4; i >= 0; i--) {
        const y = currentYear - i;
        const key = String(y);
        timelineMap.set(key, {
          date: key,
          label: String(y),
          income: 0,
          expense: 0,
          netBalance: 0,
        });
      }
    }

    let initialCarryNet = 0;
    let runningNet = 0;

    transactions.forEach((tx) => {
      const time = dayjs(tx.time);
      const amount = Number(tx.amount) / 100;
      let key: string;
      let label: string;

      if (period === '5years') {
        key = time.format('YYYY');
        label = time.format('YYYY');
      } else if (period === 'year') {
        const quarter = Math.ceil((time.month() + 1) / 3);
        key = `${time.format('YYYY')}-Q${quarter}`;
        label = `${time.format('YYYY')} Q${quarter}`;
      } else {
        key = time.format('YYYY-MM-DD');
        label = time.format('YYYY-MM-DD');
      }

      runningNet += amount;

      if (period === 'year' || period === '5years') {
        const existing = timelineMap.get(key);

        if (existing) {
          if (amount > 0) {
            existing.income += amount;
          } else {
            existing.expense += Math.abs(amount);
          }
          existing.netBalance = runningNet;
        } else {
          initialCarryNet = runningNet;
        }
      } else {
        let existing = timelineMap.get(key);

        if (!existing) {
          existing = {
            date: key,
            label,
            income: 0,
            expense: 0,
            netBalance: 0,
          };
          timelineMap.set(key, existing);
        }

        if (amount > 0) {
          existing.income += amount;
        } else {
          existing.expense += Math.abs(amount);
        }
        existing.netBalance = runningNet;
      }
    });

    let carryNet = initialCarryNet;
    const chartData = [...timelineMap.entries()]
      .sort(([a], [b]) => a.localeCompare(b))
      .map(([, item]) => {
        if (item.netBalance === 0 && item.income === 0 && item.expense === 0) {
          item.netBalance = carryNet;
        } else {
          carryNet = item.netBalance;
        }

        return item;
      });

    const now = dayjs();
    let cutoff: dayjs.Dayjs;

    switch (period) {
      case 'day':
        cutoff = now.subtract(1, 'day').startOf('day');
        break;
      case 'week':
        cutoff = now.subtract(7, 'day').startOf('day');
        break;
      case 'month':
        cutoff = now.subtract(30, 'day').startOf('day');
        break;
      case 'year':
        cutoff = now.startOf('year');
        break;
      case '5years':
        cutoff = now.subtract(5, 'year').startOf('day');
        break;
    }

    return period === 'year' || period === '5years'
      ? chartData
      : chartData.filter(
          ({ date }) => dayjs(date).valueOf() >= cutoff.valueOf(),
        );
  }
}
