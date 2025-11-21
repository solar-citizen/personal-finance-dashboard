import { Injectable, Logger } from '@nestjs/common';
import { PrismaService } from 'src/db/prisma.service';
import { fromUnixTimestamp } from 'src/lib/utils/date.util';
import { getErrorMessage } from 'src/lib/utils/error.util';

import type { MonoBankTransaction } from '../lib/monobank.types';

type SaveTransactionsResult = {
  newTransactions: number;
  updatedTransactions: number;
  errors: string[];
};

@Injectable()
export class TransactionProcessor {
  private readonly logger = new Logger(TransactionProcessor.name);

  constructor(private readonly prismaService: PrismaService) {}

  async saveTransactions(
    accountId: string,
    transactions: MonoBankTransaction[],
  ): Promise<SaveTransactionsResult> {
    const results = await Promise.all(
      transactions.map((tx) => this.saveTransaction(accountId, tx)),
    );

    const newTransactions = results.filter((r) => r.success && r.isNew).length;
    const updatedTransactions = results.filter(
      (r) => r.success && !r.isNew,
    ).length;
    const errors = results
      .filter((r) => !r.success)
      .map(({ error }) => error)
      .filter((e): e is string => e !== undefined);

    return { newTransactions, updatedTransactions, errors };
  }

  private async saveTransaction(
    accountId: string,
    tx: MonoBankTransaction,
  ): Promise<{ success: boolean; isNew?: boolean; error?: string }> {
    try {
      const category = await this.getCategoryByMcc(tx.mcc);

      const saved = await this.prismaService.transaction.upsert({
        where: {
          accountId_externalId: {
            accountId,
            externalId: tx.id,
          },
        },
        create: {
          accountId,
          externalId: tx.id,
          time: fromUnixTimestamp(tx.time),
          description: tx.description,
          mcc: tx.mcc,
          originalMcc: tx.originalMcc,
          hold: tx.hold,
          amount: BigInt(tx.amount),
          operationAmount: BigInt(tx.operationAmount),
          currencyCode: tx.currencyCode,
          commissionRate: BigInt(tx.commissionRate),
          cashbackAmount: BigInt(tx.cashbackAmount),
          balance: BigInt(tx.balance),
          comment: tx.comment,
          receiptId: tx.receiptId,
          invoiceId: tx.invoiceId,
          counterEdrpou: tx.counterEdrpou,
          counterIban: tx.counterIban,
          counterName: tx.counterName,
          categoryId: category?.id,
        },
        update: {
          hold: tx.hold,
          balance: BigInt(tx.balance),
          comment: tx.comment,
          categoryId: category?.id,
        },
      });

      const isNew = saved.createdAt.getTime() > Date.now() - 1000;
      return { success: true, isNew };
    } catch (err) {
      this.logger.error(`Error saving transaction ${tx.id}:`, err);
      return {
        success: false,
        error: `Transaction ${tx.id}: ${getErrorMessage(err)}`,
      };
    }
  }

  private async getCategoryByMcc(mcc: number): Promise<{ id: string } | null> {
    const category = await this.prismaService.category.findUnique({
      where: { mcc },
      select: { id: true },
    });

    if (category) {
      return category;
    }

    return this.prismaService.category.findUnique({
      where: { mcc: 0 },
      select: { id: true },
    });
  }
}
