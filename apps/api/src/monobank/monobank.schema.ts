import { periods } from '@pfd/shared';
import { z } from 'zod';

// Import has to be relative, because it's used on the client as well
// and we don't want to expose the whole prisma client there
import { SyncJobStatus } from '../_generated/prisma-client/browser';

export const ConnectMonoBankSchema = z.object({
  token: z.string().min(1),
});

export const SyncTransactionsSchema = z.object({
  from: z.string().optional(),
  to: z.string().optional(),
  fullHistory: z.boolean().optional(),
});

export const MonoBankAccountResponseSchema = z.object({
  id: z.string().min(1),
  accountId: z.string().min(1),
  iban: z.string().min(1).nullable(),
  type: z.string().nullable(),
  bank: z.string().optional(),
  name: z.string().nullable().optional(),
  maskedPan: z.string().nullable().optional(),
  currency: z.string().min(1),
  balance: z.string().min(1),
  creditLimit: z.string().min(1),
  lastSyncedAt: z.string().nullable(),
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
  account: z.object({ id: z.string(), type: z.string().nullable() }),
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

export const GetJobsQuerySchema = z.object({
  page: z.coerce.number().int().min(1).max(1_000_000).default(1),
  limit: z.coerce.number().int().min(1).max(100).default(10),
});

export const SyncJobListItemResponseSchema = z.object({
  id: z.string(),
  accountId: z.string(),
  status: z.enum(SyncJobStatus),
  progress: z.number(),
  total: z.number(),
  newCount: z.number(),
  updatedCount: z.number(),
  errorMessage: z.string().nullable().optional(),
  from: z.string().nullable().optional(),
  to: z.string().nullable().optional(),
  createdAt: z.string(),
  updatedAt: z.string(),
});

export const SyncJobsPageResponseSchema = z.object({
  items: z.array(SyncJobListItemResponseSchema),
  total: z.number().int().nonnegative(),
  page: z.number().int().positive(),
  limit: z.number().int().positive(),
});

export const SyncJobListResponseSchema = z.array(SyncJobListItemResponseSchema);
