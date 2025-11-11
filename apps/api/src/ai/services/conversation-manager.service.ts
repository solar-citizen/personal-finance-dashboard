import { Injectable, Logger, NotFoundException } from '@nestjs/common';
import { createId } from '@paralleldrive/cuid2';
import { MessageRole } from '@prisma/client';
import {
  ConversationDto,
  ConversationListItemDto,
  FinancialContextMetadataDto,
  MessageDto,
} from 'src/@generated/zod/pfd-dtos';
import { ConfigService } from 'src/config/config.service';
import { PrismaService } from '../../db/prisma.service';
import { OllamaClientService } from './ollama-client.service';

@Injectable()
export class ConversationManagerService {
  private readonly logger = new Logger(ConversationManagerService.name);
  private readonly maxHistoryMessages: number;

  constructor(
    private readonly prismaService: PrismaService,
    private readonly configService: ConfigService,
    private readonly ollamaClient: OllamaClientService,
  ) {
    this.maxHistoryMessages = this.configService.llmMaxHistoryMessages;
  }

  async createConversation(
    userId: string,
    firstMessage: string,
  ): Promise<string> {
    const conversation = await this.prismaService.conversation.create({
      data: {
        userId,
        title: this.generateTitle(firstMessage),
      },
    });

    this.logger.log(
      `Created conversation ${conversation.id} for user ${userId}`,
    );

    return conversation.id;
  }

  async getOrCreateConversation(
    userId: string,
    conversationId?: string,
    firstMessage?: string,
  ): Promise<string> {
    if (conversationId) {
      const exists = await this.prismaService.conversation.findFirst({
        where: { id: conversationId, userId },
      });

      if (!exists) {
        throw new NotFoundException('Conversation not found');
      }

      return conversationId;
    }

    return this.createConversation(userId, firstMessage || 'New conversation');
  }

  async addMessage(
    conversationId: string,
    role: MessageRole,
    content: string,
    contextUsed?: FinancialContextMetadataDto,
    tokensUsed?: number,
    responseTimeMs?: number,
  ): Promise<string> {
    const embedding = await this.ollamaClient.generateEmbedding(content);
    const embeddingVector = `[${embedding.join(',')}]`;

    const messageId = createId();

    await this.prismaService.$executeRaw`
    INSERT INTO "Message" (
      id, "conversationId", role, content, embedding, 
      "contextUsed", "tokensUsed", "responseTimeMs", "createdAt"
    )
    VALUES (
      ${messageId},
      ${conversationId},
      ${role}::"MessageRole",
      ${content},
      ${embeddingVector}::vector,
      ${contextUsed ? JSON.stringify(contextUsed) : null}::jsonb,
      ${tokensUsed},
      ${responseTimeMs},
      NOW()
    )
  `;

    await this.prismaService.conversation.update({
      where: { id: conversationId },
      data: { updatedAt: new Date() },
    });

    this.logger.log(
      `Saved message ${messageId} with embedding (${embedding.length} dimensions)`,
    );

    return messageId;
  }

  async findSimilarMessages(
    conversationId: string,
    query: string,
    limit = 5,
  ): Promise<Array<{ id: string; content: string; similarity: number }>> {
    const queryEmbedding = await this.ollamaClient.generateEmbedding(query);
    const embeddingVector = `[${queryEmbedding.join(',')}]`;

    const results = await this.prismaService.$queryRaw<
      Array<{ id: string; content: string; similarity: number }>
    >`
      SELECT 
        id,
        content,
        1 - (embedding <=> ${embeddingVector}::vector) as similarity
      FROM "Message"
      WHERE "conversationId" = ${conversationId}
        AND embedding IS NOT NULL
        AND role = 'user'::"MessageRole"
      ORDER BY embedding <=> ${embeddingVector}::vector
      LIMIT ${limit}
    `;

    this.logger.log(
      `Found ${results.length} similar messages for query: "${query.substring(0, 50)}..."`,
    );

    return results;
  }

  async getConversationHistory(
    conversationId: string,
    userId: string,
  ): Promise<Array<{ role: MessageRole; content: string }>> {
    const conversation = await this.prismaService.conversation.findFirst({
      where: { id: conversationId, userId },
      include: {
        messages: {
          orderBy: { createdAt: 'desc' },
          take: this.maxHistoryMessages,
          select: {
            role: true,
            content: true,
          },
        },
      },
    });

    if (!conversation) {
      throw new NotFoundException('Conversation not found');
    }

    // Reverse to get chronological order (oldest first)
    return conversation.messages.reverse();
  }

  async getConversation(
    conversationId: string,
    userId: string,
  ): Promise<ConversationDto> {
    const conversation = await this.prismaService.conversation.findFirst({
      where: { id: conversationId, userId },
      include: {
        messages: {
          orderBy: { createdAt: 'asc' },
          select: {
            id: true,
            role: true,
            content: true,
            createdAt: true,
          },
        },
      },
    });

    if (!conversation) {
      throw new NotFoundException('Conversation not found');
    }

    return {
      id: conversation.id,
      title: conversation.title,
      messages: conversation.messages.map(
        ({ id, role, content, createdAt }): MessageDto => ({
          id,
          role,
          content,
          createdAt: createdAt.toISOString(),
        }),
      ),
      createdAt: conversation.createdAt.toISOString(),
      updatedAt: conversation.updatedAt.toISOString(),
    };
  }

  async listConversations(userId: string): Promise<ConversationListItemDto[]> {
    const conversations = await this.prismaService.conversation.findMany({
      where: { userId },
      orderBy: { updatedAt: 'desc' },
      include: {
        messages: {
          orderBy: { createdAt: 'desc' },
          take: 1,
          select: { content: true },
        },
        _count: {
          select: { messages: true },
        },
      },
    });

    return conversations.map(
      ({ id, title, messages, _count, createdAt, updatedAt }) => ({
        id,
        title,
        lastMessage: messages[0]?.content || null,
        messageCount: _count.messages,
        createdAt: createdAt.toISOString(),
        updatedAt: updatedAt.toISOString(),
      }),
    );
  }

  async deleteConversation(
    conversationId: string,
    userId: string,
  ): Promise<void> {
    const conversation = await this.prismaService.conversation.findFirst({
      where: { id: conversationId, userId },
    });

    if (!conversation) {
      throw new NotFoundException('Conversation not found');
    }

    await this.prismaService.conversation.delete({
      where: { id: conversationId },
    });

    this.logger.log(`Deleted conversation ${conversationId}`);
  }

  private generateTitle(message: string): string {
    const maxLength = 50;
    const cleaned = message.trim().replace(/\s+/g, ' ');

    if (cleaned.length <= maxLength) {
      return cleaned;
    }

    return cleaned.substring(0, maxLength).trim() + '...';
  }
}
