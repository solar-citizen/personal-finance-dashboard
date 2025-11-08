import { Injectable } from '@nestjs/common';
import { ConfigService as NestConfigService } from '@nestjs/config';
import { z } from 'zod';

const envs = ['development', 'production'] as const;

const validationObject = z.object({
  APP_ENV: z.enum(envs),
  APP_PORT: z.coerce.number().int().min(0).max(65535),
  WEB_URL: z.url(),
  JWT_SECRET: z.string(),
  MONOBANK_API_URL: z.url(),
});

@Injectable()
export class ConfigService {
  static validate = (
    config: Record<string, unknown>,
  ): z.infer<typeof validationObject> => validationObject.parse(config);

  constructor(
    private readonly configService: NestConfigService<
      z.infer<typeof validationObject>,
      true
    >,
  ) {}

  get env(): (typeof envs)[number] {
    return this.configService.get('APP_ENV');
  }

  get port(): number {
    return Number(this.configService.get('APP_PORT'));
  }

  get webUrl(): string {
    return this.configService.get<string>('WEB_URL');
  }

  get jwtSecret(): string {
    return this.configService.get<string>('JWT_SECRET');
  }

  get monoApiUrl(): string {
    return this.configService.get<string>('MONOBANK_API_URL');
  }
}
