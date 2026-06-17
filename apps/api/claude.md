# NestJS conventions

- DB schema lives in `apps/api/prisma/schema.prisma`
- Never add `exports` or `imports` to a module unless necessary

## Module organization

Modules are feature-based: `auth`, `ai`, `currency`, `monobank`, `config`, `db` etc. Each contains its own `.module.ts`, `.service.ts`, and `.controller.ts`. `_lib/` holds shared utilities. `_generated/` contains auto-generated Prisma client and Zod DTOs.

## Zod schemas

- Zod is the only validation library — `class-validator` is not used
- `ZodValidationPipe` from `nestjs-zod` is registered globally in `app.module.ts`
- Hand-authored schemas live in `*.schema.ts` files colocated within each feature module (e.g. `auth/auth.schema.ts`, `monobank/monobank.schema.ts`)
- Generated Zod DTOs live in `_generated/zod/pfd-dtos.ts`

## Prisma transactions

- `$transaction` is used in `prisma/seed.ts` for bulk upserts during seeding
- Not used in application services — Prisma operations are called directly via injected `PrismaService`

## Exception handling

- `HttpException` / `HttpStatus` from `@nestjs/common` thrown directly in services
- `getErrorMessage()` utility in `_lib/utils/error.util.ts` for extracting error strings
- No custom global exception filter added yet

## Auth

- JWT-based, dual extraction: `JwtStrategy` checks the `token` httpOnly cookie first, then falls back to `Authorization: Bearer <token>` (`ExtractJwt.fromAuthHeaderAsBearerToken`)
- `JwtAuthGuard` is registered globally via `APP_GUARD` — every route requires auth by default
- Use `@Public()` on a route/controller to opt out (`auth/decorators/public.decorator.ts`)
- `register`/`login` set the `token` cookie via `AuthCookieInterceptor` (httpOnly, `sameSite: 'strict'`, `secure` in production — see `auth/cookie.config.ts`); `logout` clears it via `LogoutCookieInterceptor`
- `@CurrentUser()` reads `request.user`, populated by `JwtStrategy.validate()` after the guard runs
- CORS must allow `credentials: true` with an explicit origin (not `*`) for the cookie to round-trip — check this before assuming an auth bug is client-side
