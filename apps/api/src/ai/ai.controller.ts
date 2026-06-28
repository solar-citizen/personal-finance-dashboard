import {
  Body,
  Controller,
  Delete,
  Get,
  Param,
  Post,
  Res,
  UseGuards,
} from '@nestjs/common';
import { ApiTags } from '@nestjs/swagger';
import type { Response } from 'express';
import {
  ChatResponseDto,
  ConversationDto,
  ConversationListItemDto,
  HealthStatusDto,
  SendMessageDto,
} from 'src/_generated/zod/pfd-dtos';

import { CurrentUser } from '../auth/decorators/current-user.decorator';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { AiService } from './ai.service';

@ApiTags('AI')
@Controller('api/ai')
@UseGuards(JwtAuthGuard)
export class AiController {
  constructor(private readonly aiService: AiService) {}

  @Post('chat')
  async chat(
    @CurrentUser('id') userId: string,
    @Body() dto: SendMessageDto,
  ): Promise<ChatResponseDto> {
    return await this.aiService.sendMessage(userId, dto);
  }

  @Post('chat/stream')
  streamChat(
    @CurrentUser('id') userId: string,
    @Body() dto: SendMessageDto,
    @Res() res: Response,
  ): void {
    return this.aiService.streamChat(userId, dto, res);
  }

  @Get('conversations')
  async getConversationsList(
    @CurrentUser('id') userId: string,
  ): Promise<ConversationListItemDto[]> {
    return await this.aiService.getConversationsList(userId);
  }

  @Get('conversations/:id')
  async getConversation(
    @CurrentUser('id') userId: string,
    @Param('id') conversationId: string,
  ): Promise<ConversationDto> {
    return await this.aiService.getConversation(conversationId, userId);
  }

  @Delete('conversations/:id')
  async deleteConversation(
    @CurrentUser('id') userId: string,
    @Param('id') conversationId: string,
  ): Promise<{ success: boolean }> {
    await this.aiService.deleteConversation(conversationId, userId);
    return { success: true };
  }

  @Get('health')
  async healthCheck(): Promise<HealthStatusDto> {
    const { gemini, ollama } = await this.aiService.healthCheck();

    return {
      status: gemini && ollama ? 'healthy' : 'unhealthy',
      ollama,
      gemini,
    };
  }

  @Get('gemini/models')
  async listGeminiModels() {
    return await this.aiService.listGeminiModels();
  }
}
