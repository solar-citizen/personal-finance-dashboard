'use client';

import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { ReactQueryDevtools } from '@tanstack/react-query-devtools';
import { ThemeProvider } from 'next-themes';
import { useEffect, useState } from 'react';

import { initI18n } from '#src/lib/i18n';

type ProvidersProps = React.PropsWithChildren<{
  initialLocale: string;
}>;

export function Providers({ children, initialLocale }: ProvidersProps) {
  const [queryClient] = useState(
    () =>
      new QueryClient({
        defaultOptions: {
          queries: {
            retry: 2,
            refetchOnWindowFocus: false,
          },
        },
      }),
  );

  useEffect(() => {
    initI18n(initialLocale);
  }, [initialLocale]);

  initI18n(initialLocale);

  return (
    <QueryClientProvider client={queryClient}>
      <ThemeProvider
        attribute={'class'}
        defaultTheme={'system'}
        enableSystem
        disableTransitionOnChange
      >
        {children}
      </ThemeProvider>
      <ReactQueryDevtools initialIsOpen={false} />
    </QueryClientProvider>
  );
}
