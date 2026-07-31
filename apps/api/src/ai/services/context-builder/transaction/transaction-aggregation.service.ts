import { Injectable, Logger } from '@nestjs/common';
import dayjs from 'dayjs';
import { Currency } from 'src/_generated/prisma-client/enums';
import {
  AccountSummaryDto,
  TransactionWithRelationsDto,
} from 'src/_generated/zod/pfd-dtos';
import { amountToNumber } from 'src/_lib/utils/currency.util';
import type { DateRange } from 'src/_lib/utils/date-range.util';
import { currencyToIso4217, iso4217ToCurrency } from 'src/monobank/lib/utils';

import { PrismaService } from '../../../../db/prisma.service';
import { getCategoryName } from '../../_lib/utils';
import type {
  CategoryBreakdown,
  SpendingAggregates,
} from '../context-builder.types';

// The cap on how many individual transaction rows we ever inline as
// "examples" in the system prompt - not a cap on what we count or sum.
const transactionsLimit = 500;
const categoryTopN = 15;

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

    const currenciesInUse = new Set<Currency>();

    for (const { accountId } of transactions) {
      const currency = currencyByAccountId.get(accountId);

      if (currency && currency !== Currency.uah) {
        currenciesInUse.add(currency);
      }
    }

    const rateMaps = await this.getDailyRateMaps(
      currenciesInUse,
      dateRange.from,
      dateRange.to,
    );

    const totalsByCurrency = new Map<
      Currency,
      {
        total: number;
        incoming: number;
        outgoing: number;
        totalInUah: number;
        incomingInUah: number;
        outgoingInUah: number;
        count: number;
      }
    >();

    const totalsByCategory = new Map<
      string,
      { incoming: number; outgoing: number }
    >();

    let totalCashOut = 0;
    let totalCashIn = 0;

    const totalsByOperationCurrency = new Map<
      number,
      {
        currencyCode: number;
        currencyName: string;
        incoming: number;
        outgoing: number;
        count: number;
      }
    >();

    for (const transaction of transactions) {
      const { accountId, amount, time, category } = transaction;
      const currency = currencyByAccountId.get(accountId);

      if (!currency) {
        continue;
      }

      const rawVal = amountToNumber(amount);
      const dateKey = dayjs(time).format('YYYY-MM-DD');
      const rate =
        currency === Currency.uah
          ? 1
          : (rateMaps.get(currency)?.get(dateKey) ?? null);

      if (rate === null) {
        this.logger.warn(
          `No exchange rate for ${currency} on ${dateKey}; excluding transaction from aggregates`,
        );
        continue;
      }

      const valInUah = rawVal * rate;

      // --- byCurrency (raw + UAH equivalent) ---
      const existing = totalsByCurrency.get(currency) ?? {
        total: 0,
        incoming: 0,
        outgoing: 0,
        totalInUah: 0,
        incomingInUah: 0,
        outgoingInUah: 0,
        count: 0,
      };

      existing.total += rawVal;
      existing.totalInUah += valInUah;

      if (rawVal >= 0) {
        existing.incoming += rawVal;
        existing.incomingInUah += valInUah;
      } else {
        existing.outgoing += Math.abs(rawVal);
        existing.outgoingInUah += Math.abs(valInUah);
      }
      existing.count += 1;

      totalsByCurrency.set(currency, existing);

      // --- totalCashOut / totalCashIn (in UAH) ---
      if (valInUah < 0) {
        totalCashOut += Math.abs(valInUah);
      } else {
        totalCashIn += valInUah;
      }

      // --- byCategory (in UAH) ---
      const categoryName = getCategoryName(category);

      const existingCategory = totalsByCategory.get(categoryName) ?? {
        incoming: 0,
        outgoing: 0,
      };

      if (valInUah < 0) {
        existingCategory.outgoing += Math.abs(valInUah);
      } else {
        existingCategory.incoming += valInUah;
      }

      totalsByCategory.set(categoryName, existingCategory);

      // --- byOperationCurrency (cross-currency operational analytics) ---
      const txCurrencyCode = transaction.currencyCode;

      if (txCurrencyCode !== currencyToIso4217[currency]) {
        const opVal = amountToNumber(transaction.operationAmount);
        const existing = totalsByOperationCurrency.get(txCurrencyCode) ?? {
          currencyCode: txCurrencyCode,
          currencyName:
            iso4217ToCurrency[txCurrencyCode] ?? `ISO-${txCurrencyCode}`,
          incoming: 0,
          outgoing: 0,
          count: 0,
        };

        if (opVal >= 0) {
          existing.incoming += opVal;
        } else {
          existing.outgoing += Math.abs(opVal);
        }
        existing.count += 1;
        totalsByOperationCurrency.set(txCurrencyCode, existing);
      }
    }

    const byCurrency = [...totalsByCurrency.entries()].map(
      ([
        currency,
        {
          total,
          incoming,
          outgoing,
          totalInUah,
          incomingInUah,
          outgoingInUah,
          count,
        },
      ]) => ({
        currency,
        total,
        incoming,
        outgoing,
        totalInUah,
        incomingInUah,
        outgoingInUah,
        count,
      }),
    );

    const byCategory: CategoryBreakdown = [...totalsByCategory.entries()]
      .map(([category, { incoming, outgoing }]) => ({
        category,
        incoming,
        outgoing,
      }))
      .sort(
        (a, b) =>
          Math.abs(b.incoming + b.outgoing) - Math.abs(a.incoming + a.outgoing),
      );

    const topCategories = [...byCategory]
      .sort((a, b) => b.outgoing - a.outgoing)
      .slice(0, categoryTopN);

    const topCategoryNames = new Set(
      topCategories.map(({ category }) => category),
    );

    const rest = byCategory.filter(
      ({ category }) => !topCategoryNames.has(category),
    );

    return {
      byCurrency,
      byCategory,
      topCategories,
      otherCategoriesCount: rest.length,
      otherCategoriesOutgoing: rest.reduce(
        (total, { outgoing }) => total + outgoing,
        0,
      ),
      otherCategoriesIncoming: rest.reduce(
        (total, { incoming }) => total + incoming,
        0,
      ),
      totalCashOut,
      totalCashIn,
      byOperationCurrency: [...totalsByOperationCurrency.values()].filter(
        ({ currencyName }) => currencyName !== Currency.uah,
      ),
    };
  }

  /**
   * Builds a per-currency, per-day lookup of UAH exchange rates covering
   * [from, to]. Days with no published rate (weekends/holidays) carry
   * forward the most recent prior rate, matching how NBU rates actually
   * work.
   */
  private async getDailyRateMaps(
    currenciesInput: Iterable<Currency>,
    from: Date,
    to: Date,
  ): Promise<Map<Currency, Map<string, number>>> {
    const result = new Map<Currency, Map<string, number>>();
    const currencies = [...currenciesInput];

    if (currencies.length === 0 || from > to) {
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
      let list = ratesByCurrency.get(currency);

      if (!list) {
        list = [];
        ratesByCurrency.set(currency, list);
      }

      list.push({ date, rate: Number(rateToUah) });
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
