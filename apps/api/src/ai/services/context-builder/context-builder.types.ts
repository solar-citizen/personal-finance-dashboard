import { Currency } from 'src/_generated/prisma-client/enums';
import {
  AccountSummaryDto,
  CategorySummaryDto,
  ExchangeRatesDto,
  TransactionWithRelationsDto,
} from 'src/_generated/zod/pfd-dtos';

export type KnowledgeBaseEntry = {
  content: string;
  similarity: number;
};

export type CategoryBreakdown = {
  category: string;
  incoming: number;
  outgoing: number;
}[];

export type SpendingAggregates = {
  byCurrency: {
    currency: Currency;
    total: number;
    incoming: number;
    outgoing: number;
    totalInUah: number;
    incomingInUah: number;
    outgoingInUah: number;
    count: number;
  }[];
  byCategory: CategoryBreakdown;
  topCategories: CategoryBreakdown;
  otherCategoriesCount: number;
  otherCategoriesOutgoing: number;
  otherCategoriesIncoming: number;
  totalCashOut: number;
  totalCashIn: number;
  byOperationCurrency: {
    currencyCode: number;
    currencyName: string;
    incoming: number;
    outgoing: number;
    incomingInAccountCurrency?: number;
    outgoingInAccountCurrency?: number;
    count: number;
  }[];
};

/**
 * Result of an exact, filtered lookup (see TransactionSearchService).
 * Unlike the general display sample, this is either COMPLETE for its
 * filters, or explicitly flagged as truncated - never silently partial.
 */
export type MatchingTransactionsResult = {
  categoryName: string;
  transactions: TransactionWithRelationsDto[];
  truncated: boolean;
};

export type SystemPromptData = {
  accounts: AccountSummaryDto[];
  transactions: TransactionWithRelationsDto[];
  wasSampled: boolean;
  totalTransactionCount: number;
  dateRange: { from: string; to: string };
  categories: CategorySummaryDto[];
  knowledgeBase: KnowledgeBaseEntry[];
  exchangeRates: ExchangeRatesDto;
  aggregates: SpendingAggregates;
  matchingTransactions: MatchingTransactionsResult | null;
  isFullCategoryBreakdownRequested: boolean;
};

/**
 * What gets stored in Redis. Holds the expensive-to-compute,
 * message-INDEPENDENT data only. The rendered system prompt and
 * message-dependent flags (RAG hits, category detection, etc.) are
 * intentionally excluded — they must be recomputed on every request.
 */
export type CachedBundle = {
  accounts: AccountSummaryDto[];
  categories: CategorySummaryDto[];
  sampleTransactions: TransactionWithRelationsDto[];
  wasSampled: boolean;
  totalTransactionCount: number;
  actualDateRange: { from: string; to: string };
  aggregates: SpendingAggregates;
  exchangeRates: ExchangeRatesDto;
};
