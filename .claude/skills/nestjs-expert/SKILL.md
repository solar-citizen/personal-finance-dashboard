---
name: nestjs-expert
description: Creates and configures NestJS modules, controllers, services, Zod schemas, guards, and interceptors for TypeScript backend applications using Prisma and Zod validation. Use when building NestJS REST APIs, implementing dependency injection, scaffolding feature-based modules, adding JWT authentication with cookie/header extraction, integrating Prisma, or working with .module.ts, .controller.ts, .service.ts, and .schema.ts files. Invoke for guards, interceptors, pipes, Zod validation, Swagger documentation, and unit/E2E testing in NestJS projects.
license: MIT
metadata:
  author: adapted from https://github.com/Jeffallan by solar._.citizen
  version: '1.1.0-zod-prisma'
  domain: backend
  triggers: NestJS, Nest, Node.js backend, TypeScript backend, dependency injection, controller, service, module, guard, interceptor, zod, prisma
  role: specialist
  scope: implementation
  output-format: code
  related-skills: fullstack-guardian, test-master, devops-engineer
---

# NestJS Expert (Zod + Prisma variant)

Senior NestJS specialist for enterprise-grade TypeScript backend applications built on **Prisma** and **Zod** (not TypeORM/class-validator).

## Core Workflow

1. **Analyze requirements** — Identify feature modules, endpoints, entities, and relationships
2. **Design structure** — Plan a feature-based module (own `.module.ts`, `.service.ts`, `.controller.ts`, `.schema.ts`); only add `exports`/`imports` to the module if another module genuinely needs it
3. **Implement** — Create the module, service, and controller with constructor-injected `PrismaService`
4. **Secure** — Add guards where the default global `JwtAuthGuard` needs to be opted out of (`@Public()`) or supplemented
5. **Verify** — Run `npm run lint`, `npm run test`
6. **Test** — Write unit tests for services and E2E tests for controllers

## Reference Guide

Load detailed guidance based on context:

| Topic                  | Reference                              | Load When                                    |
| ---------------------- | -------------------------------------- | -------------------------------------------- |
| Controllers            | `references/controllers-routing.md`    | Creating controllers, routing, Swagger docs  |
| Services               | `references/services-di.md`            | Services, dependency injection, providers    |
| Zod Schemas            | `references/zod-schemas.md`            | Validation, `nestjs-zod`, schema colocation  |
| Authentication         | `references/authentication.md`         | JWT, cookie/header extraction, guards        |
| Testing                | `references/testing-patterns.md`       | Unit tests, E2E tests, mocking PrismaService |
| Migration from Express | `references/migration-from-express.md` | Migrating from Express.js to NestJS          |

## Code Examples

### Zod Schema + Controller

Schemas are hand-authored in `*.schema.ts`, colocated in the feature module:

```typescript
// monobank/monobank.schema.ts
import { z } from 'zod';

export const ConnectMonoBankSchema = z.object({
  token: z.string().min(1),
});
```

`dtos:generate` turns hand-authored schemas into typed DTOs re-exported from
`src/_generated/zod/pfd-dtos.ts`. **Controllers import the generated DTO types
from there, not from the local `.schema.ts` file directly** — the schema file
is the source, the generated barrel is what code consumes:

```typescript
// monobank/monobank.controller.ts
import { Body, Controller, Get, Param, Post, Query, UseGuards } from '@nestjs/common';
import { ApiTags } from '@nestjs/swagger';
import { ConnectMonoBankDto, MonoBankAccountResponseDto } from 'src/_generated/zod/pfd-dtos';
import { CurrentUser } from 'src/auth/decorators/current-user.decorator';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { MonoBankService } from './monobank.service';

@ApiTags('Mono')
@Controller('api/mono')
@UseGuards(JwtAuthGuard)
export class MonoBankController {
  constructor(private readonly monoBankService: MonoBankService) {}

  @Post('connect')
  async connectAccount(
    @CurrentUser('id') userId: string,
    @Body() dto: ConnectMonoBankDto,
  ): Promise<MonoBankAccountResponseDto[]> {
    return await this.monoBankService.connectAccount(userId, dto);
  }
}
```

Notes on this project's actual conventions (don't deviate without a reason):

