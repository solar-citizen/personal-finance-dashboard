import { Injectable, Logger } from '@nestjs/common';
import dayjs from 'dayjs';
import {
  AccountSummaryDto,
  CategorySummaryDto,
  ExchangeRatesDto,
  FinancialContextDto,
  TransactionWithRelationsDto,
} from 'src/@generated/zod/pfd-dtos';
import { CurrencyService } from 'src/currency/currency.service';
import { formatAmount, formatCurrency } from 'src/lib/utils/currency.util';
import { getDateRange } from 'src/lib/utils/date.util';
import { formatEmbeddingVector } from 'src/lib/utils/vector.util';
import { getAccountTypeName } from 'src/monobank/lib/utils/currency.util';
import { PrismaService } from '../../db/prisma.service';
import { rejectPatterns } from './lib/reject-patterns';
import { OllamaClientService } from './ollama-client.service';

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
  userMessage?: string;
};

@Injectable()
export class ContextBuilderService {
  private readonly logger = new Logger(ContextBuilderService.name);

  constructor(
    private readonly prismaService: PrismaService,
    private readonly ollamaClient: OllamaClientService,
    private readonly currencyService: CurrencyService,
  ) {}

  async buildContext({
    userId,
    userMessage,
  }: ContextData): Promise<FinancialContextDto> {
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
    };

    return { systemPrompt, metadata };
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
    } catch (error) {
      this.logger.warn('Knowledge base search failed:', error);

      return [];
    }
  }

  private async getUserAccounts(userId: string): Promise<AccountSummaryDto[]> {
    return this.prismaService.account.findMany({
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

    return this.prismaService.transaction.findMany({
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
    return this.prismaService.category.findMany({
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

    const formatted = accounts.map(({ balance, currency, type }) => {
      const amount = Number(balance);
      const formattedBalance = formatCurrency(balance, currency);
      const typeName = getAccountTypeName(type);

      const conversionRates: Record<string, number> = {
        usd: usdToUah,
        eur: eurToUah,
        uah: 1,
      };
      const uahAmount = amount * (conversionRates[currency] ?? 1);

      const uahSuffix =
        currency !== 'uah' && amount !== 0
          ? ` = ${formatAmount(uahAmount, { decimals: 2, divisor: 1 })} UAH`
          : '';

      const line = `- ${typeName} (${currency.toUpperCase()}): ${formattedBalance}${uahSuffix}`;

      return { line, amount };
    });

    const allAccountsList = formatted.map((f) => f.line).join('\n');
    const accountsSummary = formatted
      .filter(({ amount }) => amount !== 0)
      .map(({ line }) => line)
      .join('\n');

    const totalInUah = accounts.reduce((sum, { balance, currency }) => {
      const amount = Number(balance);

      if (currency === 'usd') {
        return sum + amount * usdToUah;
      }

      if (currency === 'eur') {
        return sum + amount * eurToUah;
      }

      return sum + amount;
    }, 0);

    const txByCurrency = transactions.reduce(
      (acc, tx): Record<string, TransactionWithRelationsDto[]> => {
        const currency = tx.account?.currency || 'uah';
        if (!acc[currency]) acc[currency] = [];
        acc[currency].push(tx);
        return acc;
      },
      {},
    );

    const txSummary = Object.entries(txByCurrency)
      .map(([currency, txs]) => {
        const total = txs.reduce((sum, { amount }) => sum + Number(amount), 0);
        return `- ${currency.toUpperCase()}: ${txs.length} transactions, ${formatCurrency(total.toString(), currency)}`;
      })
      .join('\n');

    const categoryList = categories.map((c) => c.name).join(', ');
    const topSpending = this.formatTopSpending(transactions);
    const knowledgeSection = this.formatKnowledgeSection(knowledgeBase);
    const { defaultReject } = rejectPatterns;

    return `You are a financial assistant for a personal finance app. You have FULL ACCESS to user's transaction data including currency information.

      === EXCHANGE RATES (CURRENT) ===
      1 USD = ${formatAmount(usdToUah, { decimals: 2, divisor: 1 })} UAH
      1 EUR = ${formatAmount(eurToUah, { decimals: 2, divisor: 1 })} UAH
      1 UAH = 1 UAH

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
      1. **CURRENCY CONVERSIONS**: You HAVE exchange rates above. When user asks about amounts in UAH/EUR/USD:
        - Use the rates provided
        - Don't ask for rates - YOU HAVE THEM.
        - Show calculations clearly
        - Example: "1,000 UAH ÷ ${formatAmount(eurToUah, { decimals: 2, divisor: 1 })} = X EUR"

      2. **TRANSACTION DATA**: You have FULL transaction data with currency info. When asked about spending by currency:
        - Analyze transactions from "Transactions by Currency" section
        - Show amounts per currency
        - Don't say "I don't have this data" - YOU HAVE IT.

      3. **LANGUAGE**: Respond in Ukrainian if user writes in Ukrainian, English otherwise

      4. **ACCOUNTS DISPLAY**:
        - By default show only non-zero accounts
        - Show all accounts only if explicitly asked
        - Use translated names (Чорна, Біла, єПідтримка), not technical names

      5. **NON-FINANCIAL QUESTIONS**: Redirect with: ${defaultReject}

      6. **FORMATTING**: Be concise, no unnecessary explanations, direct answers with data

      === EXAMPLES ===
      ❌ BAD: "I don't have currency data for transactions"
      ✅ GOOD: "EUR spending: 150.50 EUR (see Transactions by Currency section)"

      ❌ BAD: "Please provide exchange rate"
      ✅ GOOD: "Using rate 1 EUR = ${formatAmount(eurToUah, { decimals: 2, divisor: 1 })} UAH: 5,000 UAH = 102.50 EUR"

      Remember: You have ALL data needed. Be confident, precise, and helpful!`;
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
        const categoryName = category?.name || 'Uncategorized';

        return {
          ...spending,
          [categoryName]: (spending[categoryName] || 0) + Number(amount),
        };
      },
      {},
    );
  }
}
