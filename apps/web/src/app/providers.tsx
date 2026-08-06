'use client';

import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { ReactQueryDevtools } from '@tanstack/react-query-devtools';
import { ThemeProvider } from 'next-themes';
import { useEffect, useState } from 'react';
import { I18nextProvider } from 'react-i18next';

import { createI18nInstance } from '#src/lib/i18n';

type ProvidersProps = React.PropsWithChildren<{
  initialLocale: string;
}>;

export function Providers({ children, initialLocale }: ProvidersProps) {
  // Create an isolated i18n instance per render tree
  const [i18nInstance] = useState(() => createI18nInstance(initialLocale));

  /**
   * Keeps the instance in sync if initialLocale changes on a re-render
   * that doesn't remount this component (e.g. client-side nav between
   * locale routes without a full tree teardown).
   */
  useEffect(() => {
    if (i18nInstance.language !== initialLocale) {
      void i18nInstance.changeLanguage(initialLocale);
    }
  }, [i18nInstance, initialLocale]);

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

  return (
    <I18nextProvider i18n={i18nInstance}>
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
    </I18nextProvider>
  );
}
