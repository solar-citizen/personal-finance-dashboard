'use client';

import { z } from 'zod';

// FIXME: Consider using shared package schemas for consistency and reusability
export const loginSchema = z.object({
  email: z.email('Invalid email address'),
  password: z.string().min(8, 'Password must be at least 8 characters'),
});

export type LoginFormData = z.infer<typeof loginSchema>;
