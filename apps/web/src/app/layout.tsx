import './globals.css';

import type { Metadata } from 'next';
import { Inter } from 'next/font/google';

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

export default function RootLayout({ children }: Readonly<React.PropsWithChildren>) {
  return (
    <html lang={'en'} suppressHydrationWarning>
      <body className={cn(inter.variable, 'antialiased')}>
        <Providers>{children}</Providers>
      </body>
    </html>
  );
}
