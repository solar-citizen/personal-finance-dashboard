import { Account } from 'src/@generated/prisma-client/client';
import { MonoBankAccountResponseDto } from 'src/@generated/zod/pfd-dtos';
import { formatAmount } from 'src/_lib/utils/currency.util';
import { formatDateToIso } from 'src/_lib/utils/date.util';

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
    iban: iban ?? '',
    type,
    currency,
    balance: formatAmount(balance),
    creditLimit: formatAmount(creditLimit),
    lastSyncedAt: lastSyncedAt ? formatDateToIso(lastSyncedAt) : null,
  };
}
