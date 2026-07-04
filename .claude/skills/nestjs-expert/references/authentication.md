# Authentication & Guards

JWT-based auth with **dual extraction**: the `token` httpOnly cookie is
checked first, then the `Authorization: Bearer <token>` header as a fallback.
There is no roles/permissions system in this project — don't invent a
`RolesGuard` or `@Roles()` decorator unless explicitly asked to build one.

## JWT Payload Schema

```typescript
// auth/strategies/jwt.schema.ts
import { z } from 'zod';

export const JwtPayloadSchema = z.object({
  sub: z.string(),
  email: z.email(),
});
```

## JWT Strategy (cookie-first, header fallback, re-fetches the user)

```typescript
// auth/strategies/jwt.strategy.ts
import { Injectable, UnauthorizedException } from '@nestjs/common';
import { PassportStrategy } from '@nestjs/passport';
import { Request } from 'express';
import { ExtractJwt, Strategy } from 'passport-jwt';
import { JwtPayloadDto } from 'src/_generated/zod/pfd-dtos';
import { ConfigService } from 'src/config/config.service';
import { PrismaService } from '../../db/prisma.service';

type RequestWithCookies = Request & { cookies: { token?: string } };

@Injectable()
export class JwtStrategy extends PassportStrategy(Strategy) {
  constructor(
    configService: ConfigService,
    private readonly prismaService: PrismaService,
  ) {
    super({
      jwtFromRequest: ExtractJwt.fromExtractors([
        ({ cookies }: RequestWithCookies): string | null => cookies.token ?? null,
        ExtractJwt.fromAuthHeaderAsBearerToken(),
      ]),
      ignoreExpiration: false,
      secretOrKey: configService.jwtSecret,
    });
  }

  async validate({ sub }: JwtPayloadDto) {
    const user = await this.prismaService.user.findUnique({
      where: { id: sub },
      select: { id: true, email: true, name: true },
    });

    if (!user) {
      throw new UnauthorizedException('User not found');
    }

    return user; // becomes `request.user`, read via @CurrentUser()
  }
}
```

Note: `validate()` re-queries the DB for the user on every request rather than
trusting the JWT payload's `email` field as current — don't "optimize" this
away by returning the payload directly, since the payload can go stale
(e.g. after a name change) and this also lets deleted/deactivated users get
rejected immediately.

## JWT Auth Guard (global, opt-out via @Public())

```typescript
// auth/guards/jwt-auth.guard.ts
import { ExecutionContext, Injectable } from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { AuthGuard } from '@nestjs/passport';
import { isPublicKey } from '../decorators/public.decorator';

@Injectable()
export class JwtAuthGuard extends AuthGuard('jwt') {
  constructor(private readonly reflector: Reflector) {
    super();
  }

  canActivate(context: ExecutionContext) {
    const isPublic = this.reflector.getAllAndOverride<boolean>(isPublicKey, [
      context.getHandler(),
      context.getClass(),
    ]);

    if (isPublic) {
      return true;
    }

    return super.canActivate(context);
  }
}
```

```typescript
// auth/decorators/public.decorator.ts
import { SetMetadata } from '@nestjs/common';

export const isPublicKey = 'isPublic'; // camelCase constant, not IS_PUBLIC_KEY

export const Public = () => SetMetadata(isPublicKey, true);
```

```typescript
// auth/decorators/current-user.decorator.ts
import { createParamDecorator, ExecutionContext } from '@nestjs/common';
import { Request } from 'express';
import { User } from 'src/_generated/prisma-client/client';

export const CurrentUser = createParamDecorator(
  (data: keyof User | undefined, ctx: ExecutionContext): User | User[keyof User] | undefined => {
    const request = ctx.switchToHttp().getRequest<Request & { user?: User }>();
    const user = request.user;

    if (!user) {
      return undefined;
    }

    return data ? user[data] : user;
  },
);
```

`@CurrentUser()` is typed against the generated Prisma `User` entity directly
(`src/_generated/prisma-client/client`) — not a hand-written interface. Field
access is generic (`user[data]`), so `@CurrentUser('email')`,
`@CurrentUser('name')`, etc. all work without extra decorator changes.

## Cookie Interceptors (set/clear on login/register/logout)

```typescript
// auth/interceptors/auth-cookie-interceptor.ts
import { type CallHandler, type ExecutionContext, Injectable, type NestInterceptor } from '@nestjs/common';
import type { Response } from 'express';
import type { Observable } from 'rxjs';
import { map } from 'rxjs/operators';
import type { AuthResponseDto } from 'src/_generated/zod/pfd-dtos';
import { cookieConfig } from './cookie.config';

const oneWeekInMs = 7 * 24 * 60 * 60 * 1000;

@Injectable()
export class AuthCookieInterceptor implements NestInterceptor {
  intercept(context: ExecutionContext, next: CallHandler): Observable<AuthResponseDto> {
    return next.handle().pipe(
      map((data: AuthResponseDto) => {
        const response = context.switchToHttp().getResponse<Response>();
        if (data.accessToken) {
          response.cookie('token', data.accessToken, { ...cookieConfig, maxAge: oneWeekInMs });
        }
        return data;
      }),
    );
  }
}
```

