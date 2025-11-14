import { z } from 'zod';

export const ExchangeRateApiResponseSchema = z.object({
  base: z.literal('UAH'),
  date: z.string(),
  time_last_updated: z.number(),
  rates: z.record(z.string(), z.number()),
});

export const ExchangeRatesSchema = z.object({
  UAH: z.number().positive(),
  USD: z.number().positive(),
  EUR: z.number().positive(),
});
