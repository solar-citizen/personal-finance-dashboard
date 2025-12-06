import { Injectable, Logger } from '@nestjs/common';
import dayjs from 'dayjs';
import {
  amountToNumber,
  formatAmount,
  formatCurrency,
} from 'src/_lib/utils/currency.util';
import { formatDateToIso, getDateRange } from 'src/_lib/utils/date.util';
import { formatValue } from 'src/_lib/utils/number.util';
import { formatEmbeddingVector } from 'src/_lib/utils/vector.util';
import {
  AccountSummaryDto,
  CategorySummaryDto,
  ExchangeRatesDto,
  FinancialContextDto,
  TransactionWithRelationsDto,
} from 'src/@generated/zod/pfd-dtos';
import { CurrencyService } from 'src/currency/currency.service';
import { getAccountTypeName } from 'src/monobank/lib/utils/currency.util';

import { PrismaService } from '../../db/prisma.service';
import {
  identityInstructions,
  languageInstructions,
  nonFinancialInstructions,
} from './lib/system-prompt-commons';
import { OllamaClientService } from './ollama-client.service';
import type { ContextLevel } from './query-strategy.service';

type CategoryRecord = Record<
  NonNullable<TransactionWithRelationsDto['category']>['name'],
  number
>;

type KnowledgeBaseEntry = {
  content: string;
  similarity: number;
};

type SystemPromptData = {
  accounts: AccountSummaryDto[];
  transactions: TransactionWithRelationsDto[];
  categories: CategorySummaryDto[];
  knowledgeBase: KnowledgeBaseEntry[];
  exchangeRates: ExchangeRatesDto;
};

type ContextData = {
  userId: string;
  userMessage: string;
  contextLevel: ContextLevel;
};

type CachedPrompt = {
  prompt: string;
  timestamp: number;
  metadata: {
    accountCount: number;
    transactionCount: number;
    categories: string[];
    dateRange: { from: string; to: string };
  };
};

@Injectable()
export class ContextBuilderService {
  private readonly logger = new Logger(ContextBuilderService.name);
  private promptCache = new Map<string, CachedPrompt>();
  private readonly cacheTtl = 10 * 60 * 1000;

  constructor(
    private readonly prismaService: PrismaService,
    private readonly ollamaClient: OllamaClientService,
    private readonly currencyService: CurrencyService,
  ) {}

  async buildContext({
    userId,
    userMessage,
    contextLevel,
  }: ContextData): Promise<FinancialContextDto> {
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

    const cached = this.promptCache.get(userId);
    const now = dayjs();

    if (cached && now.valueOf() - cached.timestamp < this.cacheTtl) {
      this.logger.log(`Using cached context for user ${userId}`);

      return {
        systemPrompt: cached.prompt,
        metadata: {
          ...cached.metadata,
          knowledgeBaseHits: 0,
          cached: true,
          minimal: true,
        },
      };
    }

    const [
      accounts,
      recentTransactions,
      categories,
      relevantKnowledge,
      exchangeRates,
    ] = await Promise.all([
      this.getUserAccounts(userId),
      this.getRecentTransactions(userId),
      this.getCategories(),
      userMessage
        ? this.findRelevantKnowledge(userMessage)
        : Promise.resolve([]),
      this.currencyService.getExchangeRates(),
    ]);

    const systemPrompt = this.createSystemPrompt({
      accounts,
      transactions: recentTransactions,
      categories,
      knowledgeBase: relevantKnowledge,
      exchangeRates,
    });

    const metadata = {
      accountCount: accounts.length,
      transactionCount: recentTransactions.length,
      categories: categories.map(({ name }) => name),
      dateRange: getDateRange(recentTransactions),
      knowledgeBaseHits: relevantKnowledge.length,
      minimal: false,
    };

    this.promptCache.set(userId, {
      prompt: systemPrompt,
      timestamp: now.valueOf(),
      metadata,
    });

    return {
      systemPrompt,
      metadata: {
        ...metadata,
        knowledgeBaseHits: relevantKnowledge.length,
        cached: false,
      },
    };
  }

