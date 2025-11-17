import { HttpModule } from '@nestjs/axios';
import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { AiModule } from 'src/ai/ai.module';
import { PrismaModule } from '../db/prisma.module';
import { MonoBankController } from './monobank.controller';
import { MonoBankService } from './monobank.service';
import { MonoBankApiClient } from './services/monobank-api-client.service';
import { SyncJobManager } from './services/sync-job-manager.service';
import { TransactionProcessor } from './services/transaction-processor.service';

@Module({
  imports: [
    HttpModule.register({
      timeout: 30000,
      maxRedirects: 5,
    }),
    ConfigModule,
    PrismaModule,
    AiModule,
  ],
  controllers: [MonoBankController],
  providers: [
    MonoBankService,
    MonoBankApiClient,
    SyncJobManager,
    TransactionProcessor,
  ],
  exports: [MonoBankService],
})
export class MonoBankModule {}
