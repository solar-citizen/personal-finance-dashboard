import { Currency } from '@prisma/client';

// MonoBank uses ISO 4217 numeric currency codes
const currencyMap: Record<number, Currency> = {
  980: Currency.uah,
  840: Currency.usd,
  978: Currency.eur,
};

export function getCurrencyFromCode(code: number): Currency {
  const currency = currencyMap[code];

  if (!currency) {
    throw new Error(`Unknown currency code: ${code}`);
  }

  return currency;
}
