import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { CurrencyModule } from 'src/currency/currency.module';

import { PrismaModule } from '../db/prisma.module';
import { AiController } from './ai.controller';
import { AiService } from './ai.service';
import {
  ContextBuilderService,
  ContextCacheService,
  KnowledgeBaseService,
  SystemPromptBuilderService,
  TransactionAggregationService,
  TransactionFetchService,
  TransactionSearchService,
} from './services/context-builder';
import { ConversationManagerService } from './services/conversation-manager.service';
import { GeminiClientService } from './services/gemini-client.service';
import { OllamaClientService } from './services/ollama-client.service';
import { QueryStrategyService } from './services/query-strategy.service';

@Module({
  imports: [ConfigModule, PrismaModule, CurrencyModule],
  controllers: [AiController],
  providers: [
    AiService,
    OllamaClientService,
    ConversationManagerService,
    ContextBuilderService,
    ContextCacheService,
    KnowledgeBaseService,
    SystemPromptBuilderService,
    TransactionAggregationService,
    TransactionFetchService,
    TransactionSearchService,
    GeminiClientService,
    QueryStrategyService,
  ],
  exports: [AiService, ContextBuilderService],
})
export class AiModule {}
