import './globals.css';

import type { Metadata } from 'next';
import { Inter } from 'next/font/google';
import { cookies, headers } from 'next/headers';

import { cn } from '#src/lib/utils';

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
  const cookieLocale = cookieStore.get('NEXT_LOCALE')?.value;

  let resolvedLocale = cookieLocale;

  if (!resolvedLocale) {
    const headerList = await headers();
    const acceptLanguage = headerList.get('accept-language');

    if (acceptLanguage?.includes('uk')) {
      resolvedLocale = 'uk';
    } else {
      resolvedLocale = 'en';
    }
  }

  return (
    <html lang={resolvedLocale} suppressHydrationWarning>
      <body className={cn(inter.variable, 'antialiased')}>
        <Providers initialLocale={resolvedLocale}>{children}</Providers>
      </body>
    </html>
  );
}
