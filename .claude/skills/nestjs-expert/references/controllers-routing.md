# Controllers & Routing

This project's controllers are intentionally lean on Swagger: **only `@ApiTags`
at the controller level**. Don't add `@ApiOperation`, `@ApiResponse`,
`@ApiParam`, or `@ApiQuery` decorators unless explicitly asked — it's not this
project's convention and adds noise the codegen pipeline doesn't need (Swagger
docs aren't hand-decorated per route; the OpenAPI spec is generated from
controller signatures + Zod schemas).

## Standard Controller

```typescript
// monobank/monobank.controller.ts
import { Body, Controller, Get, Param, Post, Query, UseGuards } from '@nestjs/common';
import { ApiTags } from '@nestjs/swagger';
import {
  ConnectMonoBankDto,
  GetTransactionsQueryDto,
  MonoBankAccountResponseDto,
  TransactionResponseDto,
} from 'src/_generated/zod/pfd-dtos';
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

  @Get('accounts')
  async getAccounts(
    @CurrentUser('id') userId: string,
  ): Promise<MonoBankAccountResponseDto[]> {
    return await this.monoBankService.getUserAccounts(userId);
  }

  @Get('transactions')
  async getLatestTransactions(
    @CurrentUser('id') userId: string,
    @Query() { limit }: GetTransactionsQueryDto,
  ): Promise<TransactionResponseDto[]> {
    return await this.monoBankService.getLatestTransactions(userId, limit);
  }

  @Get(':accountId')
  async getAccountById(
    @Param('accountId') accountId: string,
  ): Promise<MonoBankAccountResponseDto> {
    return await this.monoBankService.getAccountById(accountId);
  }
}
```

## Conventions

- **Route prefix is written per-controller**, e.g. `@Controller('api/mono')`.
  There is no `app.setGlobalPrefix()` and no API versioning (`enableVersioning`)
  in use — don't introduce either without being asked.
- **Path params use `@Param('name')` with no `ParseUUIDPipe`/`ParseIntPipe`**
  unless a specific route needs runtime coercion beyond what the Zod schema for
  the query/body already validates — query/body validation goes through the
  global `ZodValidationPipe`, not per-param pipes.
- **`@UseGuards(JwtAuthGuard)` is written explicitly on the controller**, even
  though the guard is already global via `APP_GUARD` in `app.module.ts`. Keep
  this explicit for readability/consistency with existing controllers — don't
  remove it as "redundant."
- **Query DTOs** (e.g. `GetTransactionsQueryDto`) are destructured directly out
  of `@Query()`, typed from the generated DTO barrel — same import source as
  body DTOs (`src/_generated/zod/pfd-dtos`).
- Controllers `await` service calls explicitly even when returning the promise
  directly would work — match this style rather than dropping `await`.

## Nested Routes

Same shape as any other controller — no special pattern beyond composing the
path segments:

```typescript
@Controller('api/mono/:accountId/transactions')
@UseGuards(JwtAuthGuard)
export class AccountTransactionsController {
  @Get()
  async findAll(@Param('accountId') accountId: string) {
    return await this.service.findByAccount(accountId);
  }
}
```

## Quick Reference

| Decorator | Purpose |
|-----------|---------|
| `@Controller('api/...')` | Route prefix, written per-controller |
| `@ApiTags('...')` | The **only** Swagger decorator used at controller level |
| `@UseGuards(JwtAuthGuard)` | Explicit per-controller, even though also global |
| `@CurrentUser('id')` | Pulls the authenticated user's field from `request.user` |
| `@Body()` / `@Query()` | Typed from `src/_generated/zod/pfd-dtos`, validated by the global `ZodValidationPipe` |

**Do not add:** `@ApiOperation`, `@ApiResponse`, `@ApiParam`, `@ApiQuery`,
global prefixes, or URI versioning unless the task explicitly calls for it.
