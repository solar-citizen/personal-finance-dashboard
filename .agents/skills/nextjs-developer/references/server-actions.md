# Server Actions

**This project does not use Next.js Server Actions.** Confirmed: 100% of data
flow — reads and writes — goes through the generated TanStack Query hooks
hitting the separate NestJS API directly. There is no `'use server'` file,
no `formData`-based form submission calling a local mutation, and no
`revalidatePath`/`revalidateTag` usage anywhere in this app.

Don't introduce a Server Action as a solution to a data-mutation task unless
explicitly asked to add one. The default approach for "add a form that creates
X" is:

## The actual pattern for mutations

```typescript
// _generated/api/pfd-components.ts (generated — never hand-edit)
export const useCreateAccount = (
  options?: Omit<
    reactQuery.UseMutationOptions<CreateAccountResponse, CreateAccountError, CreateAccountVariables>,
    'mutationFn'
  >,
) => {
  const { fetcherOptions } = usePfdContext();
  return reactQuery.useMutation<CreateAccountResponse, CreateAccountError, CreateAccountVariables>({
    mutationFn: (variables) => fetchCreateAccount(deepMerge(fetcherOptions, variables)),
    ...options,
  });
};
```

```tsx
// components/accounts/ConnectAccountForm.tsx
'use client';

import { z } from 'zod';
import { useCreateAccount } from '#src/_generated/api/pfd-components';
import Form from '#src/components/form/Form';
import FormInput from '#src/components/form/FormInput';

const ConnectAccountSchema = z.object({
  token: z.string().min(1),
});

type ConnectAccountValues = z.infer<typeof ConnectAccountSchema>;

export default function ConnectAccountForm() {
  const { mutate, isPending, error } = useCreateAccount();

  return (
    <Form<ConnectAccountValues>
      defaultValues={{ token: '' }}
      validationSchema={ConnectAccountSchema}
      onSubmit={values => mutate(values)}
    >
      <FormInput<ConnectAccountValues> name={'token'} label={'Mono API token'} />
      <button type={'submit'} disabled={isPending}>
        {isPending ? 'Connecting…' : 'Connect'}
      </button>
      {error && <p>{'Failed to connect account.'}</p>}
    </Form>
  );
}
```

Notes on the actual `Form`/`FormInput` components (don't deviate from these
signatures):
- **`Form` owns the `useForm` instance internally** — it takes
  `defaultValues` + `validationSchema` (a Zod schema, wired to `zodResolver`
  internally) and builds the form itself. Don't pass a separately-created
  `form` object as a prop; there is no such prop.
- **`children` can be a render function** receiving the live watched form
  values (`form.watch()`), or a plain `ReactNode` — useful for conditional
  rendering based on current field values without a separate `useWatch` call.
- **`FormInput` converts empty string to `null`** on change (`e.target.value
  === '' ? null : e.target.value`) — so schemas for optional text fields
  should account for `null`, not just `undefined`, as the "empty" state.
- `mode` defaults to `'onSubmit'` (validate on submit, not on every
  keystroke) — only override it if a specific field genuinely needs
  onChange/onBlur validation timing.
- The form's root element gets `pointer-events-none` while
  `form.formState.isLoading` is true — this is a distinct flag from the
  mutation hook's own `isPending`; don't conflate them when disabling the
  submit button (as shown above, gate the button on the mutation's
  `pending`, not the form's `isLoading`).

## Rules

- Mutations use `useCreateXxx`/`useUpdateXxx`/`useDeleteXxx` generated hooks
  (React Query `useMutation` under the hood), driven by the project's
  `Form`/`FormInput` components (built on react-hook-form), not raw `<form
  action={...}>` with `FormData`.
- No `revalidatePath`/`revalidateTag` — TanStack Query's own
  `queryClient.invalidateQueries()` (often wired via the generated hook's
  `onSuccess`) is how the UI refreshes after a mutation, if that isn't already
  handled by the generated hook itself.
- No file uploads via `writeFile`/local filesystem — if the app ever needs
  file upload, it would go through an endpoint on the NestJS API, not a Next
  Server Action writing to `public/uploads`.
- No rate limiting, redirect-after-mutation, or optimistic-update patterns
  implemented via Server Actions — if these are needed, they'd be built with
  TanStack Query's own primitives (`onMutate` for optimistic updates,
  `useRouter().push()` client-side for redirects after a mutation succeeds).

If a task genuinely seems to need a Server Action (e.g. something that must
run only on the Next.js server itself, unrelated to the Nest API), flag it
explicitly rather than defaulting to writing one — it would be a new pattern
for this codebase.
