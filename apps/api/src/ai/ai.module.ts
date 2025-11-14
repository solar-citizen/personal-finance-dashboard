import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { CurrencyModule } from 'src/currency/currency.module';
import { PrismaModule } from '../db/prisma.module';
import { AiController } from './ai.controller';
import { AiService } from './ai.service';
import { ContextBuilderService } from './services/context-builder.service';
import { ConversationManagerService } from './services/conversation-manager.service';
import { GeminiClientService } from './services/gemini-client.service';
import { ModelRouterService } from './services/model-router.service';
import { OllamaClientService } from './services/ollama-client.service';

@Module({
  imports: [ConfigModule, PrismaModule, CurrencyModule],
  controllers: [AiController],
  providers: [
    AiService,
    OllamaClientService,
    ConversationManagerService,
    ContextBuilderService,
    GeminiClientService,
    ModelRouterService,
  ],
  exports: [AiService],
})
export class AiModule {}
