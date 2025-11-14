import { z } from 'zod';

export const ExchangeRatesSchema = z.looseObject({
  UAH: z.number().positive(),
  USD: z.number().positive(),
  EUR: z.number().positive(),
});

export const ExchangeRateApiResponseSchema = z.object({
  base: z.literal('UAH'),
  date: z.string(),
  time_last_updated: z.number(),
  rates: ExchangeRatesSchema,
});
