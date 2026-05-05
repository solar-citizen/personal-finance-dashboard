import { Currency } from 'src/_generated/prisma-client/client';

export const currencyToIso4217: Record<Currency, number> = {
  [Currency.uah]: 980,
  [Currency.usd]: 840,
  [Currency.eur]: 978,
};
