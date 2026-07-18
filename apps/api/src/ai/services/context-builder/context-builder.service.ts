import { Injectable, Logger } from '@nestjs/common';
import dayjs from 'dayjs';
import { FinancialContextDto } from 'src/_generated/zod/pfd-dtos';
import { formatDateToIso, getDateRange } from 'src/_lib/utils/date.util';
import type { DateRange } from 'src/_lib/utils/date-range.util';
import { CurrencyService } from 'src/currency/currency.service';

import type { ContextLevel } from '../query-strategy.service';
import { ContextCacheService } from './context-cache.service';
import { KnowledgeBaseService } from './knowledge-base.service';
import { SystemPromptBuilderService } from './system-prompt-builder.service';
import { TransactionAggregationService } from './transaction/transaction-aggregation.service';
import { TransactionFetchService } from './transaction/transaction-fetch.service';
import { TransactionSearchService } from './transaction/transaction-search.service';

type ContextData = {
  userId: string;
  userMessage: string;
  contextLevel: ContextLevel;
};

@Injectable()
export class ContextBuilderService {
  private readonly logger = new Logger(ContextBuilderService.name);

  constructor(
    private readonly transactionFetchService: TransactionFetchService,
    private readonly transactionAggregationService: TransactionAggregationService,
    private readonly transactionSearchService: TransactionSearchService,
    private readonly systemPromptBuilderService: SystemPromptBuilderService,
    private readonly knowledgeBaseService: KnowledgeBaseService,
    private readonly contextCacheService: ContextCacheService,
    private readonly currencyService: CurrencyService,
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
        systemPrompt:
          this.systemPromptBuilderService.createMinimalSystemPrompt(),
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
    const cacheKey = this.contextCacheService.buildCacheKey(
      userId,
      effectiveRange,
    );
    const cached = await this.contextCacheService.get(cacheKey);

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
      this.transactionFetchService.getUserAccounts(userId),
      this.transactionFetchService.getCategories(),
      this.transactionFetchService.getAllTransactionsInRange(
        userId,
        effectiveRange,
      ),
      userMessage
        ? this.knowledgeBaseService.findRelevantKnowledge(userMessage)
        : Promise.resolve([]),
      this.currencyService.getExchangeRates(),
    ]);

    // Aggregates (money totals) and the sample (display examples) both
    // read from the SAME full array, so they can never drift apart.
    const aggregates =
      await this.transactionAggregationService.getSpendingAggregates(
        allTransactions,
        effectiveRange,
        accounts,
      );

    const { transactions: sampleTransactions, wasSampled } =
      this.transactionAggregationService.sampleTransactionsForDisplay(
        allTransactions,
      );

    // If this looks like a narrow "list my X transactions" request, fetch
    // the exact, complete set for that category instead of relying on the
    // general sample - see TransactionSearchService for the reasoning.
    const requestedCategory = userMessage
      ? this.transactionSearchService.detectRequestedCategory(
          userMessage,
          categories,
        )
      : null;

    const matchingTransactions = requestedCategory
      ? await this.transactionSearchService.findMatchingTransactions(
          userId,
          effectiveRange,
          requestedCategory,
        )
      : null;

    const totalTransactionCount = allTransactions.length;
    // The true span of transactions actually found - computed from the
    // full array, so it can't be narrower than reality the way deriving
    // it from the display sample used to be.
    const actualDateRange = getDateRange(allTransactions);

    const systemPrompt = this.systemPromptBuilderService.createSystemPrompt({
      accounts,
      transactions: sampleTransactions,
      wasSampled,
      totalTransactionCount,
      dateRange: actualDateRange,
      categories,
      knowledgeBase: relevantKnowledge,
      exchangeRates,
      aggregates,
      matchingTransactions,
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

    await this.contextCacheService.set(cacheKey, {
      prompt: systemPrompt,
      metadata,
    });

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

  async clearCache(userId?: string): Promise<void> {
    return await this.contextCacheService.clear(userId);
  }

  private getDefaultRange(): DateRange {
    const to = new Date();
    const from = dayjs(to).subtract(30, 'day').toDate();

    return { from, to };
  }
}
