import { Injectable, Logger } from '@nestjs/common';
import dayjs from 'dayjs';
import { Ollama } from 'ollama';
import { Observable } from 'rxjs';
import { ConfigService } from 'src/config/config.service';

export type OllamaChatMessage = {
  role: 'system' | 'user' | 'assistant';
  content: string;
};

export type OllamaStreamChunk = {
  message: {
    role: string;
    content: string;
  };
  done: boolean;
};

@Injectable()
export class OllamaClientService {
  private readonly logger = new Logger(OllamaClientService.name);
  private readonly ollama: Ollama;
  private readonly chatModel: string;
  private readonly embeddingModel: string;

  constructor(private readonly configService: ConfigService) {
    const host = this.configService.llmHost;
    this.chatModel = this.configService.llmChatModel;
    this.embeddingModel = this.configService.llmEmbeddingModel;
    this.ollama = new Ollama({ host });
    this.logger.log(`Ollama client initialized: ${host}`);
  }

  async chat(messages: OllamaChatMessage[]): Promise<{
    response: string;
    tokensUsed?: number;
  }> {
    const startTime = dayjs();

    try {
      const { message, eval_count } = await this.ollama.chat({
        model: this.chatModel,
        messages,
        stream: false,
      });

      this.logDuration('Chat completed', startTime);

      return {
        response: message.content,
        tokensUsed: eval_count,
      };
    } catch (error) {
      this.logger.error('Ollama chat error:', error);

      return { response: '', tokensUsed: undefined };
    }
  }

  chatStream(messages: OllamaChatMessage[]): Observable<string> {
    return new Observable((subscriber) => {
      const startTime = dayjs();

      (async () => {
        const stream = await this.ollama.chat({
          model: this.chatModel,
          messages,
          stream: true,
        });

        for await (const chunk of stream) {
          if (chunk.message?.content) {
            subscriber.next(chunk.message.content);
          }

          if (chunk.done) {
            this.logDuration('Stream completed', startTime);
            subscriber.complete();
          }
        }
      })().catch((error) => {
        this.logger.error('Uncaught Ollama stream error:', error);
        subscriber.error(error);
      });
    });
  }

  async generateEmbedding(text: string): Promise<number[]> {
    try {
      const response = await this.ollama.embeddings({
        model: this.embeddingModel,
        prompt: text,
      });

      return response.embedding;
    } catch (error) {
      this.logger.error('Embedding generation error:', error);

      return [];
    }
  }

  async healthCheck(): Promise<boolean> {
    try {
      await this.ollama.list();
      return true;
    } catch (error) {
      this.logger.error('Ollama health check failed:', error);
      return false;
    }
  }

  private logDuration(message: string, startTime: dayjs.Dayjs): void {
    const duration = dayjs().diff(startTime);
    this.logger.log(`${message} in ${duration}ms`);
  }
}
