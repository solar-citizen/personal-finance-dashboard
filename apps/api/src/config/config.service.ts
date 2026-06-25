import { Injectable } from '@nestjs/common';
import { ConfigService as NestConfigService } from '@nestjs/config';
import { z } from 'zod';

const envs = ['development', 'production'] as const;

const validationObject = z.object({
  APP_ENV: z.enum(envs),
  APP_PORT: z.coerce.number().int().min(0).max(65535),
  WEB_URL: z.url(),
  REDIS_URL: z.string(),
  JWT_SECRET: z.string(),
  MONOBANK_API_URL: z.url(),
  LLM_HOST: z.url(),
  LLM_CHAT_MODEL: z.string(),
  LLM_EMBEDDING_MODEL: z.string(),
  LLM_MAX_HISTORY_MESSAGES: z.coerce.number().int().min(1).max(1000),
  GEMINI_API_KEY: z.string(),
  GEMINI_MODEL: z.string(),
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

  get llmHost(): string {
    return this.configService.get<string>('LLM_HOST');
  }

  get llmChatModel(): string {
    return this.configService.get<string>('LLM_CHAT_MODEL');
  }

  get llmEmbeddingModel(): string {
    return this.configService.get<string>('LLM_EMBEDDING_MODEL');
  }

  get llmMaxHistoryMessages(): number {
    return this.configService.get<number>('LLM_MAX_HISTORY_MESSAGES');
  }

  get geminiApiKey(): string {
    return this.configService.get<string>('GEMINI_API_KEY');
  }

  get geminiModel(): string {
    return this.configService.get<string>('GEMINI_MODEL');
  }

  get redisUrl(): string {
    return this.configService.getOrThrow<string>('REDIS_URL');
  }
}
