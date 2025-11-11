import { z } from 'zod';

export const SendMessageSchema = z.object({
  message: z.string().min(1).max(2000),
  conversationId: z.string().optional(),
});

export const ChatResponseSchema = z.object({
  conversationId: z.string(),
  messageId: z.string(),
  response: z.string(),
  tokensUsed: z.number().optional(),
  responseTimeMs: z.number().optional(),
});
