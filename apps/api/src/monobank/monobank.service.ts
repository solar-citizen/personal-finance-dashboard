import { BadRequestException, Injectable, Logger } from '@nestjs/common';
import { type Period } from '@pfd/shared';
import dayjs from 'dayjs';
import { Currency } from 'src/_generated/prisma-client/enums';
import {
  ConnectMonoBankDto,
  ExpenseCategoryResponseDto,
  MonoBankAccountResponseDto,
  SyncJobResponseDto,
  SyncProgressResponseDto,
  SyncResultResponseDto,
  SyncTransactionsDto,
  TransactionResponseDto,
} from 'src/_generated/zod/pfd-dtos';
import { formatDateToIso } from 'src/_lib/utils/date.util';
import { decrypt, encrypt } from 'src/_lib/utils/encryption.util';

import { ContextBuilderService } from '../ai/services/context-builder.service';
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

    this.contextBuilder.clearCache(userId);

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

    const transactions = await this.apiClient.getStatement({
      accountId: account.accountId,
      token: decrypt(account.monoToken),
      from,
      to,
    });

    this.logger.log(
      `Fetched ${transactions.length} transactions from MonoBank`,
    );

    const { newTransactions, updatedTransactions, errors } =
      await this.transactionProcessor.saveTransactions(
        account.id,
        transactions,
      );

    await this.prismaService.account.update({
      where: { id: account.id },
      data: { lastSyncedAt: dayjs().toDate() },
    });

    this.contextBuilder.clearCache(userId);
    this.logger.log(`Cleared context cache for user ${userId} after sync`);

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
  }

  async getSyncJobStatus(jobId: string): Promise<SyncProgressResponseDto> {
    return await this.syncJobManager.getJobStatus(jobId);
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
    const from = dayjs().subtract(1, period).toDate();

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
      const processedAmount = Math.abs(Number(amount)) / 100;

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
      entry.amount += processedAmount;

      return acc;
    }, {});

    return Object.values(expensesByCategory)
      .filter((val): val is ExpenseCategoryResponseDto => val !== undefined)
      .sort((a, b) => b.amount - a.amount);
  }
}
