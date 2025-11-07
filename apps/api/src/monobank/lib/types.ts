/**
 * MonoBank API response for client info
 * https://api.monobank.ua/docs/#/definitions/UserInfo
 */
export type MonoBankClientInfo = {
  clientId: string;
  name: string;
  webHookUrl: string;
  permissions: string;
  accounts: MonoBankAccount[];
  jars?: MonoBankJar[];
};

export type MonoBankAccount = {
  id: string; // Account identifier
  sendId: string; // Identifier for P2P
  balance: number; // Balance in minimal units (kopiykas)
  creditLimit: number; // Credit limit in minimal units
  type: 'black' | 'white' | 'platinum' | 'iron' | 'fop' | 'yellow' | 'eAid';
  currencyCode: number; // ISO 4217 currency code
  cashbackType?: 'None' | 'UAH' | 'Miles';
  maskedPan: string[]; // Masked card numbers
  iban: string;
};

export type MonoBankJar = {
  id: string;
  sendId: string;
  title: string;
  description: string;
  currencyCode: number;
  balance: number;
  goal: number;
};

/**
 * MonoBank API response for statement (transactions)
 * https://api.monobank.ua/docs/#/definitions/StatementItem
 */
export type MonoBankTransaction = {
  id: string; // Unique transaction ID
  time: number; // Transaction time in seconds (Unix timestamp)
  description: string; // Transaction description
  mcc: number; // Merchant Category Code
  originalMcc: number; // Original MCC
  hold: boolean; // Status of hold operation
  amount: number; // Amount in minimal units (kopiykas)
  operationAmount: number; // Amount in transaction currency
  currencyCode: number; // ISO 4217 currency code
  commissionRate: number; // Commission in minimal units
  cashbackAmount: number; // Cashback in minimal units
  balance: number; // Balance after transaction
  comment?: string; // User comment
  receiptId?: string; // Receipt identifier
  invoiceId?: string; // Invoice identifier
  counterEdrpou?: string; // Counterparty EDRPOU code
  counterIban?: string; // Counterparty IBAN
  counterName?: string; // Counterparty name
};

/**
 * Error response from MonoBank API
 */
export type MonoBankErrorResponse = {
  errorDescription: string;
};

export type MonoBankAccountResponse = {
  id: string;
  accountId: string;
  iban: string;
  type: string;
  currency: string;
  balance: string; // Converted to decimal string
  creditLimit: string;
  lastSyncedAt: Date | null;
};

export type SyncResultResponse = {
  success: boolean;
  synced: number;
  newTransactions: number;
  updatedTransactions: number;
  errors?: string[];
};