  private async findRelevantKnowledge(
    query: string,
    limit = 3,
  ): Promise<KnowledgeBaseEntry[]> {
    try {
      const queryEmbedding = await this.ollamaClient.generateEmbedding(query);
      const embeddingVector = formatEmbeddingVector(queryEmbedding);

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

  private async getRecentTransactions(
    userId: string,
  ): Promise<TransactionWithRelationsDto[]> {
    const thirtyDaysAgo = dayjs().subtract(30, 'day').toDate();

    return await this.prismaService.transaction.findMany({
      where: {
        account: { userId },
        time: { gte: thirtyDaysAgo },
      },
      include: {
        category: true,
        account: {
          select: {
            type: true,
            currency: true,
          },
        },
      },
      orderBy: { time: 'desc' },
      take: 100,
    });
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
  }: SystemPromptData): string {
    const { USD, EUR } = exchangeRates;
    const usdToUah = 1 / USD;
    const eurToUah = 1 / EUR;

    const conversionRates: Record<string, number> = {
      usd: usdToUah,
      eur: eurToUah,
      uah: 1,
    };

    const formatted = accounts.map(({ balance, currency, type }) => {
      const amount = amountToNumber(balance);
      const uahAmount = amount * (conversionRates[currency] ?? 1);
      const suffix =
        currency !== 'uah' && amount !== 0
          ? ` = ${uahAmount.toFixed(2)} UAH`
          : '';

      return {
        line: `- ${getAccountTypeName(type)} (${currency.toUpperCase()}): ${formatCurrency(balance, currency)}${suffix}`,
        amount: uahAmount,
      };
    });

    const allAccountsList = formatted.map(({ line }) => line).join('\n');
    const accountsSummary = formatted
      .filter(({ amount }) => amount !== 0)
      .map(({ line }) => line)
      .join('\n');

    const totalInUah = formatted.reduce((sum, { amount }) => sum + amount, 0);

    const txByCurrency = transactions.reduce<
      Partial<Record<string, TransactionWithRelationsDto[]>>
    >((acc, tx) => {
      const currency = tx.account.currency;

      acc[currency] = acc[currency] ?? [];
      acc[currency].push(tx);

      return acc;
    }, {});

    const txSummary = Object.entries(txByCurrency)
      .flatMap(([currency, txs]) => {
        if (!txs) {
          return [];
        }

        const total = txs.reduce((sum, { amount }) => sum + Number(amount), 0);

        return [
          `- ${currency.toUpperCase()}: ${txs.length} transactions, ${formatCurrency(total.toString(), currency)}`,
        ];
      })
      .join('\n');

    const categoryList = categories.map(({ name }) => name).join(', ');
    const topSpending = this.formatTopSpending(transactions);
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
      Recent Transactions (30 days): ${transactions.length}

      Transactions by Currency:
      ${txSummary || 'No transactions'}

      Active Accounts:
      ${accountsSummary || 'No accounts with balance'}

      All Accounts:
      ${allAccountsList}

      Top Spending (30 days):
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

  private formatTopSpending(
    transactions: TransactionWithRelationsDto[],
  ): string {
    const spendingByCategory = this.calculateSpendingByCategory(transactions);

    return Object.entries(spendingByCategory)
      .sort(([, a], [, b]) => Math.abs(b) - Math.abs(a))
      .slice(0, 5)
      .map(
        ([category, amount]) =>
          `- ${category}: ${formatCurrency(amount, 'UAH')}`,
      )
      .join('\n');
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

  private calculateSpendingByCategory(
    transactions: TransactionWithRelationsDto[],
  ): CategoryRecord {
    return transactions.reduce<CategoryRecord>(
      (spending, { amount, category }) => {
        const categoryName = category?.name ?? 'Uncategorized';

        return {
          ...spending,
          [categoryName]: (spending[categoryName] || 0) + Number(amount),
        };
      },
      {},
    );
  }

  private createMinimalSystemPrompt(): string {
    return `
      **IDENTITY**: ${identityInstructions}
      **NON-FINANCIAL QUESTIONS**: ${nonFinancialInstructions}
      **LANGUAGE**: ${languageInstructions}
    `;
  }

  clearCache(userId?: string): void {
    if (userId) {
      this.promptCache.delete(userId);
      this.logger.log(`Cleared cache for user ${userId}`);
    } else {
      this.promptCache.clear();
      this.logger.log('Cleared all cached prompts');
    }
  }
}
