# Localization (English & Ukrainian) Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add full English (`en`) and Ukrainian (`uk`) localization to the Next.js frontend using `i18next`, with SSR cookie-based locale resolution and a language switcher exclusively on the settings page (`/settings`).

**Architecture:** 
1. Define translations in JSON dictionaries (`en.json`, `uk.json`) and validate them via Zod (`schema.ts`).
2. Server component (`app/layout.tsx`) reads the `NEXT_LOCALE` cookie (falling back to `Accept-Language` or `en`), setting `<html lang={locale}>`.
3. Client initialization (`lib/i18n.ts` & `providers.tsx`) initializes `i18next` with the server-resolved locale.
4. Settings page (`/settings`) provides a language switcher component that updates both `localStorage` and `NEXT_LOCALE` cookie, then calls `router.refresh()` to keep SSR in sync.
5. Update core components (`MainNav`, Dashboard, Settings, etc.) to use `useTranslation()`.

**Tech Stack:** Next.js (App Router), `i18next`, `react-i18next`, `zod`, Tailwind CSS.

## Global Constraints

- **Naming Conventions:** camelCase for all variables, constants, function names, and object keys. PascalCase for types, enums, Zod schemas. SCREAMING_SNAKE_CASE only for env vars.
- **Next.js & React Conventions:** Default exports for components and pages (except shadcn/ui). Explicit text content as strings (`{'Foo'}`). No `useMemo`/`useCallback`/`React.memo`. Prefer fragments (`<>...</>`).
- **i18n & Cookies:** Server-side locale resolution from `NEXT_LOCALE` cookie / `Accept-Language` header. Client initialization via explicit `initI18n(initialLocale)`. Language switcher on settings page calling `router.refresh()`.

---

## Task 1: Install i18next & Create Translation Dictionaries and Zod Schema

**Files:**
- Modify: `apps/web/package.json`
- Create: `apps/web/src/locales/en.json`
- Create: `apps/web/src/locales/uk.json`
- Create: `apps/web/src/locales/schema.ts`

**Interfaces:**
- Produces: `TranslationSchema`, `en.json`, `uk.json`

- [ ] **Step 1: Install i18next and react-i18next**

Run: `cd apps/web && bun add i18next react-i18next`
Expected: Packages installed successfully.

- [ ] **Step 2: Create Zod translation schema (`apps/web/src/locales/schema.ts`)**

```typescript
import { z } from 'zod';

export const TranslationSchema = z.object({
  common: z.object({
    loading: z.string(),
    error: z.string(),
    save: z.string(),
    cancel: z.string(),
  }),
  nav: z.object({
    dashboard: z.string(),
    transactions: z.string(),
    settings: z.string(),
  }),
  dashboard: z.object({
    title: z.string(),
    welcome: z.string(),
  }),
  transactions: z.object({
    title: z.string(),
    addTransaction: z.string(),
  }),
  settings: z.object({
    title: z.string(),
    language: z.string(),
    languageSelect: z.string(),
    english: z.string(),
    ukrainian: z.string(),
  }),
});

export type TranslationSchemaType = z.infer<typeof TranslationSchema>;
```

- [ ] **Step 3: Create English locale file (`apps/web/src/locales/en.json`)**

```json
{
  "common": {
    "loading": "Loading...",
    "error": "An error occurred",
    "save": "Save",
    "cancel": "Cancel"
  },
  "nav": {
    "dashboard": "Dashboard",
    "transactions": "Transactions",
    "settings": "Settings"
  },
  "dashboard": {
    "title": "Dashboard",
    "welcome": "Welcome back"
  },
  "transactions": {
    "title": "Transactions",
    "addTransaction": "Add Transaction"
  },
  "settings": {
    "title": "Settings",
    "language": "Language",
    "languageSelect": "Select your preferred language",
    "english": "English",
    "ukrainian": "Українська"
  }
}
```

- [ ] **Step 4: Create Ukrainian locale file (`apps/web/src/locales/uk.json`)**

```json
{
  "common": {
    "loading": "Завантаження...",
    "error": "Сталася помилка",
    "save": "Зберегти",
    "cancel": "Скасувати"
  },
  "nav": {
    "dashboard": "Панель приладів",
    "transactions": "Транзакції",
    "settings": "Налаштування"
  },
  "dashboard": {
    "title": "Панель приладів",
    "welcome": "З поверненням"
  },
  "transactions": {
    "title": "Транзакції",
    "addTransaction": "Додати транзакцію"
  },
  "settings": {
    "title": "Налаштування",
    "language": "Мова",
    "languageSelect": "Виберіть бажану мову",
    "english": "English",
    "ukrainian": "Українська"
  }
}
```

