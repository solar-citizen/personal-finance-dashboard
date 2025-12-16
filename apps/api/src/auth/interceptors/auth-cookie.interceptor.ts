import {
  type CallHandler,
  type ExecutionContext,
  Injectable,
  type NestInterceptor,
} from '@nestjs/common';
import type { Response } from 'express';
import type { Observable } from 'rxjs';
import { map } from 'rxjs/operators';
import type { AuthResponseDto } from 'src/_generated/zod/pfd-dtos';

const oneWeekInMs = 7 * 24 * 60 * 60 * 1000;

@Injectable()
export class AuthCookieInterceptor implements NestInterceptor {
  intercept(
    context: ExecutionContext,
    next: CallHandler,
  ): Observable<AuthResponseDto> {
    return next.handle().pipe(
      map((data: AuthResponseDto) => {
        const response = context.switchToHttp().getResponse<Response>();

        if (data.accessToken) {
          response.cookie('token', data.accessToken, {
            httpOnly: true,
            secure: process.env.APP_ENV === 'production',
            sameSite: 'strict',
            maxAge: oneWeekInMs,
            path: '/',
          });
        }

        return data;
      }),
    );
  }
}
