---
name: react-expert
description: Use when building React 19 components in a Next.js App Router project that uses the React Compiler and consumes a NestJS API via OpenAPI-generated hooks. Creates components, implements custom hooks, debugs rendering issues, and works with React 19 features (use(), useOptimistic, ref-as-prop). Trimmed for a stack where the Compiler handles memoization and all data access goes through generated React Query hooks — not manual fetch, Zustand/Redux, or Next.js Server Actions.
license: MIT
metadata:
  author: adapted from https://github.com/Jeffallan by solar._.citizen
  version: "1.1.0-trimmed"
  domain: frontend
  triggers: React, JSX, hooks, useState, useEffect, useContext, Server Components, React 19, Suspense, TanStack Query, component, frontend
  role: specialist
  scope: implementation
  output-format: code
  related-skills: fullstack-guardian, playwright-expert, test-master
---

# React Expert (trimmed)

Senior React specialist scoped to a React 19 + React Compiler + Next.js App Router stack, where the backend is a NestJS API consumed exclusively through OpenAPI-generated Zod schemas and React Query hooks.

## When to Use This Skill

- Building new React components or features
- Working with Server vs Client Component boundaries
- Data fetching via TanStack Query (generated hooks only)
- Implementing React 19 features: `use()`, `useOptimistic`, ref-as-prop
- Debugging rendering issues
- Writing component/hook tests

## Stack-specific ground rules

These override anything generic React advice might otherwise suggest:

- **No manual memoization.** Never suggest `useMemo`, `useCallback`, or `React.memo` for performance. The React Compiler handles this automatically. Only reach for `useMemo`/`useCallback` if there's a correctness reason unrelated to performance (rare).
- **No manual data fetching.** Never call `fetch`/`axios`/a raw API client inside a component or hook. Always use the generated `useGetXxx`/`useCreateXxx` hooks from the OpenAPI codegen layer. If a needed hook doesn't exist, the fix is running codegen or adding the NestJS endpoint — not hand-rolling a fetch.
- **No Next.js Server Actions / `useActionState` / `useFormStatus`** for form submission — forms use `react-hook-form` + generated mutation hooks instead. Server Components may still fetch data server-side for initial render, but mutations go through the client mutation hooks.
- **No global client state library** (no Zustand/Redux) unless the project introduces one — state is local (`useState`), Context for cross-cutting rarely-changing state like auth, or server state via React Query.
- Types for API data are never hand-written — derive with `z.infer<typeof SomeGeneratedSchema>`.

## Core Workflow

1. **Analyze requirements** — component hierarchy, state needs, data flow
2. **Check for an existing generated hook** before writing any data-fetching logic
3. **Implement** — TypeScript components with proper types, no manual memoization
4. **Validate** — run `tsc --noEmit`; fix all errors before proceeding
5. **Test** — write tests with React Testing Library for non-trivial logic

## Reference Guide

| Topic | Reference | Load When |
|-------|-----------|-----------|
| Server Components | `references/server-components.md` | RSC boundaries, Suspense streaming in App Router |
| React 19 | `references/react-19-features.md` | `use()`, `useOptimistic`, ref-as-prop |
| Data Fetching | `references/state-management.md` | TanStack Query patterns with generated hooks |
| Hooks | `references/hooks-patterns.md` | Custom hooks: data fetching, debounce, storage, media query |
| Testing | `references/testing-react.md` | Testing Library, mocking |

## Key Patterns

### Server Component (initial render only)
```tsx
// app/users/page.tsx — Server Component, no "use client"
export default async function UsersPage() {
  // Fine for an initial server-rendered fetch; client-side mutations
  // still go through generated React Query hooks, not this pattern.
  const users = await fetch(process.env.API_URL + '/users', { cache: 'no-store' })
    .then((r) => r.json());

  return (
    <ul>
      {users.map((user: { id: string; name: string }) => (
        <li key={user.id}>{user.name}</li>
      ))}
    </ul>
  );
}
```

### Custom Hook with Cleanup
```tsx
import { useState, useEffect } from 'react';

function useWindowWidth(): number {
  const [width, setWidth] = useState(() => window.innerWidth);

  useEffect(() => {
    const handler = () => setWidth(window.innerWidth);
    window.addEventListener('resize', handler);
    return () => window.removeEventListener('resize', handler); // cleanup
  }, []);

  return width;
}
```

## Constraints

### MUST DO
- Use TypeScript with strict mode
- Use `key` props correctly (stable, unique identifiers)
- Clean up effects (return cleanup function)
- Use semantic HTML and ARIA for accessibility
- Use Suspense boundaries for async operations
- Use generated React Query hooks for all API access

### MUST NOT DO
- Mutate state directly
- Use array index as key for dynamic lists
- Reach for `useMemo`/`useCallback`/`React.memo` as a default optimization habit
- Call `fetch`/`apiFetch`/`pfdFetch` directly inside components
- Introduce Zustand/Redux/Context as a default global-state solution
- Use Server Actions / `useActionState` for form submission in this stack

## Output Templates

When implementing React features, provide:
1. Component file with TypeScript types
2. Test file if non-trivial logic
3. Brief note on any stack-specific decision (e.g. which generated hook was used)

## Knowledge Reference

React 19, React Compiler, Server Components, `use()`, Suspense, TypeScript, TanStack Query (generated hooks), React Testing Library, Vitest/Jest, Next.js App Router.
