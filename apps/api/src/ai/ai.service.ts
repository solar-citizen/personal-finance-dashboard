import { Injectable, Logger } from '@nestjs/common';
import { MessageRole } from '@prisma/client';
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
    const startTime = Date.now();

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

    const context = await this.contextBuilder.buildContext(userId, dto.message);
    const history = await this.conversationManager.getConversationHistory(
      conversationId,
      userId,
    );

    const messages: OllamaChatMessage[] = [
      { role: 'system', content: context.systemPrompt },
      ...history.map(
        ({ role, content }): OllamaChatMessage => ({
          role,
          content,
        }),
      ),
    ];

    const { response, tokensUsed } = await this.ollamaClient.chat(messages);

    const responseTimeMs = Date.now() - startTime;

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
      const startTime = Date.now();
      let conversationId: string;
      let fullResponse = '';

      (async () => {
        conversationId = await this.conversationManager.getOrCreateConversation(
          userId,
          dto.conversationId,
          dto.message,
        );

        await this.conversationManager.addMessage(
          conversationId,
          MessageRole.user,
          dto.message,
        );

        const context = await this.contextBuilder.buildContext(
          userId,
          dto.message,
        );
        const history = await this.conversationManager.getConversationHistory(
          conversationId,
          userId,
        );

        const messages: OllamaChatMessage[] = [
          { role: 'system', content: context.systemPrompt },
          ...history.map(
            ({ role, content }): OllamaChatMessage => ({
              role,
              content,
            }),
          ),
        ];

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
            (async () => {
              const responseTimeMs = Date.now() - startTime;

              await this.conversationManager.addMessage(
                conversationId,
                MessageRole.assistant,
                fullResponse,
                context.metadata,
                undefined,
                responseTimeMs,
              );

              subscriber.next({
                type: 'end',
                responseTimeMs,
              });

              subscriber.complete();
            })().catch((err) => {
              this.logger.error('Complete handler error:', err);
              subscriber.error(err);
            });
          },
        });
      })().catch((err) => {
        this.logger.error('Stream setup error:', err);
        subscriber.error(err);
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
}
