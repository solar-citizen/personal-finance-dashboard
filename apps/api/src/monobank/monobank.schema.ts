import { periods } from '@pfd/shared';
import { z } from 'zod';

// Import has to be relative, because it's used on the client as well
// and we don't want to expose the whole prisma client there
import { SyncJobStatus } from '../_generated/prisma-client/browser';

export const ConnectMonoBankSchema = z.object({
  token: z.string().min(1),
});

export const SyncTransactionsSchema = z.object({
  from: z.iso.datetime().optional(),
  to: z.iso.datetime().optional(),
  fullHistory: z.boolean().optional(),
});

export const MonoBankAccountResponseSchema = z.object({
  id: z.string().min(1),
  accountId: z.string().min(1),
  iban: z.string().min(1).nullable(),
  type: z.string().min(1),
  currency: z.string().min(1),
  balance: z.string().min(1),
  creditLimit: z.string().min(1),
  lastSyncedAt: z.iso.datetime().nullable(),
});

export const SyncResultResponseSchema = z.object({
  success: z.boolean(),
  synced: z.number().int().nonnegative(),
  newTransactions: z.number().int().nonnegative(),
  updatedTransactions: z.number().int().nonnegative(),
  errors: z.array(z.string()).optional(),
});

export const SyncProgressResponseSchema = z.object({
  jobId: z.string().min(1),
  progress: z.number().min(0).max(100),
  total: z.number().int().nonnegative(),
  newTransactions: z.number().int().nonnegative(),
  updatedTransactions: z.number().int().nonnegative(),
  errorMessage: z.string().optional(),
  status: z.enum(SyncJobStatus),
});

export const SyncJobResponseSchema = z.object({
  jobId: z.string().min(1),
  message: z.string(),
});

export const TransactionCategorySchema = z.object({
  id: z.string(),
  name: z.string(),
  icon: z.string(),
});

export const TransactionResponseSchema = z.object({
  id: z.string(),
  category: TransactionCategorySchema.nullable(),
  account: z.object({ id: z.string(), type: z.string() }),
  amount: z.number(),
  currencyCode: z.string(),
  time: z.string(),
  description: z.string(),
});

export const ExpenseCategoryResponseSchema = z.object({
  category: TransactionCategorySchema,
  amount: z.number(),
  currency: z.string(),
});

export const GetTransactionsQuerySchema = z.object({
  limit: z.coerce.number().int().positive().max(10000).default(10000),
});

export const GetExpensesQuerySchema = z.object({
  period: z.enum(periods).default('month'),
});

export const CashFlowPointResponseSchema = z.object({
  date: z.string(),
  label: z.string(),
  income: z.number(),
  expense: z.number(),
  netBalance: z.number(),
});

export const GetCashFlowQuerySchema = z.object({
  period: z.enum(periods).default('month'),
});
