import { CACHE_MANAGER } from '@nestjs/cache-manager';
import { Inject, Injectable, Logger } from '@nestjs/common';
import { accountTypeNames } from '@pfd/shared';
import type { Cache } from 'cache-manager';
import dayjs from 'dayjs';
import { Currency } from 'src/_generated/prisma-client/enums';
import {
  AccountSummaryDto,
  CategorySummaryDto,
  ExchangeRatesDto,
  FinancialContextDto,
  TransactionWithRelationsDto,
} from 'src/_generated/zod/pfd-dtos';
import {
  amountToNumber,
  formatAmount,
  formatCurrency,
} from 'src/_lib/utils/currency.util';
import {
  dayMs,
  formatDateToIso,
  getDateRange,
  hourMs,
  weekMs,
} from 'src/_lib/utils/date.util';
import type { DateRange } from 'src/_lib/utils/date-range.util';
import { formatValue } from 'src/_lib/utils/number.util';
import { formatEmbeddingVector } from 'src/_lib/utils/vector.util';
import { CurrencyService } from 'src/currency/currency.service';

import { PrismaService } from '../../db/prisma.service';
import {
  identityInstructions,
  languageInstructions,
  nonFinancialInstructions,
} from './lib/system-prompt-commons';
import { getCategoryName } from './lib/utils';
import { OllamaClientService } from './ollama-client.service';
import type { ContextLevel } from './query-strategy.service';

type KnowledgeBaseEntry = {
  content: string;
  similarity: number;
};

type SystemPromptData = {
  accounts: AccountSummaryDto[];
  transactions: TransactionWithRelationsDto[];
  wasSampled: boolean;
  totalTransactionCount: number;
  dateRange: { from: string; to: string };
  categories: CategorySummaryDto[];
  knowledgeBase: KnowledgeBaseEntry[];
  exchangeRates: ExchangeRatesDto;
  aggregates: {
    byCurrency: { currency: Currency; total: number; count: number }[];
    byCategory: { category: string; total: number }[];
  };
};

type ContextData = {
  userId: string;
  userMessage: string;
  contextLevel: ContextLevel;
};

type CachedPrompt = {
  prompt: string;
  metadata: {
    accountCount: number;
    transactionCount: number;
    categories: string[];
    dateRange: {
      from: string;
      to: string;
    };
  };
};

const transactionsLimit = 500;
const maxTransactionsFetch = 20_000;
const cacheKeyPrefix = 'context';
const cacheTtlMs = 600_000;
const isExceedsDay = (diff: number) => diff > dayMs;
const isExceedsWeek = (diff: number) => diff > weekMs;

@Injectable()
export class ContextBuilderService {
  private readonly logger = new Logger(ContextBuilderService.name);

  constructor(
    private readonly prismaService: PrismaService,
    private readonly ollamaClient: OllamaClientService,
    private readonly currencyService: CurrencyService,
    @Inject(CACHE_MANAGER) private readonly cacheManager: Cache,
  ) {}

