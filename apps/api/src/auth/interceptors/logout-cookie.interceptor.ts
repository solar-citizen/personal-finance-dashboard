import {
  type CallHandler,
  type ExecutionContext,
  Injectable,
  type NestInterceptor,
} from '@nestjs/common';
import type { Response } from 'express';
import { Observable, tap } from 'rxjs';
import type { LogoutResponseDto } from 'src/_generated/zod/pfd-dtos';

import { cookieConfig } from './cookie.config';

@Injectable()
export class LogoutCookieInterceptor implements NestInterceptor {
  intercept(
    context: ExecutionContext,
    next: CallHandler,
  ): Observable<LogoutResponseDto> {
    const response = context.switchToHttp().getResponse<Response>();

    return next.handle().pipe(
      tap(() => {
        response.clearCookie('token', cookieConfig);
      }),
    );
  }
}
