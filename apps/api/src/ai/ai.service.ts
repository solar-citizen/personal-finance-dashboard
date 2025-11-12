import { Injectable, Logger } from '@nestjs/common';
import { MessageRole } from '@prisma/client';
import dayjs from 'dayjs';
import { Observable } from 'rxjs';
import { ChatResponseDto, SendMessageDto } from 'src/@generated/zod/pfd-dtos';
import { ContextBuilderService } from './services/context-builder.service';
import { ConversationManagerService } from './services/conversation-manager.service';
import {
  OllamaChatMessage,
  OllamaClientService,
} from './services/ollama-client.service';

@Injectable()
export class AiService {
  private readonly logger = new Logger(AiService.name);

  constructor(
    private readonly ollamaClient: OllamaClientService,
    private readonly conversationManager: ConversationManagerService,
    private readonly contextBuilder: ContextBuilderService,
  ) {}

  async sendMessage(
    userId: string,
    dto: SendMessageDto,
  ): Promise<ChatResponseDto> {
    const startTime = dayjs();

    const { conversationId, messages, context } =
      await this.prepareConversation(userId, dto);

    const { response, tokensUsed } = await this.ollamaClient.chat(messages);
    const responseTimeMs = dayjs().diff(startTime, 'millisecond');

    const messageId = await this.conversationManager.addMessage(
      conversationId,
      MessageRole.assistant,
      response,
      context.metadata,
      tokensUsed,
      responseTimeMs,
    );

    this.logger.log(
      `Message processed in ${responseTimeMs}ms (${tokensUsed} tokens)`,
    );

    return {
      conversationId,
      messageId,
      response,
      tokensUsed,
      responseTimeMs,
    };
  }

  streamMessage(
    userId: string,
    dto: SendMessageDto,
  ): Observable<{
    type: 'start' | 'chunk' | 'end';
    conversationId?: string;
    content?: string;
    tokensUsed?: number;
    responseTimeMs?: number;
  }> {
    return new Observable((subscriber) => {
      const startTime = dayjs();
      let fullResponse = '';

      this.prepareConversation(userId, dto)
        .then(({ conversationId, messages, context }) => {
          subscriber.next({
            type: 'start',
            conversationId,
          });

          const stream = this.ollamaClient.chatStream(messages);

          stream.subscribe({
            next: (chunk) => {
              fullResponse += chunk;
              subscriber.next({
                type: 'chunk',
                content: chunk,
              });
            },
            error: (error) => {
              this.logger.error('Stream error:', error);
              subscriber.error(error);
            },
            complete: () => {
              const responseTimeMs = dayjs().diff(startTime, 'millisecond');

              this.conversationManager
                .addMessage(
                  conversationId,
                  MessageRole.assistant,
                  fullResponse,
                  context.metadata,
                  undefined,
                  responseTimeMs,
                )
                .then(() => {
                  subscriber.next({
                    type: 'end',
                    responseTimeMs,
                  });

                  subscriber.complete();
                })
                .catch((error) => {
                  this.logger.error('Complete handler error:', error);
                  subscriber.error(error);
                });
            },
          });
        })
        .catch((error) => {
          this.logger.error('Stream setup error:', error);
          subscriber.error(error);
        });
    });
  }

  async getConversation(conversationId: string, userId: string) {
    return this.conversationManager.getConversation(conversationId, userId);
  }

  async listConversations(userId: string) {
    return this.conversationManager.listConversations(userId);
  }

  async deleteConversation(conversationId: string, userId: string) {
    return this.conversationManager.deleteConversation(conversationId, userId);
  }

  async healthCheck() {
    return this.ollamaClient.healthCheck();
  }

  private async prepareConversation(userId: string, dto: SendMessageDto) {
    const conversationId =
      await this.conversationManager.getOrCreateConversation(
        userId,
        dto.conversationId,
        dto.message,
      );

    await this.conversationManager.addMessage(
      conversationId,
      MessageRole.user,
      dto.message,
    );

    const [context, history] = await Promise.all([
      this.contextBuilder.buildContext(userId, dto.message),
      this.conversationManager.getConversationHistory(conversationId, userId),
    ]);

    const messages: OllamaChatMessage[] = [
      { role: 'system', content: context.systemPrompt },
      ...history.map(
        ({ role, content }): OllamaChatMessage => ({
          role,
          content,
        }),
      ),
    ];

    return { conversationId, messages, context };
  }
}
