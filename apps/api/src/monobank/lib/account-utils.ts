import { Account } from '@prisma/client';
import { MonoBankAccountResponseDto } from 'src/@generated/zod/pfd-dtos';
import { formatAmount } from 'src/lib/currency-utils';
import { formatDateToIso } from 'src/lib/date-utils';

export function formatAccountResponse({
  id,
  accountId,
  iban,
  type,
  currency,
  balance,
  creditLimit,
  lastSyncedAt,
}: Account): MonoBankAccountResponseDto {
  return {
    id,
    accountId,
    iban: iban || '',
    type,
    currency,
    balance: formatAmount(balance),
    creditLimit: formatAmount(creditLimit),
    lastSyncedAt: lastSyncedAt ? formatDateToIso(lastSyncedAt) : null,
  };
}
