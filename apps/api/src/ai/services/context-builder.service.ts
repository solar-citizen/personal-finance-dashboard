import { Injectable, Logger } from '@nestjs/common';
import {
  AccountSummaryDto,
  CategorySummaryDto,
  FinancialContextDto,
  TransactionWithRelationsDto,
} from 'src/@generated/zod/pfd-dtos';
import { PrismaService } from '../../db/prisma.service';
import { OllamaClientService } from './ollama-client.service';

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
      dateRange: this.getDateRange(recentTransactions),
      knowledgeBaseHits: relevantKnowledge.length,
    };

    return { systemPrompt, metadata };
  }

  private async findRelevantKnowledge(
    query: string,
    limit = 3,
  ): Promise<Array<{ content: string; similarity: number }>> {
    try {
      const queryEmbedding = await this.ollamaClient.generateEmbedding(query);
      const embeddingVector = `[${queryEmbedding.join(',')}]`;

      const results = await this.prismaService.$queryRaw<
        Array<{ content: string; similarity: number }>
      >`
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
    const thirtyDaysAgo = new Date();
    thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);

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
    knowledgeBase: Array<{ content: string; similarity: number }>,
  ): string {
    const totalBalance = accounts.reduce(
      (sum, acc) => sum + Number(acc.balance),
      0,
    );
    const totalBalanceFormatted = (totalBalance / 100).toFixed(2);

    const accountsSummary = accounts
      .map(
        (acc) =>
          `- ${acc.type} (${acc.currency.toUpperCase()}): ${(Number(acc.balance) / 100).toFixed(2)} ${acc.currency.toUpperCase()}`,
      )
      .join('\n');

    const categoryList = categories.map((c) => c.name).join(', ');
    const topSpending = Object.entries(
      this.calculateSpendingByCategory(transactions),
    )
      .sort(([, a], [, b]) => Math.abs(b) - Math.abs(a))
      .slice(0, 5)
      .map(
        ([category, amount]) =>
          `- ${category}: ${(amount / 100).toFixed(2)} UAH`,
      )
      .join('\n');

    const knowledgeSection =
      knowledgeBase.length > 0
        ? `\n\nRelevant Information:
${knowledgeBase.map(({ content, similarity }, i) => `${i + 1}. ${content} (relevance: ${(similarity * 100).toFixed(0)}%)`).join('\n')}`
        : '';

    return `You are a helpful financial assistant for a personal finance dashboard. You have access to the user's financial data and can help them understand their spending, budgeting, and financial health.

Current Financial Overview:
- Total Balance: ${totalBalanceFormatted} UAH
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

Remember: You have access to the last 30 days of transaction history. Be helpful, accurate, and supportive!`;
  }

  private calculateSpendingByCategory(
    transactions: TransactionWithRelationsDto[],
  ): Record<string, number> {
    const spending: Record<string, number> = {};

    for (const transaction of transactions) {
      const categoryName = transaction.category?.name || 'Uncategorized';
      const amount = Number(transaction.amount);

      if (!spending[categoryName]) {
        spending[categoryName] = 0;
      }

      spending[categoryName] += amount;
    }

    return spending;
  }

  private getDateRange(transactions: TransactionWithRelationsDto[]): {
    from: string;
    to: string;
  } {
    if (transactions.length === 0) {
      const now = new Date();
      return {
        from: now.toISOString(),
        to: now.toISOString(),
      };
    }

    const dates = transactions.map(({ time }) => new Date(time).getTime());
    const earliest = new Date(Math.min(...dates));
    const latest = new Date(Math.max(...dates));

    return {
      from: earliest.toISOString(),
      to: latest.toISOString(),
    };
  }
}