  async buildContext({
    userId,
    userMessage,
    contextLevel,
    dateRange = null,
  }: ContextData & {
    dateRange?: DateRange | null;
  }): Promise<FinancialContextDto> {
    if (contextLevel === 'minimal') {
      const now = dayjs();

      return {
        systemPrompt: this.createMinimalSystemPrompt(),
        metadata: {
          accountCount: 0,
          transactionCount: 0,
          categories: [],
          dateRange: {
            from: formatDateToIso(now.toDate()),
            to: formatDateToIso(now.toDate()),
          },
          knowledgeBaseHits: 0,
          cached: false,
          minimal: true,
        },
      };
    }

    const effectiveRange = dateRange ?? this.getDefaultRange();
    const cacheKey = this.buildCacheKey(userId, effectiveRange);
    const cached = await this.cacheManager.get<CachedPrompt>(cacheKey);

    if (cached) {
      this.logger.log(`Using cached context for user ${userId}`);

      return {
        systemPrompt: cached.prompt,
        metadata: {
          ...cached.metadata,
          knowledgeBaseHits: 0,
          cached: true,
          minimal: false,
        },
      };
    }

    const [
      accounts,
      categories,
      allTransactions,
      relevantKnowledge,
      exchangeRates,
    ] = await Promise.all([
      this.getUserAccounts(userId),
      this.getCategories(),
      this.getAllTransactionsInRange(userId, effectiveRange),
      userMessage
        ? this.findRelevantKnowledge(userMessage)
        : Promise.resolve([]),
      this.currencyService.getExchangeRates(),
    ]);

    const aggregates = await this.getSpendingAggregates(
      allTransactions,
      effectiveRange,
      accounts,
    );

    const { transactions: sampleTransactions, wasSampled } =
      this.sampleTransactionsForDisplay(allTransactions);

    const totalTransactionCount = allTransactions.length;
    const actualDateRange = getDateRange(allTransactions);

    const systemPrompt = this.createSystemPrompt({
      accounts,
      transactions: sampleTransactions,
      wasSampled,
      totalTransactionCount,
      dateRange: actualDateRange,
      categories,
      knowledgeBase: relevantKnowledge,
      exchangeRates,
      aggregates,
    });

    const metadata = {
      accountCount: accounts.length,
      transactionCount: totalTransactionCount,
      categories: categories.map(({ name }) => name),
      dateRange: actualDateRange,
      knowledgeBaseHits: relevantKnowledge.length,
      minimal: false,
      requestedRange: {
        from: formatDateToIso(effectiveRange.from),
        to: formatDateToIso(effectiveRange.to),
      },
    };

    await this.cacheManager.set(
      cacheKey,
      {
        prompt: systemPrompt,
        metadata,
      },
      cacheTtlMs,
    );

    this.logger.log(`Cached context for user ${userId}`);

    return {
      systemPrompt,
      metadata: {
        ...metadata,
        knowledgeBaseHits: relevantKnowledge.length,
        cached: false,
      },
    };
  }

  private getDefaultRange(): DateRange {
    const to = new Date();
    const from = dayjs(to).subtract(30, 'day').toDate();

    return { from, to };
  }

  private getBucketSize(diff: number): number {
    if (isExceedsWeek(diff)) {
      return dayMs;
    }

    if (isExceedsDay(diff)) {
      return hourMs;
    }

    return cacheTtlMs;
  }

  private bucketTimestamp(time: number, bucketSize: number): number {
    return Math.floor(time / bucketSize) * bucketSize;
  }

  private buildCacheKey(userId: string, { from, to }: DateRange): string {
    const fromTime = from.getTime();
    const toTime = to.getTime();
    const diff = toTime - fromTime;

    const bucketSize = this.getBucketSize(diff);
    const bucketedFrom = this.bucketTimestamp(fromTime, bucketSize);
    const bucketedTo = this.bucketTimestamp(toTime, bucketSize);

    return `${cacheKeyPrefix}:${userId}:${bucketedFrom}:${bucketedTo}`;
  }

  private async findRelevantKnowledge(
    query: string,
    limit = 3,
  ): Promise<KnowledgeBaseEntry[]> {
    try {
      const embeddingVector = formatEmbeddingVector(
        await this.ollamaClient.generateEmbedding(query),
      );

      const results = await this.prismaService.$queryRaw<KnowledgeBaseEntry[]>`
        SELECT 
          content,
          1 - (embedding <=> ${embeddingVector}::vector) as similarity
        FROM "KnowledgeBase"
        WHERE 1 - (embedding <=> ${embeddingVector}::vector) > 0.7
        ORDER BY embedding <=> ${embeddingVector}::vector
        LIMIT ${limit}
      `;

      this.logger.log(
        `Found ${results.length} relevant knowledge entries for: "${query.substring(0, 50)}..."`,
      );

      return results;
    } catch (err: unknown) {
      this.logger.warn('Knowledge base search failed:', err);

      return [];
    }
  }

