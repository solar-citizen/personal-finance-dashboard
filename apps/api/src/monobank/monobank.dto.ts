export class ConnectMonoBankDto {
  token!: string;
}

export class SyncTransactionsDto {
  from?: string;
  to?: string;
}

export class MonoBankAccountResponseDto {
  id!: string;
  accountId!: string;
  iban!: string;
  type!: string;
  currency!: string;
  balance!: string;
  creditLimit!: string;
  lastSyncedAt!: Date | null;
}

export class SyncResultResponseDto {
  success!: boolean;
  synced!: number;
  newTransactions!: number;
  updatedTransactions!: number;
  errors?: string[];
}
