import { Injectable, Logger } from '@nestjs/common';
import { formatEmbeddingVector } from 'src/_lib/utils/vector.util';

import { PrismaService } from '../../../db/prisma.service';
import { OllamaClientService } from '../ollama-client.service';
import { KnowledgeBaseEntry } from './context-builder.types';

@Injectable()
export class KnowledgeBaseService {
  private readonly logger = new Logger(KnowledgeBaseService.name);

  constructor(
    private readonly prismaService: PrismaService,
    private readonly ollamaClient: OllamaClientService,
  ) {}

  async findRelevantKnowledge(
    query: string,
    limit = 3,
  ): Promise<KnowledgeBaseEntry[]> {
    try {
      const embeddingVector = formatEmbeddingVector(
        await this.ollamaClient.generateEmbedding(query),
      );

      const results = await this.prismaService.$queryRaw<KnowledgeBaseEntry[]>`
        SELECT 
          content,
          1 - (embedding <=> ${embeddingVector}::vector) as similarity
        FROM "KnowledgeBase"
        WHERE 1 - (embedding <=> ${embeddingVector}::vector) > 0.7
        ORDER BY embedding <=> ${embeddingVector}::vector
        LIMIT ${limit}
      `;

      this.logger.log(
        `Found ${results.length} relevant knowledge entries for: "${query.substring(0, 50)}..."`,
      );

      return results;
    } catch (err: unknown) {
      this.logger.warn('Knowledge base search failed:', err);

      return [];
    }
  }
}
