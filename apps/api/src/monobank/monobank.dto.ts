import { ApiProperty } from '@nestjs/swagger';
import { SyncJobStatus } from '@prisma/client';

export class ConnectMonoBankDto {
  token!: string;
}

export class SyncTransactionsDto {
  from?: string;
  to?: string;
  fullHistory?: boolean;
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

export class SyncProgressResponseDto {
  jobId!: string;
  progress!: number;
  total!: number;
  newTransactions!: number;
  updatedTransactions!: number;
  errorMessage?: string;

  @ApiProperty({ enum: SyncJobStatus })
  status!: SyncJobStatus;
}
