import { z } from 'zod';

export const TranslationSchema = z.object({
  common: z.object({
    loading: z.string(),
    error: z.string(),
    save: z.string(),
    cancel: z.string(),
  }),
  nav: z.object({
    dashboard: z.string(),
    transactions: z.string(),
    settings: z.string(),
  }),
  dashboard: z.object({
    title: z.string(),
    welcome: z.string(),
  }),
  transactions: z.object({
    title: z.string(),
    addTransaction: z.string(),
  }),
  settings: z.object({
    title: z.string(),
    language: z.string(),
    languageSelect: z.string(),
    english: z.string(),
    ukrainian: z.string(),
  }),
});

export type TranslationSchemaType = z.infer<typeof TranslationSchema>;
