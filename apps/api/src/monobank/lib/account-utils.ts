import { Account } from '@prisma/client';
import { formatAmount } from 'src/lib/currency-utils';
import { MonoBankAccountResponseDto } from '../monobank.dto';

export function formatAccountResponse(
  account: Account,
): MonoBankAccountResponseDto {
  return {
    id: account.id,
    accountId: account.accountId,
    iban: account.iban || '',
    type: account.type,
    currency: account.currency,
    balance: formatAmount(account.balance),
    creditLimit: formatAmount(account.creditLimit),
    lastSyncedAt: account.lastSyncedAt,
  };
}
