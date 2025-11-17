import Decimal from 'decimal.js';

export function formatValue(
  value: bigint | number | string,
  decimals = 2,
): number {
  return new Decimal(value.toString()).toDecimalPlaces(decimals).toNumber();
}
