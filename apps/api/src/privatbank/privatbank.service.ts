import { BadRequestException, Injectable, Logger } from '@nestjs/common';
import {
  InspectPrivatBankResponseDto,
  UploadPrivatBankResponseDto,
  UploadPrivatBankStatementDto,
} from 'src/_generated/zod/pfd-dtos';
import { ContextBuilderService } from 'src/ai/services/context-builder/context-builder.service';
import { PrismaService } from 'src/db/prisma.service';

import { PrivatBankCategoryService } from './services/privatbank-category.service';
import { PrivatBankParserService } from './services/privatbank-parser.service';

@Injectable()
export class PrivatBankService {
  private readonly logger = new Logger(PrivatBankService.name);

  constructor(
    private readonly prismaService: PrismaService,
    private readonly parserService: PrivatBankParserService,
    private readonly categoryService: PrivatBankCategoryService,
    private readonly contextBuilder: ContextBuilderService,
  ) {}

  async inspectStatement(
    userId: string,
    fileBuffer: Buffer,
  ): Promise<InspectPrivatBankResponseDto> {
    const statement = await this.parserService.parseXlsx(fileBuffer);

    const matchedAccount = await this.prismaService.account.findFirst({
      where: {
        userId,
        maskedPan: statement.maskedPan,
      },
    });

    return {
      maskedPan: statement.maskedPan,
      periodFrom: statement.periodFrom.toISOString(),
      periodTo: statement.periodTo.toISOString(),
      totalTransactions: statement.transactions.length,
      currency: statement.currency,
      matchedAccountId: matchedAccount ? matchedAccount.id : null,
      matchedAccountName: matchedAccount ? matchedAccount.name : null,
    };
  }

  async uploadStatement(
    userId: string,
    fileBuffer: Buffer,
    { accountId, accountName }: UploadPrivatBankStatementDto,
  ): Promise<UploadPrivatBankResponseDto> {
    const statement = await this.parserService.parseXlsx(fileBuffer);

    let account = accountId
      ? await this.prismaService.account.findFirst({
          where: { id: accountId, userId },
        })
      : await this.prismaService.account.findFirst({
          where: { userId, maskedPan: statement.maskedPan },
        });

    if (accountId && !account) {
      throw new BadRequestException('Selected account not found.');
    }

    if (!account) {
      const defaultName = `ПриватБанк - ${statement.maskedPan.slice(-4)}`;
      const name = accountName?.trim() ?? defaultName;

      account = await this.prismaService.account.create({
        data: {
          userId,
          bank: 'privatbank',
          name,
          maskedPan: statement.maskedPan,
          accountId: `privat_${statement.maskedPan.replace(/\s+/g, '')}_${Date.now()}`,
          currency: statement.currency,
          balance: statement.latestBalance,
        },
      });
    }

    let newCount = 0;
    let updatedCount = 0;

    for (const tx of statement.transactions) {
      const categoryId = await this.categoryService.resolveCategoryId(
        tx.categoryName,
      );

      const existing = await this.prismaService.transaction.findUnique({
        where: {
          accountId_externalId: {
            accountId: account.id,
            externalId: tx.externalId,
          },
        },
      });

      if (existing) {
        await this.prismaService.transaction.update({
          where: { id: existing.id },
          data: {
            categoryId,
            balance: tx.balance,
          },
        });
        updatedCount++;
      } else {
        await this.prismaService.transaction.create({
          data: {
            accountId: account.id,
            externalId: tx.externalId,
            time: tx.time,
            description: tx.description,
            amount: tx.amount,
            operationAmount: tx.operationAmount,
            currencyCode: tx.currencyCode,
            balance: tx.balance,
            categoryId,
          },
        });
        newCount++;
      }
    }

    await this.prismaService.account.update({
      where: { id: account.id },
      data: {
        balance: statement.latestBalance,
        lastSyncedAt: new Date(),
      },
    });

    await this.contextBuilder.clearCache(userId);

    return {
      accountId: account.id,
      accountName: account.name ?? 'ПриватБанк Account',
      totalParsed: statement.transactions.length,
      newTransactions: newCount,
      updatedTransactions: updatedCount,
    };
  }
}
