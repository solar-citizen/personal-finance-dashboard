# Localization Design Spec: English & Ukrainian (i18next)

## Overview
Add multi-language support (English `en` and Ukrainian `uk`) to the Next.js personal finance dashboard frontend using `i18next` and `react-i18next`, with language switching managed exclusively on the settings page (`/settings`).

## Key Architectural Decisions

### 1. Locale File Structure & Type Safety (`apps/web/src/locales/`)
- `apps/web/src/locales/en.json` — English translation dictionary nested by feature (`common`, `nav`, `dashboard`, `transactions`, `settings`, etc.).
- `apps/web/src/locales/uk.json` — Ukrainian translation dictionary matching the exact same keys.
- `apps/web/src/locales/schema.ts` — Zod schema describing the full translation shape. A validation script or test checks both JSON files against this schema to prevent missing keys at runtime.
- **Dependencies note:** `i18next-browser-languagedetector` is removed from dependencies since server-side resolution handles both first-visit and returning-visitor detection.

### 2. SSR Hydration & Cookie Strategy
- To avoid hydration mismatches or locale flashes in Next.js App Router, the user's selected language will be stored in both a cookie (`NEXT_LOCALE`) and `localStorage`.
- The cookie is read on the server during initial render, ensuring the server and initial client render match perfectly.
- Language switching on the settings page updates both `localStorage` and the cookie, triggering `router.refresh()` so the server re-resolves the locale and stays in sync.

#### Server-Side Locale Resolution
- `app/layout.tsx` (Server Component) reads the `NEXT_LOCALE` cookie via `cookies()` from `next/headers`, falling back to the `Accept-Language` header on first visit (no cookie yet), and defaulting to `en` if neither resolves.
- This resolved locale is passed as a prop (`initialLocale`) into the client provider — it is not read again client-side as the source of truth for the first render.
- The `<html lang={locale}>` attribute is set from this same resolved value.

### 3. Client Boundary & Initialization
- `apps/web/src/lib/i18n.ts` exports an `initI18n(lng: string)` function rather than calling `i18next.init()` at module scope on import. This allows the server-resolved locale to be passed in explicitly before any component calls `useTranslation()`.
- `providers.tsx` accepts `initialLocale` as a prop and calls `initI18n(initialLocale)`.

### 4. Settings Page Integration
- A dedicated language switcher on the settings page (`/settings`) allows toggling between English and Ukrainian.
- Updates both the `NEXT_LOCALE` cookie and `localStorage`, then triggers `router.refresh()` so the server re-resolves the locale on subsequent navigation/reload and stays in sync with the cookie.

### 5. Text Replacement Rule
- All user-facing UI text across core components (`MainNav`, Dashboard, Transactions, Settings) will use `t('key')` or explicit React strings `{'String'}` as governed by project rules.