  private async getUserAccounts(userId: string): Promise<AccountSummaryDto[]> {
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

  private async getAllTransactionsInRange(
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

  private sampleTransactionsForDisplay(
    allTransactions: TransactionWithRelationsDto[],
  ): { transactions: TransactionWithRelationsDto[]; wasSampled: boolean } {
    if (allTransactions.length <= transactionsLimit) {
      return { transactions: allTransactions, wasSampled: false };
    }

    const recent = allTransactions.slice(0, 150);
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

  private async getSpendingAggregates(
    transactions: TransactionWithRelationsDto[],
    dateRange: DateRange,
    accounts: AccountSummaryDto[],
  ): Promise<{
    byCurrency: { currency: Currency; total: number; count: number }[];
    byCategory: { category: string; total: number }[];
  }> {
    const currencyByAccountId = new Map(
      accounts.map(({ id, currency }) => [id, currency]),
    );

    const totalsByCurrency = new Map<
      Currency,
      { total: number; count: number }
    >();

    for (const transaction of transactions) {
      const { accountId, amount } = transaction;

      const currency = currencyByAccountId.get(accountId);

      if (!currency) {
        // account no longer in user's account list
        continue;
      }

      const existing = totalsByCurrency.get(currency) ?? {
        total: 0,
        count: 0,
      };
      existing.total += amountToNumber(amount);
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

    const totalsByCategory = new Map<string, number>();

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

      totalsByCategory.set(
        categoryName,
        (totalsByCategory.get(categoryName) ?? 0) +
          amountToNumber(amount) * rate,
      );
    }

    const byCategory = Array.from(totalsByCategory.entries())
      .map(([category, total]) => ({ category, total }))
      .sort((a, b) => Math.abs(b.total) - Math.abs(a.total))
      .slice(0, 5);

    return { byCurrency, byCategory };
  }

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

  private async getCategories(): Promise<CategorySummaryDto[]> {
    return await this.prismaService.category.findMany({
      select: {
        id: true,
        name: true,
        mcc: true,
      },
    });
  }

  private createSystemPrompt({
    accounts,
    transactions,
    categories,
    knowledgeBase,
    exchangeRates,
    wasSampled,
    totalTransactionCount,
    dateRange,
    aggregates,
  }: SystemPromptData): string {
    const { usdToUah, eurToUah } = exchangeRates;
    const { from, to } = dateRange;

    const dateRangeLabel =
      totalTransactionCount > 0 ? `${from} to ${to}` : 'No recent transactions';

    const conversionRates: Record<Currency, number> = {
      [Currency.usd]: usdToUah,
      [Currency.eur]: eurToUah,
      [Currency.uah]: 1,
    };

    const formatted = accounts.map(({ balance, currency, type }) => {
      const amount = amountToNumber(balance);
      const amountInUah = amount * conversionRates[currency];
      const suffix =
        currency !== Currency.uah && amount !== 0
          ? ` = ${amountInUah.toFixed(2)} UAH`
          : '';

      return {
        line: `- ${accountTypeNames[type] || type} (${currency.toUpperCase()}): ${formatCurrency(balance, currency)}${suffix}`,
        amount: amountInUah,
      };
    });

    const allAccountsList = formatted.map(({ line }) => line).join('\n');
    const accountsSummary = formatted
      .filter(({ amount }) => amount !== 0)
      .map(({ line }) => line)
      .join('\n');

    const totalInUah = formatted.reduce((sum, { amount }) => sum + amount, 0);

    const { byCurrency, byCategory } = aggregates;

    const txSummary = byCurrency
      .map(
        ({ currency, count, total }) =>
          `- ${currency.toUpperCase()}: ${count} transactions, ${formatCurrency(total.toString(), currency)}`,
      )
      .join('\n');

    const categoryList = categories.map(({ name }) => name).join(', ');
    const topSpending = byCategory
      .map(({ category, total }) => `- ${category}: ${total.toFixed(2)}`)
      .join('\n');
    const knowledgeSection = this.formatKnowledgeSection(knowledgeBase);

    return `
      === IDENTITY ===
      ${identityInstructions}

      === EXCHANGE RATES (CURRENT) ===
      1 USD = ${formatValue(conversionRates.usd)} UAH
      1 EUR = ${formatValue(conversionRates.eur)} UAH
      1 UAH = 1 UAH

      === CALCULATION RULES ===
      When calculating totals:
        1. Convert each account to UAH using rates above
        2. Sum all converted amounts
        3. Show your calculation steps

      Example:
        - 929.22 EUR × 48.78 UAH/EUR = 45,327.80 UAH
        - 329.88 UAH = 329.88 UAH
        Total: 45,327.80 + 329.88 = 45,657.68 UAH

      === FINANCIAL SUMMARY ===
      Total Balance: ${formatAmount(totalInUah, { decimals: 2, divisor: 1 })} UAH
      Accounts: ${accounts.length}
      Total Transactions (${dateRangeLabel}): ${totalTransactionCount}
      ${
        wasSampled
          ? `
              Note: all totals and breakdowns below are calculated from all 
              ${totalTransactionCount} transactions. Only ${transactions.length} representative 
              examples are listed individually below (sampled for importance) - do not treat 
              ${transactions.length} as the real count.
            `
          : ''
      }

      Transactions by Currency:
      ${txSummary || 'No transactions'}

      Active Accounts:
      ${accountsSummary || 'No accounts with balance'}

      All Accounts:
      ${allAccountsList}

      Top Spending (${dateRangeLabel}):
      ${topSpending || 'No data'}

      Categories: ${categoryList}
      ${knowledgeSection}

      === CRITICAL RULES ===
      1. **TONE & STYLE**:
        - Be warm, polite, and conversational.
        - Write like a helpful human, not a robot.
        - Use natural language, avoid overly technical or formal tone.
        - Show empathy when discussing spending or finances.

      2. **CURRENCY CONVERSIONS**: You HAVE exchange rates above. When user asks about amounts in UAH/EUR/USD:
        - Use the rates provided
        - Don't ask for rates - YOU HAVE THEM.
        - Show calculations clearly
        - Example: "1,000 UAH ÷ ${formatAmount(eurToUah, { decimals: 2, divisor: 1 })} = X EUR"

      3. **TRANSACTION DATA**: You have FULL transaction data with currency info. When asked about spending by currency:
        - Analyze transactions from "Transactions by Currency" section
        - Show amounts per currency
        - Don't say "I don't have this data" - YOU HAVE IT.

      4. **LANGUAGE**: ${languageInstructions}

      5. **ACCOUNTS DISPLAY**:
        - By default show only non-zero accounts
        - Show all accounts only if explicitly asked
        - Use translated names (Чорна, Біла, єПідтримка), not technical names

      6. **NON-FINANCIAL QUESTIONS**: ${nonFinancialInstructions}

      7. **FORMATTING**: Be concise, no unnecessary explanations, direct answers with data

      === EXAMPLES ===
      ❌ BAD: "I don't have currency data for transactions"
      ✅ GOOD: "EUR spending: 150.50 EUR (see Transactions by Currency section)"

      ❌ BAD: "Please provide exchange rate"
      ✅ GOOD: "Using rate 1 EUR = ${formatAmount(eurToUah, { decimals: 2, divisor: 1 })} UAH: 5,000 UAH = 102.50 EUR"

      ❌ BAD: "Data shows: EUR=500, USD=200"
      ✅ GOOD: "You spent 500 EUR and 200 USD this month. Would you like to see this converted to UAH?"

      Remember: You have ALL data needed. Be confident, precise, helpful, and most importantly - human!`;
  }

  private formatKnowledgeSection(knowledgeBase: KnowledgeBaseEntry[]): string {
    if (knowledgeBase.length === 0) {
      return '';
    }

    const entries = knowledgeBase
      .map(({ content, similarity }, index) => {
        const relevancePercent = (similarity * 100).toFixed(0);
        return `${index + 1}. ${content} (relevance: ${relevancePercent}%)`;
      })
      .join('\n');

    return `\n\nRelevant Information:\n${entries}`;
  }

  private createMinimalSystemPrompt(): string {
    return `
      **IDENTITY**: ${identityInstructions}
      **NON-FINANCIAL QUESTIONS**: ${nonFinancialInstructions}
      **LANGUAGE**: ${languageInstructions}
    `;
  }

  async clearCache(userId?: string): Promise<void> {
    if (userId) {
      await this.cacheManager.del(`${cacheKeyPrefix}:${userId}`);
      this.logger.log(`Cleared cache for user ${userId}`);
    } else {
      await this.cacheManager.clear();
      this.logger.log('Cleared all cached prompts');
    }
  }
}
