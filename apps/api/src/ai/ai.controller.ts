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
  SendMessageDto,
} from 'src/@generated/zod/pfd-dtos';
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
    return this.aiService.sendMessage(userId, dto);
  }

  @Post('chat/stream')
  streamChat(
    @CurrentUser('id') userId: string,
    @Body() dto: SendMessageDto,
    @Res() res: Response,
  ): void {
    return this.aiService.handleStreamResponse(userId, dto, res);
  }

  @Get('conversations/:id')
  async getConversation(
    @CurrentUser('id') userId: string,
    @Param('id') conversationId: string,
  ): Promise<ConversationDto> {
    return this.aiService.getConversation(conversationId, userId);
  }

  @Get('conversations')
  async listConversations(
    @CurrentUser('id') userId: string,
  ): Promise<{ conversations: ConversationListItemDto[] }> {
    const conversations = await this.aiService.listConversations(userId);

    return { conversations };
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
  async healthCheck(): Promise<{ status: string; ollama: boolean }> {
    const ollamaHealthy = await this.aiService.healthCheck();

    return {
      status: ollamaHealthy ? 'healthy' : 'unhealthy',
      ollama: ollamaHealthy,
    };
  }
}
