import { HttpModule } from '@nestjs/axios';
import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { PrismaModule } from '../db/prisma.module';
import { MonoBankController } from './monobank.controller';
import { MonoBankService } from './monobank.service';

@Module({
  imports: [
    HttpModule.register({
      timeout: 30000, // 30 seconds in ms
      maxRedirects: 5,
    }),
    ConfigModule,
    PrismaModule,
  ],
  controllers: [MonoBankController],
  providers: [MonoBankService],
  exports: [MonoBankService],
})
export class MonoBankModule {}
