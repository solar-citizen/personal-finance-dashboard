import { SyncJobStatus } from 'src/@generated/prisma-client/client';
import { z } from 'zod';

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
