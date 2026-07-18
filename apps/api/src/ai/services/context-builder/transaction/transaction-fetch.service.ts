import { Injectable, Logger } from '@nestjs/common';
import {
  AccountSummaryDto,
  CategorySummaryDto,
  TransactionWithRelationsDto,
} from 'src/_generated/zod/pfd-dtos';
import { formatDateToIso } from 'src/_lib/utils/date.util';
import type { DateRange } from 'src/_lib/utils/date-range.util';

import { PrismaService } from '../../../../db/prisma.service';

// Safety net only - not a designed limit. If a user's date range ever has
// this many transactions, we log a warning so truncation is visible
// instead of silently skewing totals/date-range the way past DB-level
// caps (take: 2000, then take: 5000) used to.
const maxTransactionsFetch = 20_000;

@Injectable()
export class TransactionFetchService {
  private readonly logger = new Logger(TransactionFetchService.name);

  constructor(private readonly prismaService: PrismaService) {}

  async getUserAccounts(userId: string): Promise<AccountSummaryDto[]> {
    return await this.prismaService.account.findMany({
      where: { userId },
      select: {
        id: true,
        type: true,
        currency: true,
        balance: true,
        iban: true,
      },
    });
  }

  async getCategories(): Promise<CategorySummaryDto[]> {
    return await this.prismaService.category.findMany({
      select: {
        id: true,
        name: true,
        mcc: true,
      },
    });
  }

  /**
   * Fetches EVERY transaction in the date range, once. This is the single
   * source of truth used both for money aggregates
   * (TransactionAggregationService) and for building the display sample -
   * no DB-level truncation that silently drops the oldest rows before
   * anything downstream even sees them.
   */
  async getAllTransactionsInRange(
    userId: string,
    dateRange: DateRange,
  ): Promise<TransactionWithRelationsDto[]> {
    const transactions = await this.prismaService.transaction.findMany({
      where: {
        account: { userId },
        time: { gte: dateRange.from, lte: dateRange.to },
      },
      include: {
        category: true,
        account: { select: { type: true, currency: true } },
      },
      orderBy: { time: 'desc' },
      take: maxTransactionsFetch,
    });

    if (transactions.length === maxTransactionsFetch) {
      this.logger.warn(
        `User ${userId} hit the ${maxTransactionsFetch}-transaction safety ` +
          `cap for range ${formatDateToIso(dateRange.from)} - ${formatDateToIso(dateRange.to)}. ` +
          'Totals/date-range for this request may be incomplete.',
      );
    }

    return transactions;
  }
}
