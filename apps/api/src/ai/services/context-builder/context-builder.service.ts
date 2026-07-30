import { Injectable, Logger } from '@nestjs/common';
import dayjs from 'dayjs';
import { FinancialContextDto } from 'src/_generated/zod/pfd-dtos';
import { type DateRange, formatDateToIso, getDateRange } from 'src/_lib/utils';
import { CurrencyService } from 'src/currency/currency.service';

import { ConversationManagerService } from '../conversation-manager.service';
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
  dateRange?: DateRange | null;
  conversationId?: string;
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
    private readonly conversationManagerService: ConversationManagerService,
  ) {}

  async buildContext({
    userId,
    userMessage,
    contextLevel,
    dateRange = null,
    conversationId,
  }: ContextData): Promise<FinancialContextDto> {
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

    const effectiveRange =
      dateRange ?? (await this.resolveFallbackRange(conversationId, userId));
    const cacheKey = this.contextCacheService.buildCacheKey(
      userId,
      effectiveRange,
    );

    let cachedBundle = await this.contextCacheService.get(cacheKey);

    if (!cachedBundle) {
      const [accounts, categories, allTransactions, exchangeRates] =
        await Promise.all([
          this.transactionFetchService.getUserAccounts(userId),
          this.transactionFetchService.getCategories(),
          this.transactionFetchService.getAllTransactionsInRange(
            userId,
            effectiveRange,
          ),
          this.currencyService.getExchangeRates(),
        ]);

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

      cachedBundle = {
        accounts,
        categories,
        sampleTransactions,
        wasSampled,
        totalTransactionCount: allTransactions.length,
        actualDateRange: getDateRange(allTransactions),
        aggregates,
        exchangeRates,
      };

      await this.contextCacheService.set(cacheKey, cachedBundle);
      this.logger.log(`Cached context bundle for user ${userId}`);
    } else {
      this.logger.log(`Using cached context bundle for user ${userId}`);
    }

    const {
      accounts,
      actualDateRange,
      aggregates,
      categories,
      exchangeRates,
      sampleTransactions,
      totalTransactionCount,
      wasSampled,
    } = cachedBundle;

    // --- Everything below MUST run on every call, cache hit or miss ---
    const relevantKnowledge = userMessage
      ? await this.knowledgeBaseService.findRelevantKnowledge(userMessage)
      : [];

    const requestedCategory = userMessage
      ? this.transactionSearchService.detectRequestedCategory(
          userMessage,
          categories,
        )
      : null;

    const priorOfferedBreakdown = conversationId
      ? await this.conversationManagerService.getLastFullBreakdownOffer(
          conversationId,
          userId,
        )
      : false;

    const isFullCategoryBreakdownRequested = userMessage
      ? this.transactionSearchService.detectFullCategoryBreakdownRequest(
          userMessage,
          priorOfferedBreakdown,
        )
      : false;

    const matchingTransactions = requestedCategory
      ? await this.transactionSearchService.findMatchingTransactions(
          userId,
          effectiveRange,
          requestedCategory,
        )
      : null;

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
      isFullCategoryBreakdownRequested,
    });

    const willOfferFullBreakdown =
      !isFullCategoryBreakdownRequested && aggregates.otherCategoriesCount > 0;

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
      offeredFullBreakdown: willOfferFullBreakdown,
    };

    return {
      systemPrompt,
      metadata: { ...metadata, cached: !!cachedBundle },
    };
  }

  async clearCache(userId?: string): Promise<void> {
    return await this.contextCacheService.clear(userId);
  }

  private async resolveFallbackRange(
    conversationId: string | undefined,
    userId: string,
  ): Promise<DateRange> {
    if (conversationId) {
      const previousRange =
        await this.conversationManagerService.getLastDateRange(
          conversationId,
          userId,
        );

      if (previousRange) {
        this.logger.log(
          `No date range parsed from message; reusing previous range for conversation ${conversationId}:
          (${formatDateToIso(previousRange.from)} to ${formatDateToIso(previousRange.to)})`,
        );

        return previousRange;
      }
    }

    return this.getDefaultRange();
  }

  private getDefaultRange(): DateRange {
    const to = new Date();
    const from = dayjs(to).subtract(30, 'day').toDate();

    return { from, to };
  }
}
