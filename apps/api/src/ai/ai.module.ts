import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { PrismaModule } from '../db/prisma.module';
import { AiController } from './ai.controller';
import { AiService } from './ai.service';
import { ContextBuilderService } from './services/context-builder.service';
import { ConversationManagerService } from './services/conversation-manager.service';
import { OllamaClientService } from './services/ollama-client.service';

@Module({
  imports: [ConfigModule, PrismaModule],
  controllers: [AiController],
  providers: [
    AiService,
    OllamaClientService,
    ConversationManagerService,
    ContextBuilderService,
  ],
  exports: [AiService],
})
export class AiModule {}
