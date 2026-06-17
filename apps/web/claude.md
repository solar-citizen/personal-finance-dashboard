# Next.js / React conventions

- Components and pages use default exports, not named exports:

```tsx
// correct
function FooPage() {...}
export default FooPage

// wrong
export { FooPage }
```

- shadcn/ui components (`components/ui/`) must not have their structure or styles edited directly. They are the exception that may use named exports.

- Put loading state in a parent component rather than passing `isLoading` props down to children.

- Always write text content as explicit strings:

```tsx
// correct
<>{'FooBar'}</>

// wrong
<>FooBar</>
```

This also applies to string attribute values, e.g. `type={'button'}` instead of `type="button"`.

- When building a page, extract any included components into their own files rather than defining them inline.

- Do not use `useMemo`, `useCallback`, or `React.memo` for optimization — the React Compiler handles this.

- Avoid unnecessary wrapper `divs`. Prefer fragments (`<>...</>`) and flatten nested elements where possible.

- Don't re-declare a callback if it has the same signature as the prop it's passed to:

```tsx
type FooProps = {
  onChange: (value: string) => void;
};

// correct
function Foo({ onChange }: FooProps) {
  return <button onClick={onChange}>...</button>;
}

// wrong
function Foo({ onChange }: FooProps) {
  const handleClick = useCallback(
    (option: string) => () => {
      onChange(option);
    },
    [onChange],
  );
  return <button onClick={handleClick}>...</button>;
}
```

- Don't declare `children` in prop types — use `React.PropsWithChildren`:

```tsx
// correct
type Props = React.PropsWithChildren<{
  // other props
}>;

// wrong
type Props = {
  children: React.ReactNode;
};
```

## API calls

- API client is fully generated from OpenAPI spec into `_generated/api/`
- All queries use **React Query** (`useQuery` / `useMutation`) via generated hooks in `_generated/api/pfd-components.ts`
- Transport layer uses `window.fetch` wrapped in a generated fetcher (`pfd-fetcher.ts`)
- Never call fetch or axios directly — always use the generated hooks

## Shared types

- Types are generated from the API's OpenAPI spec into `_generated/api/`
- Do not manually duplicate types that exist in `_generated/`

## Form handling

- **react-hook-form** via `useForm` and `useFormContext`
- Shared form primitives in `components/form/` (`Form.tsx`, `FormInput.tsx`)

## Auth

- Cookie-based, not manual token attachment — the API sets an httpOnly `token` cookie on login/register, and `pfdFetcher` already sends `credentials: 'include'`, so the browser attaches it on every request automatically
- No client-side token storage or header injection needed for the normal flow
- If requests come back unauthenticated, check the API's CORS config and the cookie's `sameSite` setting before changing anything client-side

## Error handling

- `pfdFetch` throws on non-2xx responses: if the body parses as JSON it throws that parsed body directly (shape depends on the Nest exception, typically `{ statusCode, message, error }`); if parsing fails or the fetch itself fails (network/CORS), it throws a plain `Error` with `name: 'unknown'`
- Not wired up at the React Query layer yet — `onError` callbacks need to distinguish the Nest error shape from the generic `Error` case
- No global error UI (toasts, etc.) exists — first usage establishes the convention
