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

export type SpendingAggregates = {
  byCurrency: { currency: Currency; total: number; count: number }[];
  byCategory: { category: string; total: number }[];
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
};

export type CachedPrompt = {
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
