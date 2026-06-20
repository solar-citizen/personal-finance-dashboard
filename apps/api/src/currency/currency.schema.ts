import { z } from 'zod';

export const ExchangeRatesSchema = z.looseObject({
  uahToUah: z.number().positive(),
  usdToUah: z.number().positive(),
  eurToUah: z.number().positive(),
});

export const MonoExchangeRateSchema = z.object({
  currencyCodeA: z.number().positive().int(),
  currencyCodeB: z.number().positive().int(),
  date: z.number().int(),
  rateSell: z.number().optional(),
  rateBuy: z.number().optional(),
  rateCross: z.number().optional(),
});
