import { z } from 'zod';

export const RegisterSchema = z.object({
  email: z.email(),
  password: z.string().min(8).max(100),
  name: z.string().min(1).max(100),
});

export const LoginSchema = z.object({
  email: z.email(),
  password: z.string(),
});

export const UserSchema = z.object({
  id: z.string(),
  email: z.email(),
  name: z.string().nullable(),
});

export const AuthResponseSchema = z.object({
  accessToken: z.string(),
  user: UserSchema,
});
