import { Currency } from 'src/_generated/prisma-client/client';

export const iso4217ToCurrency: Record<number, Currency> = {
  980: Currency.uah,
  840: Currency.usd,
  978: Currency.eur,
};

export const currencyToIso4217: Record<Currency, number> = {
  [Currency.uah]: 980,
  [Currency.usd]: 840,
  [Currency.eur]: 978,
};