- [ ] **Step 5: Test schema validation script/test or run build check**

Run: `cd apps/web && bun run build`
Expected: Successful build (or typecheck).

- [ ] **Step 6: Commit changes**

```bash
git add apps/web/package.json apps/web/src/locales/
git commit -m "feat(i18n): add locales and validation schema"
```

---

## Task 2: Implement Client i18n Initialization & SSR Locale Resolution

**Files:**
- Create: `apps/web/src/lib/i18n.ts`
- Modify: `apps/web/src/app/layout.tsx`
- Modify: `apps/web/src/app/providers.tsx`

**Interfaces:**
- Consumes: `en.json`, `uk.json`
- Produces: `initI18n` function, server locale detection in layout

- [ ] **Step 1: Create `apps/web/src/lib/i18n.ts`**

```typescript
import i18n from 'i18next';
import { initReactI18next } from 'react-i18next';
import en from '#src/locales/en.json';
import uk from '#src/locales/uk.json';

const resources = {
  en: { translation: en },
  uk: { translation: uk },
};

export function initI18n(lng: string = 'en') {
  if (!i18n.isInitialized) {
    i18n.use(initReactI18next).init({
      resources,
      lng,
      fallbackLng: 'en',
      interpolation: {
        escapeValue: false,
      },
    });
  } else if (i18n.language !== lng) {
    i18n.changeLanguage(lng);
  }
  return i18n;
}
```

- [ ] **Step 2: Update `apps/web/src/app/layout.tsx` for server-side locale resolution**

```tsx
import { cookies, headers } from 'next/headers';
import Providers from '#src/app/providers';
import './globals.css';

export default async function RootLayout({
  children,
}: React.PropsWithChildren) {
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
    <html lang={resolvedLocale}>
      <body>
        <Providers initialLocale={resolvedLocale}>
          {children}
        </Providers>
      </body>
    </html>
  );
}
```

- [ ] **Step 3: Update `apps/web/src/app/providers.tsx`**

```tsx
'use client';

import React from 'react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { ReactQueryDevtools } from '@tanstack/react-query-devtools';
import { initI18n } from '#src/lib/i18n';

type ProvidersProps = React.PropsWithChildren<{
  initialLocale: string;
}>;

export default function Providers({ children, initialLocale }: ProvidersProps) {
  const [queryClient] = React.useState(
    () =>
      new QueryClient({
        defaultOptions: {
          queries: {
            staleTime: 60 * 1000,
          },
        },
      }),
  );

  // Initialize i18n with server-resolved locale
  React.useEffect(() => {
    initI18n(initialLocale);
  }, [initialLocale]);

  // Synchronously initialize for first render
  initI18n(initialLocale);

  return (
    <QueryClientProvider client={queryClient}>
      {children}
      <ReactQueryDevtools initialIsOpen={false} />
    </QueryClientProvider>
  );
}
```

- [ ] **Step 4: Run build check**

Run: `cd apps/web && bun run build`
Expected: Build passes successfully.

- [ ] **Step 5: Commit changes**

```bash
git add apps/web/src/lib/i18n.ts apps/web/src/app/layout.tsx apps/web/src/app/providers.tsx
git commit -m "feat(i18n): implement SSR locale resolution and client i18n initialization"
```

---

## Task 3: Implement Language Switcher on Settings Page

**Files:**
- Modify/Create: `apps/web/src/app/(main)/settings/page.tsx`
- Create: `apps/web/src/components/settings/Settings.tsx`
- Create: `apps/web/src/components/settings/LanguageSwitcher.tsx`

**Interfaces:**
- Produces: Language switcher component wired to `NEXT_LOCALE` cookie and `router.refresh()`

- [ ] **Step 1: Create `apps/web/src/components/settings/LanguageSwitcher.tsx`**

