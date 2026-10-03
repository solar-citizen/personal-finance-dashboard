import { BadRequestException } from '@nestjs/common';
import { beforeEach, describe, expect, it, mock } from 'bun:test';
import { ContextBuilderService } from 'src/ai/services/context-builder/context-builder.service';
import { PrismaService } from 'src/db/prisma.service';

import { PrivatBankService } from './privatbank.service';
import { PrivatBankCategoryService } from './services/privatbank-category.service';
import {
  ParsedPrivatBankStatement,
  PrivatBankParserService,
} from './services/privatbank-parser.service';

describe('PrivatBankService', () => {
  let service: PrivatBankService;
  let accountFindFirstMock: ReturnType<typeof mock>;
  let accountCreateMock: ReturnType<typeof mock>;
  let accountUpdateMock: ReturnType<typeof mock>;
  let transactionFindUniqueMock: ReturnType<typeof mock>;
  let transactionCreateMock: ReturnType<typeof mock>;
  let transactionUpdateMock: ReturnType<typeof mock>;
  let parseXlsxMock: ReturnType<typeof mock>;
  let resolveCategoryIdMock: ReturnType<typeof mock>;
  let clearCacheMock: ReturnType<typeof mock>;

  const mockDate = new Date('2026-05-29T19:44:03Z');
  const mockStatement: ParsedPrivatBankStatement = {
    maskedPan: '4149 **** **** 8602',
    periodFrom: mockDate,
    periodTo: mockDate,
    currency: 'uah',
    latestBalance: 50000n,
    transactions: [
      {
        time: mockDate,
        categoryName: 'Продукти',
        maskedPan: '4149 **** **** 8602',
        description: 'АТБ Маркет',
        amount: -15000n,
        operationAmount: -15000n,
        currencyCode: 980,
        balance: 50000n,
        externalId: 'sample-hash-1',
      },
    ],
  };

  beforeEach(() => {
    accountFindFirstMock = mock(() => Promise.resolve(null));
    accountCreateMock = mock(
      (args: { data: { name: string; maskedPan: string; balance: bigint } }) =>
        Promise.resolve({
          id: 'acc-1',
          name: args.data.name,
          ...args.data,
        }),
    );
    accountUpdateMock = mock(
      (args: { where: { id: string }; data: { balance: bigint } }) =>
        Promise.resolve({
          id: args.where.id,
          ...args.data,
        }),
    );
    transactionFindUniqueMock = mock(() => Promise.resolve(null));
    transactionCreateMock = mock(
      (args: { data: { externalId: string; amount: bigint } }) =>
        Promise.resolve({
          id: 'tx-1',
          ...args.data,
        }),
    );
    transactionUpdateMock = mock(
      (args: { where: { id: string }; data: { balance: bigint } }) =>
        Promise.resolve({
          id: args.where.id,
          ...args.data,
        }),
    );

    const prismaMock = {
      account: {
        findFirst: accountFindFirstMock,
        create: accountCreateMock,
        update: accountUpdateMock,
      },
      transaction: {
        findUnique: transactionFindUniqueMock,
        create: transactionCreateMock,
        update: transactionUpdateMock,
      },
    };

    parseXlsxMock = mock(() => Promise.resolve(mockStatement));
    const parserMock = { parseXlsx: parseXlsxMock };

    resolveCategoryIdMock = mock(() => Promise.resolve('cat-food'));
    const categoryMock = { resolveCategoryId: resolveCategoryIdMock };

    clearCacheMock = mock(() => Promise.resolve());
    const contextBuilderMock = { clearCache: clearCacheMock };

    service = new PrivatBankService(
      prismaMock as unknown as PrismaService,
      parserMock as unknown as PrivatBankParserService,
      categoryMock as unknown as PrivatBankCategoryService,
      contextBuilderMock as unknown as ContextBuilderService,
    );
  });

  describe('inspectStatement', () => {
    it('should return inspection summary without matched account when none exists', async () => {
      const buffer = Buffer.from('test');
      const result = await service.inspectStatement('user-1', buffer);

      expect(parseXlsxMock).toHaveBeenCalledWith(buffer);
      expect(accountFindFirstMock).toHaveBeenCalledWith({
        where: {
          userId: 'user-1',
          maskedPan: mockStatement.maskedPan,
        },
      });
      expect(result).toEqual({
        maskedPan: '4149 **** **** 8602',
        periodFrom: mockDate.toISOString(),
        periodTo: mockDate.toISOString(),
        totalTransactions: 1,
        currency: 'uah',
        matchedAccountId: null,
        matchedAccountName: null,
      });
    });

    it('should return inspection summary with matched account when one exists', async () => {
      accountFindFirstMock.mockImplementation(() =>
        Promise.resolve({
          id: 'acc-existing',
          name: 'My Privat Card',
        }),
      );

      const buffer = Buffer.from('test');
      const result = await service.inspectStatement('user-1', buffer);

      expect(result.matchedAccountId).toBe('acc-existing');
      expect(result.matchedAccountName).toBe('My Privat Card');
    });
  });

  describe('uploadStatement', () => {
    it('should create new account when no account is matched and none specified', async () => {
      const buffer = Buffer.from('test');
      const result = await service.uploadStatement('user-1', buffer, {});

      expect(accountCreateMock).toHaveBeenCalled();
      expect(transactionCreateMock).toHaveBeenCalled();
      expect(accountUpdateMock).toHaveBeenCalledWith({
        where: { id: 'acc-1' },
        data: {
          balance: 50000n,
          lastSyncedAt: expect.any(Date),
        },
      });
      expect(clearCacheMock).toHaveBeenCalledWith('user-1');
      expect(result).toEqual({
        accountId: 'acc-1',
        accountName: 'ПриватБанк - 8602',
        totalParsed: 1,
        newTransactions: 1,
        updatedTransactions: 0,
      });
    });

    it('should update existing transaction if duplicate externalId is found', async () => {
      accountFindFirstMock.mockImplementation(() =>
        Promise.resolve({
          id: 'acc-existing',
          name: 'Existing Account',
        }),
      );
      transactionFindUniqueMock.mockImplementation(() =>
        Promise.resolve({
          id: 'tx-existing',
        }),
      );

      const buffer = Buffer.from('test');
      const result = await service.uploadStatement('user-1', buffer, {
        accountId: 'acc-existing',
      });

      expect(transactionUpdateMock).toHaveBeenCalled();
      expect(transactionCreateMock).not.toHaveBeenCalled();
      expect(result.newTransactions).toBe(0);
      expect(result.updatedTransactions).toBe(1);
    });

    it('should throw BadRequestException when specified accountId is not found', async () => {
      accountFindFirstMock.mockImplementation(() => Promise.resolve(null));

      const buffer = Buffer.from('test');
      await expect(
        service.uploadStatement('user-1', buffer, {
          accountId: 'non-existent',
        }),
      ).rejects.toThrow(BadRequestException);
    });
  });
});
