import { messageRoles } from '@pfd/shared';
import { z } from 'zod';

export const MessageSchema = z.object({
  id: z.string(),
  role: z.enum(messageRoles),
  content: z.string(),
  createdAt: z.string(),
});

export const ConversationSchema = z.object({
  id: z.string(),
  title: z.string().nullable(),
  messages: z.array(MessageSchema),
  createdAt: z.string(),
  updatedAt: z.string(),
});

export const ConversationListItemSchema = z.object({
  id: z.string(),
  title: z.string().nullable(),
  lastMessage: z.string().nullable(),
  messageCount: z.number(),
  createdAt: z.string(),
  updatedAt: z.string(),
});
