import { Injectable, Logger, NotFoundException } from '@nestjs/common';
import { createId } from '@paralleldrive/cuid2';
import { MessageRole } from '@prisma/client';
import dayjs from 'dayjs';
import {
  ConversationDto,
  ConversationListItemDto,
  FinancialContextMetadataDto,
  MessageDto,
} from 'src/@generated/zod/pfd-dtos';
import { ConfigService } from 'src/config/config.service';
import { formatDateToIso } from 'src/lib/utils/date.util';
import { formatEmbeddingVector } from 'src/lib/utils/vector.util';
import { PrismaService } from '../../db/prisma.service';
import { OllamaClientService } from './ollama-client.service';

type SimilarMessage = {
  id: string;
  content: string;
  similarity: number;
};

type MessageHistoryItem = {
  role: MessageRole;
  content: string;
};

type LastMessagePreview = {
  content: string;
};

type MessageCount = {
  messages: number;
};

type ConversationWithMessagesAndCount = {
  id: string;
  title: string | null;
  messages: LastMessagePreview[];
  _count: MessageCount;
  createdAt: Date;
  updatedAt: Date;
};

type AddMessageArgs = {
  conversationId: string;
  role: MessageRole;
  content: string;
  contextUsed?: FinancialContextMetadataDto;
  tokensUsed?: number;
  responseTimeMs?: number;
};

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
      await this.validateConversationExists(conversationId, userId);
      return conversationId;
    }

    return this.createConversation(userId, firstMessage || 'New conversation');
  }

  async addMessage({
    conversationId,
    role,
    content,
    contextUsed,
    tokensUsed,
    responseTimeMs,
  }: AddMessageArgs): Promise<string> {
    const messageId = createId();

    await this.prismaService.$executeRaw`
      INSERT INTO "Message" (
        id, "conversationId", role, content, 
        "contextUsed", "tokensUsed", "responseTimeMs", "createdAt"
      )
      VALUES (
        ${messageId},
        ${conversationId},
        ${role}::"MessageRole",
        ${content},
        ${contextUsed ? JSON.stringify(contextUsed) : null}::jsonb,
        ${tokensUsed},
        ${responseTimeMs},
        NOW()
      )
    `;

    await this.prismaService.conversation.update({
      where: { id: conversationId },
      data: { updatedAt: dayjs().toDate() },
    });

    this.generateAndUpdateEmbedding(messageId, content).catch((error) => {
      this.logger.error(
        `Failed to generate embedding for ${messageId}:`,
        error,
      );
    });

    return messageId;
  }

  async findSimilarMessages(
    conversationId: string,
    query: string,
    limit = 5,
  ): Promise<SimilarMessage[]> {
    const queryEmbedding = await this.ollamaClient.generateEmbedding(query);
    const embeddingVector = formatEmbeddingVector(queryEmbedding);

    const results = await this.prismaService.$queryRaw<SimilarMessage[]>`
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
  ): Promise<MessageHistoryItem[]> {
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
          createdAt: formatDateToIso(createdAt),
        }),
      ),
      createdAt: formatDateToIso(conversation.createdAt),
      updatedAt: formatDateToIso(conversation.updatedAt),
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

    return conversations.map((conversation) =>
      this.mapToConversationListItemDto(conversation),
    );
  }

  async deleteConversation(
    conversationId: string,
    userId: string,
  ): Promise<void> {
    await this.validateConversationExists(conversationId, userId);

    await this.prismaService.conversation.delete({
      where: { id: conversationId },
    });

    this.logger.log(`Deleted conversation ${conversationId}`);
  }

  private async generateAndUpdateEmbedding(
    messageId: string,
    content: string,
  ): Promise<void> {
    try {
      const embedding = await this.ollamaClient.generateEmbedding(content);
      const embeddingVector = formatEmbeddingVector(embedding);

      await this.prismaService.$executeRaw`
        UPDATE "Message"
        SET embedding = ${embeddingVector}::vector
        WHERE id = ${messageId}
      `;

      this.logger.log(
        `Updated embedding for message ${messageId} (${embedding.length} dimensions)`,
      );
    } catch (err) {
      this.logger.error(
        `Embedding generation failed for message ${messageId}:`,
        err,
      );
    }
  }

  private generateTitle(message: string): string {
    const maxLength = 50;
    const cleaned = message.trim().replace(/\s+/g, ' ');

    if (cleaned.length <= maxLength) {
      return cleaned;
    }

    return `${cleaned.substring(0, maxLength).trim()}...`;
  }

  private async validateConversationExists(
    conversationId: string,
    userId: string,
  ): Promise<void> {
    const exists = await this.prismaService.conversation.findFirst({
      where: { id: conversationId, userId },
    });

    if (!exists) {
      throw new NotFoundException('Conversation not found');
    }
  }

  private mapToConversationListItemDto({
    id,
    title,
    messages,
    _count,
    createdAt,
    updatedAt,
  }: ConversationWithMessagesAndCount): ConversationListItemDto {
    return {
      id,
      title: title ?? 'Untitled Conversation',
      lastMessage: messages[0]?.content || null,
      messageCount: _count.messages,
      createdAt: formatDateToIso(createdAt),
      updatedAt: formatDateToIso(updatedAt),
    };
  }
}
