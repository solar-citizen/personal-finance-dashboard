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
