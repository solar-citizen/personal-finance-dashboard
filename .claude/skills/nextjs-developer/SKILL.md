---
name: nextjs-developer
description: "Use when building this project's Next.js 14+ App Router frontend, which consumes a separate NestJS API via a fully generated TanStack Query client — not via Next.js's own data fetching, Route Handlers, or Server Actions. Invoke for App Router structure, Client/Server Component boundaries, generated-hook data fetching, react-hook-form forms, and deployment of the web app in this bun/Turbo monorepo."
license: MIT
metadata:
  author: adapted from https://github.com/Jeffallan by solar._.citizen
  version: '1.1.0-generated-api-client'
  domain: frontend
  triggers: Next.js, App Router, Server Components, TanStack Query, react-hook-form, Next.js deployment
  role: specialist
  scope: implementation
  output-format: code
  related-skills: typescript-pro
---

# Next.js Developer (generated-API-client variant)

Next.js 14+ App Router frontend that consumes a separate NestJS API entirely
through a **generated TanStack Query client** — no local database, no Next.js
Route Handlers, no Server Actions. See the reference files for the full
picture; this file is the entry point and the constraints that most often get
this wrong.

## Core Workflow

1. **Check for an existing generated hook first.** Before writing any data
   logic, search `_generated/api/pfd-components.ts` for a hook matching the
   endpoint/method. If it's missing, the NestJS endpoint doesn't exist yet or
   codegen hasn't been re-run (`bun run codegen`) — don't hand-roll a fetch
   call as a substitute.
2. **Decide Server vs Client Component** — see `references/server-components.md`.
   Anything using a generated hook must be `'use client'`.
3. **Build the component** — thin `page.tsx` importing one root component;
   composition lives in that root component.
4. **Forms/mutations** use react-hook-form + generated `useCreateXxx`/`useUpdateXxx` hooks — never a Server Action.
5. **Validate** — `next build` (via `bun turbo build`) with zero type errors.

## Reference Guide

| Topic                    | Reference                         | Load When                                                           |
|------------------------|--------------------------------- |------------------------------------------------------------------- |
| App Router               | `references/app-router.md`        | File-based routing, layouts, loading/error, page-wrapper convention |
| Server/Client Components | `references/server-components.md` | Deciding component boundaries — note the generated-hook caveat      |
| Data Fetching            | `references/data-fetching.md`     | TanStack Query generated hooks, `<QueryState>`, no raw fetch/SWR    |
| Server Actions           | `references/server-actions.md`    | **Not used in this project** — read this before reaching for one    |
| Deployment               | `references/deployment.md`        | bun/Turbo monorepo build, CORS/cookie prod gotchas                  |

## Constraints

### MUST DO

- Use App Router (`app/` directory)
- Check `_generated/api/pfd-components.ts` for an existing hook before writing any fetch logic
- Add `'use client'` to any component using a generated hook (TanStack Query hooks can't run in Server Components)
- Use react-hook-form (`useForm`/`useFormContext`) for forms, paired with generated mutation hooks
- Use `next/image` for content images
- Keep `page.tsx` as a thin wrapper importing a single root component

### MUST NOT DO

- Call `fetch()` or `axios` directly for API data — always go through a generated hook
- Use Next.js's `cache`/`next.revalidate`/`next.tags` fetch options, `revalidatePath`/`revalidateTag`, or SWR — none of these apply since there's no raw `fetch()` for Next to cache
- Create a Route Handler (`app/api/**/route.ts`) or Server Action as a way to reach the NestJS API — go through codegen instead
- Add a Prisma client or any direct DB access to the Next.js app — it doesn't have one
- Assume "default to Server Components" applies to data-fetching components — it doesn't here, since data fetching is hook-based

## Code Example — the actual pattern end to end

```tsx
// app/dashboard/page.tsx — thin Server Component wrapper
import Dashboard from '#src/components/dashboard/Dashboard';

export default function DashboardPage() {
  return <Dashboard />;
}
```

```tsx
// components/dashboard/Dashboard.tsx — Client Component, composes data-driven children
'use client';

import AccountsSummary from '#src/components/accounts/AccountsSummary';

export default function Dashboard() {
  return (
    <div>
      <AccountsSummary />
    </div>
  );
}
```

```tsx
// components/accounts/AccountsSummary.tsx
'use client';

import { useGetAccounts } from '#src/_generated/api/pfd-components';
import QueryState from '#src/components/common/QueryState';
import { SkeletonList } from '#src/components/common/Skeleton';

export default function AccountsSummary() {
  const { data, isLoading, error } = useGetAccounts({});

  return (
    <section className={'p-4 border rounded-lg shadow-sm'}>
      <h2 className={'text-xl font-bold mb-4'}>{'Accounts/Cards'}</h2>
      <QueryState
        isLoading={isLoading}
        error={error}
        data={data}
        errorMessage={'Failed to load accounts.'}
        loadingFallback={<SkeletonList length={6} />}
      >
        {accounts => <div>{/* render accounts */}</div>}
      </QueryState>
    </section>
  );
}
```

## Output Templates

When implementing a Next.js feature, provide:

1. `page.tsx` (thin wrapper) + root component file
2. Client/Server Component split, following `server-components.md`
3. Generated-hook usage for any data — flag clearly if a needed hook doesn't exist yet (i.e. the API/codegen needs updating first)
4. Form + mutation hook if the feature involves writes
5. Brief note on which components are `'use client'` and why

## Knowledge Reference

Next.js 14+ App Router, React Server/Client Components, TanStack Query
(generated hooks), react-hook-form, next/image, next/font, Metadata API,
Tailwind v4 semantic tokens (see project web `CLAUDE.md`)

**Explicitly not part of this project's stack:** Next.js Route Handlers,
Server Actions, raw `fetch()` caching, SWR, Prisma/local DB access from the
web app, Pages Router.