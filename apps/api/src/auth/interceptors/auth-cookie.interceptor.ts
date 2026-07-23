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
import { weekMs } from 'src/_lib/utils';

import { cookieConfig } from './cookie.config';

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
            ...cookieConfig,
            maxAge: weekMs,
          });
        }

        return data;
      }),
    );
  }
}
