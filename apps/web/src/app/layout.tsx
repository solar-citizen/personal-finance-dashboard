import './globals.css';

import type { Metadata } from 'next';
import { Inter } from 'next/font/google';
import type { PropsWithChildren } from 'react';

import { Providers } from './providers';

const inter = Inter({ subsets: ['latin', 'cyrillic'] });

export const metadata: Metadata = {
  title: 'Personal Finance Dashboard - Your Finance Manager',
  description: 'AI-powered personal finance management with banks integration',
};

export default function RootLayout({ children }: Readonly<PropsWithChildren>) {
  return (
    <html lang={'en'} suppressHydrationWarning>
      <body className={inter.className}>
        <Providers>{children}</Providers>
      </body>
    </html>
  );
}
