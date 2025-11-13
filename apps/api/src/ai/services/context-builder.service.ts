import { Injectable, Logger } from '@nestjs/common';
import dayjs from 'dayjs';
import {
  AccountSummaryDto,
  CategorySummaryDto,
  FinancialContextDto,
  TransactionWithRelationsDto,
} from 'src/@generated/zod/pfd-dtos';
import { calculateTotal, formatCurrency } from 'src/lib/currency-utils';
import { getDateRange } from 'src/lib/date-utils';
import { formatEmbeddingVector } from 'src/lib/vector.utils';
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

@Injectable()
export class ContextBuilderService {
  private readonly logger = new Logger(ContextBuilderService.name);

  constructor(
    private readonly prismaService: PrismaService,
    private readonly ollamaClient: OllamaClientService,
  ) {}

  async buildContext(
    userId: string,
    userMessage?: string,
  ): Promise<FinancialContextDto> {
    const [accounts, recentTransactions, categories, relevantKnowledge] =
      await Promise.all([
        this.getUserAccounts(userId),
        this.getRecentTransactions(userId),
        this.getCategories(),
        userMessage
          ? this.findRelevantKnowledge(userMessage)
          : Promise.resolve([]),
      ]);

    const systemPrompt = this.createSystemPrompt(
      accounts,
      recentTransactions,
      categories,
      relevantKnowledge,
    );

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

  private createSystemPrompt(
    accounts: AccountSummaryDto[],
    transactions: TransactionWithRelationsDto[],
    categories: CategorySummaryDto[],
    knowledgeBase: KnowledgeBaseEntry[],
  ): string {
    const totalBalance = calculateTotal(
      accounts.map(({ balance }) => Number(balance)),
    );
    const totalBalanceFormatted = formatCurrency(totalBalance, 'UAH');

    const accountsSummary = accounts
      .map(({ balance, currency, type }) => {
        const formattedBalance = formatCurrency(Number(balance), currency);
        return `- ${type} (${currency.toUpperCase()}): ${formattedBalance}`;
      })
      .join('\n');

    const categoryList = categories.map((c) => c.name).join(', ');
    const topSpending = this.formatTopSpending(transactions);
    const knowledgeSection = this.formatKnowledgeSection(knowledgeBase);
    const { defaultReject } = rejectPatterns;

    return `You are a helpful financial assistant for a personal finance dashboard. You have access to the user's financial data and can help them understand their spending, budgeting, and financial health.

      Current Financial Overview:
      - Total Balance: ${totalBalanceFormatted}
      - Number of Accounts: ${accounts.length}
      - Recent Transactions: ${transactions.length} in the last 30 days

      Accounts:
      ${accountsSummary || 'No accounts connected yet'}

      Available Categories: ${categoryList}

      Top Spending Categories (Last 30 Days):
      ${topSpending || 'No spending data available'}${knowledgeSection}

      Guidelines:
      1. Always provide specific, actionable financial advice
      2. Use actual data from the user's transactions when answering
      3. Format currency amounts clearly (e.g., "1,234.56 UAH")
      4. Be conversational but professional
      5. If asked about specific transactions, refer to the recent data
      6. Suggest budgeting strategies based on spending patterns
      7. Warn about unusual spending if detected
      8. Always respond in Ukrainian if the user writes in Ukrainian, otherwise use English
      9. **IMPORTANT: You are a FINANCIAL assistant. If user asks non-financial questions (weather, recipes, general knowledge, etc.), politely redirect them: ${defaultReject}**

      Remember: You have access to the last 30 days of transaction history. Be helpful, accurate, and supportive!`;
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