```tsx
'use client';

import React from 'react';
import { useTranslation } from 'react-i18next';
import { useRouter } from 'next/navigation';

export default function LanguageSwitcher() {
  const { t, i18n } = useTranslation();
  const router = useRouter();
  const currentLanguage = i18n.language || 'en';

  const handleLanguageChange = (lng: string) => {
    i18n.changeLanguage(lng);
    document.cookie = `NEXT_LOCALE=${lng}; path=/; max-age=31536000; SameSite=Lax`;
    localStorage.setItem('i18nextLng', lng);
    router.refresh();
  };

  return (
    <div className="flex flex-col gap-2">
      <label className="text-sm font-medium text-foreground">
        {t('settings.language')}
      </label>
      <p className="text-xs text-muted-foreground">
        {t('settings.languageSelect')}
      </p>
      <div className="flex gap-2 mt-1">
        <button
          type="button"
          onClick={() => handleLanguageChange('en')}
          className={`px-4 py-2 text-sm font-medium rounded-md border transition-colors ${
            currentLanguage === 'en'
              ? 'bg-primary text-primary-foreground border-primary'
              : 'bg-background text-foreground border-border hover:bg-muted'
          }`}
        >
          {t('settings.english')}
        </button>
        <button
          type="button"
          onClick={() => handleLanguageChange('uk')}
          className={`px-4 py-2 text-sm font-medium rounded-md border transition-colors ${
            currentLanguage === 'uk'
              ? 'bg-primary text-primary-foreground border-primary'
              : 'bg-background text-foreground border-border hover:bg-muted'
          }`}
        >
          {t('settings.ukrainian')}
        </button>
      </div>
    </div>
  );
}

export { LanguageSwitcher };
```

- [ ] **Step 2: Create `apps/web/src/components/settings/Settings.tsx`**

```tsx
'use client';

import React from 'react';
import { useTranslation } from 'react-i18next';
import { LanguageSwitcher } from '#src/components/settings/LanguageSwitcher';

export default function Settings() {
  const { t } = useTranslation();

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold tracking-tight text-foreground">
          {t('settings.title')}
        </h1>
      </div>
      <div className="p-6 bg-card border border-border rounded-lg shadow-sm">
        <LanguageSwitcher />
      </div>
    </div>
  );
}

export { Settings };
```

- [ ] **Step 3: Update `apps/web/src/app/(main)/settings/page.tsx`**

```tsx
import Settings from '#src/components/settings/Settings';

export default function SettingsPage() {
  return <Settings />;
}
```

- [ ] **Step 4: Run build check**

Run: `cd apps/web && bun run build`
Expected: Build passes successfully.

- [ ] **Step 5: Commit changes**

```bash
git add apps/web/src/app/(main)/settings/page.tsx apps/web/src/components/settings/
git commit -m "feat(i18n): add language switcher and settings component"
```

---

## Task 4: Localize Navigation (`MainNav`) and Dashboard/Transactions Headers

**Files:**
- Modify: `apps/web/src/components/MainNav.tsx`
- Modify: `apps/web/src/components/dashboard/Dashboard.tsx`
- Modify: `apps/web/src/components/transactions/Transactions.tsx`

**Interfaces:**
- Consumes: `nav.*`, `dashboard.*`, `transactions.*`

- [ ] **Step 1: Update `apps/web/src/components/MainNav.tsx` to use `useTranslation()`**

```tsx
'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { useTranslation } from 'react-i18next';

export default function MainNav() {
  const pathname = usePathname();
  const { t } = useTranslation();

  const links = [
    { href: '/dashboard', label: t('nav.dashboard') },
    { href: '/transactions', label: t('nav.transactions') },
    { href: '/settings', label: t('nav.settings') },
  ];

  return (
    <nav className="flex gap-4">
      {links.map((link) => {
        const isActive = pathname === link.href;
        return (
          <Link
            key={link.href}
            href={link.href}
            className={`px-3 py-2 rounded-md text-sm font-medium transition-colors ${
              isActive
                ? 'bg-primary text-primary-foreground'
                : 'text-muted-foreground hover:bg-muted hover:text-foreground'
            }`}
          >
            {link.label}
          </Link>
        );
      })}
    </nav>
  );
}

export { MainNav };
```

- [ ] **Step 2: Update `apps/web/src/components/dashboard/Dashboard.tsx` to use `useTranslation()`**

Check Dashboard.tsx implementation and wrap title/headings with `t('dashboard.title')`, etc.

- [ ] **Step 3: Update `apps/web/src/components/transactions/Transactions.tsx` to use `useTranslation()`**

Wrap title/headings with `t('transactions.title')`, etc.

- [ ] **Step 4: Run build check**

Run: `cd apps/web && bun run build`
Expected: Build passes successfully with zero errors.

- [ ] **Step 5: Commit changes**

```bash
git add apps/web/src/components/MainNav.tsx apps/web/src/components/dashboard/Dashboard.tsx apps/web/src/components/transactions/Transactions.tsx
git commit -m "feat(i18n): localize MainNav, Dashboard, and Transactions headers"
```
