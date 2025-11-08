import { Account } from '@prisma/client';
import { formatAmount } from 'src/lib/currency-utils';
import { MonoBankAccountResponseDto } from '../monobank.dto';

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
    lastSyncedAt,
  };
}
