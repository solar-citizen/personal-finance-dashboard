import { Injectable, Logger } from '@nestjs/common';
import dayjs from 'dayjs';
import { Currency } from 'src/_generated/prisma-client/enums';
import {
  AccountSummaryDto,
  TransactionWithRelationsDto,
} from 'src/_generated/zod/pfd-dtos';
import { amountToNumber } from 'src/_lib/utils/currency.util';
import type { DateRange } from 'src/_lib/utils/date-range.util';

import { PrismaService } from '../../../../db/prisma.service';
import { getCategoryName } from '../../_lib/utils';
import { SpendingAggregates } from '../context-builder.types';

// The cap on how many individual transaction rows we ever inline as
// "examples" in the system prompt - not a cap on what we count or sum.
const transactionsLimit = 500;

@Injectable()
export class TransactionAggregationService {
  private readonly logger = new Logger(TransactionAggregationService.name);

  constructor(private readonly prismaService: PrismaService) {}

  /**
   * Picks a representative subset of `allTransactions` for the LLM to see
   * as concrete examples (so it can quote a real description/date/amount).
   * This NEVER feeds totals/counts/date-range shown to the user - those
   * always come from getSpendingAggregates, over the full array.
   */
  sampleTransactionsForDisplay(
    allTransactions: TransactionWithRelationsDto[],
  ): { transactions: TransactionWithRelationsDto[]; wasSampled: boolean } {
    if (allTransactions.length <= transactionsLimit) {
      return { transactions: allTransactions, wasSampled: false };
    }

    // allTransactions is ordered by time desc (most recent first).
    const recent = allTransactions.slice(0, 150);
    // Guarantees the earliest history is represented too - "recent" +
    // "highValue" + per-category samples all skew toward recent dates, so
    // without this, the oldest transactions almost never appear in the
    // sample even though they exist in the data.
    const oldest = allTransactions.slice(-50);

    const highValue = [...allTransactions]
      .sort((a, b) => Math.abs(Number(b.amount)) - Math.abs(Number(a.amount)))
      .slice(0, 200);

    const seenIds = new Set<string>();
    const core = [...recent, ...oldest, ...highValue].filter(({ id }) => {
      if (seenIds.has(id)) {
        return false;
      }

      seenIds.add(id);

      return true;
    });

    const categoryMap = new Map<string, TransactionWithRelationsDto[]>();

    for (const transaction of allTransactions) {
      const { id, category } = transaction;

      if (seenIds.has(id)) {
        continue;
      }

      const categoryName = getCategoryName(category);
      const bucket = categoryMap.get(categoryName);

      if (bucket) {
        bucket.push(transaction);
      } else {
        categoryMap.set(categoryName, [transaction]);
      }
    }

    const remainingBudget = transactionsLimit - core.length;
    const perCategoryLimit = Math.max(
      1,
      Math.floor(remainingBudget / (categoryMap.size || 1)),
    );

    const categorySamples: TransactionWithRelationsDto[] = [];

    for (const txs of categoryMap.values()) {
      categorySamples.push(...txs.slice(0, perCategoryLimit));
    }

    return {
      transactions: [...core, ...categorySamples].slice(0, transactionsLimit),
      wasSampled: true,
    };
  }

