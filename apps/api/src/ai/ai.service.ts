import { Injectable, Logger } from '@nestjs/common';
import type { StreamResponse } from '@pfd/shared';
import dayjs from 'dayjs';
import { Response } from 'express';
import { Observable } from 'rxjs';
import { MessageRole } from 'src/_generated/prisma-client/client';
import {
  ChatResponseDto,
  HealthStatusDto,
  SendMessageDto,
} from 'src/_generated/zod/pfd-dtos';

import { ContextBuilderService } from './services/context-builder/context-builder.service';
import { ConversationManagerService } from './services/conversation-manager.service';
import {
  type GeminiChatMessage,
  GeminiClientService,
} from './services/gemini-client.service';
import {
  OllamaChatMessage,
  OllamaClientService,
} from './services/ollama-client.service';
import { QueryStrategyService } from './services/query-strategy.service';

@Injectable()
export class AiService {
  private readonly logger = new Logger(AiService.name);

  constructor(
    private readonly ollamaClient: OllamaClientService,
    private readonly geminiClient: GeminiClientService,
    private readonly conversationManager: ConversationManagerService,
    private readonly contextBuilder: ContextBuilderService,
    private readonly queryStrategy: QueryStrategyService,
  ) {}

  async sendMessage(
    userId: string,
    dto: SendMessageDto,
  ): Promise<ChatResponseDto> {
    const {
      conversationId,
      messages,
      context,
      selectedModel,
      isLockedToGemini,
    } = await this.prepareConversation(userId, dto);

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
      } catch (err: unknown) {
        if (isLockedToGemini) {
          throw err;
        }

        this.logger.error('Primary model failed, falling back to Ollama:', err);
        return await this.ollamaClient.chat(messages);
      }
    })();

    const responseTimeMs = dayjs().diff(startTime, 'millisecond');

    const messageId = await this.conversationManager.addMessage({
      conversationId,
      role: MessageRole.assistant,
      content: response,
      contextUsed: {
        ...context.metadata,
        modelUsed: provider,
        modelReason: reason,
      },
      tokensUsed,
      responseTimeMs,
    });

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

  streamChat(userId: string, dto: SendMessageDto, res: Response): void {
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
  ): Observable<StreamResponse> {
    return new Observable((subscriber) => {
      const startTime = dayjs();
      let accumulatedResponse = '';

      this.prepareConversation(userId, dto)
        .then(
          ({
            conversationId,
            messages,
            context,
            selectedModel,
            isLockedToGemini,
          }) => {
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
              } catch (err: unknown) {
                if (isLockedToGemini) {
                  throw err;
                }

                this.logger.error(
                  'Primary model failed, falling back to Ollama:',
                  err,
                );
                return this.ollamaClient.chatStream(messages);
              }
            })();

            stream.subscribe({
              next: (chunk) => {
                accumulatedResponse += chunk;
                subscriber.next({ type: 'chunk', content: chunk });
              },
              error: (err: unknown) => {
                this.logger.error('Stream error:', err);
                subscriber.error(err);
              },
              complete: () => {
                const responseTimeMs = dayjs().diff(startTime, 'millisecond');

                this.conversationManager
                  .addMessage({
                    conversationId,
                    role: MessageRole.assistant,
                    content: accumulatedResponse,
                    contextUsed: {
                      ...context.metadata,
                      modelUsed: provider,
                      modelReason: reason,
                    },
                    tokensUsed: undefined,
                    responseTimeMs,
                  })
                  .then(() => {
                    subscriber.next({
                      type: 'end',
                      responseTimeMs,
                      modelUsed: provider,
                    });
                    subscriber.complete();
                  })
                  .catch((err: unknown) => {
                    this.logger.error('Complete handler error:', err);
                    subscriber.error(err);
                  });
              },
            });
          },
        )
        .catch((err: unknown) => {
          this.logger.error('Stream setup error:', err);
          subscriber.error(err);
        });
    });
  }

  async getConversation(conversationId: string, userId: string) {
    return await this.conversationManager.getConversation(
      conversationId,
      userId,
    );
  }

  async getConversationsList(userId: string) {
    return await this.conversationManager.getConversationsList(userId);
  }

  async deleteConversation(conversationId: string, userId: string) {
    return await this.conversationManager.deleteConversation(
      conversationId,
      userId,
    );
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

    const isLockedToGemini = dto.conversationId
      ? await this.conversationManager.isConversationLockedToGemini(
          conversationId,
          userId,
        )
      : false;

    const { contextLevel, provider, reason, type, dateRange } =
      this.queryStrategy.analyzeQuery(
        dto.message,
        this.geminiClient.isAvailable(),
        isLockedToGemini,
      );

    this.queryStrategy.logStrategy(
      { provider, contextLevel, reason, type },
      dto.message,
    );

    await this.conversationManager.addMessage({
      conversationId,
      role: MessageRole.user,
      content: dto.message,
    });

    if (!dateRange) {
      this.logger.debug(
        `No date range parsed, falling back to default window: "${dto.message.slice(0, 50)}"`,
      );
    }

    const [context, history] = await Promise.all([
      this.contextBuilder.buildContext({
        userId,
        userMessage: dto.message,
        contextLevel,
        dateRange,
      }),
      this.conversationManager.getConversationHistory(conversationId, userId),
    ]);

    const messages: OllamaChatMessage[] = [
      { role: 'system', content: context.systemPrompt },
      ...history.map(({ role, content }): OllamaChatMessage => ({
        role,
        content,
      })),
    ];

    return {
      conversationId,
      messages,
      context,
      selectedModel: {
        provider,
        reason,
      },
      isLockedToGemini,
    };
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
