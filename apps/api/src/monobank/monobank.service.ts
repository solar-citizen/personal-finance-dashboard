import { HttpService } from '@nestjs/axios';
import {
  BadRequestException,
  HttpException,
  HttpStatus,
  Injectable,
  Logger,
} from '@nestjs/common';
import { Account } from '@prisma/client';
import { firstValueFrom } from 'rxjs';
import { ConfigService } from 'src/config/config.service';
import { getErrorMessage } from 'src/lib/error-utils';
import { PrismaService } from '../db/prisma.service';
import { getCurrencyFromCode } from './lib/currency-utils';
import { isAxiosErrorWithResponse } from './lib/utils';
import { ConnectMonoBankDto, SyncTransactionsDto } from './monobank.dto';
import type {
  MonoBankAccountResponse,
  MonoBankClientInfo,
  MonoBankTransaction,
  SyncResultResponse,
} from './lib/types';

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
  ): Promise<MonoBankAccountResponse[]> {
    this.logger.log(`Connecting MonoBank account for user: ${userId}`);

    const clientInfo = await this.getClientInfo(token);

    if (!clientInfo.accounts || clientInfo.accounts.length === 0) {
      throw new BadRequestException('No accounts found for this token');
    }

    const savedAccounts: MonoBankAccountResponse[] = [];

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

  async getUserAccounts(userId: string): Promise<MonoBankAccountResponse[]> {
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
  ): Promise<SyncResultResponse> {
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

    const from = dto?.from
      ? new Date(dto.from)
      : account.lastSyncedAt
        ? new Date(account.lastSyncedAt)
        : new Date(to.getTime() - 31 * 24 * 60 * 60 * 1000);

    const daysDiff = Math.ceil(
      (to.getTime() - from.getTime()) / (1000 * 60 * 60 * 24),
    );

    if (daysDiff > 31) {
      throw new BadRequestException('Date range cannot exceed 31 days');
    }

    const transactions = await this.getStatement(
      account.monoToken,
      account.accountId,
      from,
      to,
    );

    this.logger.log(
      `Fetched ${transactions.length} transactions from MonoBank`,
    );

    const results = await Promise.all(
      transactions.map(async (tx) => {
        try {
          const category = await this.getCategoryByMcc(tx.mcc);

          const saved = await this.prismaService.transaction.upsert({
            where: {
              accountId_externalId: {
                accountId: account.id,
                externalId: tx.id,
              },
            },
            create: {
              accountId: account.id,
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

    // Update last synced timestamp
    await this.prismaService.account.update({
      where: { id: account.id },
      data: { lastSyncedAt: new Date() },
    });

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
  }: Account): MonoBankAccountResponse {
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
