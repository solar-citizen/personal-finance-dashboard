import './globals.css';

import type { Metadata } from 'next';
import { Inter } from 'next/font/google';
import { cookies, headers } from 'next/headers';

import { cn } from '#src/lib/utils';
import { AppLanguage, defaultLanguage } from '#src/locales/types';

import { Providers } from './providers';

const inter = Inter({
  subsets: ['latin', 'cyrillic'],
  variable: '--font-inter',
});

export const metadata: Metadata = {
  title: 'Personal Finance Dashboard - Your Finance Manager',
  description: 'AI-powered personal finance management with banks integration',
};

export default async function RootLayout({ children }: Readonly<React.PropsWithChildren>) {
  const cookieStore = await cookies();
  const rawCookieLocale = cookieStore.get('NEXT_LOCALE')?.value;
  const cookieLocale =
    rawCookieLocale === AppLanguage.UK || rawCookieLocale === AppLanguage.EN
      ? rawCookieLocale
      : undefined;

  const acceptLanguage = (await headers()).get('accept-language');
  const resolvedLocale: AppLanguage =
    cookieLocale ?? (acceptLanguage?.includes('uk') ? AppLanguage.UK : defaultLanguage);

  return (
    <html lang={resolvedLocale} suppressHydrationWarning>
      <body className={cn(inter.variable, 'antialiased')}>
        <Providers initialLocale={resolvedLocale}>{children}</Providers>
      </body>
    </html>
  );
}
