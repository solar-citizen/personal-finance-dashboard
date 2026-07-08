# Data Fetching

This project does **not** use Next.js's built-in fetch caching (`cache:
'force-cache'`/`'no-store'`, `next.revalidate`, `next.tags`,
`revalidatePath`/`revalidateTag`), SWR, or direct database access from
Next.js. There is no local Prisma client in the web app — all data comes from
the separate NestJS API via a **fully generated TanStack Query client**.

Don't reach for any of the above. Instead:

## The actual pattern

```typescript
// _generated/api/pfd-components.ts (generated — never hand-edit)
export const useGetAccounts = <TData = GetAccountsResponse>(
  variables: GetAccountsVariables | reactQuery.SkipToken,
  options?: Omit<
    reactQuery.UseQueryOptions<GetAccountsResponse, GetAccountsError, TData>,
    'queryKey' | 'queryFn' | 'initialData'
  >,
) => {
  const { queryOptions, fetcherOptions } = usePfdContext(options);
  return reactQuery.useQuery<GetAccountsResponse, GetAccountsError, TData>({
    ...getAccountsQuery(
      variables === reactQuery.skipToken ? variables : deepMerge(fetcherOptions, variables),
    ),
    ...options,
    ...queryOptions,
  });
};
```

```tsx
// components/accounts/AccountsSummary.tsx
'use client';

import { useGetAccounts } from '#src/_generated/api/pfd-components';
import { MonoBankAccountResponseDto } from '#src/_generated/api/pfd-types';
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
        {accounts => <AccountsList accounts={accounts} />}
      </QueryState>
    </section>
  );
}
```

## Rules

- **Never call `fetch()` or `axios` directly.** Every read/write goes through
  a generated hook in `_generated/api/pfd-components.ts`. If a hook doesn't
  exist for an endpoint, the NestJS controller is missing or codegen hasn't
  been re-run (`bun run codegen`) — don't hand-roll a fetch call as a
  workaround.
- **Any component using a generated hook must be a Client Component**
  (`'use client'`). Hooks (`useGetAccounts`, `useQuery`, etc.) cannot run in
  Server Components — this is the main reason most data-driven components in
  this app are Client Components rather than Server Components. See
  `server-components.md` for the fuller implication of this.
- **Loading and error states are handled per-query with `<QueryState>`**, not
  with `loading.tsx`/`error.tsx` route-segment boundaries or `<Suspense>`.
  `isLoading`/`error`/`data` come straight off the `useQuery` result.
- **Skip variables with `reactQuery.skipToken`** (not `enabled: false`
  patterns you might reach for from raw `useQuery`) when a query shouldn't run
  yet — this is baked into the generated hook's type signature.
- Mutations follow the same generated-hook shape:
  `useCreateXxx`/`useUpdateXxx` from the same generated barrel, not a Next.js
  Server Action. See `server-actions.md`.
- **No manual caching decisions to make** — TanStack Query's own
  `staleTime`/`gcTime` (set via `options` passed into the generated hook, or
  defaults from `usePfdContext`) is the only caching layer. There is no Next
  Data Cache involved since there's no raw `fetch()` call for Next to
  intercept.
- Auth is cookie-based and automatic: the underlying fetcher
  (`pfd-fetcher.ts`) sends `credentials: 'include'`, so the httpOnly `token`
  cookie is attached without any manual header injection. If a query comes
  back unauthenticated, check CORS/cookie config on the API side before
  changing anything client-side.
- Error handling: `pfdFetch` throws the parsed JSON error body on non-2xx
  responses (shape depends on the Nest exception — typically `{ statusCode,
  message, error }`), or a plain `Error` with `name: 'unknown'` if parsing or
  the fetch itself fails. This isn't wired into a shared `onError` yet, so
  handle both shapes explicitly if you add error-specific UI.

## Do not use

- `fetch()` with `cache`/`next: { revalidate | tags }`
- `revalidatePath()` / `revalidateTag()`
- SWR (`useSWR`)
- React's `cache()` for dedup — TanStack Query already dedupes by query key
- Any direct Prisma/`db.*` calls from the Next app — there is no local
  database client in this app
