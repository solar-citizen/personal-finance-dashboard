import { z } from 'zod';

export const InspectPrivatBankResponseSchema = z.object({
  maskedPan: z.string(),
  periodFrom: z.string(),
  periodTo: z.string(),
  totalTransactions: z.number(),
  currency: z.enum(['uah', 'usd', 'eur']),
  matchedAccountId: z.string().nullable(),
  matchedAccountName: z.string().nullable(),
});

export const UploadPrivatBankStatementSchema = z.object({
  accountId: z.string().optional(),
  accountName: z.string().optional(),
});

export const UploadPrivatBankResponseSchema = z.object({
  accountId: z.string(),
  accountName: z.string(),
  totalParsed: z.number(),
  newTransactions: z.number(),
  updatedTransactions: z.number(),
});
