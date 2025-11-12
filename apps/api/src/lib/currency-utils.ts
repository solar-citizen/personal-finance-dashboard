import Decimal from 'decimal.js';

export function formatAmount(
  amount: bigint | number | string,
  options?: {
    decimals?: number;
    divisor?: number;
  },
): string {
  const { decimals = 2, divisor = 100 } = options ?? {};
  return new Decimal(amount.toString()).dividedBy(divisor).toFixed(decimals);
}

export function formatCurrency(
  amount: bigint | number | string,
  currency: string,
  options?: {
    decimals?: number;
    divisor?: number;
  },
): string {
  return `${formatAmount(amount, options)} ${currency.toUpperCase()}`;
}

export function calculateTotal(amounts: number[]): number {
  return amounts.reduce((sum, amount) => sum + amount, 0);
}
