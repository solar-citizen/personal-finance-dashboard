# App Router Architecture

The file-based routing conventions below (layouts, loading/error boundaries,
route groups, dynamic/catch-all routes) are standard Next.js mechanics and
apply as-is in this project. Two things are project-specific and covered at
the end: **Route Handlers are not used**, and **pages are thin wrappers**.

## File-Based Routing

```
app/
├── layout.tsx              # Root layout (required)
├── page.tsx               # Home page (/)
├── loading.tsx            # Loading UI
├── error.tsx              # Error boundary
├── not-found.tsx          # 404 page
│
├── (marketing)/           # Route group (no URL segment)
│   ├── layout.tsx
│   └── about/
│       └── page.tsx      # /about
│
├── dashboard/
│   ├── layout.tsx        # Shared dashboard layout
│   ├── page.tsx          # /dashboard
│   └── settings/
│       └── page.tsx      # /dashboard/settings
│
└── blog/
    ├── [slug]/
    │   └── page.tsx      # /blog/my-post (dynamic)
    └── [...slug]/
        └── page.tsx      # /blog/a/b/c (catch-all)
```

## Page Structure — project convention

Pages are thin wrappers: import and render a single root component, nothing
else. All composition, layout, and child-component logic lives in that root
component, not in `page.tsx`:

```tsx
// app/dashboard/page.tsx
import Dashboard from '#src/components/dashboard/Dashboard';

export default function DashboardPage() {
  return <Dashboard />;
}
```

`page.tsx` itself stays a Server Component (no `'use client'` needed at this
level) — the root component it renders is very often a Client Component once
it starts using generated data-fetching hooks (see `server-components.md`).

## Root Layout (Required)

```tsx
// app/layout.tsx
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
```

## Loading States

```tsx
// app/dashboard/loading.tsx
export default function Loading() {
  return <div className={'flex items-center justify-center h-screen'}>{'Loading…'}</div>;
}
```

Note: this covers route-level navigation loading (the automatic Suspense
boundary Next.js creates around the page during a route transition) — it does
**not** cover per-query loading state from a TanStack Query hook. That's
handled by `<QueryState>` inside the component itself; see `data-fetching.md`.

## Error Boundaries

```tsx
// app/error.tsx
'use client';

export default function Error({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  return (
    <div>
      <h2>{'Something went wrong!'}</h2>
      <button onClick={() => reset()}>{'Try again'}</button>
    </div>
  );
}
```

Same distinction as above — this is a route-segment-crash boundary, not the
mechanism for surfacing a failed API query (that's `error` from `useQuery`,
rendered through `<QueryState>`).

## Route Groups

```tsx
app/
├── (marketing)/
│   ├── layout.tsx      # Marketing layout
│   └── about/
│       └── page.tsx    # /about
└── (app)/
    ├── layout.tsx      # App shell layout
    └── dashboard/
        └── page.tsx    # /dashboard
```

## Dynamic & Catch-All Routes

```tsx
// app/blog/[slug]/page.tsx
export default function BlogPost({ params }: { params: { slug: string } }) {
  return <h1>{`Post: ${params.slug}`}</h1>;
}

// app/docs/[...slug]/page.tsx — matches /docs/a, /docs/a/b, etc.
export default function Docs({ params }: { params: { slug: string[] } }) {
  return <div>{`Docs: ${params.slug.join('/')}`}</div>;
}
```

## Route Handlers — not used in this project

**Confirmed: this project has no local Route Handlers** (`app/api/**/route.ts`)
and no Server Actions — 100% of data flow goes through the generated TanStack
Query client hitting the separate NestJS API directly (see `data-fetching.md`
and `server-actions.md`). Don't create a Route Handler as a solution to a data
task — the equivalent work happens on the NestJS side, then a codegen run
(`bun run codegen`) produces the hook to consume it from Next.

If a task genuinely needs same-origin server-side logic unrelated to the Nest
API (rare — e.g. a webhook receiver that must live on the Next.js origin),
flag it explicitly before adding a Route Handler, since it would be a new
pattern for this codebase.

## Quick Reference

| File            | Purpose                                   | Use Case                                      |
| --------------- | ----------------------------------------- | --------------------------------------------- |
| `layout.tsx`    | Persistent UI across routes               | Shared navigation, auth wrapper               |
| `page.tsx`      | Thin wrapper importing one root component | Route entry point                             |
| `loading.tsx`   | Route-transition loading fallback         | Automatic Suspense boundary (navigation only) |
| `error.tsx`     | Route-segment crash boundary              | Handle render errors gracefully               |
| `not-found.tsx` | 404 page                                  | Custom not found UI                           |

**Not used here:** `route.ts` (Route Handlers), `template.tsx`, parallel
routes (`@slot`), intercepting routes — none of these appear in this project;
don't introduce them without being asked.
