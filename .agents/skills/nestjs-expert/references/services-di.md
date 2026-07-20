# Services & Dependency Injection

## Service Pattern (Prisma, not TypeORM)

```typescript
// monobank/monobank.service.ts
import { ConflictException, Injectable, Logger, NotFoundException } from '@nestjs/common';
import { PrismaService } from 'src/db/prisma.service';
import { ConnectMonoBankDto, MonoBankAccountResponseDto } from 'src/_generated/zod/pfd-dtos';

@Injectable()
export class MonoBankService {
  private readonly logger = new Logger(MonoBankService.name);

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

  async getAccountById(accountId: string): Promise<MonoBankAccountResponseDto> {
    const account = await this.prisma.monoBankAccount.findUnique({ where: { id: accountId } });
    if (!account) {
      throw new NotFoundException(`Account ${accountId} not found`);
    }
    return account;
  }

  async getUserAccounts(userId: string): Promise<MonoBankAccountResponseDto[]> {
    return this.prisma.monoBankAccount.findMany({ where: { userId } });
  }
}
```

Notes:
- **Throw NestJS's built-in exception subclasses directly** —
  `ConflictException`, `NotFoundException`, `UnauthorizedException`, etc. —
  confirmed by the real `auth.service.ts` (`ConflictException`,
  `UnauthorizedException`). This corrects earlier guidance in this skill that
  said to use raw `new HttpException(message, status)` instead — that was
  wrong; use the typed subclasses.
- No custom global exception filter exists — the built-in subclasses already
  produce a sensible default JSON error shape, so nothing extra is needed.
- `getErrorMessage()` (from `src/_lib/utils/error.util.ts`) is available for
  extracting a safe string from an unknown caught error when you do need a
  try/catch around a DB call — but don't reach for it reflexively; the auth
  service's own methods don't wrap Prisma calls in try/catch at all, they let
  unexpected errors propagate and only throw explicit exceptions for known
  business-logic conditions (already-exists, not-found, bad credentials).
- `$transaction` is reserved for bulk operations in `prisma/seed.ts` — don't
  wrap routine single-write service calls in it.

## Module with Providers

```typescript
// monobank/monobank.module.ts
import { Module } from '@nestjs/common';
import { MonoBankController } from './monobank.controller';
import { MonoBankService } from './monobank.service';

@Module({
  controllers: [MonoBankController],
  providers: [MonoBankService],
  // No `imports`/`exports` unless another module genuinely needs
  // MonoBankService — keep modules self-contained by default.
})
export class MonoBankModule {}
```

`PrismaService` doesn't need to be imported here — it comes from `PrismaModule`,
which is registered once in `app.module.ts` (check whether it's global before
adding it to a feature module's `imports`).

## Custom Providers (framework-generic — still applicable)

```typescript
// Value provider
{ provide: 'API_KEY', useValue: process.env.API_KEY }

// Factory provider
{
  provide: 'CONFIG',
  useFactory: (configService: ConfigService) => ({
    apiUrl: configService.get('API_URL'),
  }),
  inject: [ConfigService],
}

// Class provider
{ provide: LoggerService, useClass: CustomLoggerService }
```

## Injection Patterns (framework-generic)

```typescript
// Constructor injection (preferred, used everywhere in this project)
constructor(private readonly prisma: PrismaService) {}

// Token injection
constructor(@Inject('API_KEY') private apiKey: string) {}

// Optional injection
constructor(@Optional() private readonly cache?: CacheService) {}
```

## Scope

```typescript
// Default: Singleton (shared across app) — used for all services in this project
@Injectable()
export class SharedService {}

// Request-scoped: only if a service genuinely needs per-request state
@Injectable({ scope: Scope.REQUEST })
export class RequestService {
  constructor(@Inject(REQUEST) private request: Request) {}
}
```

Stick to the default singleton scope unless there's a specific need — this
project doesn't currently use request- or transient-scoped providers.

## Quick Reference

| Pattern | Use When |
|---------|----------|
| Constructor DI with `PrismaService` | All DB-backed services in this project |
| `ConflictException`, `NotFoundException`, `UnauthorizedException` | Thrown directly for known business-logic conditions — not raw `HttpException` |
| `getErrorMessage(err)` | Extracting a string from a caught unknown error, when a try/catch is actually needed |
| Factory provider | Dynamic configuration (rare in this project) |
| `Scope.REQUEST` / `Scope.TRANSIENT` | Not currently used — default singleton is the norm |