- **No manual `ZodValidationPipe` per route.** It's registered once, globally, via `APP_PIPE` in `app.module.ts` — `@Body()` alone is enough; validation happens automatically against the DTO's underlying schema. Only reach for `@Body(new ZodValidationPipe(SomeSchema))` if a route genuinely needs a schema the global pipe can't infer.
- **No `@ApiCreatedResponse`/`@ApiOkResponse` etc.** in practice — only `@ApiTags` at the controller level is used. Don't add per-route Swagger response decorators unless asked; it's not this project's style.
- **Controller-level `@UseGuards(JwtAuthGuard)` is applied explicitly**, even though `JwtAuthGuard` is also wired globally via `APP_GUARD` in `app.module.ts`. Match this existing (slightly redundant) pattern for consistency rather than "cleaning it up" by removing the explicit guard.
- **Route prefix is written per-controller** (`@Controller('api/mono')`), not via a global prefix — include `api/` in each controller's path.
- `await` is used explicitly on service calls even where returning the promise directly would work — match this style.

### App Module Wiring (reference)

```typescript
// app.module.ts
@Module({
  imports: [/* feature modules */],
  providers: [
    { provide: APP_GUARD, useClass: JwtAuthGuard },
    { provide: APP_PIPE, useClass: ZodValidationPipe },
  ],
})
export class AppModule {}
```

Both the auth guard and Zod validation are global — new modules don't need to re-register either.

### Service with Prisma and Built-in Exception Subclasses

```typescript
// monobank/monobank.service.ts
import { ConflictException, Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from 'src/db/prisma.service';
import { ConnectMonoBankDto, MonoBankAccountResponseDto } from 'src/_generated/zod/pfd-dtos';

@Injectable()
export class MonoBankService {
  constructor(private readonly prisma: PrismaService) {}

  async connectAccount(
    userId: string,
    dto: ConnectMonoBankDto,
  ): Promise<MonoBankAccountResponseDto[]> {
    const existing = await this.prisma.monoBankAccount.findFirst({ where: { userId } });
    if (existing) {
      throw new ConflictException('Account already connected');
    }
    const account = await this.prisma.monoBankAccount.create({ data: { userId, ...dto } });
    return [account];
  }

  async getUserAccounts(userId: string): Promise<MonoBankAccountResponseDto[]> {
    return this.prisma.monoBankAccount.findMany({ where: { userId } });
  }
}
```

Notes:

- **Throw NestJS's built-in exception subclasses directly** — `ConflictException`, `NotFoundException`, `UnauthorizedException`, etc. — confirmed by the actual `auth.service.ts`. Don't use raw `new HttpException(message, status)`.
- No custom global exception filter exists — the built-in subclasses already produce a sensible default error response shape.
- `$transaction` is only used in `prisma/seed.ts` for bulk upserts — don't introduce it in application services unless there's a genuine multi-write atomicity need; direct calls via injected `PrismaService` are the norm.

### Module Definition

```typescript
// monobank/monobank.module.ts
import { Module } from '@nestjs/common';
import { MonoBankController } from './monobank.controller';
import { MonoBankService } from './monobank.service';

@Module({
  controllers: [MonoBankController],
  providers: [MonoBankService],
  // Don't add `imports`/`exports` unless another module actually needs
  // MonoBankService or a shared provider — keep modules self-contained by default.
})
export class MonoBankModule {}
```

### Auth Pattern (project-specific)

- JWT-based; `JwtStrategy` checks the `token` httpOnly cookie first, then falls back to the `Authorization: Bearer <token>` header.
- `JwtAuthGuard` is global via `APP_GUARD` — every route requires auth by default. Use `@Public()` to opt out.
- `@CurrentUser()` reads `request.user`, populated by `JwtStrategy.validate()`.
- `register`/`login` set the cookie via `AuthCookieInterceptor`; `logout` clears it via `LogoutCookieInterceptor`.
- CORS needs `credentials: true` with an explicit origin (never `*`) for the cookie to round-trip. If auth looks broken, check CORS config before assuming it's a client bug.

```typescript
// example: opting a route out of the global guard
import { Controller, Get } from '@nestjs/common';
import { Public } from '../auth/decorators/public.decorator';

@Controller('health')
export class HealthController {
  @Public()
  @Get()
  check() {
    return { ok: true };
  }
}
```

### Unit Test for Service (mocking PrismaService)

