import { Card, Currency } from '@prisma/client';
import { z } from 'zod';

export const AccountSummarySchema = z.object({
  id: z.string(),
  type: z.enum(Card),
  currency: z.enum(Currency),
  balance: z.bigint(),
  iban: z.string().nullable(),
});

export const CategorySummarySchema = z.object({
  id: z.string(),
  name: z.string(),
  mcc: z.number(),
});

export const TransactionWithRelationsSchema = z.object({
  id: z.string(),
  accountId: z.string(),
  externalId: z.string(),
  time: z.date(),
  description: z.string(),
  mcc: z.number(),
  amount: z.bigint(),
  operationAmount: z.bigint(),
  currencyCode: z.number(),
  cashbackAmount: z.bigint(),
  balance: z.bigint(),
  category: CategorySummarySchema.nullable(),
  account: z.object({
    type: z.enum(Card),
    currency: z.enum(Currency),
  }),
});

export const FinancialContextMetadataSchema = z.object({
  accountCount: z.number(),
  transactionCount: z.number(),
  categories: z.array(z.string()),
  dateRange: z.object({
    from: z.string(),
    to: z.string(),
  }),
  knowledgeBaseHits: z.number().optional(),
  modelUsed: z.string().optional(),
  modelReason: z.string().optional(),
});

export const FinancialContextSchema = z.object({
  systemPrompt: z.string(),
  metadata: FinancialContextMetadataSchema,
});
