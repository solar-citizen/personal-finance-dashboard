# Server & Client Components

The generic React Server Component model still applies structurally, but one
thing about this project inverts the usual "default to Server Components"
advice for anything touching data:

## The key project-specific fact

**Every data read/write goes through a generated TanStack Query hook**
(`useGetAccounts`, `useCreateAccount`, etc.), and **hooks cannot run in Server
Components** — only in Client Components. So in practice:

- Any component that fetches or mutates API data **must** be a Client
  Component (`'use client'`) — not because of interactivity, but because the
  data-fetching mechanism itself is hook-based.
- This is different from the textbook Next.js advice ("fetch in a Server
  Component, pass data down as props") — that pattern assumes `fetch()` or a
  direct DB call inside an `async` Server Component, which isn't how this app
  gets data at all.

```tsx
// components/accounts/AccountsSummary.tsx
'use client'; // required — useGetAccounts is a hook, not because of interactivity

import { useGetAccounts } from '#src/_generated/api/pfd-components';

export default function AccountsSummary() {
  const { data, isLoading, error } = useGetAccounts({});
  // ...
}
```

## Where Server Components still make sense

- **Static composition/layout** with no data dependency — e.g. a page's
  `layout.tsx` that just arranges children, or a purely presentational wrapper
  component with no hooks.
- Per this project's page-structure convention (see the web `CLAUDE.md`):
  `page.tsx` files are thin Server Component wrappers that import and render a
  single root component — that root component itself, though, is very
  frequently a Client Component once you're inside it and it needs to fetch
  data.

```tsx
// app/dashboard/page.tsx — Server Component, no 'use client' needed here
import Dashboard from '#src/components/dashboard/Dashboard';

export default function DashboardPage() {
  return <Dashboard />;
}
```

```tsx
// components/dashboard/Dashboard.tsx — likely 'use client' once it fetches
'use client';

import AccountsSummary from '#src/components/accounts/AccountsSummary';

export default function Dashboard() {
  return (
    <div>
      <AccountsSummary />
      {/* other data-driven sections */}
    </div>
  );
}
```

## What doesn't apply here

- `Suspense`-based streaming for data fetching — loading states come from
  `useQuery`'s `isLoading`, surfaced through the shared `<QueryState>`
  component, not `<Suspense fallback>` around an async Server Component.
- React's `cache()` for request deduplication — TanStack Query already
  dedupes by query key across the whole app; there's no server-side fetch to
  dedupe in the first place.
- "Zero bundle size" as a reason to prefer Server Components for a given
  component — if the component needs a generated hook, it's a Client
  Component regardless of bundle-size tradeoffs; that decision is made by the
  hook, not by Claude weighing bundle size.

## Still true, unchanged

- Push `'use client'` as low in the tree as sensibly possible — a data-driven
  leaf component being a Client Component doesn't mean its parent layout also
  needs to be one.
- Don't add `'use client'` to a component that has no hooks, no event
  handlers, and no browser APIs, just because a sibling or child needs it.
- Composition (Server Component rendering a Client Component as a child, or
  passing Server Component children into a Client Component wrapper) still
  works the same way React/Next.js describes it generally — nothing project-
  specific changes there.