  /**
   * Computes totals from the FULL transaction array - never a sample.
   * Iterates row-by-row (not a SQL groupBy) because byCategory needs each
   * transaction's own date to look up the correct historical FX rate - a
   * SQL-level sum would collapse currency/date info before we can convert.
   */
  async getSpendingAggregates(
    transactions: TransactionWithRelationsDto[],
    dateRange: DateRange,
    accounts: AccountSummaryDto[],
  ): Promise<SpendingAggregates> {
    const currencyByAccountId = new Map(
      accounts.map(({ id, currency }) => [id, currency]),
    );

    const totalsByCurrency = new Map<
      Currency,
      { total: number; count: number }
    >();

    let totalCashOut = 0;
    let totalCashIn = 0;

    for (const transaction of transactions) {
      const { accountId, amount } = transaction;
      const val = amountToNumber(amount);

      if (val < 0) {
        totalCashOut += Math.abs(val);
      } else {
        totalCashIn += val;
      }

      const currency = currencyByAccountId.get(accountId);

      if (!currency) {
        continue;
      }

      const existing = totalsByCurrency.get(currency) ?? {
        total: 0,
        count: 0,
      };
      existing.total += val;
      existing.count += 1;
      totalsByCurrency.set(currency, existing);
    }

    const byCurrency = Array.from(totalsByCurrency.entries()).map(
      ([currency, { total, count }]) => ({ currency, total, count }),
    );

    const currenciesInUse = Array.from(
      new Set(
        transactions
          .map(({ accountId }) => currencyByAccountId.get(accountId))
          .filter((c): c is Currency => !!c && c !== Currency.uah),
      ),
    );

    const rateMaps = await this.getDailyRateMaps(
      currenciesInUse,
      dateRange.from,
      dateRange.to,
    );

    const totalsByCategory = new Map<
      string,
      { incoming: number; outgoing: number }
    >();

    for (const { accountId, amount, time, category } of transactions) {
      const currency = currencyByAccountId.get(accountId);

      if (!currency) {
        continue;
      }

      const dateKey = dayjs(time).format('YYYY-MM-DD');
      const rate =
        currency === Currency.uah
          ? 1
          : (rateMaps.get(currency)?.get(dateKey) ?? null);

      if (rate === null) {
        this.logger.warn(
          `No exchange rate for ${currency} on ${dateKey}; excluding transaction from Top Spending`,
        );
        continue;
      }

      const categoryName = getCategoryName(category);
      const val = amountToNumber(amount) * rate;

      const existing = totalsByCategory.get(categoryName) ?? {
        incoming: 0,
        outgoing: 0,
      };

      if (val < 0) {
        existing.outgoing += Math.abs(val);
      } else {
        existing.incoming += val;
      }

      totalsByCategory.set(categoryName, existing);
    }

    const byCategory = Array.from(totalsByCategory.entries())
      .map(([category, { incoming, outgoing }]) => ({
        category,
        incoming,
        outgoing,
      }))
      .sort(
        (a, b) =>
          Math.abs(b.incoming + b.outgoing) - Math.abs(a.incoming + a.outgoing),
      )
      .slice(0, 20);

    return { byCurrency, byCategory, totalCashOut, totalCashIn };
  }

  /**
   * Builds a per-currency, per-day lookup of UAH exchange rates covering
   * [from, to]. Days with no published rate (weekends/holidays) carry
   * forward the most recent prior rate, matching how NBU rates actually
   * work.
   */
  private async getDailyRateMaps(
    currencies: Currency[],
    from: Date,
    to: Date,
  ): Promise<Map<Currency, Map<string, number>>> {
    const result = new Map<Currency, Map<string, number>>();

    if (currencies.length === 0) {
      return result;
    }

    const rows = await this.prismaService.exchangeRateHistory.findMany({
      where: {
        currency: { in: currencies },
        date: { gte: dayjs(from).subtract(7, 'day').toDate(), lte: to },
      },
      orderBy: { date: 'asc' },
      select: { date: true, currency: true, rateToUah: true },
    });

    const ratesByCurrency = new Map<Currency, { date: Date; rate: number }[]>();

    for (const { date, currency, rateToUah } of rows) {
      const list = ratesByCurrency.get(currency) ?? [];
      list.push({ date, rate: Number(rateToUah) });
      ratesByCurrency.set(currency, list);
    }

    for (const currency of currencies) {
      result.set(
        currency,
        this.buildDailyRateMap(ratesByCurrency.get(currency) ?? [], from, to),
      );
    }

    return result;
  }

  private buildDailyRateMap(
    rates: { date: Date; rate: number }[],
    from: Date,
    to: Date,
  ): Map<string, number> {
    const map = new Map<string, number>();
    let rateIndex = 0;
    let currentRate: number | null = null;

    let cursor = dayjs(from).startOf('day');

    while (cursor.valueOf() <= dayjs(to).startOf('day').valueOf()) {
      while (
        rateIndex < rates.length &&
        dayjs(rates[rateIndex].date).valueOf() <= cursor.valueOf()
      ) {
        currentRate = rates[rateIndex].rate;
        rateIndex++;
      }

      if (currentRate !== null) {
        map.set(cursor.format('YYYY-MM-DD'), currentRate);
      }

      cursor = cursor.add(1, 'day');
    }

    return map;
  }
}
