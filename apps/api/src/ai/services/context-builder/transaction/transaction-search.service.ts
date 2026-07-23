import { Injectable, Logger } from '@nestjs/common';
import { CategorySummaryDto } from 'src/_generated/zod/pfd-dtos';
import type { DateRange } from 'src/_lib/utils/date-range.util';

import { PrismaService } from '../../../../db/prisma.service';
import { MatchingTransactionsResult } from '../context-builder.types';
import {
  breakdownConfirmationPattern,
  fullCategoryBreakdownPattern,
  listRequestPattern,
} from './patterns';

/**
 * Deliberately generous - this is a targeted, filtered query (usually one
 * category within the period), so it should rarely need truncating at
 * all. If it does, `truncated: true` is surfaced honestly in the prompt
 * rather than hidden.
 */
const maxMatchingTransactions = 300;

@Injectable()
export class TransactionSearchService {
  private readonly logger = new Logger(TransactionSearchService.name);

  constructor(private readonly prismaService: PrismaService) {}

  /**
   * Heuristically decides whether a user's message is asking for a
   * specific/complete list of transactions (rather than a summary), and
   * if so, which known category it's asking about.
   *
   * Known limitation: this only detects the CATEGORY, not a narrower date
   * range mentioned in the message itself (e.g. "in June 2022"). Reusing
   * that free-text date extraction is date-range.util.ts's job - wiring
   * this up to a narrower range once that's parsed is a follow-up, not
   * duplicated here.
   */
  detectRequestedCategory(
    userMessage: string,
    categories: CategorySummaryDto[],
  ): string | null {
    if (!listRequestPattern.test(userMessage)) {
      return null;
    }

    const lowerMessage = userMessage.toLowerCase();
    const matched = categories.find(({ name }) =>
      lowerMessage.includes(name.toLowerCase()),
    );

    return matched?.name ?? null;
  }

  detectFullCategoryBreakdownRequest(
    userMessage: string,
    priorTurnOfferedBreakdown = false,
  ): boolean {
    if (fullCategoryBreakdownPattern.test(userMessage)) {
      return true;
    }

    return (
      priorTurnOfferedBreakdown &&
      breakdownConfirmationPattern.test(userMessage.trim())
    );
  }

  /**
   * Runs an exact, filtered query and returns EVERY matching row (up to
   * the safety cap). This exists specifically so narrow requests like
   * "list my grocery purchases in June 2022" get a complete, exact answer
   * instead of depending on whether those rows happened to survive the
   * general-purpose ~500-row sample.
   */
  async findMatchingTransactions(
    userId: string,
    dateRange: DateRange,
    categoryName: string,
  ): Promise<MatchingTransactionsResult> {
    const rows = await this.prismaService.transaction.findMany({
      where: {
        account: { userId },
        time: { gte: dateRange.from, lte: dateRange.to },
        category: { name: { equals: categoryName, mode: 'insensitive' } },
      },
      include: {
        category: true,
        account: { select: { type: true, currency: true } },
      },
      orderBy: { time: 'desc' },
      take: maxMatchingTransactions + 1,
    });

    const truncated = rows.length > maxMatchingTransactions;

    if (truncated) {
      this.logger.log(
        `Matching-transaction lookup for user ${userId}, category ` +
          `"${categoryName}" exceeded ${maxMatchingTransactions} rows; ` +
          'flagging as truncated rather than silently cutting it.',
      );
    }

    return {
      categoryName,
      transactions: rows.slice(0, maxMatchingTransactions),
      truncated,
    };
  }
}