```typescript
// auth/interceptors/logout-cookie-interceptor.ts
import { type CallHandler, type ExecutionContext, Injectable, type NestInterceptor } from '@nestjs/common';
import type { Response } from 'express';
import { Observable, tap } from 'rxjs';
import type { LogoutResponseDto } from 'src/_generated/zod/pfd-dtos';
import { cookieConfig } from './cookie.config';

@Injectable()
export class LogoutCookieInterceptor implements NestInterceptor {
  intercept(context: ExecutionContext, next: CallHandler): Observable<LogoutResponseDto> {
    const response = context.switchToHttp().getResponse<Response>();
    return next.handle().pipe(tap(() => response.clearCookie('token', cookieConfig)));
  }
}
```

```typescript
// auth/interceptors/cookie.config.ts
import type { CookieOptions } from 'express';

export const cookieConfig: CookieOptions = {
  httpOnly: true,
  secure: process.env.APP_ENV === 'production',
  sameSite: 'strict',
  path: '/',
};
```

Notes:
- `maxAge` (one week) is only added at the point `AuthCookieInterceptor` sets
  the cookie — it's not part of the shared `cookieConfig`, since
  `LogoutCookieInterceptor`'s `clearCookie` doesn't need it.
- `secure` is driven by `process.env.APP_ENV === 'production'`, not NestJS's
  built-in `NODE_ENV` — check `APP_ENV` specifically if debugging cookie issues
  across environments.
- **CORS reminder:** the frontend must send credentials
  (`credentials: 'include'` client-side, `credentials: true` in Nest's CORS
  config) and the CORS `origin` must be explicit — never `'*'` — or the cookie
  won't round-trip.

## Auth Service

```typescript
// auth/auth.service.ts
import { ConflictException, Injectable, Logger, UnauthorizedException } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { compare, hash } from 'bcrypt';
import { AuthResponseDto, JwtPayloadDto, LoginDto, RegisterDto } from 'src/_generated/zod/pfd-dtos';
import { PrismaService } from '../db/prisma.service';

@Injectable()
export class AuthService {
  private readonly logger = new Logger(AuthService.name);

  constructor(
    private readonly prismaService: PrismaService,
    private readonly jwtService: JwtService,
  ) {}

  async register({ email, password, name }: RegisterDto): Promise<AuthResponseDto> {
    const existingUser = await this.prismaService.user.findUnique({ where: { email } });
    if (existingUser) {
      throw new ConflictException('User with this email already exists');
    }

    const passwordHash = await hash(password, 10);
    const user = await this.prismaService.user.create({ data: { email, passwordHash, name } });

    const payload: JwtPayloadDto = { sub: user.id, email: user.email };
    const accessToken = this.jwtService.sign(payload);

    return {
      accessToken,
      user: { id: user.id, email: user.email, name: user.name },
    };
  }

  async login({ email, password }: LoginDto): Promise<AuthResponseDto> {
    const user = await this.prismaService.user.findUnique({ where: { email } });
    if (!user) {
      throw new UnauthorizedException('Invalid email');
    }

    const isPasswordValid = await compare(password, user.passwordHash);
    if (!isPasswordValid) {
      throw new UnauthorizedException('Invalid password');
    }

    const payload: JwtPayloadDto = { sub: user.id, email: user.email };
    const accessToken = this.jwtService.sign(payload);

    this.logger.log(`Logged as: ${user.email} | ${user.id}`);

    return {
      accessToken,
      user: { id: user.id, email: user.email, name: user.name },
    };
  }
}
```

Key conventions to preserve:
- **Throw NestJS's built-in exception subclasses directly** —
  `ConflictException`, `UnauthorizedException`, `NotFoundException`, etc. —
  not a raw `new HttpException(message, status)`. (This corrects earlier
  guidance in this skill's other reference files that said the opposite —
  see the note in `services-di.md`.)
- The user field is `passwordHash`, not `password` — the DB never stores or
  returns the plaintext field name.
- `bcrypt`'s `hash`/`compare` are imported as named functions
  (`import { compare, hash } from 'bcrypt'`), not `import * as bcrypt`.
- Login intentionally distinguishes "Invalid email" vs "Invalid password" in
  the thrown message — this is an existing tradeoff in the code (slightly more
  user-friendly, slightly more info-leaky than a generic "Invalid
  credentials") — match it rather than "fixing" it unprompted.
- Both `register` and `login` return the same `AuthResponseDto` shape
  (`accessToken` + a trimmed `user` object with `id`/`email`/`name`, no
  `passwordHash`) — reuse this shape for any new auth-adjacent endpoint.

## Opting a Route Out of Auth

```typescript
import { Controller, Get } from '@nestjs/common';
import { Public } from 'src/auth/decorators/public.decorator';

@Controller('api/health')
export class HealthController {
  @Public()
  @Get()
  check() {
    return { ok: true };
  }
}
```

## Quick Reference

| Component | Purpose |
|-----------|---------|
| `JwtStrategy` | Validates JWT, cookie first then Bearer header; re-fetches user from DB |
| `JwtAuthGuard` | Global via `APP_GUARD` — protects every route by default |
| `@Public()` | Opt a route/controller out of the guard (`isPublicKey`, camelCase) |
| `@CurrentUser('email')` | Reads a field off the Prisma `User` entity in `request.user` |
| `AuthCookieInterceptor` / `LogoutCookieInterceptor` | Set (with 1-week `maxAge`) / clear the `token` cookie |
| `cookieConfig` | httpOnly, `sameSite: 'strict'`, `secure` when `APP_ENV === 'production'` |
| `ConflictException`, `UnauthorizedException` | Thrown directly in `AuthService` — built-in subclasses, not raw `HttpException` |

**Do not add:** a `RolesGuard`, `@Roles()` decorator, or any permissions layer
— none of this exists in the project.
