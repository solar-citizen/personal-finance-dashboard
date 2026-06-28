import KeyvRedis from '@keyv/redis';
import { CacheModule } from '@nestjs/cache-manager';
import { Module } from '@nestjs/common';
import { APP_GUARD, APP_PIPE } from '@nestjs/core';
import { ZodValidationPipe } from 'nestjs-zod';

import { AiModule } from './ai/ai.module';
import { AuthModule } from './auth/auth.module';
import { JwtAuthGuard } from './auth/guards/jwt-auth.guard';
import { ConfigModule } from './config/config.module';
import { ConfigService } from './config/config.service';
import { CurrencyModule } from './currency/currency.module';
import { PrismaModule } from './db/prisma.module';
import { MonoBankModule } from './monobank/monobank.module';

@Module({
  imports: [
    CacheModule.registerAsync({
      isGlobal: true,
      useFactory: ({ redisUrl }: ConfigService) => ({
        stores: [new KeyvRedis(redisUrl)],
      }),
      inject: [ConfigService],
    }),
    ConfigModule,
    PrismaModule,
    AuthModule,
    MonoBankModule,
    AiModule,
    CurrencyModule,
  ],
  providers: [
    {
      provide: APP_GUARD,
      useClass: JwtAuthGuard,
    },
    {
      provide: APP_PIPE,
      useClass: ZodValidationPipe,
    },
  ],
})
export class AppModule {}
