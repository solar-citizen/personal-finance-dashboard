import { z } from 'zod';

const email = z.email('Invalid email address');
const password = z
  .string()
  .min(8, 'Password must be at least 8 characters')
  .max(100);

export const RegisterSchema = z
  .object({
    email,
    name: z
      .string()
      .min(1, 'Name is required')
      .max(100, 'Name must be at most 100 characters'),
    password,
    repeatPassword: password,
  })
  .refine(({ password, repeatPassword }) => password === repeatPassword, {
    message: "Passwords don't match",
    path: ['repeatPassword'],
  });

export const LoginSchema = z.object({
  email,
  password,
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

export const LogoutResponseSchema = z.object({
  message: z.string(),
});
