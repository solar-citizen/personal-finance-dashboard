import { Currency } from 'src/@generated/prisma-client/client';

/**
 * MonoBank uses ISO 4217 numeric currency codes
 */
const currencyMap: Record<number, Currency> = {
  980: Currency.uah,
  840: Currency.usd,
  978: Currency.eur,
};

export const getCurrencyFromCode = (code: number) => currencyMap[code];

export function getAccountTypeName(type: string): string {
  const typeMap: Record<string, string> = {
    black: 'Чорна',
    white: 'Біла',
    eAid: 'єПідтримка',
  };

  return typeMap[type] || type;
}
