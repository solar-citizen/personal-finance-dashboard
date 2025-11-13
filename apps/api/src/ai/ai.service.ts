import { Injectable, Logger } from '@nestjs/common';
import { MessageRole } from '@prisma/client';
import dayjs from 'dayjs';
import { Response } from 'express';
import { Observable } from 'rxjs';
import {
  ChatResponseDto,
  HealthStatusDto,
  SendMessageDto,
} from 'src/@generated/zod/pfd-dtos';
import { ContextBuilderService } from './services/context-builder.service';
import { ConversationManagerService } from './services/conversation-manager.service';
import {
  type GeminiChatMessage,
  GeminiClientService,
} from './services/gemini-client.service';
import { ModelRouterService } from './services/model-router.service';
import {
  OllamaChatMessage,
  OllamaClientService,
} from './services/ollama-client.service';

@Injectable()
export class AiService {
  private readonly logger = new Logger(AiService.name);

  constructor(
    private readonly ollamaClient: OllamaClientService,
    private readonly geminiClient: GeminiClientService,
    private readonly conversationManager: ConversationManagerService,
    private readonly contextBuilder: ContextBuilderService,
    private readonly modelRouter: ModelRouterService,
  ) {}

  async sendMessage(
    userId: string,
    dto: SendMessageDto,
  ): Promise<ChatResponseDto> {
    const { conversationId, messages, context, selectedModel } =
      await this.prepareConversation(userId, dto);

    const { provider, reason } = selectedModel;
    const startTime = dayjs();

    const { response, tokensUsed } = await (async () => {
      try {
        return provider === 'gemini'
          ? await this.geminiClient.chat(
              context.systemPrompt,
              this.convertToGeminiFormat(messages),
            )
          : await this.ollamaClient.chat(messages);
      } catch (error) {
        this.logger.error(
          'Primary model failed, falling back to Ollama:',
          error,
        );
        return await this.ollamaClient.chat(messages);
      }
    })();

    const responseTimeMs = dayjs().diff(startTime, 'millisecond');

    const messageId = await this.conversationManager.addMessage(
      conversationId,
      MessageRole.assistant,
      response,
      {
        ...context.metadata,
        modelUsed: provider,
        modelReason: reason,
      },
      tokensUsed,
      responseTimeMs,
    );

    this.logger.log(
      `Message processed in ${responseTimeMs}ms (${tokensUsed} tokens) using ${provider.toUpperCase()}`,
    );

    return {
      conversationId,
      messageId,
      response,
      tokensUsed,
      responseTimeMs,
    };
  }

  handleStreamResponse(
    userId: string,
    dto: SendMessageDto,
    res: Response,
  ): void {
    res.setHeader('Content-Type', 'text/event-stream');
    res.setHeader('Cache-Control', 'no-cache');
    res.setHeader('Connection', 'keep-alive');
    res.setHeader('X-Accel-Buffering', 'no');

    const subscription = this.streamMessage(userId, dto).subscribe({
      next: (data) => res.write(`data: ${JSON.stringify(data)}\n\n`),
      error: (err: Error) => {
        this.logger.error('Stream error:', err);
        res.write(
          `data: ${JSON.stringify({
            type: 'error',
            message: err.message || 'Stream failed',
          })}\n\n`,
        );
        res.end();
      },
      complete: () => res.end(),
    });

    res.on('close', () => {
      subscription.unsubscribe();
      this.logger.log('Client disconnected, subscription cleaned up');
    });
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
    modelUsed?: string;
  }> {
    return new Observable((subscriber) => {
      const startTime = dayjs();
      const responseBuilder = { current: '' };

      this.prepareConversation(userId, dto)
        .then(({ conversationId, messages, context, selectedModel }) => {
          const { provider, reason } = selectedModel;

          subscriber.next({
            type: 'start',
            conversationId,
            modelUsed: provider,
          });

          const stream = (() => {
            try {
              return provider === 'gemini'
                ? this.geminiClient.chatStream(
                    context.systemPrompt,
                    this.convertToGeminiFormat(messages),
                  )
                : this.ollamaClient.chatStream(messages);
            } catch (error) {
              this.logger.error(
                'Primary model failed, falling back to Ollama:',
                error,
              );
              return this.ollamaClient.chatStream(messages);
            }
          })();

          stream.subscribe({
            next: (chunk) => {
              responseBuilder.current += chunk;
              subscriber.next({ type: 'chunk', content: chunk });
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
                  responseBuilder.current,
                  {
                    ...context.metadata,
                    modelUsed: provider,
                    modelReason: reason,
                  },
                  undefined,
                  responseTimeMs,
                )
                .then(() => {
                  subscriber.next({
                    type: 'end',
                    responseTimeMs,
                    modelUsed: provider,
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

  async healthCheck(): Promise<Omit<HealthStatusDto, 'status'>> {
    const [ollamaHealthy, geminiHealthy] = await Promise.all([
      this.ollamaClient.healthCheck(),
      this.geminiClient.healthCheck(),
    ]);

    return {
      ollama: ollamaHealthy,
      gemini: geminiHealthy,
    };
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

    const selectedModel = this.modelRouter.selectModel(
      dto.message,
      this.geminiClient.isAvailable(),
    );

    this.modelRouter.logSelection(selectedModel, dto.message);

    const messages: OllamaChatMessage[] = [
      { role: 'system', content: context.systemPrompt },
      ...history.map(
        ({ role, content }): OllamaChatMessage => ({
          role,
          content,
        }),
      ),
    ];

    return { conversationId, messages, context, selectedModel };
  }

  private convertToGeminiFormat(
    messages: OllamaChatMessage[],
  ): GeminiChatMessage[] {
    return messages
      .filter(({ role }) => role !== 'system')
      .map(({ role, content }) => ({
        role: role === 'assistant' ? 'model' : 'user',
        parts: [{ text: content }],
      }));
  }

  async listGeminiModels() {
    return await this.geminiClient.listAvailableModels();
  }
}
