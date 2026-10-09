---
name: typescript-pro
description: Implements advanced TypeScript types, custom type guards and utility types. Use for advanced generics, conditional or mapped types, discriminated unions, strict tsconfig work and monorepo type setup.
license: MIT
metadata:
  author: https://github.com/Jeffallan refined by solar._.citizen
  version: '1.2.0-trimmed'
  domain: language
  triggers: TypeScript, generics, type safety, conditional types, mapped types, tsconfig, type guards, discriminated unions
  role: specialist
  scope: implementation
  output-format: code
---

# TypeScript Pro

## Core Workflow

1. **Analyze existing types** - Review the package's tsconfig and the types already in use (generated Zod schemas, Prisma types)
2. **Design type-first** - Prefer inference and existing generated types; add generics, utility types or custom types only where needed
3. **Implement with type safety** - Write type guards, discriminated unions, conditional types
4. **Verify** - Run `tsc --noEmit` and fix all errors before moving on

## Reference Guide

Load detailed guidance based on context:

| Topic                   | Reference                                | Load When                                                    |
| ----------------------- | ---------------------------------------- | ------------------------------------------------------------ |
| Advanced Types          | `references/advanced-types.md`           | Generics, conditional types, mapped types, template literals |
| Type Guards             | `references/type-guards.md`              | Type narrowing, discriminated unions, assertion functions    |
| Utility Types           | `references/utility-types.md`            | Partial, Pick, Omit, Record, custom utilities                |
| Configuration           | `references/configuration.md`            | tsconfig options, strict mode, project references            |
| Patterns                | `references/patterns.md`                 | Builder pattern, factory pattern, type-safe APIs             |
| Additional Style Guides | `references/additional-style-guiding.md` | Consistent coding practices (any, destructuring)             |

## Stack Conventions

- API types come from generated Zod schemas: use `z.infer<typeof Schema>`, never hand-write them.
- Prisma types: use `Prisma.XGetPayload` / `Prisma.validator` instead of redefining shapes.
- Validate at boundaries with Zod. Don't add runtime type libraries (tRPC, io-ts).
- Don't change tsconfig compiler options unprompted. Match the existing config of the package you're
  editing (web uses bundler resolution, API uses Nest defaults). Suggest `noUncheckedIndexedAccess`
  if it isn't already on.

## Code Examples

### Avoiding ID mix-ups

Prefer object parameters over positional ones when several arguments share a type:

```typescript
// Hard to get wrong: swapping the two IDs is visible at the call site
function getOrder({ userId, orderId }: { userId: string; orderId: string }) {
  /* ... */
}

getOrder({ userId, orderId });
```

Only when a mix-up would be genuinely dangerous (ownership checks, money), brand at the Zod
boundary instead of casting:

```typescript
const UserIdSchema = z.string().uuid().brand<'UserId'>();
type UserId = z.infer<typeof UserIdSchema>;
```

### Discriminated Unions & Type Guards

```typescript
type LoadingState = { status: 'loading' };
type SuccessState = { status: 'success'; data: string[] };
type ErrorState = { status: 'error'; error: Error };
type RequestState = LoadingState | SuccessState | ErrorState;

// Type predicate guard
function isSuccess(state: RequestState): state is SuccessState {
  return state.status === 'success';
}

// Exhaustive switch with discriminated union
function renderState(state: RequestState): string {
  switch (state.status) {
    case 'loading':
      return 'Loading…';
    case 'success':
      return state.data.join(', ');
    case 'error':
      return state.error.message;
    default: {
      const _exhaustive: never = state;
      throw new Error(`Unhandled state: ${_exhaustive}`);
    }
  }
}
```

### Custom Utility Types

```typescript
// Deep readonly — immutable nested objects
type DeepReadonly<T> = {
  readonly [K in keyof T]: T[K] extends object ? DeepReadonly<T[K]> : T[K];
};

// Require exactly one of a set of keys
type RequireExactlyOne<T, Keys extends keyof T = keyof T> = Pick<T, Exclude<keyof T, Keys>> &
  { [K in Keys]-?: Required<Pick<T, K>> & Partial<Record<Exclude<Keys, K>, never>> }[Keys];
```

## Constraints

### MUST DO

- Keep strict mode on; never loosen it
- Use `import type` for type-only imports
- Give exported functions and service methods explicit return types
- Use type-first API design and let inference do the rest
- Use the `satisfies` operator for type validation
- Create discriminated unions for state machines
- Consider branded types (via Zod `.brand()`) only where IDs are easily and dangerously mixed up

### MUST NOT DO

- Use explicit `any` without justification
- Use `as` assertions without necessity (prefer `satisfies`, type guards or Zod parsing)
- Disable strict null checks
- Hand-write types that already exist as generated Zod or Prisma types
- Use enums in hand-written code (prefer `as const` objects). Prisma/Zod-generated enums are fine.

## Output Templates

When implementing TypeScript features, provide:

1. Type definitions (interfaces, types, generics)
2. Implementation with type guards
3. tsconfig changes only if explicitly requested
4. Brief explanation of type design decisions

## Knowledge Reference

TypeScript 5.0+, generics, conditional types, mapped types, template literal types, discriminated
unions, type guards, const assertions, satisfies operator, Zod inference, Prisma generated types
