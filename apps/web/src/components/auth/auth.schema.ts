'use client';

import { z } from 'zod';

// FIXME: Consider using shared package schemas for consistency and reusability
const password = z.string().min(8, 'Password must be at least 8 characters').max(100);

export const loginSchema = z.object({
  email: z.email('Invalid email address'),
  password,
});

export const registerSchema = z
  .object({
    email: z.email('Invalid email address'),
    name: z.string().min(1, 'Name is required').max(100, 'Name must be at most 100 characters'),
    password,
    repeatPassword: password,
  })
  .refine(({ password, repeatPassword }) => password === repeatPassword, {
    message: "Passwords don't match",
    path: ['repeatPassword'],
  });

export type LoginFormData = z.infer<typeof loginSchema>;

export type RegisterFormData = z.infer<typeof registerSchema>;
