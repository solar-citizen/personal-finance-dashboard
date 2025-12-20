import type { CookieOptions } from 'express';

export const cookieConfig: CookieOptions = {
  httpOnly: true,
  secure: process.env.APP_ENV === 'production',
  sameSite: 'strict',
  path: '/',
};
