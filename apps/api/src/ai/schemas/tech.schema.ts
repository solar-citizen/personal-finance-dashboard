import { z } from 'zod';

export const HealthStatusSchema = z.object({
  status: z.string(),
  ollama: z.boolean(),
  gemini: z.boolean(),
});