```typescript
// monobank/monobank.service.spec.ts
import { Test, TestingModule } from '@nestjs/testing';
import { ConflictException } from '@nestjs/common';
import { MonoBankService } from './monobank.service';
import { PrismaService } from 'src/db/prisma.service';

const mockPrisma = {
  monoBankAccount: {
    findFirst: jest.fn(),
    findMany: jest.fn(),
    create: jest.fn(),
  },
};

describe('MonoBankService', () => {
  let service: MonoBankService;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [MonoBankService, { provide: PrismaService, useValue: mockPrisma }],
    }).compile();
    service = module.get<MonoBankService>(MonoBankService);
    jest.clearAllMocks();
  });

  it('throws ConflictException when account already connected', async () => {
    mockPrisma.monoBankAccount.findFirst.mockResolvedValue({ id: '1', userId: 'u1' });
    await expect(service.connectAccount('u1', { token: 'sometoken' })).rejects.toThrow(
      ConflictException,
    );
  });
});
```

## Constraints

### MUST DO

- Use `@Injectable()` and constructor injection for all services — never instantiate services with `new`
- Validate all inputs with **Zod schemas** (`*.schema.ts`, colocated in the feature module) — `class-validator` is not used in this project
- Rely on the globally registered `ZodValidationPipe` (`APP_PIPE` in `app.module.ts`); use `@Body() dto: SomeDto` plainly — don't wrap it in `new ZodValidationPipe(...)` per route unless a route genuinely needs a schema the global pipe can't infer
- Import generated DTO types from `src/_generated/zod/pfd-dtos`, not from the local `.schema.ts` file, in controllers/services
- Use `PrismaService` (injected from `src/db/prisma.service`) for all DB access — never TypeORM `Repository`
- Throw NestJS's built-in exception subclasses directly (`ConflictException`, `NotFoundException`, `UnauthorizedException`, etc.) in services — not raw `new HttpException(message, status)`
- Use `getErrorMessage()` from `src/_lib/utils/error.util.ts` only when a try/catch around an unexpected error is genuinely needed — most service methods throw explicit exceptions for known conditions without wrapping calls in try/catch
- Add `@ApiTags` at the controller level only — this project does not use per-route `@ApiCreatedResponse`/`@ApiOkResponse` etc.
- Add `@UseGuards(JwtAuthGuard)` explicitly at the controller level, matching existing controllers, even though the guard is also global via `APP_GUARD`
- Write unit tests for every service method, mocking `PrismaService`
- Use `@Public()` for routes that should skip auth
- Keep modules self-contained: no `imports`/`exports` unless another module genuinely needs the provider
- Prefix controller routes with `api/` explicitly (e.g. `@Controller('api/mono')`) — there is no global route prefix

### MUST NOT DO

- Introduce `class-validator` decorators or TypeORM entities/repositories — this project uses Zod + Prisma exclusively
- Add manual `ZodValidationPipe` instantiation per route when the global pipe already covers it
- Add `@ApiCreatedResponse`/`@ApiOkResponse`/etc. decorators unless explicitly asked — not this project's convention
- Expose passwords, secrets, or internal stack traces in responses
- Accept unvalidated user input — always go through a Zod schema
- Use `any` type unless absolutely necessary and documented
- Create circular dependencies between modules — use `forwardRef()` only as a last resort
- Hardcode hostnames, ports, or credentials in source files
- Wrap routine single-write service calls in `$transaction` — reserve it for genuine bulk/atomic operations (currently only used in `prisma/seed.ts`)
- Assume `Authorization: Bearer` is the only auth path — remember the `token` httpOnly cookie is checked first

## Output Templates

When implementing a NestJS feature, provide in this order:

1. Module definition (`.module.ts`) — no `imports`/`exports` unless needed
2. Zod schema(s) (`.schema.ts`), consumed via generated DTOs from `src/_generated/zod/pfd-dtos`
3. Controller with `@ApiTags` and `@UseGuards(JwtAuthGuard)` (`.controller.ts`) — no per-route response decorators
4. Service with `PrismaService` and built-in exception subclasses (`ConflictException`, `NotFoundException`, etc.) (`.service.ts`)
5. Unit tests mocking `PrismaService` (`*.service.spec.ts`)

## Knowledge Reference

NestJS, TypeScript, Prisma, `nestjs-zod`, Zod, Passport, JWT (cookie + header extraction), Swagger/OpenAPI, Jest, Supertest, Guards, Interceptors, Pipes, Filters
