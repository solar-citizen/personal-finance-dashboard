# Zod Schemas & Validation

This project uses **Zod exclusively** for validation — `class-validator` and
`class-transformer` are not used anywhere. Global validation is wired once via
`ZodValidationPipe` registered as `APP_PIPE` in `app.module.ts`; controllers
just declare typed `@Body()`/`@Query()` params, no per-route pipe wrapping.

## Schema Pattern

Hand-authored schemas live in `*.schema.ts`, colocated in the feature module:

```typescript
// monobank/monobank.schema.ts
import { z } from 'zod';

export const ConnectMonoBankSchema = z.object({
  token: z.string().min(1),
});

export const GetTransactionsQuerySchema = z.object({
  limit: z.coerce.number().int().min(1).max(100).default(20),
});
```

Naming: **camelCase** for field names, **PascalCase** for the schema constant
itself (e.g. `ExchangeRatesSchema`, `CurrencyPair`), matching project-wide
naming conventions — never `SCREAMING_SNAKE_CASE` for schema fields (that's
reserved for env vars only).

`dtos:generate` turns these into typed DTOs re-exported from
`src/_generated/zod/pfd-dtos.ts`. **Controllers and services import the
generated type from there** (`ConnectMonoBankDto`), not `z.infer` on the local
schema directly — the schema file is the source of truth that codegen reads,
the generated barrel is what application code consumes.

## Partial / Pick / Omit Equivalents

Zod's native chainable methods replace `PartialType`/`OmitType`/`PickType`:

```typescript
// All fields optional (update DTO equivalent)
export const UpdateAccountSchema = ConnectAccountSchema.partial();

// Omit a field (equivalent of OmitType(..., ['password']))
export const PublicUserSchema = UserSchema.omit({ password: true });

// Pick specific fields (equivalent of PickType)
export const LoginSchema = UserSchema.pick({ email: true, password: true });
```

## Nested & Array Validation

```typescript
export const OrderItemSchema = z.object({
  productId: z.string().uuid(),
  quantity: z.number().int().min(1).max(100),
});

export const CreateOrderSchema = z.object({
  items: z.array(OrderItemSchema).min(1),
  shippingAddress: AddressSchema,
});
```

## Custom Validation (`.refine()` instead of custom decorators)

```typescript
export const StrongPasswordSchema = z
  .string()
  .min(8)
  .refine(
    (val) => /^(?=.*[A-Z])(?=.*[a-z])(?=.*\d)(?=.*[@$!%*?&]).{8,}$/.test(val),
    { message: 'Password must contain uppercase, lowercase, digit, and special character' },
  );
```

## Transform / Coerce (replaces class-transformer `@Transform`)

```typescript
export const QuerySchema = z.object({
  page: z.coerce.number().int().min(1).default(1),
  search: z
    .string()
    .optional()
    .transform((val) => val?.trim().toLowerCase()),
  isActive: z.coerce.boolean().default(true),
});
```

`z.coerce.number()` / `z.coerce.boolean()` handle the string→type coercion that
`class-transformer`'s `@Transform` decorators used to do for query params.

## Global Pipe Wiring (reference — already done, don't repeat)

```typescript
// app.module.ts
providers: [
  { provide: APP_PIPE, useClass: ZodValidationPipe },
],
```

Only instantiate `ZodValidationPipe` manually inside a `@Body()` param —
`@Body(new ZodValidationPipe(SomeSchema))` — if a specific route needs a schema
different from what the global pipe infers from the DTO type. This should be
rare; check whether the generated DTO already covers it first.

## Quick Reference

| Zod construct | Replaces (class-validator equivalent) |
|----------------|----------------------------------------|
| `z.object({...})` | DTO class with decorators |
| `.partial()` | `PartialType()` |
| `.omit({...})` | `OmitType()` |
| `.pick({...})` | `PickType()` |
| `.refine()` | custom `@Validate` decorator |
| `z.coerce.number()` / `.transform()` | `@Transform()` |
| `z.infer<typeof Schema>` (local, pre-codegen) | n/a — after `dtos:generate`, import the generated type instead |

**Do not:** hand-write a TS type or interface for API request/response data —
check `src/_generated/zod/pfd-dtos.ts` for an existing type first, and only add
a new schema if genuinely none exists.
